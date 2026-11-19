import hashlib
import re
import threading
from pathlib import Path

from ..config import settings

_lock = threading.Lock()
_collection = None
_bm25_cache: dict = {"key": None, "bm25": None, "ids": [], "docs": [], "metas": []}
_state = {"indexing": False, "last_report": None}


def get_collection():
    global _collection
    if _collection is None:
        import chromadb
        from chromadb.utils import embedding_functions

        ef = embedding_functions.SentenceTransformerEmbeddingFunction(model_name=settings.embedding_model)
        client = chromadb.PersistentClient(path=str(settings.chroma_dir))
        _collection = client.get_or_create_collection(
            "campus_docs", embedding_function=ef, metadata={"hnsw:space": "cosine"}
        )
    return _collection


def _extract_pages(path: Path) -> list[tuple[int, str]]:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        from pypdf import PdfReader

        reader = PdfReader(str(path))
        pages = []
        for i, page in enumerate(reader.pages, start=1):
            try:
                text = page.extract_text() or ""
            except Exception:
                text = ""
            text = re.sub(r"[ \t]+", " ", text)
            if text.strip():
                pages.append((i, text.strip()))
        return pages
    text = path.read_text(encoding="utf-8", errors="ignore")
    return [(1, text.strip())] if text.strip() else []


