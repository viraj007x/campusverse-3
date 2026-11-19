import io
import re

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

SKILLS: dict[str, list[str]] = {
    "Python": ["python"],
    "Java": ["java "],
    "C++": ["c++", "cpp"],
    "JavaScript": ["javascript", "js "],
    "TypeScript": ["typescript", "ts "],
    "React": ["react", "react.js", "reactjs"],
    "Next.js": ["next.js", "nextjs"],
    "Node.js": ["node.js", "nodejs", "node "],
    "FastAPI": ["fastapi"],
    "Django": ["django"],
    "Flask": ["flask"],
    "Spring Boot": ["spring boot", "springboot"],
    "SQL": ["sql", "mysql", "postgres", "postgresql", "sqlite"],
    "MongoDB": ["mongodb", "mongo"],
    "Redis": ["redis"],
    "Docker": ["docker", "containers"],
    "Kubernetes": ["kubernetes", "k8s"],
    "AWS": ["aws", "amazon web services", "ec2", "s3"],
    "Azure": ["azure"],
    "GCP": ["gcp", "google cloud"],
    "CI/CD": ["ci/cd", "cicd", "jenkins", "github actions", "gitlab ci"],
    "Linux": ["linux", "ubuntu", "bash", "shell scripting"],
    "Git": ["git", "github", "gitlab"],
    "Machine Learning": ["machine learning", "ml ", "supervised learning"],
    "Deep Learning": ["deep learning", "neural network", "neural networks"],
    "PyTorch": ["pytorch", "torch"],
    "TensorFlow": ["tensorflow", "keras"],
    "Scikit-learn": ["scikit-learn", "sklearn"],
    "Pandas": ["pandas"],
    "NumPy": ["numpy"],
    "NLP": ["nlp", "natural language processing", "text classification", "tokenization"],
    "Computer Vision": ["computer vision", "opencv", "image processing", "yolo", "object detection"],
    "LLMs": ["llm", "large language model", "gpt", "llama", "transformers", "langchain", "rag", "retrieval augmented"],
    "Generative AI": ["generative ai", "diffusion", "gan", "stable diffusion"],
    "Data Analysis": ["data analysis", "data analytics", "eda", "visualization"],
    "Big Data": ["hadoop", "spark", "big data", "pyspark"],
    "Statistics": ["statistics", "probability", "hypothesis testing"],
    "REST APIs": ["rest api", "restful", "api design", "fastapi", "flask", "express"],
    "GraphQL": ["graphql"],
    "System Design": ["system design", "distributed systems", "microservices", "scalability"],
    "Data Structures": ["data structures", "algorithms", "dsa"],
    "Operating Systems": ["operating system", "process scheduling", "concurrency"],
    "DBMS": ["dbms", "database management", "normalization", "indexing"],
    "Computer Networks": ["computer networks", "tcp/ip", "http", "dns"],
    "OOP": ["object oriented", "oop", "solid principles"],
    "Agile": ["agile", "scrum", "kanban"],
    "Testing": ["unit testing", "pytest", "jest", "selenium", "test automation"],
    "Android": ["android", "kotlin"],
    "Flutter": ["flutter", "dart"],
    "Tailwind CSS": ["tailwind"],
    "HTML/CSS": ["html", "css"],
    "Figma": ["figma", "ui design", "ux"],
    "Communication": ["communication", "presentation", "public speaking"],
    "Leadership": ["leadership", "team lead", "mentoring"],
    "Problem Solving": ["problem solving", "critical thinking", "analytical"],
}

STOPWORD_SKILLS = {"ML"}


def _normalize(text: str) -> str:
    return " " + re.sub(r"\s+", " ", text.lower()) + " "


def extract_skills(text: str) -> list[str]:
    norm = _normalize(text)
    found = []
    for skill, aliases in SKILLS.items():
        for alias in aliases:
            pattern = r"(?<![a-z0-9+#.])" + re.escape(alias.strip()) + r"(?![a-z0-9+#])"
            if re.search(pattern, norm):
                found.append(skill)
                break
    return found


