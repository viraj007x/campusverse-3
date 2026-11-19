from collections import Counter
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..deps import require_roles
from ..models import (
    AttendanceRecord,
    AttendanceSession,
    ChatLog,
    Course,
    CrowdSample,
    DocMeta,
    Enrollment,
    LostFoundItem,
    User,
)
from ..services import rag

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("")
def analytics(
    user: User = Depends(require_roles("faculty", "admin")), db: Session = Depends(get_db)
):
    now = datetime.utcnow()
    chats = db.query(ChatLog).all()

    chat_daily = []
    for offset in range(13, -1, -1):
        day = (now - timedelta(days=offset)).date()
        count = sum(1 for c in chats if c.created_at.date() == day)
        chat_daily.append({"date": day.isoformat(), "count": count})

    source_counter: Counter = Counter()
    for c in chats:
        for s in c.sources or []:
            title = s.get("title")
            if title:
                source_counter[title] += 1
    top_sources = [{"title": t, "count": n} for t, n in source_counter.most_common(6)]

    recent_questions = []
    for c in sorted(chats, key=lambda x: x.created_at, reverse=True)[:12]:
        user_obj = db.get(User, c.user_id)
        recent_questions.append(
            {
                "question": c.question,
                "user": user_obj.name if user_obj else "Unknown",
                "mode": c.mode,
                "latency_ms": c.latency_ms,
                "created_at": c.created_at,
            }
        )

    courses = db.query(Course).all()
    attendance = []
    for course in courses:
        sids = [s.id for s in db.query(AttendanceSession).filter(AttendanceSession.course_id == course.id).all()]
        enrolled = db.query(Enrollment).filter(Enrollment.course_id == course.id).count()
        present = 0
        if sids:
            present = db.query(AttendanceRecord).filter(AttendanceRecord.session_id.in_(sids)).count()
        possible = enrolled * len(sids)
        attendance.append(
            {
                "code": course.code,
                "title": course.title,
                "sessions": len(sids),
                "present": present,
                "possible": possible,
                "rate": round(100 * present / possible) if possible else 0,
            }
        )

    samples = db.query(CrowdSample).order_by(CrowdSample.created_at).all()
    footfall: dict[str, list] = {}
    for s in samples[-180:]:
        footfall.setdefault(s.zone, []).append({"t": s.created_at.isoformat(), "count": s.person_count})

    lost = db.query(LostFoundItem).filter(LostFoundItem.kind == "lost").count()
    found = db.query(LostFoundItem).filter(LostFoundItem.kind == "found").count()
    matched = db.query(LostFoundItem).filter(LostFoundItem.status == "matched").count()
    resolved = db.query(LostFoundItem).filter(LostFoundItem.status == "resolved").count()

    mode_counts = Counter(c.mode for c in chats)
    avg_latency = round(sum(c.latency_ms for c in chats) / len(chats)) if chats else 0

    return {
        "system": {
            "llm_mode": settings.llm_mode,
            "chunks": rag.status()["chunks"],
            "documents": db.query(DocMeta).count(),
            "avg_latency_ms": avg_latency,
            "qa_pairs": len(chats),
            "mode_split": [{"mode": m, "count": n} for m, n in mode_counts.items()],
        },
        "chat_daily": chat_daily,
        "top_sources": top_sources,
        "recent_questions": recent_questions,
        "attendance": attendance,
        "footfall": [{"zone": z, "series": series} for z, series in footfall.items()],
        "lost_found": {"lost": lost, "found": found, "matched": matched, "resolved": resolved},
    }
