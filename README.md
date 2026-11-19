# CampusVerse AI — The Campus, Wired With Intelligence

An integrated smart-university platform for **Graphic Era Hill University (GEHU)**, built as a 7th-semester B.Tech major project. CampusVerse is a Zoho Creator–style campus ERP with **SAMVIT**, its AI brain: a RAG academic copilot that also answers open-domain questions, face-recognition attendance with liveness checks, YOLOv8 crowd analytics, CLIP-powered lost & found matching, a resume/JD placement studio with AI video interviews, an LLM-as-judge assignment grader with integrity checks, and a performance intelligence module trained on **32,593 real anonymised OULAD learner records** with a seven-model ML suite — all under role-based access for students, faculty and administrators.

- **Backend:** FastAPI · SQLAlchemy 2 · SQLite · ChromaDB · OpenCV Zoo · Ultralytics · OpenCLIP · scikit-learn · LightGBM · pandas
- **Frontend:** Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · Recharts · lucide-react
- **LLM:** Groq (`llama-3.3-70b-versatile`) with an offline extractive fallback — the app is fully functional without any API key

---

## Modules

| Module | What it does | Core tech |
| --- | --- | --- |
| **SAMVIT AI** | Campus copilot with a university knowledge brain and a real 32.6k-learner OULAD analytics brain; answers any question (campus, analytics or general knowledge); specialist agents for risk, engagement, placement and faculty workflows; streaming answers with page-level citations | ChromaDB + all-MiniLM-L6-v2 dense retrieval, BM25 hybrid re-ranking, performance-context injection, Wikipedia open-domain fallback, Groq Llama 3.3 + offline fallback |
| **VisionGuard** | Face-recognition attendance sessions with a head-turn liveness challenge and live roster | OpenCV Zoo **YuNet** detector + **SFace** recogniser (cosine, 0.40 threshold) |
| **Crowd Analytics** | Zone occupancy from uploaded frame or live camera, annotated image, 36 h footfall history | **YOLOv8n** person detection (conf 0.35) |
| **Lost & Found** | Photo-based lost/found reports with automatic visual match suggestions | **OpenCLIP ViT-B-32** embeddings (laion2b_s34b_b79k), 0.58 match threshold |
| **Placement Studio** | Resume parsing, JD skill-gap match with roadmap, AI **video-call** mock interviewer (voice questions, camera + mic answers, live transcript) | TF-IDF + skill taxonomy, Web Speech API + getUserMedia, LLM with heuristic offline fallback |
| **EvalAI Grader** | Rubric-based grading with structured JSON, peer plagiarism, AI-writing detection, PDF/paste submission and mandatory **Approve & Publish** | LLM JSON mode + deterministic offline rubric engine, TF-IDF word+char cosine, stylometric signals |
| **PerformanceTracker** | Real OULAD cohort (32,593 learners) with risk prediction, SGPA regression, VLE-engagement forecasting, clustering, anomaly detection, digital twin, what-if simulator and interventions; every screen labels its data source | XGBoost, Random Forest, Logistic Regression, Decision Tree, HistGradientBoosting, LightGBM, K-Means, Isolation Forest, Linear/RF/HistGB/LightGBM regressors; joblib artifacts |
| **Analytics** | Cross-module insights: copilot volume, top cited sources, attendance health, footfall, L&F funnel | Aggregation APIs + Recharts |

### Role matrix

| Capability | Student | Faculty | Admin |
| --- | :-: | :-: | :-: |
| SAMVIT assistant, lost & found, placement | ✓ | ✓ | ✓ |
| SAMVIT risk / engagement / placement agents | ✓ | ✓ | ✓ |
| SAMVIT faculty assistant agent | — | ✓ | ✓ |
| Download knowledge base files / full zip | ✓ | ✓ | ✓ |
| Add or remove knowledge base documents | — | ✓ | ✓ |
| Submit assignments, view published rubric feedback | ✓ | — | — |
| Run AI review, edit rubric marks, approve & publish | — | ✓ | ✓ |
| View own performance record, twin and what-if simulator | ✓ | — | — |
| Cohort explorer, interventions, engagement risk, clusters, anomalies, model lab | — | ✓ | ✓ |
| Retrain the ML suite on demand | — | — | ✓ |
| Enroll face, mark own attendance | ✓ | — | — |
| Start/close sessions, roster, export CSV | — | ✓ | ✓ |
| Campus analytics | — | ✓ | ✓ |
| Platform stats, all-module oversight | — | — | ✓ |

