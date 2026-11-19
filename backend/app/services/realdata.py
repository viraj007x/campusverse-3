"""Real-world cohort adapter: OULAD (Open University Learning Analytics Dataset).

Source: https://analyse.kmi.open.ac.uk/open_dataset
License: CC BY 4.0. Anonymised learner records from The Open University (UK).
No Graphic Era or other institutional records are used here.
"""

from __future__ import annotations

import gzip
import json
import time
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data" / "real" / "oulad"
CACHE = ROOT / "artifacts" / "oulad_records.json.gz"

SOURCE = {
    "name": "OULAD — Open University Learning Analytics Dataset",
    "provider": "The Open University (UK)",
    "license": "CC BY 4.0",
    "url": "https://analyse.kmi.open.ac.uk/open_dataset",
    "kind": "real",
    "note": (
        "Anonymised real learner records. VLE = virtual learning environment (the online study platform); "
        "engagement is measured as active study days and stands in for attendance because OULAD has no classroom roll-call. "
        "Placement readiness is a derived estimate from real assessment and engagement outcomes; "
        "skills, certifications and internships are not present in OULAD."
    ),
}

EARLY = 0.40
LATE = 0.70


def available() -> bool:
    return all(
        (DATA_DIR / name).exists()
        for name in ("studentInfo.csv", "studentAssessment.csv", "assessments.csv", "studentVle.csv", "courses.csv")
    )


def _days_map(courses: pd.DataFrame) -> dict[tuple[str, str], int]:
    return {
        (str(r.code_module), str(r.code_presentation)): int(r.module_presentation_length)
        for r in courses.itertuples()
    }


def _vle_engagement(lengths: dict[tuple[str, str], int]) -> pd.DataFrame:
    chunks: list[pd.DataFrame] = []
    usecols = ["code_module", "code_presentation", "id_student", "date", "sum_click"]
    for chunk in pd.read_csv(DATA_DIR / "studentVle.csv", usecols=usecols, chunksize=2_000_000):
        chunk["length"] = [
            lengths.get((str(m), str(p)), 240) for m, p in zip(chunk["code_module"], chunk["code_presentation"])
        ]
        chunk = chunk[(chunk["date"] >= 0) & (chunk["date"] <= chunk["length"])]
        early = chunk[chunk["date"] <= (chunk["length"] * EARLY)].copy()
        late = chunk[chunk["date"] >= (chunk["length"] * LATE)].copy()
        for frame, prefix in ((early, "early"), (late, "late")):
            if frame.empty:
                continue
            daily = (
                frame.groupby(["code_module", "code_presentation", "id_student", "date"], observed=True)["sum_click"]
                .sum()
                .reset_index()
            )
            agg = daily.groupby(["code_module", "code_presentation", "id_student"], observed=True).agg(
                clicks=("sum_click", "sum"), days=("date", "count")
            )
            agg.columns = [f"{prefix}_clicks", f"{prefix}_days"]
            chunks.append(agg.reset_index())
    if not chunks:
        return pd.DataFrame(columns=["code_module", "code_presentation", "id_student", "early_clicks", "early_days", "late_clicks", "late_days"])
    merged = pd.concat(chunks, ignore_index=True)
    return merged.groupby(["code_module", "code_presentation", "id_student"], observed=True).sum().reset_index()


