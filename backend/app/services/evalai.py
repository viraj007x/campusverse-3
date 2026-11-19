import io
import json
import math
import re
import statistics

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from ..config import settings
from . import llm as llm_service

MAX_TEXT = 40000

_AI_PHRASES = [
    "in today's rapidly evolving",
    "rapidly evolving landscape",
    "it is important to note",
    "it is worth noting",
    "plays a vital role",
    "plays a crucial role",
    "in conclusion",
    "furthermore",
    "moreover",
    "additionally",
    "consequently",
    "comprehensive",
    "robust",
    "seamless",
    "leverage",
    "leveraging",
    "delve",
    "landscape",
    "multifaceted",
    "underscores",
    "pivotal",
    "transformative",
]
_CONNECTORS = {
    "furthermore",
    "moreover",
    "additionally",
    "consequently",
    "therefore",
    "however",
    "overall",
    "ultimately",
    "notably",
    "crucially",
    "subsequently",
}


def extract_text(filename: str, raw: bytes) -> str:
    name = (filename or "").lower()
    if name.endswith(".pdf"):
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(raw))
        text = "\n".join((page.extract_text() or "") for page in reader.pages)
    else:
        text = raw.decode("utf-8", errors="ignore")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()[:MAX_TEXT]


def _sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+|\n+", text) if len(s.strip().split()) >= 3]


def ai_likelihood(text: str) -> tuple[float, dict]:
    """Stylometric heuristic: uniform sentence rhythm, formulaic discourse, low burstiness."""
    sentences = _sentences(text)
    lengths = [len(s.split()) for s in sentences]
    mean_len = statistics.fmean(lengths) if lengths else 0.0
    stdev = statistics.pstdev(lengths) if len(lengths) > 1 else 0.0
    burstiness = (stdev / mean_len) if mean_len else 1.0

    words = re.findall(r"[A-Za-z']+", text.lower())
    diversity = (len(set(words)) / len(words)) if words else 1.0

    lower = text.lower()
    phrase_hits = sum(1 for phrase in _AI_PHRASES if phrase in lower)
    connector_hits = sum(1 for w in words if w in _CONNECTORS)
    connector_rate = connector_hits / max(1, len(words))
    near_mean = sum(1 for n in lengths if mean_len and abs(n - mean_len) <= 0.2 * mean_len)
    uniformity = near_mean / max(1, len(lengths))

    score = 0.0
    if burstiness < 0.6:
        score += (0.6 - burstiness) / 0.6 * 38
    if diversity < 0.62:
        score += (0.62 - diversity) / 0.62 * 18
    score += min(phrase_hits, 7) * 5.5
    score += min(connector_rate / 0.012, 1.0) * 10
    if uniformity > 0.45:
        score += (uniformity - 0.45) / 0.55 * 16
    if mean_len > 21:
        score += min((mean_len - 21) / 10, 1.0) * 10

    prob = round(max(2.0, min(97.0, score)), 1)
    signals = {
        "burstiness": round(burstiness, 2),
        "sentence_length_mean": round(mean_len, 1),
        "lexical_diversity": round(diversity, 2),
        "uniform_sentence_ratio": round(uniformity, 2),
        "formulaic_phrases": phrase_hits,
        "connectors_per_100_words": round(connector_rate * 100, 1),
        "sentences": len(sentences),
    }
    return prob, signals


def plagiarism(text: str, peers: list[tuple[int, str, str]], threshold: float = 0.18) -> tuple[float, list[dict]]:
    """Peer-to-peer similarity with word + character n-grams to catch paraphrase, not just copy-paste."""
    if not peers:
        return 0.0, []
    corpus = [text] + [p[2] for p in peers]
    word_vec = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), sublinear_tf=True)
    char_vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(4, 5), sublinear_tf=True, min_df=1)
    word_sim = cosine_similarity(word_vec.fit_transform(corpus)[0:1], word_vec.transform(corpus)[1:]).ravel()
    char_sim = cosine_similarity(char_vec.fit_transform(corpus)[0:1], char_vec.transform(corpus)[1:]).ravel()
    sims = (word_sim * 0.45 + char_sim * 0.55)
    matches = []
    for peer, sim in zip(peers, sims):
        if sim >= threshold:
            matches.append(
                {"student_id": peer[0], "student_name": peer[1], "similarity": round(float(sim) * 100, 1)}
            )
    matches.sort(key=lambda m: m["similarity"], reverse=True)
    pct = round(float(max(sims)) * 100, 1) if len(sims) else 0.0
    return pct, matches[:3]