def resume_text(raw: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(raw))
    parts = []
    for page in reader.pages:
        try:
            parts.append(page.extract_text() or "")
        except Exception:
            continue
    text = "\n".join(parts).strip()
    if not text:
        raise ValueError("Could not extract text from this PDF. Use a text-based resume, not a scanned image.")
    return text


def score_match(resume: str, jd: str) -> tuple[float, list[str], list[str]]:
    resume_skills = set(extract_skills(resume))
    jd_skills = set(extract_skills(jd))

    try:
        vectors = TfidfVectorizer(stop_words="english", ngram_range=(1, 2)).fit_transform([resume, jd])
        text_sim = float(cosine_similarity(vectors[0], vectors[1])[0][0])
    except ValueError:
        text_sim = 0.0

    if jd_skills:
        coverage = len(resume_skills & jd_skills) / len(jd_skills)
    else:
        coverage = min(1.0, len(resume_skills) / 8)
    score = round(100 * (0.45 * text_sim + 0.55 * coverage), 1)
    matched = sorted(resume_skills & jd_skills)
    missing = sorted(jd_skills - resume_skills)
    return min(score, 99.0), matched, missing


ROADMAP_STEPS = {
    "default": [
        "Complete a structured tutorial or documentation walkthrough for {skill}.",
        "Build one small project that uses {skill} end to end and publish it on GitHub.",
        "Add the project and measurable outcomes to your resume with 2-3 bullet points.",
        "Practise 5 interview questions on {skill} and write short answers.",
    ]
}


def offline_roadmap(missing: list[str], role_hint: str = "") -> list[dict]:
    items = []
    for skill in missing[:6]:
        items.append(
            {
                "skill": skill,
                "why": f"'{skill}' appears in the job description but not in your resume, so it is a likely screening gap.",
                "steps": [s.format(skill=skill) for s in ROADMAP_STEPS["default"]],
                "duration_weeks": 2,
            }
        )
    return items


QUESTION_BANK = {
    "ml": [
        "Explain the difference between supervised and unsupervised learning with a real project example.",
        "How would you detect and fix overfitting in a deep learning model?",
        "Describe how you would evaluate a classification model when the dataset is imbalanced.",
        "Explain the attention mechanism in transformers and why it replaced recurrent layers for many tasks.",
        "You have to deploy a model to production. Walk through your MLOps pipeline end to end.",
        "Walk me through a model you tuned. What did the learning curves tell you and how did you act on them?",
        "How would you handle missing values and outliers before training a tree-based model?",
        "Explain precision, recall and F1 to a product manager and say when each matters.",
        "What is data leakage? Give a concrete example of how it can inflate your test scores.",
        "Describe how you would version datasets and models in a team project.",
    ],
    "web": [
        "Walk me through what happens between a browser request and a rendered React page in a Next.js app.",
        "How do you design authentication and role-based access control for a web application?",
        "Explain how you would optimise a slow API endpoint handling 10,000 requests per minute.",
        "What is the difference between server-side rendering, client-side rendering, and static generation?",
        "Describe how you would structure a PostgreSQL schema for an attendance system and justify your keys.",
        "How do you manage state in a large React application and when would you avoid a global store?",
        "Explain how you would prevent SQL injection and XSS in a full-stack app.",
        "Describe a time you improved page load performance. What did you measure and what changed?",
        "How would you design a rate limiter for a public API?",
        "What happens during a database transaction and when would you use a row lock?",
    ],
    "data": [
        "Given a table of student attendance and marks, how would you identify students at risk of failing?",
        "Explain the steps you take to clean a messy dataset before modelling.",
        "How do you choose between a decision tree, random forest, and gradient boosting?",
        "What metrics would you use to evaluate a regression model and why?",
        "Describe a dashboard you would build for faculty to monitor attendance trends.",
        "How would you validate that a sudden dip in a metric is real and not a data pipeline bug?",
        "Explain the difference between correlation and causation with a campus example.",
        "How do you handle time-series data with missing days when building a forecast?",
        "Describe how you would write a SQL query to find the second-highest attendance in each department.",
        "What steps would you take to make a dashboard trustworthy for non-technical staff?",
    ],
    "general": [
        "Tell me about a project you are most proud of and your specific contribution.",
        "Describe a difficult bug you fixed and how you diagnosed it.",
        "How do you approach learning a new technology under a deadline?",
        "Explain a technical concept you know well to someone from a non-technical background.",
        "Where do you see yourself contributing in the first six months of this role?",
        "Tell me about a disagreement with a teammate and how you resolved it.",
        "Describe a time you missed a deadline. What did you change afterwards?",
        "How do you decide what to prioritise when two tasks are equally urgent?",
        "Walk me through your resume and highlight the parts most relevant to this role.",
        "What is one technical skill you are currently improving, and how are you practising it?",
    ],
}

