import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import BACKEND_DIR, settings
from .db import Base, engine
from .routers import analytics, auth, evalai, lostfound, overview, placement, rag, vision
from .routers import performance as performance_router

INGEST_THREAD: threading.Thread | None = None


def _warm_rag() -> None:
    try:
        from .services import rag as rag_service

        if rag_service.get_collection().count() == 0:
            rag_service.ingest_all()
            print("CampusRAG: corpus indexed")
    except Exception as exc:  # pragma: no cover - startup diagnostics
        print(f"CampusRAG indexing failed: {exc}")


def _warm_performance() -> None:
    from .db import SessionLocal
    from .services import performance

    db = SessionLocal()
    try:
        performance.ensure_dataset(db)
        performance.train_models(db)
        print("PerformanceTracker: ML benchmark ready")
    except Exception as exc:  # pragma: no cover - startup diagnostics
        print(f"PerformanceTracker warm-up failed: {exc}")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    from sqlalchemy import inspect

    from .models import PerformanceRecord

    columns = {c["name"] for c in inspect(engine).get_columns("performance_records")}
    if "placement_readiness" not in columns:
        PerformanceRecord.__table__.drop(bind=engine, checkfirst=True)
        Base.metadata.create_all(bind=engine)
        for stale in (BACKEND_DIR / "artifacts").glob("performance_*"):
            stale.unlink(missing_ok=True)

    from .seed import seed_eval_demo, seed_if_empty

    seed_if_empty()
    seed_eval_demo()
    global INGEST_THREAD
    INGEST_THREAD = threading.Thread(target=_warm_rag, daemon=True)
    INGEST_THREAD.start()
    threading.Thread(target=_warm_performance, daemon=True).start()
    print(f"CampusVerse API ready | LLM mode: {settings.llm_mode}")
    yield


app = FastAPI(title="CampusVerse API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin, "http://localhost:3100", "http://127.0.0.1:3100"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/api/files", StaticFiles(directory=str(settings.uploads_dir)), name="files")

for router in (auth, overview, rag, vision, lostfound, placement, analytics, evalai):
    app.include_router(router.router)
app.include_router(performance_router.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "llm_mode": settings.llm_mode}
