import hashlib
import json
import math
import re
import threading
import time
from datetime import datetime
from pathlib import Path

import numpy as np
from sqlalchemy import Integer, case, cast, func, insert, or_, select
from sqlalchemy.orm import Session

from ..config import settings
from ..models import PerformanceRecord, User
from . import realdata

TOTAL_RECORDS = 100_000
DATASET_VERSION = 4
ENGAGEMENT_TARGET = 5.0  # active-day engagement below this marks the low-engagement watchlist (~bottom quarter of OULAD)
CHUNK = 10_000
ARTIFACT_DIR = settings.backend_dir / "artifacts" if hasattr(settings, "backend_dir") else Path(__file__).resolve().parents[2] / "artifacts"
ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
METRICS_PATH = ARTIFACT_DIR / "performance_metrics.json"
MODEL_PATH = ARTIFACT_DIR / "performance_model.joblib"

DEPARTMENTS = [
    ("Computer Science", "CS", "CSE"),
    ("Information Technology", "IT", "IT"),
    ("Artificial Intelligence and Data Science", "AD", "AI&DS"),
    ("Electronics and Communication", "EC", "ECE"),
    ("Electrical and Electronics", "EE", "EEE"),
    ("Mechanical", "ME", "MECH"),
    ("Civil", "CV", "CIVIL"),
]
FIRST_NAMES = [
    "Aarav", "Diya", "Rohan", "Sneha", "Kabir", "Ananya", "Vivaan", "Isha", "Arjun", "Meera",
    "Aditya", "Priya", "Rahul", "Kavya", "Nikhil", "Tara", "Siddharth", "Riya", "Karthik", "Nandini",
    "Dev", "Pooja", "Manav", "Shreya", "Varun", "Anika", "Harsh", "Divya", "Yash", "Sanya",
    "Abhinav", "Lakshmi", "Farhan", "Neha", "Vikram", "Trisha", "Sameer", "Aditi", "Mohit", "Sara",
]
LAST_NAMES = [
    "Sharma", "Patel", "Verma", "Iyer", "Singh", "Rao", "Nair", "Krishnan", "Reddy", "Gupta",
    "Mehta", "Joshi", "Kulkarni", "Menon", "Chopra", "Bhat", "Desai", "Raman", "Khan", "Pillai",
    "Agarwal", "Shetty", "Das", "Mishra", "Kaur", "Ghosh", "Banerjee", "Naidu", "Saxena", "Malhotra",
]

FEATURES = [
    "attendance_pct",
    "assignment_avg",
    "prev_backlogs",
    "semester",
]
FEATURE_LABELS = {
    "attendance_pct": "VLE engagement",
    "assignment_avg": "Assignment average",
    "prev_backlogs": "Previous attempts",
    "semester": "Presentation",
}
# Features where a lower value increases risk
LOW_IS_BAD = {"attendance_pct", "assignment_avg"}

ATTENDANCE_FEATURES = FEATURES + [
    "assignment_completion",
    "study_hours",
    "library_visits",
    "lms_activity",
]
ATTENDANCE_LABELS = {
    **FEATURE_LABELS,
    "assignment_completion": "Assignment completion (early)",
    "study_hours": "VLE clicks / week (early)",
    "library_visits": "Active study days (early)",
    "lms_activity": "VLE clicks (early)",
}
CLUSTER_FEATURES = [
    "attendance_pct",
    "assignment_avg",
    "internal_avg",
    "prev_sgpa",
    "final_sgpa",
    "study_hours",
    "lms_activity",
    "placement_readiness",
    "prev_backlogs",
]
CLUSTER_NAMES = [
    "High performers",
    "Steady core",
    "Engaged improvers",
    "Disengaged",
    "Critical support",
]
CLUSTER_DESCRIPTIONS = {
    "High performers": "Strong academics, consistent engagement and placement-ready skills.",
    "Steady core": "Reliable mid-band cohort; small nudges unlock placement readiness.",
    "Engaged improvers": "High effort with uneven results; targeted subject support pays off.",
    "Disengaged": "Low VLE engagement and active study days are dragging performance down.",
    "Critical support": "Multiple compounding risk factors; needs faculty intervention now.",
}

SUBJECTS = {
    "Computer Science": ["Data Structures & Algorithms", "Database Management Systems", "Operating Systems", "Computer Networks", "Software Engineering", "Machine Learning"],
    "Information Technology": ["Web Technologies", "DBMS", "Computer Networks", "Information Security", "Cloud Computing", "Data Analytics"],
    "Artificial Intelligence and Data Science": ["Machine Learning", "Deep Learning", "Statistics for Data Science", "Natural Language Processing", "Big Data Analytics", "Computer Vision"],
    "Electronics and Communication": ["Digital Signal Processing", "VLSI Design", "Microcontrollers", "Communication Systems", "Embedded Systems", "Antenna Theory"],
    "Electrical and Electronics": ["Power Systems", "Control Systems", "Electrical Machines", "Power Electronics", "Renewable Energy", "Circuit Theory"],
    "Mechanical": ["Thermodynamics", "Fluid Mechanics", "Machine Design", "Manufacturing Processes", "Heat Transfer", "Robotics"],
    "Civil": ["Structural Analysis", "Geotechnical Engineering", "Transportation Engineering", "Water Resources", "Construction Management", "Surveying"],
}

CAREER_ROLES = [
    ("Software Engineer", {"coding_skill": 0.45, "communication_skill": 0.10, "sgpa": 0.20, "certifications": 0.10, "internship_months": 0.15}),
    ("Data Analyst", {"coding_skill": 0.30, "communication_skill": 0.15, "sgpa": 0.25, "certifications": 0.15, "internship_months": 0.15}),
    ("Product Engineer", {"coding_skill": 0.30, "communication_skill": 0.30, "sgpa": 0.20, "certifications": 0.10, "internship_months": 0.10}),
    ("QA / Automation Engineer", {"coding_skill": 0.25, "communication_skill": 0.20, "sgpa": 0.20, "certifications": 0.15, "internship_months": 0.20}),
    ("Research Assistant", {"coding_skill": 0.20, "communication_skill": 0.10, "sgpa": 0.40, "certifications": 0.20, "internship_months": 0.10}),
]

DEMO_STUDENTS = [
    # roll, name, attendance, assignment avg, internal avg, ai flag %, prev backlogs, prev SGPA
    ("23CS101", "Aarav Sharma", 78.0, 7.4, 74.0, 12.0, 0, 7.6),
    ("23CS102", "Diya Patel", 82.0, 7.8, 76.0, 8.0, 0, 7.9),
    ("23CS103", "Rohan Verma", 71.0, 6.4, 66.0, 32.0, 1, 6.8),
    ("23CS104", "Sneha Iyer", 88.0, 8.5, 82.0, 3.0, 0, 8.4),
    ("23CS105", "Kabir Singh", 58.0, 5.2, 54.0, 18.0, 2, 5.9),
    ("23CS106", "Ananya Rao", 91.0, 8.9, 86.0, 2.0, 0, 8.7),
]
DEMO_EXTRAS = {
    "23CS101": dict(practical_avg=72.0, assignment_completion=82.0, study_hours=15.0, library_visits=5, lms_activity=70.0,
                    coding_skill=68.0, communication_skill=70.0, certifications=1, internship_months=2, placement_readiness=62.0,
                    attendance_next=80.0),
    "23CS102": dict(practical_avg=76.0, assignment_completion=88.0, study_hours=18.0, library_visits=7, lms_activity=78.0,
                    coding_skill=74.0, communication_skill=76.0, certifications=2, internship_months=3, placement_readiness=72.0,
                    attendance_next=83.0),
    "23CS103": dict(practical_avg=62.0, assignment_completion=64.0, study_hours=11.0, library_visits=3, lms_activity=55.0,
                    coding_skill=58.0, communication_skill=62.0, certifications=0, internship_months=1, placement_readiness=45.0,
                    attendance_next=68.0),
    "23CS104": dict(practical_avg=84.0, assignment_completion=94.0, study_hours=22.0, library_visits=10, lms_activity=88.0,
                    coding_skill=82.0, communication_skill=80.0, certifications=3, internship_months=4, placement_readiness=84.0,
                    attendance_next=89.0),
    "23CS105": dict(practical_avg=48.0, assignment_completion=45.0, study_hours=7.0, library_visits=1, lms_activity=35.0,
                    coding_skill=42.0, communication_skill=50.0, certifications=0, internship_months=0, placement_readiness=28.0,
                    attendance_next=52.0),
    "23CS106": dict(practical_avg=88.0, assignment_completion=96.0, study_hours=24.0, library_visits=12, lms_activity=92.0,
                    coding_skill=88.0, communication_skill=85.0, certifications=4, internship_months=5, placement_readiness=90.0,
                    attendance_next=92.0),
}