NON_ANSWERS = {
    "idk", "i dont know", "i don't know", "i do not know", "i dont know the answer", "dont know", "don't know",
    "no idea", "not sure", "cannot answer", "cant answer", "can not answer", "not able to answer",
    "skip", "skip this", "pass", "next", "nothing", "none", "na", "n/a", "no", "yes", "ok", "okay", "maybe",
}


def pick_bank(role_title: str) -> str:
    role = role_title.lower()
    if any(k in role for k in ("machine", "ml", "ai", "deep", "data scientist", "nlp", "vision")):
        return "ml"
    if any(k in role for k in ("frontend", "front-end", "full stack", "fullstack", "web", "react", "backend", "back-end")):
        return "web"
    if any(k in role for k in ("data analyst", "analytics", "business intelligence", "bi ")):
        return "data"
    return "general"


def offline_questions(role_title: str, avoid: set[str] | None = None) -> list[dict]:
    import random

    avoid = avoid or set()
    bank_key = pick_bank(role_title)
    technical = [q for q in QUESTION_BANK[bank_key] if q not in avoid]
    general = [q for q in QUESTION_BANK["general"] if q not in avoid]
    random.shuffle(technical)
    random.shuffle(general)
    chosen = technical[:3] + general[:2]
    if len(chosen) < 5:  # a very busy user exhausted the bank; fall back to the full pool
        pool = [q for q in QUESTION_BANK[bank_key] + QUESTION_BANK["general"] if q not in chosen]
        random.shuffle(pool)
        chosen += pool[: 5 - len(chosen)]
    random.shuffle(chosen)
    return [{"question": q, "focus": "Technical depth and clarity"} for q in chosen]


def heuristic_answer_score(answer: str, question: str) -> dict:
    import re

    text = answer.strip()
    words = text.split()
    normalised = re.sub(r"[^a-z0-9 ]+", "", text.lower()).strip()
    if len(words) < 6 or normalised in NON_ANSWERS:
        return {
            "score": 0,
            "feedback": "No real answer was detected. Say or type at least a few sentences covering the context, your approach and the result.",
            "strengths": [],
            "improve": ["Give a complete answer: situation, approach, result."],
        }
    skills_hit = extract_skills(question + " " + text)
    structure = sum(
        1
        for marker in ("because", "for example", "project", "result", "used", "built", "measured", "percent", "%")
        if marker in text.lower()
    )
    base = 10 + min(30, len(words) / 2) + min(20, len(skills_hit) * 5) + min(25, structure * 5)
    if len(words) < 10:
        base = min(base, 15)
    elif len(words) < 15:
        base = min(base, 30)
    elif len(words) < 25:
        base = min(base, 50)
    elif not skills_hit:
        base = min(base, 65)
    score = int(max(0, min(92, base)))
    if score >= 75:
        verdict = "Strong answer with good technical grounding."
    elif score >= 55:
        verdict = "Reasonable answer, but add concrete examples and measurable outcomes."
    elif score >= 30:
        verdict = "Answer is too brief. Structure it as context, approach, result."
    else:
        verdict = "This answer does not address the question yet. Explain your approach with a concrete example."
    return {"score": score, "feedback": verdict, "strengths": skills_hit[:4], "improve": []}
