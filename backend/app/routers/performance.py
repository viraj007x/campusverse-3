import threading

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import SessionLocal, get_db
from ..deps import get_current_user, require_roles
from ..models import User
from ..services import performance

router = APIRouter(prefix="/api/performance", tags=["performance"])


class WhatIfIn(BaseModel):
    attendance_pct: float | None = None
    assignment_avg: float | None = None
    internal_avg: float | None = None
    ai_flag_rate: float | None = None
    prev_backlogs: int | None = None
    prev_sgpa: float | None = None
    semester: int | None = None


@router.get("/summary")
def summary(user: User = Depends(require_roles("faculty", "admin")), db: Session = Depends(get_db)):
    return performance.summary(db)


@router.get("/model")
def model_metrics(user: User = Depends(get_current_user)):
    state = performance.state()
    metrics = performance.get_metrics()
    return {"state": state, "metrics": metrics}


@router.get("/students")
def students(
    page: int = 1,
    size: int = 25,
    search: str = "",
    department: str = "",
    semester: int | None = None,
    risk: str = "",
    cluster: str = "",
    anomaly: str = "",
    sort: str = "risk",
    direction: str = "desc",
    user: User = Depends(require_roles("faculty", "admin")),
    db: Session = Depends(get_db),
):
    return performance.list_students(
        db,
        page=page,
        size=size,
        search=search,
        department=department,
        semester=semester,
        risk=risk,
        cluster=cluster,
        anomaly=anomaly,
        sort=sort,
        direction=direction,
    )


@router.get("/clusters")
def clusters(user: User = Depends(require_roles("faculty", "admin")), db: Session = Depends(get_db)):
    return performance.clusters(db)


@router.get("/anomalies")
def anomalies(
    page: int = 1,
    size: int = 25,
    user: User = Depends(require_roles("faculty", "admin")),
    db: Session = Depends(get_db),
):
    return performance.anomalies(db, page=page, size=size)


@router.get("/attendance-risk")
def attendance_risk(
    page: int = 1,
    size: int = 25,
    department: str = "",
    semester: int | None = None,
    user: User = Depends(require_roles("faculty", "admin")),
    db: Session = Depends(get_db),
):
    return performance.attendance_risk(db, page=page, size=size, department=department, semester=semester)


@router.get("/interventions")
def interventions(
    limit: int = 25,
    user: User = Depends(require_roles("faculty", "admin")),
    db: Session = Depends(get_db),
):
    return performance.interventions(db, limit=limit)


@router.get("/students/{roll_no}")
def student_detail(roll_no: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role == "student" and user.roll_no != roll_no:
        raise HTTPException(status_code=403, detail="You can only view your own performance record")
    record = performance.detail(db, roll_no)
    if not record:
        raise HTTPException(status_code=404, detail="No performance record for this roll number")
    return record


@router.post("/what-if")
def what_if(payload: WhatIfIn, user: User = Depends(get_current_user)):
    return performance.predict(payload.model_dump(exclude_none=True))


@router.get("/cohorts")
def cohort_analytics(user: User = Depends(require_roles("faculty", "admin")), db: Session = Depends(get_db)):
    return performance.cohorts(db)


def _retrain() -> None:
    db = SessionLocal()
    try:
        performance.train_models(db, force=True)
    except Exception as exc:  # pragma: no cover - diagnostics
        print(f"PerformanceTracker retrain failed: {exc}")
    finally:
        db.close()


@router.post("/retrain")
def retrain(user: User = Depends(require_roles("admin"))):
    if performance.state()["status"] in ("preparing", "training"):
        raise HTTPException(status_code=409, detail="Training is already running")
    threading.Thread(target=_retrain, daemon=True).start()
    return {"status": "training"}