def _chunk_text(text: str, size: int = 760, overlap: int = 140) -> list[str]:
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= size:
        return [text] if text else []
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        if end < len(text):
            boundary = max(text.rfind(". ", start + size // 2, end), text.rfind("; ", start + size // 2, end))
            if boundary > start:
                end = boundary + 1
        chunks.append(text[start:end].strip())
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
    return [c for c in chunks if len(c) > 60]


def _doc_id(path: Path) -> str:
    return hashlib.sha1(path.read_bytes()).hexdigest()[:16]


def _doc_title(path: Path) -> str:
    if path.suffix.lower() == ".pdf":
        try:
            from pypdf import PdfReader

            meta = PdfReader(str(path)).metadata
            if meta and meta.title:
                return str(meta.title).strip()
        except Exception:
            pass
    return path.stem.replace("_", " ").replace("-", " ").title()


def _invalidate_bm25():
    _bm25_cache.update({"key": None, "bm25": None, "ids": [], "docs": [], "metas": []})


_STOP = set(
    "the a an is are was were be been do does did what when how many much of for to in on and "
    "can i my me please tell about which with this that these those it its there their they "
    "from have has had not no but or so than then them if by at as will shall would should".split()
)
_MONTHS = {
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
}
_WHEN_RE = re.compile(r"\bwhen\b|\bdate|\bdeadline\b|\bschedule\b|\bstart|\bbegin", re.I)


def _norm_token(token: str) -> str:
    if token.endswith("ations") and len(token) > 7:
        return token[:-5] + "at"
    if token.endswith("ation") and len(token) > 6:
        return token[:-4] + "at"
    if token.endswith("ies") and len(token) > 4:
        return token[:-3] + "y"
    if token.endswith("es") and len(token) > 4:
        return token[:-2]
    if token.endswith("s") and len(token) > 3:
        return token[:-1]
    return token


def _tokens(text: str) -> list[str]:
    return [_norm_token(t) for t in re.findall(r"[a-z0-9]+", text.lower())]


def _query_terms(query: str) -> set[str]:
    terms = set()
    for raw in re.findall(r"[a-z0-9]+", query.lower()):
        if raw in _STOP:
            continue
        token = _norm_token(raw)
        if token in _STOP or len(token) <= 2:
            continue
        terms.add(token)
    return terms


def _coverage(q_terms: set[str], chunk_tokens: set[str]) -> float:
    if not q_terms:
        return 0.0
    hits = 0
    for q in q_terms:
        if q in chunk_tokens:
            hits += 1
        elif any((c.startswith(q) or q.startswith(c)) and min(len(c), len(q)) >= 4 for c in chunk_tokens):
            hits += 1
    return hits / len(q_terms)


def _best_window(text: str, q_terms: set[str], width: int) -> str:
    if len(text) <= width or not q_terms:
        return text[:width]
    best, best_cov = text[:width], _coverage(q_terms, set(_tokens(text[:width])))
    parts = [p for p in re.split(r"(?<=[.!?])\s+", text) if p.strip()][:40]
    for i in range(len(parts)):
        window = ""
        for j in range(i, min(i + 3, len(parts))):
            window = (window + " " + parts[j]).strip()
            slice_ = window[:width]
            cov = _coverage(q_terms, set(_tokens(slice_)))
            if cov > best_cov:
                best, best_cov = slice_, cov
            if len(window) > width:
                break
    # Long unpunctuated tables need a character-level sweep to find the answer row
    step = max(width // 3, 80)
    for start in range(step, max(1, len(text) - width + 1), step):
        chunk = text[start:start + width]
        cov = _coverage(q_terms, set(_tokens(chunk)))
        if cov > best_cov:
            best, best_cov = ("..." + chunk).strip(), cov
    return best


def ingest_all(force: bool = False, db=None) -> dict:
    from ..db import SessionLocal
    from ..models import DocMeta

    own_db = None
    if db is None:
        db = SessionLocal()
        own_db = db
    files = sorted(
        p
        for p in settings.docs_dir.iterdir()
        if p.suffix.lower() in {".pdf", ".md", ".txt"} and p.is_file()
    )
    collection = get_collection()
    report = []
    _state["indexing"] = True
    try:
        for path in files:
            doc_id = _doc_id(path)
            existing = db.query(DocMeta).filter(DocMeta.doc_id == doc_id).first()
            if existing and not force:
                report.append({"file": path.name, "status": "skipped", "chunks": existing.chunks})
                continue
            # a regenerated/edited file keeps its name but changes hash: drop the stale entry
            stale = db.query(DocMeta).filter(DocMeta.filename == path.name, DocMeta.doc_id != doc_id).all()
            for old in stale:
                collection.delete(where={"doc_id": old.doc_id})
                db.delete(old)
            pages = _extract_pages(path)
            title = _doc_title(path)
            ids, documents, metadatas = [], [], []
            for page_no, text in pages:
                for idx, chunk in enumerate(_chunk_text(text)):
                    ids.append(f"{doc_id}:{page_no}:{idx}")
                    documents.append(chunk)
                    metadatas.append({"doc_id": doc_id, "title": title, "page": page_no, "source": path.name})
            collection.delete(where={"doc_id": doc_id})
            if ids:
                collection.add(ids=ids, documents=documents, metadatas=metadatas)
            if existing:
                existing.title = title
                existing.pages = len(pages)
                existing.chunks = len(ids)
                from datetime import datetime
                existing.ingested_at = datetime.utcnow()
            else:
                db.add(DocMeta(doc_id=doc_id, title=title, filename=path.name, pages=len(pages), chunks=len(ids)))
            db.commit()
            report.append({"file": path.name, "status": "ingested", "chunks": len(ids), "pages": len(pages)})
        known = {p.name for p in files}
        for orphan in db.query(DocMeta).all():
            if orphan.filename not in known:
                collection.delete(where={"doc_id": orphan.doc_id})
                db.delete(orphan)
        db.commit()
        _invalidate_bm25()
        _state["last_report"] = report
        return report
    finally:
        _state["indexing"] = False
        if own_db:
            own_db.close()


def delete_document(doc_id: str, db=None) -> bool:
    from ..db import SessionLocal
    from ..models import DocMeta

    own_db = None
    if db is None:
        db = SessionLocal()
        own_db = db
    try:
        meta = db.query(DocMeta).filter(DocMeta.doc_id == doc_id).first()
        if not meta:
            return False
        get_collection().delete(where={"doc_id": doc_id})
        path = settings.docs_dir / Path(meta.filename).name
        if path.exists():
            path.unlink()
        db.delete(meta)
        db.commit()
        _invalidate_bm25()
        return True
    finally:
        if own_db:
            own_db.close()


def _get_bm25():
    if _bm25_cache["key"] is not None:
        return _bm25_cache
    collection = get_collection()
    total = collection.count()
    if total == 0:
        return _bm25_cache
    data = collection.get(include=["documents", "metadatas"], limit=min(total, 5000))
    docs = data.get("documents") or []
    if not docs:
        return _bm25_cache
    from rank_bm25 import BM25Okapi

    tokenized = [_tokens(d or "") for d in docs]
    _bm25_cache.update(
        {
            "key": total,
            "bm25": BM25Okapi(tokenized),
            "ids": data.get("ids") or [],
            "docs": docs,
            "metas": data.get("metadatas") or [],
        }
    )
    return _bm25_cache


def search(query: str, k: int = 6) -> list[dict]:
    collection = get_collection()
    total = collection.count()
    if total == 0:
        return []
    n = min(12, total)
    vec = collection.query(query_texts=[query], n_results=n, include=["documents", "metadatas", "distances"])
    results: dict[str, dict] = {}
    for rank, (cid, doc, meta, dist) in enumerate(
        zip(vec["ids"][0], vec["documents"][0], vec["metadatas"][0], vec["distances"][0])
    ):
        results[cid] = {
            "id": cid,
            "text": doc,
            "title": meta.get("title", "Document"),
            "page": meta.get("page"),
            "doc_id": meta.get("doc_id", ""),
            "source": meta.get("source", ""),
            "vector_score": round(1 - float(dist), 4),
            "rrf": 1.0 / (60 + rank + 1),
            "bm25": 0.0,
        }
    cache = _get_bm25()
    bm25_max = 0.0
    if cache["bm25"] is not None:
        tokens = _tokens(query)
        scores = cache["bm25"].get_scores(tokens)
        bm25_max = float(max(scores)) if len(scores) else 0.0
        order = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:n]
        for rank, i in enumerate(order):
            if scores[i] <= 0:
                continue
            cid = cache["ids"][i]
            entry = results.get(cid)
            if entry is None:
                meta = cache["metas"][i] or {}
                entry = {
                    "id": cid,
                    "text": cache["docs"][i],
                    "title": meta.get("title", "Document"),
                    "page": meta.get("page"),
                    "doc_id": meta.get("doc_id", ""),
                    "source": meta.get("source", ""),
                    "vector_score": 0.0,
                    "rrf": 0.0,
                    "bm25": 0.0,
                }
                results[cid] = entry
            entry["rrf"] += 1.0 / (60 + rank + 1)
            entry["bm25"] = round(float(scores[i]), 3)

    q_terms = _query_terms(query)
    asks_when = bool(_WHEN_RE.search(query))
    for entry in results.values():
        chunk_tokens = set(_tokens(entry["title"] + " " + entry["text"]))
        score = (
            entry["rrf"]
            + 0.15 * max(0.0, entry["vector_score"])
            + 0.06 * _coverage(q_terms, chunk_tokens)
        )
        if bm25_max:
            score += 0.005 * (entry["bm25"] / bm25_max)
        if asks_when and chunk_tokens & _MONTHS:
            score += 0.02
        entry["score"] = score

    ranked = sorted(results.values(), key=lambda r: r["score"], reverse=True)[:k]
    for r in ranked:
        r["score"] = round(r["score"], 4)
        r["snippet"] = _best_window(r["text"], q_terms, 260)
        if len(r["text"]) > len(r["snippet"]):
            r["snippet"] += "..."
    return ranked


def build_context(chunks: list[dict]) -> str:
    parts = []
    for i, c in enumerate(chunks, start=1):
        page = f"page {c['page']}" if c.get("page") else "n/a"
        parts.append(f"[{i}] {c['title']} ({page}):\n{c['text']}")
    return "\n\n".join(parts)


def status() -> dict:
    from ..config import settings as s

    try:
        count = get_collection().count()
    except Exception:
        count = 0
    return {
        "indexing": _state["indexing"],
        "chunks": count,
        "last_report": _state["last_report"],
        "embedding_model": s.embedding_model,
        "llm_mode": s.llm_mode,
    }


def offline_answer(query: str, chunks: list[dict]) -> str:
    if not chunks:
        return (
            "I could not find anything in the indexed campus documents for that question. "
            "Try rephrasing, or ask about attendance policy, exam rules, the semester 7 syllabus, "
            "placement eligibility, library or hostel rules."
        )
    lines = [f"Here is what the campus documents say about \"{query.strip()}\":", ""]
    q_terms = _query_terms(query)
    for i, c in enumerate(chunks[:3], start=1):
        body = _best_window(c["text"].strip(), q_terms, 420)
        if len(body) < len(c["text"].strip()):
            body = body.rstrip(" .;,") + "..."
        lines.append(f"{i}. {body}")
        lines.append(f"   — {c['title']}" + (f", page {c['page']}" if c.get("page") else ""))
        lines.append("")
    lines.append("Sources are listed below with document names and page numbers.")
    return "\n".join(lines)