def build_records(force: bool = False) -> list[dict]:
    if CACHE.exists() and not force:
        with gzip.open(CACHE, "rt", encoding="utf-8") as fh:
            return json.load(fh)
    if not available():
        return []

    started = time.perf_counter()
    info = pd.read_csv(DATA_DIR / "studentInfo.csv")
    courses = pd.read_csv(DATA_DIR / "courses.csv")
    assessments = pd.read_csv(DATA_DIR / "assessments.csv")
    scores = pd.read_csv(DATA_DIR / "studentAssessment.csv")
    lengths = _days_map(courses)

    info["length"] = [lengths.get((str(m), str(p)), 240) for m, p in zip(info["code_module"], info["code_presentation"])]
    info["cutoff"] = info["length"] * EARLY
    info["late_start"] = info["length"] * LATE
    early_totals = (
        assessments.merge(courses, on=["code_module", "code_presentation"], how="left")
        .assign(early=lambda d: d["date"] <= d["module_presentation_length"] * EARLY)
        .groupby(["code_module", "code_presentation"], observed=True)["early"]
        .sum()
        .to_dict()
    )

    joined = scores.merge(assessments, on="id_assessment", how="left")
    joined = joined[joined["score"].notna()].copy()
    joined["score"] = joined["score"].astype(float).clip(0, 100)
    joined["continuous"] = joined["assessment_type"].isin(["TMA", "CMA"])
    joined["exam"] = joined["assessment_type"].eq("Exam")
    keys = ["code_module", "code_presentation", "id_student"]
    joined = joined.merge(
        info[["code_module", "code_presentation", "id_student", "cutoff"]], on=keys, how="left"
    )
    joined["early"] = joined["date"] <= joined["cutoff"]
    joined["weight"] = joined["weight"].fillna(0).astype(float)

    def weighted(frame: pd.DataFrame) -> float:
        weights = frame["weight"].sum()
        if weights <= 0:
            return float(frame["score"].mean()) if len(frame) else 0.0
        return float((frame["score"] * frame["weight"]).sum() / weights)

    aggregates = []
    for key, group in joined.groupby(keys, observed=True):
        early = group[group["early"]]
        cont = early[early["continuous"]]
        exam = group[group["exam"]]
        early_score = weighted(cont) if len(cont) else (weighted(early) if len(early) else 0.0)
        exam_score = weighted(exam) if len(exam) else 0.0
        final_score = weighted(group)
        early_submitted = int(early["id_assessment"].nunique())
        aggregates.append(
            {
                "code_module": key[0],
                "code_presentation": key[1],
                "id_student": int(key[2]),
                "early_score": round(early_score, 2),
                "exam_score": round(exam_score, 2),
                "final_score": round(final_score, 2),
                "early_submitted": early_submitted,
            }
        )
    agg = pd.DataFrame(aggregates)

    vle = _vle_engagement(lengths)
    rows = info.merge(agg, on=keys, how="left").merge(vle, on=keys, how="left")
    for col in ("early_score", "exam_score", "final_score", "early_submitted", "early_clicks", "early_days", "late_clicks", "late_days"):
        if col not in rows:
            rows[col] = 0
        rows[col] = rows[col].fillna(0)
    rows["early_total"] = [
        max(1, int(early_totals.get((str(m), str(p)), 1)))
        for m, p in zip(rows["code_module"], rows["code_presentation"])
    ]
    rows["early_window"] = np.maximum(1, (rows["length"] * EARLY).round())
    rows["late_window"] = np.maximum(1, (rows["length"] * (1 - LATE)).round())

    records: list[dict] = []
    for r in rows.itertuples():
        early_score = float(r.early_score)
        final_score = float(r.final_score)
        if not final_score:
            final_score = early_score
        engagement = float(np.clip(100 * r.early_days / r.early_window, 0, 100))
        late_engagement = float(np.clip(100 * r.late_days / r.late_window, 0, 100))
        completion = float(np.clip(100 * r.early_submitted / r.early_total, 0, 100))
        study_clicks = float(r.early_clicks) / max(1.0, r.early_window / 7)
        readiness = float(np.clip(0.65 * final_score + 0.25 * engagement + 0.10 * completion, 0, 100))
        result = str(r.final_result)
        if result in ("Withdrawn", "Fail"):
            risk = 0.82 if result == "Withdrawn" else 0.74
            label = "high"
        elif result == "Pass" and final_score < 60:
            risk, label = 0.48, "medium"
        elif result == "Pass":
            risk, label = 0.22, "low"
        else:  # Distinction
            risk, label = 0.08, "low"
        presentation = str(r.code_presentation)
        records.append(
            {
                "roll_no": f"{r.code_module}{presentation}-{int(r.id_student)}",
                "name": f"Learner {int(r.id_student)}",
                "department": f"OULAD Module {r.code_module}",
                "semester": 1 if presentation.endswith("J") else 2,
                "year": int(presentation[:4]),
                "attendance_pct": round(engagement, 1),
                "assignment_avg": round(early_score / 10, 2),
                "internal_avg": round(early_score, 1),
                "ai_flag_rate": 0.0,
                "prev_backlogs": int(r.num_of_prev_attempts),
                "prev_sgpa": 0.0,  # OULAD has no prior-SGPA field; kept at zero rather than inventing one
                "final_sgpa": round(final_score / 10, 2),
                "risk_score": risk,
                "risk_label": label,
                "practical_avg": round(float(r.exam_score), 1),
                "assignment_completion": round(completion, 1),
                "study_hours": round(study_clicks, 1),
                "library_visits": int(r.early_days),
                "lms_activity": round(float(r.early_clicks), 1),
                "coding_skill": 0.0,
                "communication_skill": 0.0,
                "certifications": 0,
                "internship_months": 0,
                "placement_readiness": round(readiness, 1),
                "attendance_next": round(late_engagement, 1),
            }
        )

    CACHE.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(CACHE, "wt", encoding="utf-8", compresslevel=6) as fh:
        json.dump(records, fh)
    print(f"OULAD adapter: {len(records):,} real learner records in {time.perf_counter() - started:.1f}s")
    return records
