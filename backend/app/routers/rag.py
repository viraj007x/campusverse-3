import asyncio
import io
import json
import re
import time
import zipfile
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

from ..config import settings
from ..db import SessionLocal, get_db
from ..deps import get_current_user, require_roles
from ..models import ChatLog, DocMeta, User
from ..schemas import ChatRequest
from ..services import general, llm, performance, rag

router = APIRouter(prefix="/api/rag", tags=["rag"])

SYSTEM_PROMPT = (
    "You are SAMVIT (Sanskrit for consciousness), the campus intelligence assistant for Graphic Era Hill University (GEHU). "
    "You combine the university knowledge brain with academic analytics and broad general knowledge. "
    "When context excerpts or a performance snapshot are present, ground campus claims in them and cite documents inline "
    "with square brackets like [1] or [2] matching the numbered excerpts. "
    "When no context is supplied, answer from reliable general knowledge, state clearly that the answer is general and "
    "not an official campus policy, and invite the user to ask about campus documents for institution-specific details. "
    "Never invent campus policies, dates, fees or student records. "
    "Reply in the same language the user wrote in (English, Hindi/Devanagari, or Hinglish). "
    "Be concise and structured: short paragraphs or bullet points. Use Indian English and Rs. for currency."
)

AGENT_PROMPTS = {
    "samvit": "You are the general SAMVIT copilot: policy, academics and campus knowledge.",
    "risk": "You are SAMVIT Risk Analyst. Prioritise academic-risk evidence, drivers and intervention actions.",
    "attendance": "You are SAMVIT Engagement Coach. Focus on VLE engagement forecasts, real-data risk drivers and recovery plans.",
    "placement": "You are SAMVIT Career Mentor. Focus on placement readiness, skill gaps and career fit.",
    "faculty": "You are SAMVIT Faculty Assistant. Summarise cohorts, outliers and recommended interventions.",
}

GREETINGS = {"hi", "hello", "hey", "hi there", "hello there", "good morning", "good afternoon", "good evening", "yo"}
MIN_CONTEXT_SCORE = 0.07  # below this the chunk is off-topic; answer from general knowledge instead
UPLOAD_SUFFIXES = {".pdf", ".md", ".txt"}
MAX_UPLOAD_BYTES = 20 * 1024 * 1024


def _sse(event: str, data) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _word_chunks(text: str, size: int = 3):
    words = text.split(" ")
    for i in range(0, len(words), size):
        chunk = " ".join(words[i : i + size])
        yield chunk + (" " if i + size < len(words) else "")