def _keywords(text: str, limit: int = 14) -> list[str]:
    try:
        vec = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), token_pattern=r"(?u)\b[a-zA-Z][a-zA-Z\-]{2,}\b")
        matrix = vec.fit_transform([text])
        terms = vec.get_feature_names_out()
        scores = matrix.toarray()[0]
        order = scores.argsort()[::-1]
        return [terms[i] for i in order[: limit * 2] if len(terms[i]) > 3][:limit]
    except ValueError:
        return []


def _coverage(terms: list[str], haystack: str) -> tuple[float, list[str]]:
    if not terms:
        return 0.0, []
    missing = [t for t in terms if t not in haystack]
    return (len(terms) - len(missing)) / len(terms), missing


_WEAK_QUALIFIERS = {
    "concrete",
    "precise",
    "exact",
    "clear",
    "specific",
    "general",
    "basic",
    "strong",
    "weak",
    "good",
    "better",
    "best",
    "main",
    "key",
    "important",
    "justified",
    "readable",
}


def _clean_terms(terms: list[str], limit: int = 2) -> list[str]:
    """Keep readable key phrases: drop adjective fragments, nested duplicates and junk bigrams."""
    unigrams: list[str] = []
    bigrams: list[str] = []
    for raw in terms:
        term = raw.strip(" .,;:")
        if not term:
            continue
        words = term.replace("—", " ").replace("/", " ").split()
        if len(words) == 1:
            if len(term) >= 3 and term.lower() not in _WEAK_QUALIFIERS:
                unigrams.append(term)
        elif len(words) == 2:
            if words[0].lower() in _WEAK_QUALIFIERS or words[-1].lower() in _WEAK_QUALIFIERS:
                continue
            if words[-1].lower().endswith(("ed", "ful", "ous")):
                continue
            if all(len(w) >= 4 for w in words):
                bigrams.append(term)

    picked: list[str] = []
    for term in sorted(set(bigrams), key=len, reverse=True) + sorted(set(unigrams), key=len, reverse=True):
        words = term.split()
        if any(term in other.split() or words[0] in other.split() for other in picked):
            continue
        picked.append(term)
        if len(picked) >= limit:
            break
    return picked


_PROPER_NOUNS = {
    "docker",
    "kubernetes",
    "python",
    "java",
    "javascript",
    "typescript",
    "aws",
    "azure",
    "gcp",
    "sql",
    "linux",
    "windows",
    "transformers",
    "transformer",
    "bert",
    "gpt",
    "numpy",
    "pandas",
    "pytorch",
    "tensorflow",
}


def _mid_sentence(term: str) -> str:
    """Lowercase a leading common word when a rubric phrase is reused inside a sentence."""
    first, _, rest = term.partition(" ")
    if first.lower() in _PROPER_NOUNS or not first[:1].isupper():
        return term
    return first[:1].lower() + first[1:] + (" " + rest if rest else "")


def _rubric_concepts(description: str) -> list[str]:
    """Split a rubric description into the concepts the faculty member expects."""
    parts = re.split(r",|;|\band\b|\bvs\.?\b", description or "")
    concepts: list[str] = []
    for part in parts:
        words = part.strip(" .,:;–-").split()
        while words and words[0].lower() in _WEAK_QUALIFIERS:
            words.pop(0)
        phrase = " ".join(words).strip(" .,:;–-")
        if phrase and phrase.lower() not in {c.lower() for c in concepts}:
            concepts.append(phrase)
    return concepts


def _missing_concepts(description: str, text: str) -> tuple[list[str], list[str]]:
    concepts = _rubric_concepts(description)
    tokens = set(re.findall(r"[a-z0-9\-]+", text.lower()))
    missing = [
        c
        for c in concepts
        if not all(w in tokens for w in re.findall(r"[a-z0-9\-]+", c.lower()))
    ]
    return concepts, missing


def _structure_score(text: str) -> float:
    score = 0.0
    if "\n\n" in text:
        score += 0.3
    if re.search(r"^\s*[-*\d]+[\.)]\s", text, re.M):
        score += 0.25
    if re.search(r"[{};`]|def |class |import ", text):
        score += 0.25
    if len(re.findall(r"[.!?]", text)) >= 5:
        score += 0.2
    return min(1.0, score)


