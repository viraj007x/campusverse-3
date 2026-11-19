import csv
import io
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_current_user, require_roles
from ..models import (
    AttendanceRecord,
    AttendanceSession,
    Course,
    Enrollment,
    FaceProfile,
    User,
)
from ..schemas import CrowdRequest, FaceEnrollRequest, FrameRequest, StartSessionRequest
from ..services import crowd, vision

router = APIRouter(prefix="/api/vision", tags=["vision"])

_live_state: dict[tuple[int, int], dict] = {}

PROMPTS = {
    "center": "Look straight at the camera",
    "left": "Turn your head slowly to one side",
    "right": "Now turn your head to the other side",
    "done": "Liveness check complete",
}


def _update_liveness(session_id: int, student_id: int, yaw: float) -> str:
    state = _live_state.setdefault((session_id, student_id), {"phase": "center", "sign": 0})
    if state["phase"] == "center":
        if abs(yaw) < 0.12:
            state["phase"] = "left"
    elif state["phase"] == "left":
        if abs(yaw) >= 0.15:
            state["sign"] = 1 if yaw > 0 else -1
            state["phase"] = "right"
    elif state["phase"] == "right":
        if abs(yaw) >= 0.15 and (1 if yaw > 0 else -1) != state["sign"]:
            state["phase"] = "done"
    return state["phase"]


def _course_students(db: Session, course_id: int):
    return (
        db.query(FaceProfile, User)
        .join(User, User.id == FaceProfile.user_id)
        .join(Enrollment, Enrollment.student_id == User.id)
        .filter(Enrollment.course_id == course_id)
        .all()
    )