@router.post("/chat")
async def chat(req: ChatRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    started = time.perf_counter()
    question = req.question.strip()
    greeting = question.lower().strip(" ?!.") in GREETINGS
    agent = req.agent if req.agent in AGENT_PROMPTS else "samvit"
    analytics = None if greeting else await asyncio.to_thread(performance.nl_answer, db, question, user)
    chunks = [] if greeting or analytics else await asyncio.to_thread(rag.search, question, 6)
    chunks = [c for c in chunks if float(c.get("score") or 0) >= MIN_CONTEXT_SCORE]
    mode = settings.llm_mode
    general_result = None
    if not greeting and not analytics and not chunks and mode == "offline":
        general_result = await general.lookup(question)
    if analytics:
        sources = [
            {
                "doc_id": "performance-brain",
                "title": "SAMVIT Performance Brain",
                "page": None,
                "snippet": analytics["snippet"],
                "score": 1.0,
            }
        ]
    elif general_result:
        sources = [general_result["source"]]
    else:
        sources = [
            {
                "doc_id": c["doc_id"],
                "title": c["title"],
                "page": c.get("page"),
                "snippet": c["snippet"],
                "score": c["score"],
            }
            for c in chunks
        ]

    history = (
        db.query(ChatLog)
        .filter(ChatLog.user_id == user.id)
        .order_by(ChatLog.created_at.desc())
        .limit(3)
        .all()
    )

    async def generate():
        yield _sse("sources", sources)
        answer_parts: list[str] = []

        if greeting:
            text = (
                "Hello! I am SAMVIT, your campus intelligence assistant. I can answer from the university knowledge brain "
                "(regulations, syllabus, examinations, placements, calendar, handbook), from live academic analytics "
                "such as risk, engagement forecasts, clusters and placement readiness, and from general knowledge for "
                "anything outside campus. "
                "Try: \"How many students are high risk?\", \"When do the end semester exams start?\" or \"What is a black hole?\""
            )
            for piece in _word_chunks(text):
                answer_parts.append(piece)
                yield _sse("token", {"t": piece})
                await asyncio.sleep(0.006)
        elif analytics:
            for piece in _word_chunks(analytics["answer"]):
                answer_parts.append(piece)
                yield _sse("token", {"t": piece})
                await asyncio.sleep(0.004)
        elif mode != "offline":
            system = f"{SYSTEM_PROMPT}\n\nActive agent: {AGENT_PROMPTS[agent]}"
            messages = [{"role": "system", "content": system}]
            for past in reversed(history):
                messages.append({"role": "user", "content": past.question[:600]})
                messages.append({"role": "assistant", "content": past.answer[:900]})
            context = f"Context excerpts:\n\n{rag.build_context(chunks)}\n\n" if chunks else ""
            messages.append({"role": "user", "content": f"{context}Student question: {question}"})
            try:
                async for delta in llm.stream_chat(messages):
                    answer_parts.append(delta)
                    yield _sse("token", {"t": delta})
            except Exception as exc:
                fallback = rag.offline_answer(question, chunks) if chunks else "I could not reach the language model right now. Please retry in a moment."
                answer_parts = [fallback]
                yield _sse("meta", {"fallback": True, "reason": type(exc).__name__})
                yield _sse("token", {"t": fallback})
        elif general_result:
            for piece in _word_chunks(general_result["answer"]):
                answer_parts.append(piece)
                yield _sse("token", {"t": piece})
                await asyncio.sleep(0.004)
        else:
            text = rag.offline_answer(question, chunks) if chunks else (
                "I could not find a reliable source for that question right now. SAMVIT grounds campus "
                "questions in the indexed documents and general facts in Wikipedia — try rephrasing, or ask about "
                "attendance policy, exam rules, the semester 7 syllabus, placements, library or hostel rules."
            )
            for piece in _word_chunks(text):
                answer_parts.append(piece)
                yield _sse("token", {"t": piece})
                await asyncio.sleep(0.006)

        latency = int((time.perf_counter() - started) * 1000)
        answer = "".join(answer_parts).strip()
        answer_mode = "analytics" if analytics else "general" if general_result else mode
        chat_id = None
        try:
            vdb = SessionLocal()
            log = ChatLog(
                user_id=user.id,
                question=question,
                answer=answer,
                sources=sources,
                mode=answer_mode,
                latency_ms=latency,
            )
            vdb.add(log)
            vdb.commit()
            chat_id = log.id
            vdb.close()
        except Exception:
            pass
        yield _sse("done", {"chat_id": chat_id, "latency_ms": latency, "mode": answer_mode, "agent": agent})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


@router.get("/history")
def history(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (
        db.query(ChatLog)
        .filter(ChatLog.user_id == user.id)
        .order_by(ChatLog.created_at.desc())
        .limit(25)
        .all()
    )
    return [
        {
            "id": r.id,
            "question": r.question,
            "answer": r.answer,
            "sources": r.sources,
            "mode": r.mode,
            "created_at": r.created_at,
        }
        for r in rows
    ]


@router.get("/status")
def status(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    data = rag.status()
    rows = db.query(DocMeta).order_by(DocMeta.title).all()
    data["documents"] = [
        {
            "doc_id": r.doc_id,
            "title": r.title,
            "filename": r.filename,
            "pages": r.pages,
            "chunks": r.chunks,
            "ingested_at": r.ingested_at,
        }
        for r in rows
    ]
    try:
        performance_data = performance.summary(db)
        metrics = performance.get_metrics() or {}
        data["brain"] = {
            "documents": len(rows),
            "chunks": data.get("chunks", 0),
            "records": performance_data["records"],
            "high_risk": performance_data["at_risk"],
            "attendance_risk": performance_data["attendance_risk"],
            "anomalies": performance_data["anomalies"],
            "models": len(metrics.get("models", [])),
            "clusters": len(metrics.get("clusters", [])),
        }
    except Exception:
        data["brain"] = None
    return data


@router.post("/ingest")
def ingest(
    background: BackgroundTasks,
    force: bool = False,
    user: User = Depends(require_roles("faculty", "admin")),
):
    background.add_task(rag.ingest_all, force)
    return {"started": True, "force": force}


@router.post("/upload")
async def upload_document(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    user: User = Depends(require_roles("faculty", "admin")),
):
    original = Path(file.filename or "").name
    suffix = Path(original).suffix.lower()
    if suffix not in UPLOAD_SUFFIXES:
        raise HTTPException(status_code=400, detail="Only PDF, Markdown (.md) or plain-text (.txt) documents can be added.")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Files are limited to 20 MB.")
    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", original).strip("._") or f"document{suffix}"
    if not safe.lower().endswith(suffix):
        safe += suffix
    target = settings.docs_dir / safe
    target.write_bytes(data)
    background.add_task(rag.ingest_all, False)
    return {"saved": target.name, "bytes": len(data), "indexing": True}


@router.get("/export")
def export_documents(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(DocMeta).order_by(DocMeta.title).all()
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for row in rows:
            path = settings.docs_dir / Path(row.filename).name
            if path.is_file():
                archive.write(path, arcname=path.name)
    if buffer.tell() == 0:
        raise HTTPException(status_code=404, detail="No documents are indexed yet.")
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="samvit-knowledge-base.zip"'},
    )


@router.get("/docs/{doc_id}/download")
def download_document(doc_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    meta = db.query(DocMeta).filter(DocMeta.doc_id == doc_id).first()
    if not meta:
        raise HTTPException(status_code=404, detail="Document not found")
    path = settings.docs_dir / Path(meta.filename).name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Source file is missing on disk")
    return FileResponse(path, filename=meta.filename)


@router.delete("/docs/{doc_id}")
def delete_document(doc_id: str, user: User = Depends(require_roles("faculty", "admin")), db: Session = Depends(get_db)):
    if not rag.delete_document(doc_id, db):
        raise HTTPException(status_code=404, detail="Document not found")
    return {"deleted": True}
