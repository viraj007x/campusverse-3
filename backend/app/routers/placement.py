import json

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..deps import get_current_user
from ..models import JobMatch, MockInterview, ResumeProfile, User
from ..schemas import InterviewAnswerRequest, InterviewStartRequest, JobMatchRequest
from ..services import llm, placement

router = APIRouter(prefix="/api/placement", tags=["placement"])


@router.post("/resume")
def upload_resume(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    raw = file.file.read()
    if len(raw) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Resume must be smaller than 5 MB")
    try:
        text = placement.resume_text(raw)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    skills = placement.extract_skills(text)
    profile = ResumeProfile(user_id=user.id, filename=file.filename or "resume.pdf", text=text, skills=skills)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return {
        "id": profile.id,
        "filename": profile.filename,
        "characters": len(text),
        "skills": skills,
        "created_at": profile.created_at,
    }


@router.get("/resume")
def latest_resume(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = (
        db.query(ResumeProfile)
        .filter(ResumeProfile.user_id == user.id)
        .order_by(ResumeProfile.created_at.desc())
        .first()
    )
    if not profile:
        return {"exists": False}
    return {
        "exists": True,
        "id": profile.id,
        "filename": profile.filename,
        "characters": len(profile.text),
        "skills": profile.skills,
        "created_at": profile.created_at,
    }


ROADMAP_PROMPT = """You are a senior engineering career coach. A student wants to close the gap for a job.

Role: {role}
Resume skills: {resume_skills}
Job description skills: {jd_skills}
Missing skills: {missing}

Return ONLY valid JSON with this shape:
{{"summary": "2 sentence assessment of fit", "roadmap": [{{"skill": "...", "why": "why it matters for this role", "steps": ["concrete step 1", "step 2", "step 3"], "duration_weeks": 2}}]}}
Cover at most 6 missing skills. Be specific and practical, no generic advice."""


@router.post("/match")
async def match_job(payload: JobMatchRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = (
        db.query(ResumeProfile)
        .filter(ResumeProfile.user_id == user.id)
        .order_by(ResumeProfile.created_at.desc())
        .first()
    )
    if not profile:
        raise HTTPException(status_code=400, detail="Upload your resume first")
    score, matched, missing = placement.score_match(profile.text, payload.jd_text)
    summary = ""
    roadmap = []
    if settings.llm_mode != "offline":
        try:
            raw = await llm.complete(
                [
                    {
                        "role": "user",
                        "content": ROADMAP_PROMPT.format(
                            role=payload.jd_title,
                            resume_skills=", ".join(profile.skills) or "none listed",
                            jd_skills=", ".join(sorted(set(matched) | set(missing))) or "not explicit",
                            missing=", ".join(missing) or "none",
                        ),
                    }
                ],
                temperature=0.4,
            )
            data = llm.extract_json(raw)
            if isinstance(data, dict):
                summary = data.get("summary", "")
                roadmap = data.get("roadmap", [])
        except Exception:
            pass
    if not roadmap:
        roadmap = placement.offline_roadmap(missing, payload.jd_title)
        if not summary:
            if missing:
                summary = (
                    f"Your resume matches {len(matched)} of {len(matched) + len(missing)} skills detected in this job description "
                    f"with an overall fit of {score}%. Close the gaps below to improve your shortlisting chances."
                )
            else:
                summary = f"Your resume covers every skill detected in this job description. Overall fit is {score}%."

    match = JobMatch(
        user_id=user.id,
        jd_title=payload.jd_title,
        jd_text=payload.jd_text,
        score=score,
        matched_skills=matched,
        missing_skills=missing,
        roadmap=roadmap,
    )
    db.add(match)
    db.commit()
    db.refresh(match)
    return {
        "id": match.id,
        "score": score,
        "matched_skills": matched,
        "missing_skills": missing,
        "summary": summary,
        "roadmap": roadmap,
        "resume_skills": profile.skills,
        "created_at": match.created_at,
    }


@router.get("/matches")
def match_history(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (
        db.query(JobMatch)
        .filter(JobMatch.user_id == user.id)
        .order_by(JobMatch.created_at.desc())
        .limit(20)
        .all()
    )
    return [
        {
            "id": r.id,
            "jd_title": r.jd_title,
            "score": r.score,
            "missing_skills": r.missing_skills,
            "created_at": r.created_at,
        }
        for r in rows
    ]


QUESTION_PROMPT = """You are a technical interviewer at a product company.
Role: {role}
Candidate skills on resume: {skills}
Generate exactly 5 interview questions: 3 technical, 1 project-based, 1 behavioural. Calibrate difficulty to a final year B.Tech student.
Return ONLY valid JSON: {{"questions": [{{"question": "...", "focus": "what it assesses"}}]}}"""

SCORE_PROMPT = """You are a strict but fair technical interviewer for the role: {role}.
Question: {question}
Candidate answer: {answer}
Return ONLY valid JSON: {{"score": <integer 0-100>, "feedback": "2 sentences", "strengths": ["..."], "improve": ["..."]}}
Score out of 100 using accuracy, depth, structure and clarity."""


@router.post("/interview/start")
async def start_interview(payload: InterviewStartRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = (
        db.query(ResumeProfile)
        .filter(ResumeProfile.user_id == user.id)
        .order_by(ResumeProfile.created_at.desc())
        .first()
    )
    skills = profile.skills if profile else []
    questions = None
    if settings.llm_mode != "offline":
        try:
            raw = await llm.complete(
                [
                    {
                        "role": "user",
                        "content": QUESTION_PROMPT.format(
                            role=payload.role_title, skills=", ".join(skills) or "not provided"
                        ),
                    }
                ],
                temperature=0.6,
            )
            data = llm.extract_json(raw)
            if isinstance(data, dict) and isinstance(data.get("questions"), list) and len(data["questions"]) >= 3:
                questions = [
                    {"question": str(q.get("question", "")).strip(), "focus": str(q.get("focus", ""))}
                    for q in data["questions"][:5]
                    if q.get("question")
                ]
        except Exception:
            pass
    if not questions:
        recent = (
            db.query(MockInterview)
            .filter(MockInterview.user_id == user.id)
            .order_by(MockInterview.created_at.desc())
            .limit(3)
            .all()
        )
        avoid = {turn.get("question") for interview in recent for turn in (interview.transcript or [])}
        avoid.update({q.get("question") for interview in recent for q in (interview.questions or [])})
        questions = placement.offline_questions(payload.role_title, avoid)

    interview = MockInterview(user_id=user.id, role_title=payload.role_title, questions=questions)
    db.add(interview)
    db.commit()
    db.refresh(interview)
    return {
        "id": interview.id,
        "role_title": interview.role_title,
        "questions": [q["question"] for q in questions],
        "mode": settings.llm_mode,
    }


@router.post("/interview/answer")
async def answer_interview(
    payload: InterviewAnswerRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    interview = db.get(MockInterview, payload.interview_id)
    if not interview or interview.user_id != user.id:
        raise HTTPException(status_code=404, detail="Interview not found")
    if interview.result:
        raise HTTPException(status_code=400, detail="This interview is already completed")
    answer = payload.answer.strip()
    if not answer:
        raise HTTPException(status_code=422, detail="Answer cannot be empty")
    idx = len(interview.transcript)
    if idx >= len(interview.questions):
        raise HTTPException(status_code=400, detail="All questions already answered")
    question = interview.questions[idx]["question"]

    evaluation = None
    if settings.llm_mode != "offline":
        try:
            raw = await llm.complete(
                [
                    {
                        "role": "user",
                        "content": SCORE_PROMPT.format(role=interview.role_title, question=question, answer=answer),
                    }
                ],
                temperature=0.2,
            )
            data = llm.extract_json(raw)
            if isinstance(data, dict) and "score" in data:
                evaluation = {
                    "score": int(max(0, min(100, int(data["score"])))),
                    "feedback": str(data.get("feedback", "")),
                    "strengths": data.get("strengths", []) or [],
                    "improve": data.get("improve", []) or [],
                }
        except Exception:
            pass
    if evaluation is None:
        evaluation = placement.heuristic_answer_score(answer, question)

    transcript = list(interview.transcript)
    transcript.append({"question": question, "answer": answer, **evaluation})
    interview.transcript = transcript

    next_question = None
    result = None
    if len(transcript) >= len(interview.questions):
        scores = [t["score"] for t in transcript]
        overall = round(sum(scores) / len(scores)) if scores else 0
        if overall >= 75:
            level, summary = "Strong", "You are interview-ready for this level. Keep practising timed mock interviews to maintain fluency."
        elif overall >= 55:
            level, summary = "Developing", "Your fundamentals are visible but answers need more depth and concrete project evidence."
        else:
            level, summary = "Needs work", "Focus on structuring answers with context, approach and result, and revise core concepts for this role."
        result = {"overall_score": overall, "level": level, "summary": summary, "answered": len(transcript)}
        interview.result = result
    else:
        next_question = interview.questions[len(transcript)]["question"]

    db.commit()
    return {
        "evaluation": evaluation,
        "answered": len(transcript),
        "total": len(interview.questions),
        "next_question": next_question,
        "result": result,
    }


@router.get("/interviews")
def interviews(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (
        db.query(MockInterview)
        .filter(MockInterview.user_id == user.id)
        .order_by(MockInterview.created_at.desc())
        .limit(10)
        .all()
    )
    return [
        {
            "id": r.id,
            "role_title": r.role_title,
            "questions": len(r.questions),
            "answered": len(r.transcript),
            "result": r.result,
            "created_at": r.created_at,
        }
        for r in rows
    ]