@router.post("/enroll")
def enroll(payload: FaceEnrollRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role != "student":
        raise HTTPException(status_code=400, detail="Only student accounts can enroll a face profile")
    if not payload.images:
        raise HTTPException(status_code=400, detail="Upload at least one photo")
    try:
        embedding, count, quality = vision.enroll(payload.images)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    profile = db.query(FaceProfile).filter(FaceProfile.user_id == user.id).first()
    if profile:
        profile.embedding = embedding
        profile.images_count = count
        profile.updated_at = datetime.utcnow()
    else:
        db.add(FaceProfile(user_id=user.id, embedding=embedding, images_count=count))
    db.commit()
    return {"enrolled": True, "images_used": count, "quality": round(quality, 3)}


@router.get("/enrollment")
def my_enrollment(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(FaceProfile).filter(FaceProfile.user_id == user.id).first()
    if not profile:
        return {"enrolled": False}
    return {
        "enrolled": True,
        "images_count": profile.images_count,
        "updated_at": profile.updated_at,
    }


@router.get("/students")
def enrolled_students(user: User = Depends(require_roles("faculty", "admin")), db: Session = Depends(get_db)):
    rows = (
        db.query(FaceProfile, User)
        .join(User, User.id == FaceProfile.user_id)
        .order_by(User.name)
        .all()
    )
    return [
        {
            "id": u.id,
            "name": u.name,
            "roll_no": u.roll_no,
            "department": u.department,
            "images_count": p.images_count,
            "updated_at": p.updated_at,
        }
        for p, u in rows
    ]


@router.get("/courses")
def my_courses(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role == "student":
        rows = (
            db.query(Course)
            .join(Enrollment, Enrollment.course_id == Course.id)
            .filter(Enrollment.student_id == user.id)
            .all()
        )
    else:
        rows = db.query(Course).all()
    result = []
    for c in rows:
        faculty = db.get(User, c.faculty_id) if c.faculty_id else None
        result.append(
            {"id": c.id, "code": c.code, "title": c.title, "semester": c.semester, "faculty_name": faculty.name if faculty else None}
        )
    return result


@router.post("/sessions")
def start_session(
    payload: StartSessionRequest,
    user: User = Depends(require_roles("faculty", "admin")),
    db: Session = Depends(get_db),
):
    course = db.get(Course, payload.course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if user.role == "faculty" and course.faculty_id != user.id:
        raise HTTPException(status_code=403, detail="You are not assigned to this course")
    active = (
        db.query(AttendanceSession)
        .filter(AttendanceSession.course_id == course.id, AttendanceSession.is_active.is_(True))
        .first()
    )
    if active:
        return _session_dict(db, active)
    session = AttendanceSession(
        course_id=course.id,
        faculty_id=user.id,
        challenge="center",
        require_liveness=payload.require_liveness,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return _session_dict(db, session)


def _session_dict(db: Session, s: AttendanceSession) -> dict:
    course = db.get(Course, s.course_id)
    present = db.query(AttendanceRecord).filter(AttendanceRecord.session_id == s.id).count()
    return {
        "id": s.id,
        "course_id": s.course_id,
        "course_code": course.code if course else "",
        "course_title": course.title if course else "",
        "is_active": s.is_active,
        "challenge": s.challenge,
        "require_liveness": s.require_liveness,
        "started_at": s.started_at,
        "present_count": present,
    }


@router.get("/sessions")
def list_sessions(user: User = Depends(require_roles("faculty", "admin")), db: Session = Depends(get_db)):
    query = db.query(AttendanceSession)
    if user.role == "faculty":
        query = query.filter(AttendanceSession.faculty_id == user.id)
    rows = query.order_by(AttendanceSession.started_at.desc()).limit(40).all()
    return [_session_dict(db, s) for s in rows]


@router.get("/sessions/{session_id}")
def session_detail(
    session_id: int, user: User = Depends(require_roles("faculty", "admin")), db: Session = Depends(get_db)
):
    session = db.get(AttendanceSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    course = db.get(Course, session.course_id)
    enrolled = (
        db.query(User)
        .join(Enrollment, Enrollment.student_id == User.id)
        .filter(Enrollment.course_id == session.course_id)
        .order_by(User.roll_no)
        .all()
    )
    records = db.query(AttendanceRecord).filter(AttendanceRecord.session_id == session.id).all()
    by_student = {r.student_id: r for r in records}
    roster = []
    for stu in enrolled:
        rec = by_student.get(stu.id)
        roster.append(
            {
                "student_id": stu.id,
                "name": stu.name,
                "roll_no": stu.roll_no,
                "present": rec is not None,
                "confidence": round(rec.confidence, 3) if rec else None,
                "liveness_verified": bool(rec.liveness_verified) if rec else False,
                "marked_at": rec.created_at if rec else None,
            }
        )
    data = _session_dict(db, session)
    data["roster"] = roster
    data["course_title"] = course.title if course else ""
    return data


@router.post("/sessions/{session_id}/close")
def close_session(session_id: int, user: User = Depends(require_roles("faculty", "admin")), db: Session = Depends(get_db)):
    session = db.get(AttendanceSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.is_active = False
    session.ended_at = datetime.utcnow()
    db.commit()
    return _session_dict(db, session)


@router.post("/sessions/{session_id}/frame")
def process_frame(
    session_id: int,
    payload: FrameRequest,
    user: User = Depends(require_roles("faculty", "admin")),
    db: Session = Depends(get_db),
):
    session = db.get(AttendanceSession, session_id)
    if not session or not session.is_active:
        raise HTTPException(status_code=404, detail="Active session not found")
    if payload.require_liveness is not None and payload.require_liveness != session.require_liveness:
        session.require_liveness = payload.require_liveness
        db.commit()

    try:
        img = vision.decode_image(payload.image)
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid image frame")

    faces = vision.detect_faces(img)
    h, w = img.shape[:2]
    candidates = _course_students(db, session.course_id)
    response_faces = []
    primary_prompt = PROMPTS.get(session.challenge, PROMPTS["done"])

    largest = max(faces, key=lambda f: f[2] * f[3], default=None)
    for face in faces:
        entry = {
            "box": vision.face_box(face, w, h),
            "status": "unknown",
            "student": None,
            "confidence": 0.0,
            "prompt": None,
        }
        if candidates:
            emb = vision.face_embedding(img, face)
            best_score, best = -1.0, None
            for profile, stu in candidates:
                score = vision.cosine(emb, profile.embedding)
                if score > best_score:
                    best_score, best = score, stu
            if best is not None and best_score >= vision.MATCH_THRESHOLD:
                entry.update({"student": {"id": best.id, "name": best.name, "roll_no": best.roll_no}, "confidence": round(best_score, 3)})
                if session.require_liveness:
                    phase = _update_liveness(session.id, best.id, vision.yaw_estimate(face))
                    entry["liveness"] = phase
                    entry["prompt"] = PROMPTS[phase]
                    verified = phase == "done"
                else:
                    verified = True
                    entry["liveness"] = "disabled"
                    entry["prompt"] = "Liveness disabled for this session"
                existing = (
                    db.query(AttendanceRecord)
                    .filter(AttendanceRecord.session_id == session.id, AttendanceRecord.student_id == best.id)
                    .first()
                )
                if verified and not existing:
                    db.add(
                        AttendanceRecord(
                            session_id=session.id,
                            student_id=best.id,
                            confidence=best_score,
                            liveness_verified=session.require_liveness,
                        )
                    )
                    db.commit()
                entry["status"] = "verified" if (verified or existing) else "pending"
        response_faces.append(entry)

    if largest is not None:
        for entry in response_faces:
            if entry["student"] and entry["box"] == vision.face_box(largest, w, h):
                primary_prompt = entry.get("prompt") or primary_prompt
                break
        matched = [e for e in response_faces if e["student"]]
        if matched:
            top = max(matched, key=lambda e: e["confidence"])
            st = _live_state.get((session.id, top["student"]["id"]))
            if st:
                session.challenge = st["phase"]
                db.commit()

    present = db.query(AttendanceRecord).filter(AttendanceRecord.session_id == session.id).count()
    return {
        "faces": response_faces,
        "present_count": present,
        "challenge": session.challenge,
        "prompt": primary_prompt,
        "require_liveness": session.require_liveness,
    }


@router.get("/sessions/{session_id}/export")
def export_session(session_id: int, user: User = Depends(require_roles("faculty", "admin")), db: Session = Depends(get_db)):
    session = db.get(AttendanceSession, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    course = db.get(Course, session.course_id)
    rows = (
        db.query(AttendanceRecord, User)
        .join(User, User.id == AttendanceRecord.student_id)
        .filter(AttendanceRecord.session_id == session_id)
        .order_by(User.roll_no)
        .all()
    )
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["Roll No", "Name", "Course", "Confidence", "Liveness Verified", "Marked At"])
    for rec, stu in rows:
        writer.writerow([stu.roll_no or "", stu.name, course.code if course else "", f"{rec.confidence:.3f}", rec.liveness_verified, rec.created_at])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="attendance_session_{session_id}.csv"'},
    )


@router.get("/my-attendance")
def my_attendance(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    courses = (
        db.query(Course)
        .join(Enrollment, Enrollment.course_id == Course.id)
        .filter(Enrollment.student_id == user.id)
        .all()
    )
    result = []
    total_present = total_sessions = 0
    for course in courses:
        session_ids = [
            s.id for s in db.query(AttendanceSession).filter(AttendanceSession.course_id == course.id).all()
        ]
        if not session_ids:
            result.append({"code": course.code, "title": course.title, "present": 0, "total": 0, "percent": 0})
            continue
        present = (
            db.query(AttendanceRecord)
            .filter(AttendanceRecord.student_id == user.id, AttendanceRecord.session_id.in_(session_ids))
            .count()
        )
        total = len(session_ids)
        total_present += present
        total_sessions += total
        result.append(
            {
                "code": course.code,
                "title": course.title,
                "present": present,
                "total": total,
                "percent": round(100 * present / total) if total else 0,
            }
        )
    overall = round(100 * total_present / total_sessions) if total_sessions else 0
    return {"overall_percent": overall, "courses": result}


@router.post("/crowd")
def analyze_crowd(payload: CrowdRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        img = vision.decode_image(payload.image)
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid image")
    count, annotated, boxes = crowd.count_people(img)
    from ..models import CrowdSample

    db.add(CrowdSample(zone=payload.zone, person_count=count))
    db.commit()
    return {"count": count, "annotated": annotated, "boxes": boxes, "zone": payload.zone}


@router.get("/crowd/history")
def crowd_history(zone: str | None = None, limit: int = 40, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from ..models import CrowdSample

    query = db.query(CrowdSample)
    if zone:
        query = query.filter(CrowdSample.zone == zone)
    rows = query.order_by(CrowdSample.created_at.desc()).limit(min(limit, 200)).all()
    return [
        {"zone": r.zone, "count": r.person_count, "created_at": r.created_at}
        for r in reversed(rows)
    ]


@router.get("/crowd/zones")
def crowd_zones(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from ..models import CrowdSample

    rows = db.query(CrowdSample).order_by(CrowdSample.created_at.desc()).limit(300).all()
    latest: dict[str, dict] = {}
    for r in rows:
        if r.zone not in latest:
            latest[r.zone] = {"zone": r.zone, "count": r.person_count, "created_at": r.created_at}
    return list(latest.values())