def offline_grade(text: str, prompt: str, reference: str, rubric: list[dict]) -> dict:
    """Deterministic rubric grading used when no LLM key is configured (and as a fallback)."""
    reference_text = reference.strip() or prompt.strip()
    words = len(text.split())
    target_words = max(160, int(len(reference_text.split()) * 0.65))

    if words < 5:
        criteria = [
            {
                "criterion": item.get("criterion", "Criterion"),
                "max": float(item.get("max", 1) or 1),
                "score": 0.0,
                "comment": "No substantive answer was submitted for this criterion.",
            }
            for item in rubric
        ]
        maximum_total = sum(c["max"] for c in criteria)
        return {
            "summary": (
                f"No assessable answer was submitted ({words} word{'s' if words != 1 else ''}), "
                f"so the submission scores 0 of {maximum_total:g}."
            ),
            "criteria": criteria,
            "strengths": [],
            "improvements": ["Submit a complete answer that addresses each rubric criterion before requesting a grade."],
            "mode": "offline",
        }

    try:
        vec = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), sublinear_tf=True)
        matrix = vec.fit_transform([reference_text, text])
        relevance = float(cosine_similarity(matrix[0:1], matrix[1:2])[0][0])
    except ValueError:
        relevance = 0.0

    concepts = _keywords(reference_text, 18)
    lower = text.lower()
    coverage, missing = _coverage(concepts, lower)
    depth = min(1.0, words / target_words)
    structure = _structure_score(text)

    base = 0.38 + 0.30 * relevance + 0.22 * coverage + 0.10 * depth - 0.06 * (1 - structure)

    rubric_missing: list[str] = []
    for item in rubric:
        for term in _missing_concepts(item.get("description", ""), text)[1]:
            if term.lower() not in {t.lower() for t in rubric_missing}:
                rubric_missing.append(term)

    criteria = []
    for item in rubric:
        criterion = item.get("criterion", "Criterion")
        maximum = float(item.get("max", 1) or 1)
        description = item.get("description", "")
        crit_terms = _keywords(f"{criterion} {description}", 6)
        concept_list, concept_missing = _missing_concepts(description, text)
        if concept_list:
            crit_cov = (len(concept_list) - len(concept_missing)) / len(concept_list)
            crit_missing = concept_missing
        else:
            crit_cov, crit_missing = _coverage(crit_terms, lower) if crit_terms else (coverage, [])
        frac = max(0.28, min(0.96, 0.55 * base + 0.28 * crit_cov + 0.17 * coverage))

        score = round(maximum * frac * 2) / 2

        name = criterion.lower()
        if frac >= 0.72 and crit_cov >= 0.6:
            comment = f"Solid {name}: the expected concepts are covered with relevant detail."
        elif crit_missing:
            if "recommend" in name or "justif" in name:
                comment = (
                    f"{criterion} is only partially met. Close with a clear recommendation and "
                    "justify it against the scenario."
                )
            else:
                focus = [_mid_sentence(t) for t in crit_missing[:2]]
                verb = (
                    "Tighten"
                    if any(k in name for k in ("clarity", "writing", "presentation", "structure", "style"))
                    else "Strengthen"
                )
                comment = (
                    f"{criterion} is only partially met. {verb} the treatment of "
                    + " and ".join(focus)
                    + "."
                )
        elif frac < 0.5:
            comment = f"{criterion} is mentioned but not developed; explain the reasoning behind it."
        else:
            comment = f"{criterion} is addressed but stays high-level; tie it to a concrete example."

        criteria.append(
            {
                "criterion": criterion,
                "max": maximum,
                "score": min(score, maximum),
                "comment": comment,
            }
        )

    total = round(sum(c["score"] for c in criteria), 1)
    maximum_total = sum(c["max"] for c in criteria) or 1
    pct = total / maximum_total
    strengths = []
    if relevance >= 0.25:
        strengths.append("Stays close to the reference line of reasoning.")
    if coverage >= 0.5:
        strengths.append("Covers the core concepts expected for this assignment.")
    if words >= target_words:
        strengths.append("Provides sufficient depth and detail.")
    if structure >= 0.5:
        strengths.append("Readable structure with paragraphs or lists.")
    if not strengths:
        strengths.append("Attempts the task and gives a starting point to build on.")

    improvements = []
    if relevance < 0.2:
        improvements.append("Tie the answer more directly to the assignment's core argument.")
    if coverage < 0.5:
        focus = rubric_missing[:4] or _clean_terms(missing, 4)
        if focus:
            improvements.append("Cover the missing concepts: " + ", ".join(_mid_sentence(t) for t in focus) + ".")
        else:
            improvements.append("Cover the concepts the brief asks for, not just the topic in general.")
    if words < target_words:
        improvements.append(f"Expand the response — around {target_words} words is expected.")
    if structure < 0.4:
        improvements.append("Break the text into clear paragraphs or bullet points.")
    if not improvements:
        improvements.append("Add concrete examples or evaluation numbers to push into the top band.")

    weakest = min(criteria, key=lambda c: c["score"] / c["max"] if c["max"] else 1.0, default=None)
    strongest = max(criteria, key=lambda c: c["score"] / c["max"] if c["max"] else 0.0, default=None)
    if pct >= 0.85:
        verdict = "an excellent"
    elif pct >= 0.7:
        verdict = "a solid"
    elif pct >= 0.55:
        verdict = "a competent"
    elif pct >= 0.4:
        verdict = "a partial"
    else:
        verdict = "a limited"

    summary = (
        f"The submission scores {total} of {maximum_total:g} marks ({pct:.0%}) — {verdict} result against the rubric. "
        + ("It is grounded in the reference material. " if relevance >= 0.2 else "It drifts from the expected answer. ")
        + (
            "Coverage of the key concepts is strong. "
            if coverage >= 0.5
            else "Key concepts are only partially covered. "
        )
    )
    if weakest and strongest and weakest is not strongest:
        summary += (
            f"The best-scoring criterion is {strongest['criterion'].lower()} "
            f"({strongest['score']:g}/{strongest['max']:g}); the weakest is {weakest['criterion'].lower()} "
            f"({weakest['score']:g}/{weakest['max']:g})."
        )

    return {
        "summary": summary.strip(),
        "criteria": criteria,
        "strengths": strengths[:3],
        "improvements": improvements[:3],
        "mode": "offline",
    }