# Cohort-level effects so department and semester analytics show real signal
DEPT_ABILITY = np.array([0.28, 0.16, 0.30, 0.02, -0.10, -0.05, -0.12])
SEM_SGPA_SHIFT = np.array([0.18, 0.10, -0.12, -0.22, -0.10, 0.02, 0.14, 0.22])

_lock = threading.Lock()
_train_lock = threading.Lock()
_model_cache: dict | None = None
_unsup: dict | None = None
_cache: dict = {}
_state = {
    "status": "idle",  # idle | preparing | training | ready | error
    "records": 0,
    "target": TOTAL_RECORDS,
    "ingest_ms": 0,
    "error": None,
    "source": None,
}

FEATURE_DEFAULTS = {
    "attendance_pct": 20.0,
    "assignment_avg": 5.7,
    "prev_backlogs": 0,
    "semester": 1,
}


def state() -> dict:
    return dict(_state, metrics_ready=METRICS_PATH.exists())


def _risk_logit(attendance: float, assignment: float, backlogs: float, semester: float) -> float:
    return (
        -1.15
        - 0.055 * (attendance - 25)
        - 0.85 * (assignment - 5.5)
        + 0.55 * backlogs
        + 0.06 * (semester - 1)
    )


def _tier(score: float) -> str:
    if score >= 0.60:
        return "high"
    if score >= 0.32:
        return "medium"
    return "low"


def _fit_unsupervised(matrix: np.ndarray) -> dict:
    from sklearn.cluster import KMeans
    from sklearn.ensemble import IsolationForest
    from sklearn.preprocessing import StandardScaler

    scaler = StandardScaler()
    z = scaler.fit_transform(matrix)
    kmeans = KMeans(n_clusters=5, n_init=10, random_state=42)
    kmeans.fit(z)
    centroids = scaler.inverse_transform(kmeans.cluster_centers_)
    readiness_i = CLUSTER_FEATURES.index("placement_readiness")
    attendance_i = CLUSTER_FEATURES.index("attendance_pct")
    rank_score = centroids[:, readiness_i] * 0.7 + centroids[:, attendance_i] * 0.3
    order = rank_score.argsort()[::-1]
    names = {int(cluster): CLUSTER_NAMES[rank] for rank, cluster in enumerate(order)}
    iso = IsolationForest(n_estimators=100, contamination=0.025, random_state=42)
    iso.fit(z)
    decision = iso.decision_function(z)
    return {
        "scaler": scaler,
        "kmeans": kmeans,
        "iso": iso,
        "threshold": float(np.percentile(decision, 2.5)),
        "names": names,
    }


def _generate_rows(rng: np.random.Generator, start: int, count: int) -> list[dict]:
    """Vectorised synthetic cohort chunk: realistic latents, attendance/assignment correlations and tier labels."""
    global _unsup
    idx = np.arange(start, start + count)
    dept_idx = rng.integers(0, len(DEPARTMENTS), count)
    year = rng.integers(1, 5, count)
    semester = 2 * (year - 1) + rng.integers(1, 3, count)
    ability = rng.normal(0, 1, count) + DEPT_ABILITY[dept_idx]
    attendance_t = np.clip(rng.normal(76 + 5 * ability, 10), 30, 100)
    backlogs_t = rng.poisson(np.clip(0.85 - 0.008 * (attendance_t - 70) - 0.10 * ability, 0.12, None))
    assignment_t = np.clip(
        6.3 + 0.9 * ability + 0.024 * (attendance_t - 76) - 0.35 * backlogs_t + rng.normal(0, 0.8, count), 0, 10
    )
    internal_t = np.clip(62 + 7 * ability + 0.18 * (attendance_t - 76) - 2 * backlogs_t + rng.normal(0, 7, count), 0, 100)
    ai_flag_t = np.clip(rng.gamma(2.0, 9.0, count) - 4 + (assignment_t > 8.5) * 6, 0, 100)
    prev_sgpa_t = np.clip(
        6.4
        + 0.55 * ability
        + 0.02 * (attendance_t - 76)
        + 0.14 * (assignment_t - 6.3)
        - 0.15 * backlogs_t
        + rng.normal(0, 0.35, count),
        0,
        10,
    )
    logit = (
        -3.6
        - 0.09 * (attendance_t - 76)
        - 0.55 * (assignment_t - 6.3)
        - 0.04 * (internal_t - 64)
        + 0.70 * backlogs_t
        + 0.02 * (ai_flag_t - 15)
        - 0.50 * (prev_sgpa_t - 6.4)
    )
    risk = np.clip(1 / (1 + np.exp(-(logit + rng.normal(0, 0.50, count)))), 0.01, 0.99)
    final_sgpa = np.clip(
        prev_sgpa_t
        + 0.30 * (0.5 * attendance_t / 100 + 0.5 * assignment_t / 10 - 0.62)
        - 0.12 * backlogs_t
        + SEM_SGPA_SHIFT[semester - 1]
        + rng.normal(0, 0.35, count),
        0,
        10,
    )

    practical_t = np.clip(58 + 8 * ability + 0.35 * (internal_t - 62) + rng.normal(0, 6, count), 0, 100)
    completion_t = np.clip(
        58 + 22 * ability + 0.35 * (attendance_t - 76) - 2.5 * backlogs_t + rng.normal(0, 8, count), 0, 100
    )
    study_t = np.clip(11 + 2.0 * ability + 0.10 * (attendance_t - 76) - 0.9 * backlogs_t + rng.normal(0, 3.5, count), 0, 40)
    library_t = np.clip(3 + 1.2 * ability + 0.12 * study_t + 0.04 * (attendance_t - 70) + rng.normal(0, 2, count), 0, 30)
    lms_t = np.clip(
        48
        + 14 * ability
        + 0.30 * (attendance_t - 76)
        + 0.18 * (completion_t - 70)
        - 2.0 * backlogs_t
        + rng.normal(0, 7, count),
        0,
        100,
    )
    dept_coding = np.array([8, 6, 7, 0, -2, -4, -6])[dept_idx]
    coding_t = np.clip(44 + 11 * ability + 0.9 * study_t + dept_coding + rng.normal(0, 9, count), 0, 100)
    comm_t = np.clip(54 + 7 * ability + 0.10 * (attendance_t - 76) + rng.normal(0, 9, count), 0, 100)
    cert_t = np.clip(
        rng.poisson(np.clip(0.55 + 0.35 * ability + 0.015 * study_t + 0.002 * attendance_t, 0.05, None)), 0, 8
    )
    intern_t = np.clip(
        rng.poisson(np.clip(0.45 + 0.55 * ability + 0.10 * (year - 1) + 0.004 * attendance_t, 0.05, None)), 0, 12
    )
    readiness_t = np.clip(
        0.35 * coding_t
        + 0.20 * comm_t
        + 1.8 * final_sgpa
        + 3.0 * cert_t
        + 2.5 * intern_t
        + 0.10 * attendance_t
        - 2.0 * backlogs_t
        - 2.0,
        0,
        100,
    )
    attendance_next_t = np.clip(
        attendance_t
        + 2.0 * (lms_t - 50) / 50
        + 1.5 * (completion_t - 70) / 30
        - 0.6 * backlogs_t
        + rng.normal(0, 3.5, count),
        20,
        100,
    )

    # Stored features carry measurement noise, so the trained model cannot read the label function directly
    attendance = np.clip(attendance_t + rng.normal(0, 3.5, count), 25, 100)
    assignment = np.clip(assignment_t + rng.normal(0, 0.45, count), 0, 10)
    internal = np.clip(internal_t + rng.normal(0, 4, count), 0, 100)
    ai_flag = np.clip(ai_flag_t + rng.normal(0, 4, count), 0, 100)
    backlogs = np.maximum(0, np.round(backlogs_t + rng.normal(0, 0.4, count))).astype(int)
    prev_sgpa = np.clip(prev_sgpa_t + rng.normal(0, 0.3, count), 0, 10)
    practical = np.clip(practical_t + rng.normal(0, 4, count), 0, 100)
    completion = np.clip(completion_t + rng.normal(0, 5, count), 0, 100)
    study = np.clip(study_t + rng.normal(0, 2, count), 0, 40)
    library = np.maximum(0, np.round(library_t + rng.normal(0, 1.2, count))).astype(int)
    lms = np.clip(lms_t + rng.normal(0, 4, count), 0, 100)
    coding = np.clip(coding_t + rng.normal(0, 5, count), 0, 100)
    comm = np.clip(comm_t + rng.normal(0, 5, count), 0, 100)
    certs = np.maximum(0, np.round(cert_t + rng.normal(0, 0.3, count))).astype(int)
    internships = np.maximum(0, np.round(intern_t + rng.normal(0, 0.3, count))).astype(int)
    readiness = np.clip(readiness_t + rng.normal(0, 4, count), 0, 100)
    attendance_next = np.clip(attendance_next_t + rng.normal(0, 2, count), 0, 100)

    first = np.asarray(FIRST_NAMES)
    last = np.asarray(LAST_NAMES)
    firsts = first[rng.integers(0, len(first), count)]
    lasts = last[rng.integers(0, len(last), count)]

    matrix = np.column_stack(
        [attendance, assignment, internal, prev_sgpa, final_sgpa, study, lms, readiness, backlogs]
    ).astype(np.float64)
    if _unsup is None:
        _unsup = _fit_unsupervised(matrix)
    z = _unsup["scaler"].transform(matrix)
    cluster_ids = _unsup["kmeans"].predict(z)
    iso_scores = _unsup["iso"].decision_function(z)
    anomalies = iso_scores < _unsup["threshold"]
    anomaly_scores = np.clip(-iso_scores, 0, 1)

    rows: list[dict] = []
    for k in range(count):
        dept_name, code, _ = DEPARTMENTS[int(dept_idx[k])]
        yr = int(year[k])
        rk = float(risk[k])
        rows.append(
            {
                "roll_no": f"{2027 - yr}{code}{int(idx[k]):05d}",
                "name": f"{firsts[k]} {lasts[k]}",
                "department": dept_name,
                "semester": int(semester[k]),
                "year": yr,
                "attendance_pct": round(float(attendance[k]), 1),
                "assignment_avg": round(float(assignment[k]), 2),
                "internal_avg": round(float(internal[k]), 1),
                "ai_flag_rate": round(float(ai_flag[k]), 1),
                "prev_backlogs": int(backlogs[k]),
                "prev_sgpa": round(float(prev_sgpa[k]), 2),
                "final_sgpa": round(float(final_sgpa[k]), 2),
                "risk_score": round(rk, 4),
                "risk_label": _tier(rk),
                "practical_avg": round(float(practical[k]), 1),
                "assignment_completion": round(float(completion[k]), 1),
                "study_hours": round(float(study[k]), 1),
                "library_visits": int(library[k]),
                "lms_activity": round(float(lms[k]), 1),
                "coding_skill": round(float(coding[k]), 1),
                "communication_skill": round(float(comm[k]), 1),
                "certifications": int(certs[k]),
                "internship_months": int(internships[k]),
                "placement_readiness": round(float(readiness[k]), 1),
                "attendance_next": round(float(attendance_next[k]), 1),
                "cluster_id": int(cluster_ids[k]),
                "cluster_label": _unsup["names"][int(cluster_ids[k])],
                "anomaly_flag": bool(anomalies[k]),
                "anomaly_score": round(float(anomaly_scores[k]), 4),
            }
        )

    for demo_idx, (roll, name, attendance_d, assignment_d, internal_d, ai_d, backlogs_d, prev_d) in enumerate(DEMO_STUDENTS):
        j = demo_idx - start
        if 0 <= j < count:
            logit_d = _risk_logit(attendance_d, assignment_d, internal_d, ai_d, backlogs_d, prev_d)
            risk_d = float(np.clip(1 / (1 + math.exp(-logit_d)), 0.01, 0.99))
            final_d = prev_d + 0.30 * (
                0.5 * attendance_d / 100 + 0.5 * assignment_d / 10 - 0.62
            ) - 0.12 * backlogs_d
            rows[j].update(
                {
                    "roll_no": roll,
                    "name": name,
                    "department": DEPARTMENTS[0][0],
                    "semester": 7,
                    "year": 4,
                    "attendance_pct": attendance_d,
                    "assignment_avg": assignment_d,
                    "internal_avg": internal_d,
                    "ai_flag_rate": ai_d,
                    "prev_backlogs": backlogs_d,
                    "prev_sgpa": prev_d,
                    "final_sgpa": round(float(np.clip(final_d, 0, 10)), 2),
                    "risk_score": round(risk_d, 4),
                    "risk_label": _tier(risk_d),
                    **DEMO_EXTRAS.get(roll, {}),
                }
            )
            vector = np.asarray([[rows[j][f] for f in CLUSTER_FEATURES]], dtype=np.float64)
            z = _unsup["scaler"].transform(vector)
            cid = int(_unsup["kmeans"].predict(z)[0])
            iso = float(_unsup["iso"].decision_function(z)[0])
            rows[j].update(
                {
                    "cluster_id": cid,
                    "cluster_label": _unsup["names"][cid],
                    "anomaly_flag": iso < _unsup["threshold"],
                    "anomaly_score": round(float(np.clip(-iso, 0, 1)), 4),
                }
            )
    return rows


