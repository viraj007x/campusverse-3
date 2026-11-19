from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

OUT = Path(__file__).resolve().parent.parent / "data" / "samples" / "resume_jane_doe.pdf"

RESUME = {
    "name": "Jane Doe",
    "contact": "B.Tech Computer Science (2027) · jane.doe@campus.edu · +91 98765 43210 · Bengaluru",
    "summary": (
        "Final-year Computer Science student with hands-on experience building machine learning "
        "and retrieval systems. Comfortable across the ML lifecycle: data preparation, model "
        "training, evaluation and deployment behind FastAPI services."
    ),
    "skills": [
        "Languages: Python, TypeScript, SQL, C++",
        "ML & Data: NumPy, pandas, scikit-learn, PyTorch, OpenCV, matplotlib",
        "Backend: FastAPI, Flask, PostgreSQL, SQLite, REST APIs",
        "Tools: Git, Docker, Linux, Jupyter, Google Cloud (BigQuery basics)",
    ],
    "experience": [
        (
            "Machine Learning Intern — Finsolve Technologies (May 2026 – Jul 2026)",
            "Built a document question-answering prototype using sentence embeddings and a vector "
            "database. Improved answer relevance by 23% through chunking and hybrid retrieval. "
            "Packaged the service with FastAPI and Docker for internal demos.",
        ),
        (
            "Open Source Contributor — scikit-learn examples (2025 – present)",
            "Contributed documentation fixes and two example notebooks on model evaluation and "
            "cross-validation. Reviewed pull requests from new contributors.",
        ),
    ],
    "projects": [
        (
            "CampusVerse — AI Campus Ecosystem (Major Project, 2026)",
            "Led the retrieval module: PDF ingestion, chunking, BM25 + vector hybrid search and "
            "streaming answers with page-level citations. Also built a YOLOv8 footfall dashboard "
            "and a CLIP-based lost-and-found matcher.",
        ),
        (
            "Retail Demand Forecaster (2025)",
            "Gradient boosting pipeline on two years of sales data with feature engineering for "
            "festival seasonality. Achieved 11% lower MAPE than the naive baseline and exposed "
            "forecasts through a Streamlit dashboard.",
        ),
    ],
    "education": [
        "B.Tech Computer Science and Engineering, VNR Vignana Jyothi Institute (2023 – 2027) — CGPA 8.9/10",
        "Relevant coursework: Machine Learning, Deep Learning, DBMS, Operating Systems, NLP",
    ],
}


def build() -> Path:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    styles = getSampleStyleSheet()
    heading = ParagraphStyle("Heading", parent=styles["Heading2"], fontSize=11, spaceBefore=10, spaceAfter=4)
    body = ParagraphStyle("Body", parent=styles["BodyText"], fontSize=9.3, leading=13)
    name = ParagraphStyle("Name", parent=styles["Title"], fontSize=20, spaceAfter=2)

    doc = SimpleDocTemplate(str(OUT), pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=18 * mm, bottomMargin=16 * mm)
    story = [Paragraph(RESUME["name"], name), Paragraph(RESUME["contact"], body), Spacer(1, 6)]

    story += [Paragraph("Summary", heading), Paragraph(RESUME["summary"], body)]
    story += [Paragraph("Skills", heading)] + [Paragraph(s, body) for s in RESUME["skills"]]
    story += [Paragraph("Experience", heading)]
    for title, detail in RESUME["experience"]:
        story += [Paragraph(f"<b>{title}</b>", body), Paragraph(detail, body), Spacer(1, 4)]
    story += [Paragraph("Projects", heading)]
    for title, detail in RESUME["projects"]:
        story += [Paragraph(f"<b>{title}</b>", body), Paragraph(detail, body), Spacer(1, 4)]
    story += [Paragraph("Education", heading)] + [Paragraph(e, body) for e in RESUME["education"]]

    doc.build(story)
    return OUT


if __name__ == "__main__":
    print(f"Wrote {build()}")