async def llm_grade(
    text: str, prompt: str, reference: str, rubric: list[dict], plagiarism_pct: float, ai_probability: float
) -> dict:
    rubric_lines = "\n".join(
        f"- {r.get('criterion')}: max {r.get('max')} marks. {r.get('description', '')}" for r in rubric
    )
    system = (
        "You are EvalAI, a strict but fair teaching assistant grading an assignment against a rubric. "
        "Grade only what the submission actually demonstrates. Never award full marks for vague text. "
        "The integrity signals are hints: high plagiarism or AI-likelihood should not by itself lower the academic "
        "score, but mention them in the summary when notable. "
        "Respond with STRICT JSON only, no markdown, exactly this shape: "
        '{"summary": "...", "strengths": ["..."], "improvements": ["..."], '
        '"criteria": [{"criterion": "...", "max": 5, "score": 4.5, "comment": "..."}]} '
        "Every criterion from the rubric must appear exactly once, score in half-mark steps and never above max."
    )
    user = (
        f"ASSIGNMENT\n{prompt}\n\n"
        f"REFERENCE ANSWER (for grounding, do not copy verbatim)\n{reference}\n\n"
        f"RUBRIC\n{rubric_lines}\n\n"
        f"INTEGRITY SIGNALS\nPeer similarity: {plagiarism_pct}% | AI-writing likelihood: {ai_probability}%\n\n"
        f"STUDENT SUBMISSION\n{text[:12000]}"
    )
    raw = await llm_service.complete(
        [{"role": "system", "content": system}, {"role": "user", "content": user}], temperature=0.1, max_tokens=1100
    )
    data = llm_service.extract_json(raw)
    if not isinstance(data, dict) or not isinstance(data.get("criteria"), list):
        raise ValueError("LLM did not return the expected JSON")

    graded = []
    seen = set()
    for expected in rubric:
        match = next(
            (c for c in data["criteria"] if str(c.get("criterion", "")).strip().lower() == expected["criterion"].strip().lower()),
            None,
        )
        maximum = float(expected.get("max", 1) or 1)
        if match is None:
            match = next((c for c in data["criteria"] if c.get("criterion") not in seen), {"score": maximum * 0.6, "comment": ""})
        seen.add(match.get("criterion"))
        score = float(match.get("score", maximum * 0.6) or 0)
        score = round(max(0.0, min(maximum, score)) * 2) / 2
        graded.append(
            {
                "criterion": expected["criterion"],
                "max": maximum,
                "score": score,
                "comment": str(match.get("comment", ""))[:400],
            }
        )

    return {
        "summary": str(data.get("summary", ""))[:900],
        "criteria": graded,
        "strengths": [str(s)[:200] for s in (data.get("strengths") or [])][:3],
        "improvements": [str(s)[:200] for s in (data.get("improvements") or [])][:3],
        "mode": settings.llm_mode,
    }


async def grade_submission(
    text: str,
    prompt: str,
    reference: str,
    rubric: list[dict],
    plagiarism_pct: float,
    ai_probability: float,
) -> dict:
    if settings.llm_mode != "offline":
        try:
            return await llm_grade(text, prompt, reference, rubric, plagiarism_pct, ai_probability)
        except Exception:
            pass
    return offline_grade(text, prompt, reference, rubric)


def total_of(criteria: list[dict]) -> float:
    return round(sum(float(c.get("score", 0) or 0) for c in criteria), 1)