def ensure_dataset(db: Session) -> int:
    """Idempotent ingest of the real OULAD cohort (falls back to synthetic only if the dataset is absent)."""
    rows = realdata.build_records()
    if rows:
        target = len(rows)
        source = realdata.SOURCE
    else:
        target = TOTAL_RECORDS
        source = {
            "name": "Synthetic fallback cohort",
            "provider": "CampusVerse generator",
            "license": "Demo only",
            "url": "",
            "kind": "synthetic",
            "note": "OULAD files were not found under backend/data/real/oulad; download and unzip the CC BY 4.0 dataset from analyse.kmi.open.ac.uk/open_dataset.",
        }
    if _state["records"] == target and _state.get("source", {}).get("name") == source["name"]:
        return target
    with _lock:
        if _state["records"] == target and _state.get("source", {}).get("name") == source["name"]:
            return target
        _state.update({"status": "preparing", "error": None, "source": source, "target": target})
        try:
            existing = db.query(PerformanceRecord.id).count()
            if existing != target or not rows:
                global _unsup
                _unsup = None
                if existing:
                    db.query(PerformanceRecord).delete(synchronize_session=False)
                    db.commit()
                started = time.perf_counter()
                if not rows:
                    rng = np.random.default_rng(2026)
                    generated: list[dict] = []
                    for start in range(0, target, CHUNK):
                        generated.extend(_generate_rows(rng, start, min(CHUNK, target - start)))
                    rows = generated
                else:
                    matrix = np.asarray(
                        [[float(r.get(f, 0) or 0) for f in CLUSTER_FEATURES] for r in rows], dtype=np.float64
                    )
                    _unsup = _fit_unsupervised(matrix)
                    z = _unsup["scaler"].transform(matrix)
                    cluster_ids = _unsup["kmeans"].predict(z)
                    iso_scores = _unsup["iso"].decision_function(z)
                    for k, row in enumerate(rows):
                        row["cluster_id"] = int(cluster_ids[k])
                        row["cluster_label"] = _unsup["names"][int(cluster_ids[k])]
                        row["anomaly_flag"] = bool(iso_scores[k] < _unsup["threshold"])
                        row["anomaly_score"] = round(float(np.clip(-iso_scores[k], 0, 1)), 4)
                for start in range(0, len(rows), CHUNK):
                    db.execute(insert(PerformanceRecord), rows[start : start + CHUNK])
                    db.commit()
                    _state["records"] = start + min(CHUNK, len(rows) - start)
                _state["ingest_ms"] = int((time.perf_counter() - started) * 1000)
                if rows and source["kind"] == "real":
                    demo = db.query(User).filter(User.email == "student@campus.edu").first()
                    if demo and demo.roll_no != rows[0]["roll_no"]:
                        demo.roll_no = rows[0]["roll_no"]
                        db.commit()
            else:
                _state["records"] = existing
            _cache.clear()
            print(f"PerformanceTracker: {_state['records']:,} {source['kind']} records ready in {_state['ingest_ms']} ms")
            _state["status"] = "training" if not METRICS_PATH.exists() else "ready"
            return _state["records"]
        except Exception as exc:  # pragma: no cover - startup diagnostics
            _state.update({"status": "error", "error": str(exc)})
            raise


def _dataset(db: Session):
    columns = [getattr(PerformanceRecord, f) for f in ATTENDANCE_FEATURES]
    rows = db.execute(
        select(
            *columns,
            PerformanceRecord.risk_label,
            PerformanceRecord.final_sgpa,
            PerformanceRecord.attendance_next,
            PerformanceRecord.roll_no,
        )
    ).all()
    features = len(FEATURES)
    attendance_features = len(ATTENDANCE_FEATURES)
    label_at = attendance_features
    X = np.asarray([tuple(r[i] for i in range(features)) for r in rows], dtype=np.float32)
    y = np.asarray([1 if r[label_at] == "high" else 0 for r in rows], dtype=np.int8)
    sgpa = np.asarray([r[label_at + 1] for r in rows], dtype=np.float32)
    X_att = np.asarray([tuple(r[0:attendance_features]) for r in rows], dtype=np.float32)
    attendance = np.asarray([r[label_at + 2] for r in rows], dtype=np.float32)
    groups = np.asarray([str(r[label_at + 3]).rsplit("-", 1)[-1] for r in rows])
    return X, y, sgpa, X_att, attendance, groups