---

## Quickstart

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate        # Windows; use source .venv/bin/activate on Unix
pip install -r requirements.txt

cp .env.example .env          # then edit as needed
uvicorn app.main:app --host 127.0.0.1 --port 8100
```

First start automatically:
- creates `backend/campusverse.db` and seeds demo users, courses, attendance history, crowd samples, assignments and four EvalAI submissions;
- ingests the **OULAD real cohort** into `performance_records` (gzip-cached at `backend/artifacts/oulad_records.json.gz`), then trains and benchmarks the full ML suite (~15 s) — six classifiers, four SGPA regressors, a VLE-engagement forecaster, K-Means, Isolation Forest and a decision-rule tree — and writes `backend/artifacts/performance_*.{json,joblib}`;
- indexes `data/docs/*.pdf` into `backend/chroma_db` in a background thread (first run downloads the MiniLM embedding model).

**Real dataset:** download the OULAD dataset (CC BY 4.0) from <https://analyse.kmi.open.ac.uk/open_dataset> and extract these CSVs into `backend/data/real/oulad/`: `studentInfo.csv`, `studentVle.csv`, `studentAssessment.csv`, `assessments.csv`, `courses.csv`, `vle.csv`. If the files are missing, the app falls back to a clearly labelled synthetic cohort and the UI banner switches to "Synthetic fallback" — it never presents synthetic rows as real.

API docs: <http://127.0.0.1:8100/docs>

### 2. Frontend

```bash
cd frontend
npm install
npx next dev -p 3100
```

Open <http://localhost:3100>. The frontend expects the API at `http://localhost:8100` (override with `NEXT_PUBLIC_API_URL`).

### 3. Enable the LLM (optional but recommended)

Put a free [Groq](https://console.groq.com) key in `backend/.env` and restart the backend:

```ini
LLM_PROVIDER=groq
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.3-70b-versatile
```

Without a key the app runs on the **local engine**: campus questions are answered extractively from retrieved chunks with citations, open-domain questions fall back to a Wikipedia lookup, mock-interview scoring uses heuristics, and the UI reports the engine as `online · local knowledge engine` rather than failing.

### Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Student | `student@campus.edu` | `Student@123` |
| Faculty | `faculty@campus.edu` | `Faculty@123` |
| Admin | `admin@campus.edu` | `Admin@123` |

The login page pre-fills these and offers one-click demo buttons.

---

## Demo script

1. **Landing → Sign in** as student (demo button).
2. **SAMVIT AI:** ask *"When do the end semester exams start?"* — watch tokens stream, then the answer cites the academic calendar with the Nov 25 – Dec 12 dates. Ask something off-corpus like *"What is a black hole?"* — SAMVIT answers from general knowledge (Wikipedia fallback offline, the LLM otherwise) instead of refusing. Switch to **Risk Analyst** and ask *"How many students are high risk?"* for the analytics-first answer over the real OULAD cohort.
3. **Lost & Found:** report a lost bag and attach `vibe_images/lost-bag-1_*.png` — the CLIP index suggests the matching found report with a similarity bar.
4. **Placement:** upload `data/samples/resume_jane_doe.pdf`, paste the sample JD, get a fit score, matched/missing skills and a learning roadmap. Then start the **AI video interview**: SAMVIT speaks each question, the webcam tile shows your camera feed and the speech recogniser transcribes your answer live (typed answers still work without a mic).
5. **Crowd:** upload `vibe_images/campus-crowd_*.png` — YOLOv8 returns an annotated image and live zone counts.
6. **EvalAI (student):** open *Assignment Grader* → the seeded transformer review is already published with 7/10; open the Docker assignment, paste 40+ words or upload a PDF and submit. Every submission shows its stored text back to the student and to faculty reviewers.
7. Sign out → **Faculty** demo → *EvalAI Grader* → the queue shows four submissions with their submitted answer text. Run AI review on a **submitted** row: peer similarity, AI-likelihood signals and rubric marks appear; edit a mark, then **Approve & publish**. Signed-in students see the grade only after this step.
8. **PerformanceTracker (faculty):** the real-data banner names OULAD (CC BY 4.0) and the record count. The KPI row shows 32,593 learners, 52.8% high risk and average SGPA 5.56. Explore the six tabs: overview charts, the learner explorer with digital-twin drawer, interventions, engagement-risk worklist, cluster/anomaly panels, and the model lab with benchmark, decision rules and retraining. Search a roll number, filter by module, risk, cluster or anomaly, and drag the **what-if** sliders.
9. Sign out → **Faculty** → start an attendance session (webcam required; liveness = look straight, then turn head), mark attendance, export CSV.
10. Faculty **Analytics** → copilot volume, top sources, attendance by course, footfall.
11. Sign out → **Admin** demo → platform-wide stats, all analytics, and **Retrain models** in PerformanceTracker.

---

## How it works

### Retrieval & SAMVIT brain

1. PDFs/text are extracted page-by-page (pypdf) and chunked (~760 chars, 140 overlap) on sentence boundaries.
2. Chunks are embedded with `all-MiniLM-L6-v2` and stored in ChromaDB (cosine).
3. A query runs dense search (top 12) and BM25Okapi in parallel; results merge with Reciprocal Rank Fusion.
4. Final score:

   ```
   score = RRF + 0.15·vector_score + 0.06·query_coverage + 0.005·(bm25/bm25_max)
   ```

   plus `+0.02` for month-bearing chunks when the question asks *when/date/deadline*.
5. Tokens are stemmed (`examinations → examinat`, `exams → exam`) and stop-words filtered so generic words like "semester" don't dominate.
6. Snippets are re-windowed around the query terms (sentence windows + character sweep), which is what pins the exam calendar row in the answer.

The copilot streams Server-Sent Events: `sources` → `token`… → `meta` → `done`, and persists each chat to `ChatLog` for analytics.

SAMVIT has five agents — general (SAMVIT), Risk Analyst, Engagement Coach, Career Mentor and Faculty Assistant. Questions about risk counts, engagement forecasts, clusters or anomalies are answered **analytics-first** from the performance brain (with the matching source doc, `performance-brain`) before any document retrieval; the last three chat turns are supplied as conversation memory. When nothing in the campus corpus is relevant, SAMVIT does not refuse: online it answers from the LLM's general knowledge with an explicit "not from campus documents" disclaimer, and offline it queries Wikipedia. Campus facts are never invented — only general knowledge is answered outside the corpus.

### Vision

- **Attendance:** YuNet finds the face → SFace embeds it → cosine similarity against enrolled profiles. Liveness requires a neutral pose followed by a head turn (yaw estimated from the 5-point landmarks); frames failing liveness are rejected. One record per student per session.
- **Crowd:** YOLOv8n (`backend/models_data/yolov8n.pt`, auto-downloaded) counts class-0 persons, draws boxes, and writes `CrowdSample` rows per zone for the history charts.

### Grading (EvalAI)

1. A submission arrives as pasted text or a PDF (pypdf) capped at 40k characters; empty or under-40-word text is rejected.
2. **Integrity checks** run first and are always shown to the reviewer: stylometry (burstiness, lexical diversity, uniform-sentence ratio, formulaic phrase hits, connector rate) produces an AI-likelihood score, and word 1–2-gram plus `char_wb` 4–5-gram TF-IDF cosine blended 0.45/0.55 catches paraphrase as well as copy-paste against every other submission in the assignment.
3. Grading is rubric-driven. With an LLM key the model returns strict JSON (`summary`, `strengths`, `improvements`, `criteria[]`) which is reconciled against the rubric — every criterion exactly once, half-mark steps, clamped to max; any failure falls back to the deterministic engine.
4. The offline engine scores each criterion from TF-IDF relevance to the reference answer, concept coverage, depth vs. expected length and structural signals, so the module works with zero API keys.
5. Faculty can edit any mark or comment and must press **Approve & publish**; until then the student only sees "Under review". Students can submit once per assignment and never see peer or AI signals before publication.

### Performance intelligence (real OULAD cohort)

1. The cohort is the **Open University Learning Analytics Dataset** (OULAD, CC BY 4.0): 32,593 real, anonymised learner-module records from The Open University (UK). `backend/app/services/realdata.py` joins `studentInfo`, `assessments`, `studentAssessment` and `studentVle`, then derives:
   - **VLE engagement** = share of distinct active study days in the module's early 40% window (the real analogue of attendance);
   - **next-period engagement** = active-day share in the late 70% window;
   - **SGPA-equivalent score** from assessment weights, plus assignment/practical/internal splits and prior-attempt counts;
   - **risk labels** from real `final_result` (Withdrawn and Fail are high risk, Pass under 60 medium, Distinction low).
   Skills, certifications, internships and placement readiness are **derived estimates** — OULAD does not contain them — and the UI labels them as such. The ingestion result is gzip-cached so restarts take seconds.
2. Rows are bulk-inserted in chunks of 10,000 into `performance_records`, which carries composite indexes for roll number, module, presentation, risk, cluster and anomaly flags. Every list/search/filter/sort runs server-side in SQL with `LIMIT/OFFSET`.
3. `summary`, `cohorts` and KPI aggregates are TTL-cached and computed with SQL aggregates, so repeat page loads skip the scan.
4. At startup (or on admin **Retrain**) the full suite is trained on a stratified split of the real rows:
   - **Classifiers:** Logistic Regression, Decision Tree, Random Forest, HistGradientBoosting, LightGBM and XGBoost, benchmarked on accuracy/precision/recall/F1/AUC plus train and inference time; the best estimator is persisted with `joblib`.
   - **Regressors:** Linear, Random Forest, HistGradientBoosting and LightGBM predict the final score; a separate Random Forest predicts next-period VLE engagement from 17 extended features.
   - **Unsupervised:** K-Means (5 segments, standard-scaled) and Isolation Forest (2.5% contamination) for cohort structure and anomalies.
   - **Explainability:** a shallow Decision Tree yields human-readable high-risk rules printed with sample counts and leaf risk rates.
5. **Drivers** explain a learner's risk as z-score × feature importance for the top signals. The **digital twin** pans across academics, engagement, career and intervention data; **what-if** feeds edited values through the trained classifier to return a new risk score and forecast SGPA, shown as a delta against the current record.
6. Students only ever fetch their own roll number; faculty and admin get the explorer, interventions, the engagement-risk worklist, cluster/anomaly panels and the model lab. A source banner on the overview names the dataset, provider and licence, and flips to "Synthetic fallback" if the CSVs are absent — synthetic numbers are never presented as real.

### Privacy note

All processing is local. Face embeddings and photos of lost/found items stay in `backend/chroma_db` / `data/uploads`; nothing is sent to third parties except the optional LLM prompt for copilot answers and interview feedback.

---

## API map

| Area | Endpoints |
| --- | --- |
| Auth | `POST /api/auth/login` · `POST /api/auth/register` · `POST /api/auth/logout` · `GET /api/auth/me` |
| Overview | `GET /api/overview` (role-aware) |
| SAMVIT | `POST /api/rag/chat` (SSE) · `GET /api/rag/history` · `GET /api/rag/status` · `POST /api/rag/ingest` · `POST /api/rag/upload` · `GET /api/rag/export` · `GET /api/rag/docs/{doc_id}/download` · `DELETE /api/rag/docs/{doc_id}` |
| VisionGuard | `POST /api/vision/enroll` · `GET /api/vision/enrollment` · `GET /api/vision/courses` · `POST/GET /api/vision/sessions` · `POST /api/vision/sessions/{id}/frame` · `POST /api/vision/sessions/{id}/close` · `GET /api/vision/sessions/{id}/export` · `GET /api/vision/my-attendance` |
| Crowd | `POST /api/vision/crowd` · `GET /api/vision/crowd/history` · `GET /api/vision/crowd/zones` |
| Lost & Found | `GET/POST /api/lost-found/items` · `GET /api/lost-found/items/{id}` · `POST /api/lost-found/items/{id}/resolve` |
| Placement | `POST/GET /api/placement/resume` · `POST /api/placement/match` · `GET /api/placement/matches` · `POST /api/placement/interview/start` · `POST /api/placement/interview/answer` · `GET /api/placement/interviews` |
| EvalAI | `GET /api/eval/courses` · `GET/POST /api/eval/assignments` · `GET /api/eval/assignments/{id}` · `POST /api/eval/assignments/{id}/submit` · `POST /api/eval/submissions/{id}/review` · `POST /api/eval/submissions/{id}/approve` · `GET /api/eval/my` · `GET /api/eval/stats` |
| Performance | `GET /api/performance/summary` · `GET /api/performance/model` · `GET /api/performance/students` (page/size/search/department/semester/risk/cluster/anomaly/sort) · `GET /api/performance/clusters` · `GET /api/performance/anomalies` · `GET /api/performance/attendance-risk` · `GET /api/performance/interventions` · `GET /api/performance/students/{roll_no}` · `POST /api/performance/what-if` · `GET /api/performance/cohorts` · `POST /api/performance/retrain` |
| Analytics | `GET /api/analytics` |

Auth is a signed JWT (HS256) stored in an httpOnly cookie `cv_token`; role restrictions are enforced per-route with `require_roles`.

---

## Project structure

```
backend/
  app/
    main.py            # FastAPI app, lifespan seed + RAG warm-up, CORS, static uploads
    config.py          # Pydantic settings from backend/.env
    models.py          # SQLAlchemy models (users, courses, sessions, chats, items, resumes…)
    seed.py            # Idempotent demo data
    routers/           # auth, overview, rag, vision, lostfound, placement, evalai, performance, analytics
    services/          # rag, llm, vision, crowd, clip_service, placement, evalai, performance
  models_data/         # YuNet, SFace, yolov8n weights (auto-downloaded)
  artifacts/           # performance_metrics.json + best model joblib
frontend/
  src/app/             # landing, login, Zoho-style ERP shell + module pages
  src/components/      # UI kit, charts, module widgets
  src/lib/             # api client, auth context, webcam hook
data/
  docs/                # 8 campus PDFs (corpus for SAMVIT)
  samples/             # generated sample resume + doc generators
scripts/               # data generation utilities
vibe_images/           # test fixtures for CLIP / YOLO demos
```

---

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `LLM_PROVIDER` | `groq` | `groq` \| `openai` \| `offline` |
| `GROQ_API_KEY` / `GROQ_MODEL` | — / `llama-3.3-70b-versatile` | Groq credentials |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | — / `gpt-4o-mini` | OpenAI credentials |
| `JWT_SECRET` | dev value | **Change before deploying** |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `10080` | Session lifetime (7 days) |
| `DATABASE_URL` | `sqlite:///./campusverse.db` | SQLAlchemy URL |
| `FRONTEND_ORIGIN` | `http://localhost:3100` | CORS origin |

Model names (`embedding_model`, `clip_model`, `clip_pretrained`) can be overridden in `config.py`.

---

## Verification status

Verified end-to-end in a real browser (Chrome via browser-use) on CPU:

- Zoho Creator–style light ERP shell with a **dark theme toggle** (persisted, pre-paint, no flash): landing, login/logout, grouped sidebar, red accent bar and all three role dashboards
- SAMVIT streaming with correct page citations (exam-date query ranks the calendar #1–2), analytics-first answers over the real OULAD cohort, open-domain answers for off-corpus questions, agent switching and brain-status rail
- Lost & Found: report → CLIP match (88%) → detail modal → timestamps correct
- Placement: resume upload (20 skills parsed) → JD fit 49.5% → roadmap; AI video-call interview UI (camera tile, mic/speaker state, live transcript) with typed fallback; mock interview scoring and progression
- Crowd: 16-person detection with annotated image and zone counts
- EvalAI: student paste/PDF submission → submission text visible to student and faculty → faculty AI review (peer 25.3%, AI 84.9%) → edited marks → Approve & publish → student sees the grade; stats, filtering and locked approved rows
- PerformanceTracker: all six tabs (overview with OULAD source banner, learners, interventions, engagement risk, clusters/anomalies, model lab), digital-twin drawer, 32,593-row pagination, what-if updates, student own-record view, admin retrain
- Faculty attendance session lifecycle with live roster
- Full-role pass in both themes (student, faculty, admin; overview, analytics, attendance, crowd, lost & found, performance, placement, copilot, grading): zero WCAG AA contrast failures, no horizontal overflow, no console errors and no failed API requests
- EvalAI offline feedback is rubric-aware (names the missing concepts from each rubric description), students see only published feedback without peer/AI integrity badges, and SAMVIT reports itself as `online · local knowledge engine` instead of "offline"
- `npx tsc --noEmit` passes with no errors

Benchmark from the verified run (CPU, 32,593 real OULAD rows, 80/20 stratified split): **XGBoost AUC 0.8808 / F1 0.7934** (best), Random Forest 0.8797 / 0.7914, HistGradientBoosting 0.8777 / 0.7915, LightGBM 0.8768 / 0.7881, Decision Tree 0.8695 / 0.7842, Logistic Regression 0.8676 / 0.7789. Final-score regressors: **LightGBM R² 0.9271 / MAE 0.532** (best), Random Forest 0.9266 / 0.536, HistGradientBoosting 0.9248 / 0.549, Linear 0.9202 / 0.563. Engagement forecaster: Random Forest **R² 0.7015 / MAE 5.889** active-day points. Cohort: 5 clusters, **815 anomalies (2.5%)**, **17,208 high risk (52.8%)**, 1,751 on the watchlist, average SGPA 5.56. Engagement watchlist: **15,955 learners** forecast below 5% active-day engagement.

## Known limitations

- CPU-first design: SFace/CLIP/YOLO inference is ~1–2 s per frame class; GPU is a drop-in upgrade.
- Liveness is a yaw-based challenge-response, not anti-spoof texture analysis.
- SQLite + cookie JWT is demo-grade; production would use Postgres, refresh tokens and HTTPS.
- Offline LLM mode is extractive, not generative — enable Groq for fluent answers and rubric-based interview feedback.
- EvalAI integrity signals are heuristics, not forensic proof; the AI detector flags formulaic prose and the plagiarism check is peer-to-peer only (no web corpus).
- PerformanceTracker uses the **OULAD real cohort** (CC BY 4.0, anonymised by the publisher). "Attendance" is represented by VLE active-day engagement because OULAD has no classroom roll-call; skills, certifications, internships and placement readiness are derived estimates, not dataset fields. Risk labels and cluster names are model-derived, not causal. If the CSVs are missing, a synthetic fallback is used and labelled as such in the UI. SQLite handles 32k rows comfortably but Postgres would be the production choice.
- Engagement recovery estimates assume the remaining study window is available; the watchlist shows the active-day lift needed to reach the 5% engagement target.
- The corpus ships with 8 curated GEHU PDFs. Faculty and admins can add PDF/Markdown/text files (20 MB max) from the copilot's **Knowledge base** panel, download any file or the whole base as a zip, and remove documents; every change is indexed automatically. Off-corpus answers use the LLM or Wikipedia and carry a general-knowledge disclaimer.
