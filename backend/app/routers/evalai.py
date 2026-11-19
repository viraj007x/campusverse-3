from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..db import get_db
from ..deps import get_current_user, require_roles
from ..models import Assignment, Course, Enrollment, Submission, User
from ..services import evalai

router = APIRouter(prefix="/api/eval", tags=["evalai"])


class RubricItem(BaseModel):
    criterion: str = Field(min_length=2, max_length=80)
    max: float = Field(gt=0, le=100)
    description: str = ""


class AssignmentIn(BaseModel):
    course_id: int
    title: str = Field(min_length=3, max_length=180)
    prompt: str = ""
    reference: str = ""
    rubric: list[RubricItem]
    due_date: datetime | None = None


class ApproveIn(BaseModel):
    criteria: list[dict]
    summary: str = ""
    strengths: list[str] = []
    improvements: list[str] = []


def _assignment_out(assignment: Assignment, course: Course, include_reference: bool) -> dict:
    data = {
        "id": assignment.id,
        "title": assignment.title,
        "prompt": assignment.prompt,
        "rubric": assignment.rubric,
        "max_marks": assignment.max_marks,
        "due_date": assignment.due_date,
        "created_at": assignment.created_at,
        "course": {"id": course.id, "code": course.code, "title": course.title},
    }
    if include_reference:
        data["reference"] = assignment.reference
    return data


def _submission_out(submission: Submission, student: User) -> dict:
    return {
        "id": submission.id,
        "assignment_id": submission.assignment_id,
        "student_name": student.name if student else "Unknown",
        "roll_no": student.roll_no if student else None,
        "filename": submission.filename,
        "text": submission.text,
        "status": submission.status,
        "suggested_score": submission.suggested_score,
        "final_score": submission.final_score,
        "plagiarism_pct": submission.plagiarism_pct,
        "ai_probability": submission.ai_probability,
        "plagiarism_matches": submission.plagiarism_matches or [],
        "feedback": submission.feedback,
        "analysis_mode": submission.analysis_mode,
        "created_at": submission.created_at,
        "reviewed_at": submission.reviewed_at,
        "approved_at": submission.approved_at,
    }


def _student_submission_out(submission: Submission, user: User) -> dict:
    """Students can always read their own submitted text; the AI draft score stays hidden until faculty publish."""
    data = {
        "id": submission.id,
        "assignment_id": submission.assignment_id,
        "filename": submission.filename,
        "text": submission.text,
        "status": "submitted" if submission.status == "submitted" else "under_review",
        "created_at": submission.created_at,
    }
    if submission.status == "approved":
        data.update(
            {
                "status": "approved",
                "final_score": submission.final_score,
                "feedback": submission.feedback,
                "plagiarism_pct": submission.plagiarism_pct,
                "ai_probability": submission.ai_probability,
                "approved_at": submission.approved_at,
            }
        )
    return data


def _manage_or_owner(assignment: Assignment, user: User) -> None:
    if user.role == "admin":
        return
    if user.role == "faculty" and assignment.faculty_id == user.id:
        return
    raise HTTPException(status_code=403, detail="Only the course faculty can manage this assignment")