def _tree_rules(tree, top: int = 6) -> list[dict]:
    rules: list[dict] = []

    def walk(node: int, conditions: list[str]):
        left = tree.children_left[node]
        right = tree.children_right[node]
        if left == -1 and right == -1:
            proportions = tree.value[node][0]
            total = int(tree.n_node_samples[node])
            high = float(proportions[1]) if len(proportions) > 1 else 0.0
            if total >= 120:
                rules.append(
                    {
                        "conditions": conditions.copy(),
                        "samples": total,
                        "high_risk_pct": round(100 * high, 1),
                    }
                )
            return
        feature = FEATURES[tree.feature[node]]
        threshold = tree.threshold[node]
        walk(left, conditions + [f"{FEATURE_LABELS[feature]} ≤ {threshold:.2f}"])
        walk(right, conditions + [f"{FEATURE_LABELS[feature]} > {threshold:.2f}"])

    walk(0, [])
    rules.sort(key=lambda r: (r["high_risk_pct"], r["samples"]), reverse=True)
    return rules[:top]


def _cluster_summary(db: Session) -> list[dict]:
    rows = (
        db.query(
            PerformanceRecord.cluster_label,
            func.count(PerformanceRecord.id),
            func.avg(PerformanceRecord.final_sgpa),
            func.avg(PerformanceRecord.attendance_pct),
            func.avg(PerformanceRecord.placement_readiness),
            func.avg(PerformanceRecord.risk_score),
            func.avg(PerformanceRecord.study_hours),
        )
        .group_by(PerformanceRecord.cluster_label)
        .all()
    )
    order = {name: i for i, name in enumerate(CLUSTER_NAMES)}
    out = [
        {
            "label": label,
            "count": int(count),
            "avg_sgpa": round(float(sgpa or 0), 2),
            "avg_attendance": round(float(attendance or 0), 1),
            "avg_readiness": round(float(readiness or 0), 1),
            "avg_risk": round(float(risk or 0), 4),
            "avg_study_hours": round(float(study or 0), 1),
            "description": CLUSTER_DESCRIPTIONS.get(label, ""),
        }
        for label, count, sgpa, attendance, readiness, risk, study in rows
    ]
    out.sort(key=lambda c: order.get(c["label"], 99))
    return out


def train_models(db: Session, force: bool = False) -> dict:
    """Benchmark classifiers for early-warning risk, then persist metrics + what-if models."""
    if METRICS_PATH.exists() and not force:
        try:
            metrics = json.loads(METRICS_PATH.read_text(encoding="utf-8"))
            count = db.query(PerformanceRecord.id).count()
            if metrics.get("n_rows") == count and metrics.get("version") == DATASET_VERSION:
                _state["status"] = "ready"
                _state["records"] = count
                _state["target"] = metrics.get("n_rows", count)
                _state["ingest_ms"] = metrics.get("ingest_ms", _state["ingest_ms"])
                _state["source"] = metrics.get("data_source") or _state.get("source")
                return metrics
        except Exception:
            pass
    with _train_lock:
        _state["status"] = "training"
        from sklearn.ensemble import (
            HistGradientBoostingClassifier,
            HistGradientBoostingRegressor,
            RandomForestClassifier,
            RandomForestRegressor,
        )
        from sklearn.linear_model import LinearRegression, LogisticRegression
        from sklearn.metrics import (
            accuracy_score,
            confusion_matrix,
            f1_score,
            mean_absolute_error,
            precision_score,
            r2_score,
            recall_score,
            roc_auc_score,
        )
        from sklearn.model_selection import GroupShuffleSplit
        from sklearn.pipeline import make_pipeline
        from sklearn.preprocessing import StandardScaler
        from sklearn.tree import DecisionTreeClassifier

        started = time.perf_counter()
        X, y, sgpa, X_att, attendance_next, groups = _dataset(db)
        splitter = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
        train_idx, test_idx = next(splitter.split(X, y, groups))
        x_train, x_test = X[train_idx], X[test_idx]
        y_train, y_test = y[train_idx], y[test_idx]
        xe_train, xe_test = X_att[train_idx], X_att[test_idx]
        a_train, a_test = attendance_next[train_idx], attendance_next[test_idx]

        candidates = {
            "Logistic Regression": make_pipeline(StandardScaler(), LogisticRegression(max_iter=400)),
            "Decision Tree": DecisionTreeClassifier(max_depth=5, min_samples_leaf=60, class_weight="balanced", random_state=42),
            "Random Forest": RandomForestClassifier(
                n_estimators=90, max_depth=12, min_samples_leaf=8, n_jobs=-1, random_state=42
            ),
            "HistGradientBoosting": HistGradientBoostingClassifier(max_iter=160, learning_rate=0.1, random_state=42),
        }
        try:
            from lightgbm import LGBMClassifier

            candidates["LightGBM"] = LGBMClassifier(
                n_estimators=240, learning_rate=0.08, num_leaves=63, n_jobs=4, random_state=42, verbose=-1
            )
        except Exception:
            pass
        try:
            from xgboost import XGBClassifier

            candidates["XGBoost"] = XGBClassifier(
                n_estimators=240,
                max_depth=6,
                learning_rate=0.08,
                subsample=0.9,
                colsample_bytree=0.9,
                eval_metric="logloss",
                tree_method="hist",
                n_jobs=4,
                random_state=42,
            )
        except Exception:
            pass

        scored = []
        fitted = {}
        for name, model in candidates.items():
            t0 = time.perf_counter()
            model.fit(x_train, y_train)
            train_ms = (time.perf_counter() - t0) * 1000
            proba = model.predict_proba(x_test)[:, 1]
            pred = (proba >= 0.5).astype(np.int8)
            t1 = time.perf_counter()
            model.predict_proba(x_test[:1000])
            infer_ms = (time.perf_counter() - t1) * 1000
            scored.append(
                {
                    "name": name,
                    "accuracy": round(float(accuracy_score(y_test, pred)), 4),
                    "precision": round(float(precision_score(y_test, pred, zero_division=0)), 4),
                    "recall": round(float(recall_score(y_test, pred, zero_division=0)), 4),
                    "f1": round(float(f1_score(y_test, pred, zero_division=0)), 4),
                    "roc_auc": round(float(roc_auc_score(y_test, proba)), 4),
                    "train_ms": round(train_ms),
                    "infer_ms_per_1k": round(infer_ms, 1),
                }
            )
            fitted[name] = model

        selectable = [m for m in scored if m["name"] != "Decision Tree"] or scored
        best = max(selectable, key=lambda m: (m["roc_auc"], m["f1"]))
        best_model = fitted[best["name"]]
        proba = best_model.predict_proba(x_test)[:, 1]
        cm = confusion_matrix(y_test, (proba >= 0.5).astype(np.int8)).tolist()
        decision_rules = _tree_rules(fitted["Decision Tree"].tree_) if "Decision Tree" in fitted else []

        reg_candidates = {
            "Linear Regression": LinearRegression(),
            "Random Forest Regressor": RandomForestRegressor(
                n_estimators=80, max_depth=12, min_samples_leaf=8, n_jobs=-1, random_state=42
            ),
            "HistGradientBoosting Regressor": HistGradientBoostingRegressor(max_iter=200, learning_rate=0.1, random_state=42),
        }
        try:
            from lightgbm import LGBMRegressor

            reg_candidates["LightGBM Regressor"] = LGBMRegressor(
                n_estimators=200, learning_rate=0.08, num_leaves=63, n_jobs=4, random_state=42, verbose=-1
            )
        except Exception:
            pass

        regressors = []
        reg_fitted = {}
        # OULAD learners with no submitted assessment have final_sgpa 0; scoring them as easy
        # zeros inflates R², so grade-forecast metrics use only learners with a real outcome.
        graded_train = train_idx[sgpa[train_idx] > 0]
        graded_test = test_idx[sgpa[test_idx] > 0]
        for name, model in reg_candidates.items():
            t0 = time.perf_counter()
            model.fit(X[graded_train], sgpa[graded_train])
            reg_ms = (time.perf_counter() - t0) * 1000
            pred = model.predict(X[graded_test])
            regressors.append(
                {
                    "name": name,
                    "r2": round(float(r2_score(sgpa[graded_test], pred)), 4),
                    "mae": round(float(mean_absolute_error(sgpa[graded_test], pred)), 3),
                    "n": int(len(graded_test)),
                    "train_ms": round(reg_ms),
                }
            )
            reg_fitted[name] = model
        best_reg = max(regressors, key=lambda m: m["r2"])
        regressor = reg_fitted[best_reg["name"]]
        regression = dict(best_reg)

        t0 = time.perf_counter()
        attendance_model = RandomForestRegressor(
            n_estimators=100, max_depth=12, min_samples_leaf=5, n_jobs=-1, random_state=42
        )
        attendance_model.fit(xe_train, a_train)
        attendance_ms = (time.perf_counter() - t0) * 1000
        a_pred = attendance_model.predict(xe_test)
        attendance_metrics = {
            "name": "Random Forest Regressor",
            "r2": round(float(r2_score(a_test, a_pred)), 4),
            "mae": round(float(mean_absolute_error(a_test, a_pred)), 3),
            "train_ms": round(attendance_ms),
        }

        if hasattr(best_model, "feature_importances_"):
            raw = np.asarray(best_model.feature_importances_, dtype=np.float64)
        elif hasattr(best_model, "named_steps"):
            raw = np.abs(best_model.named_steps["logisticregression"].coef_[0])
        else:
            raw = np.ones(len(FEATURES))
        shares = raw / raw.sum() if raw.sum() else raw

        stats = {
            feature: {"mean": round(float(X[:, i].mean()), 2), "std": round(float(X[:, i].std()), 2)}
            for i, feature in enumerate(FEATURES)
        }
        extended_stats = {
            feature: {"mean": round(float(X_att[:, i].mean()), 2), "std": round(float(X_att[:, i].std()), 2)}
            for i, feature in enumerate(ATTENDANCE_FEATURES)
        }
        clusters = _cluster_summary(db)
        anomaly_count = db.query(func.count(PerformanceRecord.id)).filter(PerformanceRecord.anomaly_flag.is_(True)).scalar() or 0
        metrics = {
            "status": "ready",
            "version": DATASET_VERSION,
            "n_rows": int(X.shape[0]),
            "data_source": _state.get("source") or realdata.SOURCE,
            "positive_rate": round(float(y.mean()), 4),
            "trained_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
            "total_train_ms": round((time.perf_counter() - started) * 1000),
            "ingest_ms": _state["ingest_ms"],
            "models": scored,
            "best": best["name"],
            "confusion": {"tn": cm[0][0], "fp": cm[0][1], "fn": cm[1][0], "tp": cm[1][1]},
            "regression": regression,
            "regressors": regressors,
            "attendance_model": attendance_metrics,
            "decision_rules": decision_rules,
            "clusters": clusters,
            "anomalies": {"count": int(anomaly_count), "pct": round(100 * anomaly_count / max(1, len(y)), 2)},
            "feature_names": FEATURE_LABELS,
            "feature_importances": {f: round(float(shares[i]), 4) for i, f in enumerate(FEATURES)},
            "extended_feature_names": ATTENDANCE_LABELS,
            "extended_stats": extended_stats,
            "stats": stats,
            "tiers": {"high": 0.60, "medium": 0.32},
            "evaluation": {
                "split": "GroupShuffleSplit by learner (80/20)",
                "test_learners": int(len(set(groups[test_idx]))),
                "feature_window": "Early 40% of the presentation only",
            },
        }
        artifact = {
            "classifier": best_model,
            "regressor": regressor,
            "attendance": attendance_model,
            "features": FEATURES,
            "attendance_features": ATTENDANCE_FEATURES,
            "metrics": metrics,
        }
        try:
            import joblib

            joblib.dump(artifact, MODEL_PATH)
        except Exception:
            pass
        METRICS_PATH.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
        global _model_cache
        _model_cache = artifact
        _state["status"] = "ready"
        _cache.clear()
        return metrics


