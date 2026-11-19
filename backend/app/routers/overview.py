from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..deps import get_current_user
from ..models import (
    AttendanceRecord,
    AttendanceSession,
    ChatLog,
    Course,
    CrowdSample,
    DocMeta,
    Enrollment,
    FaceProfile,
    JobMatch,
    LostFoundItem,
    MockInterview,
    ResumeProfile,
    User,
)
from ..services import rag

router = APIRouter(prefix="/api/overview", tags=["overview"])


@router.get("")
def overview(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role == "student":
        return _student(db, user)
    if user.role == "faculty":
        return _faculty(db, user)
    return _admin(db)


def _student(db: Session, user: User) -> dict:
    courses = (
        db.query(Course).join(Enrollment, Enrollment.course_id == Course.id).filter(Enrollment.student_id == user.id).all()
    )
    rows = []
    total_present = total_sessions = 0
    for c in courses:
        sessions = db.query(AttendanceSession.id).filter(AttendanceSession.course_id == c.id).all()
        sids = [s.id for s in sessions]
        present = 0
        if sids:
            present = (
                db.query(AttendanceRecord)
                .filter(AttendanceRecord.student_id == user.id, AttendanceRecord.session_id.in_(sids))
                .count()
            )
        total_present += present
        total_sessions += len(sids)
        rows.append(
            {
                "code": c.code,
                "title": c.title,
                "present": present,
                "total": len(sids),
                "percent": round(100 * present / len(sids)) if sids else 0,
            }
        )
    attendance = round(100 * total_present / total_sessions) if total_sessions else 0

    chats = db.query(ChatLog).filter(ChatLog.user_id == user.id).order_by(ChatLog.created_at.desc()).limit(3).all()
    open_items = db.query(LostFoundItem).filter(LostFoundItem.status == "open").count()
    my_items = db.query(LostFoundItem).filter(LostFoundItem.user_id == user.id).count()
    matches = db.query(JobMatch).filter(JobMatch.user_id == user.id).order_by(JobMatch.score.desc()).all()
    interviews = db.query(MockInterview).filter(MockInterview.user_id == user.id).all()
    completed = [i.result for i in interviews if i.result]
    face = db.query(FaceProfile).filter(FaceProfile.user_id == user.id).first()

    return {
        "role": "student",
        "stats": {
            "attendance_percent": attendance,
            "courses": len(courses),
            "lost_found_open": open_items,
            "my_reports": my_items,
            "job_matches": len(matches),
            "best_match_score": matches[0].score if matches else 0,
            "interviews_completed": len(completed),
            "best_interview_score": max((c["overall_score"] for c in completed), default=0),
            "face_enrolled": bool(face),
        },
        "attendance_by_course": rows,
        "recent_chats": [
            {"id": c.id, "question": c.question, "created_at": c.created_at, "mode": c.mode} for c in chats
        ],
        "has_resume": db.query(ResumeProfile).filter(ResumeProfile.user_id == user.id).count() > 0,
    }


def _faculty(db: Session, user: User) -> dict:
    courses = db.query(Course).filter(Course.faculty_id == user.id).all()
    course_ids = [c.id for c in courses]
    sessions = []
    if course_ids:
        sessions = (
            db.query(AttendanceSession)
            .filter(AttendanceSession.course_id.in_(course_ids))
            .order_by(AttendanceSession.started_at.desc())
            .all()
        )
    active = [s for s in sessions if s.is_active]
    session_ids = [s.id for s in sessions]
    enrolled = 0
    if course_ids:
        enrolled = db.query(Enrollment).filter(Enrollment.course_id.in_(course_ids)).count()
    records = 0
    today_records = 0
    if session_ids:
        records = db.query(AttendanceRecord).filter(AttendanceRecord.session_id.in_(session_ids)).count()
        today = datetime.utcnow().date()
        today_records = sum(1 for r in db.query(AttendanceRecord).filter(AttendanceRecord.session_id.in_(session_ids)).all() if r.created_at.date() == today)
    possible = enrolled * len(sessions) if sessions else 0

    recent = []
    for s in sessions[:5]:
        course = db.get(Course, s.course_id)
        present = db.query(AttendanceRecord).filter(AttendanceRecord.session_id == s.id).count()
        recent.append(
            {
                "id": s.id,
                "course": course.code if course else "",
                "title": course.title if course else "",
                "is_active": s.is_active,
                "present": present,
                "started_at": s.started_at,
            }
        )

    return {
        "role": "faculty",
        "stats": {
            "courses": len(courses),
            "sessions": len(sessions),
            "active_sessions": len(active),
            "enrolled_students": enrolled,
            "records": records,
            "today_records": today_records,
            "attendance_rate": round(100 * records / possible) if possible else 0,
            "documents_indexed": db.query(DocMeta).count(),
            "llm_mode": settings.llm_mode,
        },
        "recent_sessions": recent,
        "courses": [
            {"id": c.id, "code": c.code, "title": c.title, "semester": c.semester} for c in courses
        ],
    }


def _admin(db: Session) -> dict:
    today = datetime.utcnow().date()
    chats = db.query(ChatLog).all()
    chats_today = sum(1 for c in chats if c.created_at.date() == today)
    sessions = db.query(AttendanceSession).count()
    records = db.query(AttendanceRecord).count()
    enrolled = db.query(Enrollment).count()
    possible = enrolled * sessions if sessions else 0
    zones = db.query(CrowdSample).order_by(CrowdSample.created_at.desc()).limit(100).all()
    latest_by_zone: dict[str, int] = {}
    for z in zones:
        latest_by_zone.setdefault(z.zone, z.person_count)
    return {
        "role": "admin",
        "stats": {
            "users": db.query(User).count(),
            "students": db.query(User).filter(User.role == "student").count(),
            "faculty": db.query(User).filter(User.role == "faculty").count(),
            "documents": db.query(DocMeta).count(),
            "chunks": rag.status()["chunks"],
            "chats": len(chats),
            "chats_today": chats_today,
            "attendance_rate": round(100 * records / possible) if possible else 0,
            "open_items": db.query(LostFoundItem).filter(LostFoundItem.status == "open").count(),
            "matched_items": db.query(LostFoundItem).filter(LostFoundItem.status == "matched").count(),
            "resumes": db.query(ResumeProfile).count(),
            "llm_mode": settings.llm_mode,
        },
        "crowd_now": [{"zone": z, "count": c} for z, c in latest_by_zone.items()],
    }