@router.get("/courses")
def my_courses(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(Course)
    if user.role == "faculty":
        query = query.filter(Course.faculty_id == user.id)
    elif user.role == "student":
        query = query.join(Enrollment, Enrollment.course_id == Course.id).filter(Enrollment.student_id == user.id)
    return [{"id": c.id, "code": c.code, "title": c.title, "semester": c.semester} for c in query.all()]


@router.post("/assignments")
def create_assignment(
    payload: AssignmentIn, user: User = Depends(require_roles("faculty", "admin")), db: Session = Depends(get_db)
):
    course = db.get(Course, payload.course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if user.role == "faculty" and course.faculty_id != user.id:
        raise HTTPException(status_code=403, detail="You can only create assignments for your own courses")
    rubric = [item.model_dump() for item in payload.rubric]
    assignment = Assignment(
        course_id=course.id,
        faculty_id=user.id,
        title=payload.title.strip(),
        prompt=payload.prompt.strip(),
        reference=payload.reference.strip(),
        rubric=rubric,
        max_marks=round(sum(item["max"] for item in rubric), 1),
        due_date=payload.due_date,
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return _assignment_out(assignment, course, include_reference=True)


@router.get("/assignments")
def list_assignments(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(Assignment, Course).join(Course, Course.id == Assignment.course_id)
    if user.role == "student":
        query = query.join(Enrollment, Enrollment.course_id == Course.id).filter(Enrollment.student_id == user.id)
    rows = query.order_by(Assignment.created_at.desc()).all()
    output = []
    for assignment, course in rows:
        data = _assignment_out(assignment, course, include_reference=user.role != "student")
        submissions = db.query(Submission).filter(Submission.assignment_id == assignment.id).all()
        approved = [s for s in submissions if s.status == "approved" and s.final_score is not None]
        data["stats"] = {
            "submissions": len(submissions),
            "awaiting_review": sum(1 for s in submissions if s.status != "approved"),
            "approved": len(approved),
            "avg_score": round(sum(s.final_score for s in approved) / len(approved), 1) if approved else None,
            "ai_flagged": sum(1 for s in submissions if s.ai_probability >= 60),
            "plagiarism_flagged": sum(1 for s in submissions if s.plagiarism_pct >= 35),
        }
        if user.role == "student":
            mine = next((s for s in submissions if s.student_id == user.id), None)
            data["my_submission"] = _student_submission_out(mine, user) if mine else None
        output.append(data)
    return output


@router.get("/assignments/{assignment_id}")
def assignment_detail(
    assignment_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    assignment = db.get(Assignment, assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    course = db.get(Course, assignment.course_id)
    data = {"assignment": _assignment_out(assignment, course, include_reference=user.role != "student")}
    if user.role == "student":
        mine = (
            db.query(Submission)
            .filter(Submission.assignment_id == assignment.id, Submission.student_id == user.id)
            .first()
        )
        data["my_submission"] = _student_submission_out(mine, user) if mine else None
        return data
    rows = (
        db.query(Submission, User)
        .join(User, User.id == Submission.student_id)
        .filter(Submission.assignment_id == assignment.id)
        .order_by(Submission.created_at.desc())
        .all()
    )
    data["submissions"] = [_submission_out(s, student) for s, student in rows]
    data["enrolled"] = db.query(Enrollment).filter(Enrollment.course_id == assignment.course_id).count()
    return data


@router.post("/assignments/{assignment_id}/submit")
def submit_assignment(
    assignment_id: int,
    text: str = Form(""),
    file: UploadFile | None = File(None),
    user: User = Depends(require_roles("student")),
    db: Session = Depends(get_db),
):
    assignment = db.get(Assignment, assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if not db.query(Enrollment).filter(Enrollment.course_id == assignment.course_id, Enrollment.student_id == user.id).first():
        raise HTTPException(status_code=403, detail="You are not enrolled in this course")

    body = text.strip()
    filename = "pasted-text"
    if file is not None and file.filename:
        raw = file.file.read()
        if not raw:
            raise HTTPException(status_code=422, detail="The uploaded file is empty")
        if len(raw) > 10 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="File must be smaller than 10 MB")
        if not file.filename.lower().endswith((".pdf", ".txt", ".md")):
            raise HTTPException(status_code=422, detail="Upload a PDF or plain-text file")
        try:
            extracted = evalai.extract_text(file.filename, raw)
        except Exception:
            raise HTTPException(status_code=422, detail="Could not read the uploaded file")
        body = (body + "\n\n" + extracted).strip() if body else extracted
        filename = file.filename

    if len(body.split()) < 40:
        raise HTTPException(status_code=422, detail="The submission is too short — at least 40 words are required")

    existing = (
        db.query(Submission)
        .filter(Submission.assignment_id == assignment.id, Submission.student_id == user.id)
        .first()
    )
    if existing and existing.status == "approved":
        raise HTTPException(status_code=409, detail="This submission is already graded and published")
    if existing:
        existing.text = body
        existing.filename = filename
        existing.status = "submitted"
        existing.suggested_score = None
        existing.plagiarism_pct = 0
        existing.ai_probability = 0
        existing.plagiarism_matches = []
        existing.feedback = None
        existing.reviewed_at = None
        submission = existing
    else:
        submission = Submission(assignment_id=assignment.id, student_id=user.id, filename=filename, text=body)
        db.add(submission)
    db.commit()
    db.refresh(submission)
    return _submission_out(submission, user)


@router.post("/submissions/{submission_id}/review")
async def review_submission(
    submission_id: int, user: User = Depends(require_roles("faculty", "admin")), db: Session = Depends(get_db)
):
    submission = db.get(Submission, submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    assignment = db.get(Assignment, submission.assignment_id)
    _manage_or_owner(assignment, user)
    if submission.status == "approved":
        raise HTTPException(status_code=409, detail="Approved submissions are locked")

    peers = (
        db.query(Submission, User)
        .join(User, User.id == Submission.student_id)
        .filter(Submission.assignment_id == submission.assignment_id, Submission.id != submission.id)
        .all()
    )
    plagiarism_pct, matches = evalai.plagiarism(
        submission.text, [(s.student_id, student.name, s.text) for s, student in peers]
    )
    ai_probability, signals = evalai.ai_likelihood(submission.text)
    feedback = await evalai.grade_submission(
        submission.text, assignment.prompt, assignment.reference, assignment.rubric or [], plagiarism_pct, ai_probability
    )
    criteria = feedback.get("criteria", [])
    feedback["ai_signals"] = signals

    submission.plagiarism_pct = plagiarism_pct
    submission.plagiarism_matches = matches
    submission.ai_probability = ai_probability
    submission.feedback = feedback
    submission.suggested_score = evalai.total_of(criteria)
    submission.analysis_mode = feedback.get("mode", "offline")
    submission.status = "reviewed"
    submission.reviewed_at = datetime.utcnow()
    db.commit()
    db.refresh(submission)
    student = db.get(User, submission.student_id)
    return _submission_out(submission, student)


@router.post("/submissions/{submission_id}/approve")
def approve_submission(
    submission_id: int,
    payload: ApproveIn,
    user: User = Depends(require_roles("faculty", "admin")),
    db: Session = Depends(get_db),
):
    submission = db.get(Submission, submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    assignment = db.get(Assignment, submission.assignment_id)
    _manage_or_owner(assignment, user)
    if not payload.criteria:
        raise HTTPException(status_code=422, detail="Mark every rubric criterion before publishing")
    if submission.status != "reviewed":
        raise HTTPException(status_code=409, detail="Run the AI review before approving")

    final_score = evalai.total_of(payload.criteria)
    feedback = submission.feedback or {}
    feedback.update(
        {
            "criteria": payload.criteria,
            "summary": payload.summary or feedback.get("summary", ""),
            "strengths": payload.strengths or feedback.get("strengths", []),
            "improvements": payload.improvements or feedback.get("improvements", []),
        }
    )
    submission.feedback = feedback
    submission.final_score = final_score
    submission.status = "approved"
    submission.approved_at = datetime.utcnow()
    db.commit()
    db.refresh(submission)
    student = db.get(User, submission.student_id)
    return _submission_out(submission, student)


@router.get("/my")
def my_submissions(user: User = Depends(require_roles("student")), db: Session = Depends(get_db)):
    rows = (
        db.query(Submission, Assignment, Course)
        .join(Assignment, Assignment.id == Submission.assignment_id)
        .join(Course, Course.id == Assignment.course_id)
        .filter(Submission.student_id == user.id)
        .order_by(Submission.created_at.desc())
        .all()
    )
    return [
        {
            "submission": _student_submission_out(submission, user),
            "assignment": {
                "id": assignment.id,
                "title": assignment.title,
                "course": course.code,
                "max_marks": assignment.max_marks,
            },
        }
        for submission, assignment, course in rows
    ]


@router.get("/stats")
def eval_stats(user: User = Depends(require_roles("faculty", "admin")), db: Session = Depends(get_db)):
    submission_query = db.query(Submission).join(Assignment, Assignment.id == Submission.assignment_id)
    if user.role == "faculty":
        submission_query = submission_query.filter(Assignment.faculty_id == user.id)
    submissions = submission_query.all()
    flagged_plagiarism = [s for s in submissions if s.plagiarism_pct >= 35]
    flagged_ai = [s for s in submissions if s.ai_probability >= 60]
    approved = [s for s in submissions if s.status == "approved" and s.final_score is not None]
    return {
        "submissions": len(submissions),
        "awaiting_review": sum(1 for s in submissions if s.status != "approved"),
        "approved": len(approved),
        "avg_score": round(sum(s.final_score for s in approved) / len(approved), 1) if approved else None,
        "plagiarism_flagged": len(flagged_plagiarism),
        "ai_flagged": len(flagged_ai),
        "llm_mode": "online" if any(s.analysis_mode != "offline" for s in submissions if s.analysis_mode) else "offline",
    }