def _load_model() -> dict | None:
    global _model_cache
    if _model_cache is not None:
        return _model_cache
    if not MODEL_PATH.exists():
        return None
    try:
        import joblib

        _model_cache = joblib.load(MODEL_PATH)
        return _model_cache
    except Exception:
        return None


def get_metrics() -> dict | None:
    try:
        return json.loads(METRICS_PATH.read_text(encoding="utf-8"))
    except Exception:
        return None


def _cached(name: str, ttl: float, builder):
    entry = _cache.get(name)
    if entry and time.time() - entry[0] < ttl:
        return entry[1]
    value = builder()
    _cache[name] = (time.time(), value)
    return value


def _row_dict(r: PerformanceRecord) -> dict:
    return {
        "id": r.id,
        "roll_no": r.roll_no,
        "name": r.name,
        "department": r.department,
        "semester": r.semester,
        "year": r.year,
        "attendance_pct": r.attendance_pct,
        "assignment_avg": r.assignment_avg,
        "internal_avg": r.internal_avg,
        "ai_flag_rate": r.ai_flag_rate,
        "prev_backlogs": r.prev_backlogs,
        "prev_sgpa": r.prev_sgpa,
        "final_sgpa": r.final_sgpa,
        "risk_score": round(r.risk_score, 4),
        "risk_label": r.risk_label,
        "practical_avg": r.practical_avg,
        "assignment_completion": r.assignment_completion,
        "study_hours": r.study_hours,
        "library_visits": r.library_visits,
        "lms_activity": r.lms_activity,
        "coding_skill": r.coding_skill,
        "communication_skill": r.communication_skill,
        "certifications": r.certifications,
        "internship_months": r.internship_months,
        "placement_readiness": r.placement_readiness,
        "attendance_next": r.attendance_next,
        "cluster_id": r.cluster_id,
        "cluster_label": r.cluster_label,
        "anomaly_flag": r.anomaly_flag,
        "anomaly_score": round(r.anomaly_score, 4),
    }


def summary(db: Session) -> dict:
    def build():
        high = func.sum(case((PerformanceRecord.risk_label == "high", 1), else_=0))
        medium = func.sum(case((PerformanceRecord.risk_label == "medium", 1), else_=0))
        passed = func.sum(case((PerformanceRecord.final_sgpa >= 5.0, 1), else_=0))
        attendance_risk = func.sum(case((PerformanceRecord.attendance_next < ENGAGEMENT_TARGET, 1), else_=0))
        anomalies = func.sum(case((PerformanceRecord.anomaly_flag.is_(True), 1), else_=0))
        (
            total,
            avg_sgpa,
            avg_attendance,
            avg_assign,
            avg_readiness,
            high_n,
            medium_n,
            pass_n,
            att_risk_n,
            anomaly_n,
        ) = db.query(
            func.count(PerformanceRecord.id),
            func.avg(PerformanceRecord.final_sgpa),
            func.avg(PerformanceRecord.attendance_pct),
            func.avg(PerformanceRecord.assignment_avg),
            func.avg(PerformanceRecord.placement_readiness),
            high,
            medium,
            passed,
            attendance_risk,
            anomalies,
        ).one()
        total = int(total or 0)
        return {
            "records": total,
            "target": _state.get("target", total),
            "source": _state.get("source"),
            "at_risk": int(high_n or 0),
            "at_risk_pct": round(100 * (high_n or 0) / total, 1) if total else 0,
            "watch": int(medium_n or 0),
            "watch_pct": round(100 * (medium_n or 0) / total, 1) if total else 0,
            "avg_sgpa": round(float(avg_sgpa or 0), 2),
            "avg_attendance": round(float(avg_attendance or 0), 1),
            "avg_assignment": round(float(avg_assign or 0), 2),
            "avg_readiness": round(float(avg_readiness or 0), 1),
            "attendance_risk": int(att_risk_n or 0),
            "attendance_risk_pct": round(100 * (att_risk_n or 0) / total, 1) if total else 0,
            "anomalies": int(anomaly_n or 0),
            "pass_pct": round(100 * (pass_n or 0) / total, 1) if total else 0,
            "departments": db.query(func.count(func.distinct(PerformanceRecord.department))).scalar() or 0,
            "ingest_ms": _state["ingest_ms"],
            "status": _state["status"],
        }

    return _cached("summary", 60, build)


SORTS = {
    "risk": PerformanceRecord.risk_score,
    "sgpa": PerformanceRecord.final_sgpa,
    "attendance": PerformanceRecord.attendance_pct,
    "forecast": PerformanceRecord.attendance_next,
    "assignment": PerformanceRecord.assignment_avg,
    "readiness": PerformanceRecord.placement_readiness,
    "roll": PerformanceRecord.roll_no,
    "name": PerformanceRecord.name,
}


def list_students(
    db: Session,
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
) -> dict:
    page = max(1, page)
    size = max(1, min(100, size))
    query = db.query(PerformanceRecord)
    if search:
        like = f"%{search.strip()}%"
        query = query.filter(or_(PerformanceRecord.roll_no.ilike(like), PerformanceRecord.name.ilike(like)))
    if department:
        query = query.filter(PerformanceRecord.department == department)
    if semester:
        query = query.filter(PerformanceRecord.semester == semester)
    if risk in ("low", "medium", "high"):
        query = query.filter(PerformanceRecord.risk_label == risk)
    if cluster:
        query = query.filter(PerformanceRecord.cluster_label == cluster)
    if anomaly == "1":
        query = query.filter(PerformanceRecord.anomaly_flag.is_(True))

    total = query.count()
    column = SORTS.get(sort, PerformanceRecord.risk_score)
    query = query.order_by(column.asc() if direction == "asc" else column.desc())
    rows = query.offset((page - 1) * size).limit(size).all()
    return {
        "total": total,
        "page": page,
        "size": size,
        "pages": max(1, math.ceil(total / size)),
        "items": [_row_dict(r) for r in rows],
    }


def predict(features: dict) -> dict:
    values = []
    clean = {}
    for feature in FEATURES:
        raw = features.get(feature, FEATURE_DEFAULTS[feature])
        try:
            value = float(raw)
        except (TypeError, ValueError):
            value = FEATURE_DEFAULTS[feature]
        if feature == "semester":
            value = max(1, min(8, round(value)))
        elif feature == "prev_backlogs":
            value = max(0, min(12, round(value)))
        elif feature == "attendance_pct":
            value = max(0, min(100, value))
        elif feature == "assignment_avg":
            value = max(0, min(10, value))
        clean[feature] = value
        values.append(value)

    model = _load_model()
    if model is not None:
        x = np.asarray([values], dtype=np.float32)
        proba = float(model["classifier"].predict_proba(x)[0, 1])
        sgpa = float(model["regressor"].predict(x)[0])
        basis = f"model:{model['metrics']['best']}"
    else:
        proba = 1 / (1 + math.exp(-_risk_logit(clean["attendance_pct"], clean["assignment_avg"], clean["prev_backlogs"], clean["semester"])))
        sgpa = (
            clean["assignment_avg"]
            + 0.03 * (clean["attendance_pct"] - 25)
            - 0.25 * clean["prev_backlogs"]
            + 0.10 * (clean["semester"] - 1)
        )
        basis = "analytic"

    proba = max(0.0, min(1.0, proba))
    return {
        "risk_score": round(proba, 4),
        "risk_label": _tier(proba),
        "predicted_sgpa": round(max(0.0, min(10.0, sgpa)), 2),
        "features": clean,
        "basis": basis,
    }


def _attendance_forecast(record: PerformanceRecord) -> dict:
    model = _load_model()
    expected = float(record.attendance_pct)
    basis = "current"
    if model and model.get("attendance") is not None:
        values = [getattr(record, f) for f in ATTENDANCE_FEATURES]
        expected = float(model["attendance"].predict(np.asarray([values], dtype=np.float32))[0])
        basis = "model"
    expected = max(0.0, min(100.0, expected))
    shortfall = max(0.0, ENGAGEMENT_TARGET - float(record.attendance_pct))
    return {
        "expected": round(expected, 1),
        "delta": round(expected - float(record.attendance_pct), 1),
        "target": ENGAGEMENT_TARGET,
        "below_target": expected < ENGAGEMENT_TARGET,
        "recovery_days": round(shortfall * 1.2, 1),
        "basis": basis,
    }


def _subjects(record: PerformanceRecord) -> list[dict]:
    pool = SUBJECTS.get(record.department, SUBJECTS["Computer Science"])
    seed = int(hashlib.sha1(record.roll_no.encode()).hexdigest()[:8], 16)
    rng = np.random.default_rng(seed)
    base = 0.45 * record.internal_avg + 0.25 * record.practical_avg + 3.0 * record.final_sgpa
    trend = (record.attendance_next - record.attendance_pct) / 2 + (record.placement_readiness - 50) / 20
    out = []
    for subject in pool:
        current = float(np.clip(base + rng.normal(0, 7), 0, 100))
        expected = float(np.clip(current + trend + rng.normal(0, 3), 0, 100))
        level = "high" if expected < 50 else "medium" if expected < 65 else "low"
        out.append(
            {
                "subject": subject,
                "current": round(current, 1),
                "expected": round(expected, 1),
                "risk": level,
                "gap_to_70": round(max(0.0, 70 - expected), 1),
            }
        )
    out.sort(key=lambda s: s["expected"])
    return out


def _skill_gap(record: PerformanceRecord) -> list[dict]:
    checks = [
        ("coding_skill", "Coding skill", 70.0, "Build two portfolio projects and 60 DSA problems."),
        ("communication_skill", "Communication", 65.0, "Join the weekly GD and mock-interview lab."),
        ("certifications", "Certifications", 2.0, "Complete one domain certification this semester."),
        ("internship_months", "Internship experience", 2.0, "Apply through the placement cell for a 2-month internship."),
        ("final_sgpa", "CGPA", 7.0, "Target a 7.0+ SGPA with subject-wise recovery."),
        ("attendance_pct", "VLE engagement", ENGAGEMENT_TARGET, "Open the module VLE at least four days a week; engagement is the strongest real-data risk signal."),
    ]
    gaps = []
    for field, label, target, action in checks:
        current = float(getattr(record, field))
        if field in ("coding_skill", "communication_skill", "certifications", "internship_months") and current <= 0:
            continue  # OULAD does not record these; omit rather than invent a gap
        if current >= target:
            continue
        gap_pct = round(100 * (target - current) / target, 1)
        gaps.append(
            {
                "area": label,
                "current": round(current, 1),
                "target": target,
                "gap_pct": gap_pct,
                "priority": "high" if gap_pct >= 35 else "medium" if gap_pct >= 15 else "low",
                "action": action,
            }
        )
    gaps.sort(key=lambda g: g["gap_pct"], reverse=True)
    return gaps


def _career(record: PerformanceRecord) -> list[dict]:
    scores = {
        "coding_skill": float(record.coding_skill),
        "communication_skill": float(record.communication_skill),
        "sgpa": float(record.final_sgpa) * 10,
        "certifications": min(100.0, float(record.certifications) * 30),
        "internship_months": min(100.0, float(record.internship_months) * 25),
    }
    out = []
    for role, weights in CAREER_ROLES:
        fit = sum(scores[k] * w for k, w in weights.items())
        weakest = min(weights, key=lambda k: scores[k])
        out.append(
            {
                "role": role,
                "fit": round(fit, 1),
                "strongest": max(weights, key=lambda k: scores[k]),
                "focus": weakest,
            }
        )
    out.sort(key=lambda c: c["fit"], reverse=True)
    return out[:3]


def _recommendations(record: PerformanceRecord, forecast: dict, subjects: list[dict], gaps: list[dict]) -> list[dict]:
    recs: list[dict] = []
    if record.attendance_pct < ENGAGEMENT_TARGET or forecast["below_target"]:
        recs.append(
            {
                "area": "Engagement",
                "priority": "high",
                "title": f"Lift VLE engagement ({record.attendance_pct:.1f}% → {ENGAGEMENT_TARGET:g}% of module days)",
                "detail": (
                    f"The model forecasts {forecast['expected']:.1f}% active-day engagement next period. "
                    f"Add about {forecast['recovery_days']:g} active study days and review the module VLE weekly."
                ),
            }
        )
    weakest = subjects[0]
    if weakest["expected"] < 65:
        recs.append(
            {
                "area": "Subject focus",
                "priority": "high" if weakest["expected"] < 50 else "medium",
                "title": f"Strengthen {weakest['subject']}",
                "detail": (
                    f"Predicted mark is {weakest['expected']:.0f}/100. Book two doubt-clearing sessions "
                    "and a timed practice paper before the next internal."
                ),
            }
        )
    if record.study_hours < 15:
        recs.append(
            {
                "area": "Study plan",
                "priority": "medium",
                "title": f"Increase study time to 15 h/week",
                "detail": f"Currently {record.study_hours:.1f} h/week. Use three 90-minute deep-work blocks.",
            }
        )
    for gap in gaps[:2]:
        recs.append(
            {
                "area": gap["area"],
                "priority": gap["priority"],
                "title": f"Close the {gap['area'].lower()} gap ({gap['current']:g} → {gap['target']:g})",
                "detail": gap["action"],
            }
        )
    if record.prev_backlogs:
        recs.append(
            {
                "area": "Backlogs",
                "priority": "high" if record.prev_backlogs >= 2 else "medium",
                "title": f"Clear {record.prev_backlogs} backlog(s)",
                "detail": "Schedule backlog tutoring this month; each cleared paper lifts the risk score materially.",
            }
        )
    if not recs:
        recs.append(
            {
                "area": "Stretch",
                "priority": "low",
                "title": "Convert strengths into placement outcomes",
                "detail": "Aim for a product internship and a mock interview every fortnight.",
            }
        )
    return recs[:5]


def _intervention(record: PerformanceRecord, forecast: dict) -> dict:
    if record.prev_backlogs >= 2:
        action, owner = "Backlog clearance plan", "Faculty advisor"
    elif record.attendance_pct < ENGAGEMENT_TARGET / 2 or forecast["below_target"]:
        action, owner = "VLE engagement outreach + study plan", "Module tutor"
    elif record.assignment_avg < 5:
        action, owner = "Assignment recovery plan", "Course faculty"
    elif record.ai_flag_rate > 30:
        action, owner = "Academic integrity review", "Department committee"
    else:
        action, owner = "Faculty mentoring", "Faculty advisor"
    if record.risk_score >= 0.8:
        priority = "critical"
    elif record.risk_score >= 0.6:
        priority = "high"
    elif record.risk_score >= 0.4:
        priority = "medium"
    else:
        priority = "low"
    return {"action": action, "owner": owner, "priority": priority}


def _drivers(record: PerformanceRecord) -> list[dict]:
    metrics = get_metrics()
    if not metrics:
        return []
    importances = metrics.get("feature_importances", {})
    stats = metrics.get("stats", {})
    drivers = []
    for feature in FEATURES:
        if feature in ("semester",):
            continue
        stat = stats.get(feature, {})
        mean, std = stat.get("mean"), stat.get("std")
        if not mean or not std:
            continue
        value = float(getattr(record, feature))
        z = (value - mean) / std
        harmful = z < 0 if feature in LOW_IS_BAD else z > 0
        if not harmful or abs(z) < 0.55:
            continue
        impact = abs(z) * float(importances.get(feature, 0))
        label = FEATURE_LABELS[feature]
        unit = "%" if feature in ("attendance_pct", "internal_avg", "ai_flag_rate") else ""
        compiled = f"{label}: {value:g}{unit} vs campus average {mean:g}{unit} ({z:+.1f}σ)"
        drivers.append({"feature": feature, "label": label, "impact": round(impact, 4), "z": round(z, 2), "sentence": compiled})
    drivers.sort(key=lambda d: d["impact"], reverse=True)
    return drivers[:3]


def detail(db: Session, roll_no: str) -> dict | None:
    record = db.query(PerformanceRecord).filter(PerformanceRecord.roll_no == roll_no).first()
    if not record:
        return None
    metrics = get_metrics()
    data = _row_dict(record)
    data["drivers"] = _drivers(record)
    cohort_sgpa = db.query(func.avg(PerformanceRecord.final_sgpa)).scalar()
    data["cohort"] = {
        "avg_sgpa": round(float(cohort_sgpa), 2) if cohort_sgpa is not None else None,
        "avg_attendance": metrics["stats"]["attendance_pct"]["mean"] if metrics else None,
    }
    prediction = predict({feature: getattr(record, feature) for feature in FEATURES})
    data["model_risk"] = prediction["risk_score"]
    data["model_label"] = prediction["risk_label"]
    data["model_sgpa"] = prediction["predicted_sgpa"]
    data["model_basis"] = prediction["basis"]

    forecast = _attendance_forecast(record)
    subjects = _subjects(record)
    gaps = _skill_gap(record)
    careers = _career(record)
    recommendations = _recommendations(record, forecast, subjects, gaps)
    intervention = _intervention(record, forecast)
    improvement = round(100 / (1 + math.exp(-(prediction["predicted_sgpa"] - record.final_sgpa) * 1.6)), 1)

    data.update(
        {
            "forecast": forecast,
            "subjects": subjects,
            "skill_gaps": gaps,
            "career": careers,
            "recommendations": recommendations,
            "intervention": intervention,
            "improvement_probability": improvement,
            "cluster": {
                "label": record.cluster_label,
                "description": CLUSTER_DESCRIPTIONS.get(record.cluster_label, ""),
            },
            "anomaly": {
                "flagged": bool(record.anomaly_flag),
                "score": round(record.anomaly_score, 3),
            },
        }
    )
    data["twin"] = {
        "risk": {"score": prediction["risk_score"], "label": prediction["risk_label"], "drivers": data["drivers"]},
        "forecast": forecast,
        "skills": {
            "coding": record.coding_skill,
            "communication": record.communication_skill,
            "lms": record.lms_activity,
            "study_hours": record.study_hours,
            "placement_readiness": record.placement_readiness,
        },
        "subjects": subjects,
        "skill_gaps": gaps,
        "career": careers,
        "recommendations": recommendations,
        "intervention": intervention,
        "improvement_probability": improvement,
    }
    return data


def clusters(db: Session) -> dict:
    return _cached("clusters", 120, lambda: {"clusters": _cluster_summary(db)})


def anomalies(db: Session, page: int = 1, size: int = 25) -> dict:
    page = max(1, page)
    size = max(1, min(100, size))
    query = db.query(PerformanceRecord).filter(PerformanceRecord.anomaly_flag.is_(True))
    total = query.count()
    rows = (
        query.order_by(PerformanceRecord.anomaly_score.desc())
        .offset((page - 1) * size)
        .limit(size)
        .all()
    )
    return {
        "total": total,
        "page": page,
        "size": size,
        "pages": max(1, math.ceil(total / size)),
        "items": [_row_dict(r) for r in rows],
    }


def attendance_risk(
    db: Session, page: int = 1, size: int = 25, department: str = "", semester: int | None = None
) -> dict:
    page = max(1, page)
    size = max(1, min(100, size))
    base = db.query(PerformanceRecord).filter(PerformanceRecord.attendance_next < ENGAGEMENT_TARGET)
    if department:
        base = base.filter(PerformanceRecord.department == department)
    if semester:
        base = base.filter(PerformanceRecord.semester == semester)
    total = base.count()
    rows = base.order_by(PerformanceRecord.attendance_next.asc()).offset((page - 1) * size).limit(size).all()
    items = []
    for r in rows:
        item = _row_dict(r)
        item["forecast"] = _attendance_forecast(r)
        items.append(item)
    summary_row = db.query(
        func.count(PerformanceRecord.id),
        func.avg(PerformanceRecord.attendance_next),
        func.sum(case((PerformanceRecord.attendance_pct < ENGAGEMENT_TARGET, 1), else_=0)),
    ).one()
    cohort, avg_forecast, current_below = summary_row
    return {
        "total": total,
        "page": page,
        "size": size,
        "pages": max(1, math.ceil(total / size)),
        "summary": {
            "target": ENGAGEMENT_TARGET,
            "predicted_low_engagement": total,
            "predicted_pct": round(100 * total / max(1, int(cohort or 0)), 1),
            "avg_forecast": round(float(avg_forecast or 0), 1),
            "currently_low_engagement": int(current_below or 0),
        },
        "items": items,
    }


def interventions(db: Session, limit: int = 25) -> dict:
    limit = max(1, min(100, limit))
    rows = (
        db.query(PerformanceRecord)
        .filter(PerformanceRecord.risk_score >= 0.6)
        .order_by(PerformanceRecord.risk_score.desc())
        .limit(limit)
        .all()
    )
    items = []
    for r in rows:
        forecast = _attendance_forecast(r)
        items.append(
            {
                **_row_dict(r),
                "drivers": _drivers(r),
                "forecast": forecast,
                "intervention": _intervention(r, forecast),
            }
        )
    high = db.query(func.count(PerformanceRecord.id)).filter(PerformanceRecord.risk_label == "high").scalar() or 0
    attendance = db.query(func.count(PerformanceRecord.id)).filter(PerformanceRecord.attendance_next < ENGAGEMENT_TARGET).scalar() or 0
    anomalies_n = db.query(func.count(PerformanceRecord.id)).filter(PerformanceRecord.anomaly_flag.is_(True)).scalar() or 0
    return {
        "summary": {
            "high_risk": int(high),
            "attendance_risk": int(attendance),
            "anomalies": int(anomalies_n),
            "queue": len(items),
        },
        "items": items,
    }


def nl_answer(db: Session, question: str, user) -> dict | None:
    """Data-grounded natural-language analytics for SAMVIT. Returns None to fall back to document RAG."""
    q = question.lower()
    role = getattr(user, "role", "student")
    roll_match = re.search(r"\b\d{2,4}[A-Z&]{2,5}\d{3,5}\b", question.upper())

    if roll_match:
        roll = roll_match.group(0)
        if role == "student" and roll != (getattr(user, "roll_no", None) or ""):
            return {
                "intent": "student_lookup",
                "snippet": "Student records are private; students can only inspect their own profile.",
                "answer": "Student performance records are private. You can open **Performance → My record** to see your own digital twin, or ask a general campus policy question.",
            }
        record = detail(db, roll)
        if not record:
            return {
                "intent": "student_lookup",
                "snippet": f"No performance record for {roll}.",
                "answer": f"I could not find a performance record for **{roll}**. Check the roll number, or search from the Performance explorer.",
            }
        top = record["recommendations"][0]
        answer = (
            f"**{record['name']} ({record['roll_no']})** — {record['department']}, semester {record['semester']}\n"
            f"- Risk: **{record['risk_label']}** ({record['risk_score'] * 100:.1f}%) · model {record['model_risk'] * 100:.1f}%\n"
            f"- SGPA: {record['prev_sgpa']:.2f} → {record['final_sgpa']:.2f} · VLE engagement {record['attendance_pct']:.1f}% (forecast {record['forecast']['expected']:.1f}%)\n"
            f"- Placement readiness: {record['placement_readiness']:.1f}/100 · cluster: {record['cluster']['label']}\n"
            f"- Priority action: {top['title']} — {top['detail']}"
        )
        return {"intent": "student_lookup", "snippet": f"Digital twin snapshot for {record['roll_no']}.", "answer": answer}

    if "vle" in q or "virtual learning environment" in q:
        return {
            "intent": "glossary",
            "snippet": "Definition: VLE engagement.",
            "answer": (
                "**VLE engagement** is the share of active study days a learner spends on the virtual learning environment — "
                "the university's online learning platform. OULAD has no classroom roll-call, so SAMVIT uses VLE active days "
                "as the attendance signal: 100% means the learner was active on every day of the measurement window, while the "
                "watchlist line marks learners forecast to be active on only about one day in twenty.\n"
                "- It is **not** marks and **not** classroom presence — it is online study activity.\n"
                "- In this app a student's attendance % is early-window VLE engagement (first 40% of the module); "
                "the forecast estimates the late window (after 70%)."
            ),
        }

    if "cluster" in q:
        data = clusters(db)
        total = sum(c["count"] for c in data["clusters"])
        lines = [f"**Cohort clusters** ({total:,} students)"]
        for c in data["clusters"]:
            lines.append(
                f"- **{c['label']}** — {c['count']:,} students · avg SGPA {c['avg_sgpa']:.2f} · readiness {c['avg_readiness']:.0f} · risk {c['avg_risk'] * 100:.0f}%"
            )
        return {"intent": "clusters", "snippet": f"K-Means cohort segmentation across {total:,} real OULAD learners.", "answer": "\n".join(lines)}

    if "anomal" in q or "unusual" in q:
        n = db.query(func.count(PerformanceRecord.id)).filter(PerformanceRecord.anomaly_flag.is_(True)).scalar() or 0
        total = db.query(func.count(PerformanceRecord.id)).scalar() or 1
        return {
            "intent": "anomalies",
            "snippet": "Isolation Forest engagement/performance anomalies.",
            "answer": (
                f"Isolation Forest flags **{n:,} learners** ({100 * n / max(1, total):.2f}% of the cohort) with unusual engagement or performance patterns. "
                "Open **Performance → Interventions** to review the highest anomaly scores alongside risk drivers."
            ),
        }

    if "attendance" in q and ("75" in q or "below" in q or "forecast" in q or "risk" in q):
        data = attendance_risk(db, size=1)
        s = data["summary"]
        return {
            "intent": "attendance_risk",
            "snippet": "Next-period VLE engagement forecast (Random Forest).",
            "answer": (
                f"**{s['predicted_low_engagement']:,} learners** ({s['predicted_pct']:.1f}%) are forecast below the "
                f"{s['target']:g}% active-day engagement line next period (average forecast {s['avg_forecast']:.1f}%). "
                f"{s['currently_low_engagement']:,} are already below it today. "
                "This cohort is OULAD, so attendance is represented by real VLE engagement rather than classroom roll-call."
            ),
        }

    if "department" in q and ("risk" in q or "sgpa" in q or "performance" in q or "worst" in q or "best" in q):
        data = cohorts(db)["risk_by_dept"]
        top = data[0]
        best = max(data, key=lambda d: d["avg_sgpa"])
        lines = ["**Department performance**"]
        lines.append(f"- Highest risk share: **{top['department']}** — {top['at_risk_pct']:.1f}% high risk, SGPA {top['avg_sgpa']:.2f}")
        lines.append(f"- Strongest SGPA: **{best['department']}** — {best['avg_sgpa']:.2f}, VLE engagement {best['avg_attendance']:.1f}%")
        for d in data[:3]:
            lines.append(f"- {d['department']}: {d['at_risk_pct']:.1f}% high risk · SGPA {d['avg_sgpa']:.2f}")
        return {"intent": "departments", "snippet": "Department risk and SGPA analytics.", "answer": "\n".join(lines)}

    if "semester" in q and ("sgpa" in q or "trend" in q or "performance" in q):
        trend = cohorts(db)["semester_trend"]
        lines = ["**SGPA by semester**"]
        for row in trend:
            lines.append(f"- Semester {row['semester']}: SGPA {row['avg_sgpa']:.2f} · pass {row['pass_pct']:.1f}% · VLE engagement {row['avg_attendance']:.1f}%")
        return {"intent": "semester_trend", "snippet": "Semester-wise SGPA and pass-rate trend.", "answer": "\n".join(lines)}

    if "placement" in q or "readiness" in q or "employab" in q:
        summary_data = summary(db)
        ready = db.query(func.count(PerformanceRecord.id)).filter(PerformanceRecord.placement_readiness >= 70).scalar() or 0
        return {
            "intent": "placement",
            "snippet": "Placement readiness across the cohort.",
            "answer": (
                f"Average placement readiness is **{summary_data['avg_readiness']:.1f}/100** across {summary_data['records']:,} students. "
                f"**{ready:,}** ({100 * ready / max(1, summary_data['records']):.1f}%) are placement-ready (≥70). "
                "Use the skill-gap panel in a student's digital twin to see coding, communication, certification and internship gaps."
            ),
        }

    if "risk" in q or "dropout" in q or "intervention" in q or "at risk" in q:
        s = summary(db)
        metrics = get_metrics() or {}
        importances = sorted((metrics.get("feature_importances") or {}).items(), key=lambda kv: kv[1], reverse=True)[:3]
        drivers = ", ".join(FEATURE_LABELS.get(k, k) for k, _ in importances)
        return {
            "intent": "risk",
            "snippet": "Risk intelligence from the benchmarked classifier.",
            "answer": (
                f"**{s['at_risk']:,} students ({s['at_risk_pct']:.1f}%)** are high risk and **{s['watch']:,}** are on the watchlist. "
                f"Average VLE engagement is {s['avg_attendance']:.1f}% and average SGPA {s['avg_sgpa']:.2f}.\n"
                f"- Top model drivers: {drivers}\n"
                f"- {s['attendance_risk']:,} learners are forecast below the {ENGAGEMENT_TARGET:g}% engagement line\n"
                "- Open **Performance → Interventions** for the prioritized faculty queue."
            ),
        }
    return None



def cohorts(db: Session) -> dict:
    def build():
        risk_rows = (
            db.query(
                PerformanceRecord.department,
                func.sum(case((PerformanceRecord.risk_label == "low", 1), else_=0)),
                func.sum(case((PerformanceRecord.risk_label == "medium", 1), else_=0)),
                func.sum(case((PerformanceRecord.risk_label == "high", 1), else_=0)),
                func.avg(PerformanceRecord.final_sgpa),
                func.avg(PerformanceRecord.attendance_pct),
                func.count(PerformanceRecord.id),
            )
            .group_by(PerformanceRecord.department)
            .all()
        )
        risk_by_dept = [
            {
                "department": dept,
                "low": int(low or 0),
                "medium": int(medium or 0),
                "high": int(high or 0),
                "total": int(total or 0),
                "avg_sgpa": round(float(sgpa or 0), 2),
                "avg_attendance": round(float(attendance or 0), 1),
                "at_risk_pct": round(100 * (high or 0) / total, 1) if total else 0,
            }
            for dept, low, medium, high, sgpa, attendance, total in risk_rows
        ]
        risk_by_dept.sort(key=lambda d: d["at_risk_pct"], reverse=True)

        semester_rows = (
            db.query(
                PerformanceRecord.semester,
                func.avg(PerformanceRecord.final_sgpa),
                func.avg(PerformanceRecord.attendance_pct),
                func.sum(case((PerformanceRecord.final_sgpa >= 5.0, 1), else_=0)),
                func.count(PerformanceRecord.id),
            )
            .group_by(PerformanceRecord.semester)
            .order_by(PerformanceRecord.semester)
            .all()
        )
        semester_trend = [
            {
                "semester": int(sem),
                "avg_sgpa": round(float(sgpa or 0), 2),
                "avg_attendance": round(float(attendance or 0), 1),
                "pass_pct": round(100 * (passed or 0) / total, 1) if total else 0,
            }
            for sem, sgpa, attendance, passed, total in semester_rows
        ]

        heat_rows = (
            db.query(
                PerformanceRecord.department,
                PerformanceRecord.semester,
                func.avg(PerformanceRecord.final_sgpa),
                func.count(PerformanceRecord.id),
            )
            .group_by(PerformanceRecord.department, PerformanceRecord.semester)
            .all()
        )
        heatmap = [
            {"department": dept, "semester": int(sem), "avg_sgpa": round(float(sgpa or 0), 2), "count": int(count)}
            for dept, sem, sgpa, count in heat_rows
        ]

        band = cast(PerformanceRecord.attendance_pct / 10, Integer) * 10
        band_rows = (
            db.query(band, func.avg(PerformanceRecord.final_sgpa), func.count(PerformanceRecord.id))
            .group_by(band)
            .order_by(band)
            .all()
        )
        attendance_bands = [
            {"band": f"{int(b)}-{min(int(b) + 9, 100)}%", "avg_sgpa": round(float(sgpa or 0), 2), "count": int(count)}
            for b, sgpa, count in band_rows
        ]

        return {
            "risk_by_dept": risk_by_dept,
            "semester_trend": semester_trend,
            "heatmap": heatmap,
            "attendance_bands": attendance_bands,
            "departments": [
                row[0]
                for row in db.query(PerformanceRecord.department)
                .distinct()
                .order_by(PerformanceRecord.department)
                .all()
            ],
        }

    return _cached("cohorts", 120, build)
