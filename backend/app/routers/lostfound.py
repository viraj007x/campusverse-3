import io
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from PIL import Image
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..deps import get_current_user
from ..models import LostFoundItem, User
from ..services import clip_service

router = APIRouter(prefix="/api/lost-found", tags=["lost-found"])

MATCH_THRESHOLD = 0.58


def _serialize(item: LostFoundItem, reporter: User | None) -> dict:
    return {
        "id": item.id,
        "kind": item.kind,
        "title": item.title,
        "description": item.description,
        "category": item.category,
        "location": item.location,
        "status": item.status,
        "image_url": f"/api/files/{item.image_path}" if item.image_path else None,
        "reporter_name": reporter.name if reporter else "Unknown",
        "created_at": item.created_at,
    }


def _matches(db: Session, item: LostFoundItem, limit: int = 3) -> list[dict]:
    if not item.embedding:
        return []
    opposite = "found" if item.kind == "lost" else "lost"
    candidates = (
        db.query(LostFoundItem, User)
        .join(User, User.id == LostFoundItem.user_id)
        .filter(LostFoundItem.kind == opposite, LostFoundItem.embedding.isnot(None), LostFoundItem.id != item.id)
        .all()
    )
    scored = []
    for cand, reporter in candidates:
        score = clip_service.cosine(item.embedding, cand.embedding)
        if score >= MATCH_THRESHOLD:
            data = _serialize(cand, reporter)
            data["match_score"] = round(score, 3)
            scored.append(data)
    scored.sort(key=lambda x: x["match_score"], reverse=True)
    return scored[:limit]


@router.post("")
def create_item(
    kind: str = Form(...),
    title: str = Form(...),
    description: str = Form(""),
    category: str = Form("Other"),
    location: str = Form(""),
    image: UploadFile | None = File(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if kind not in ("lost", "found"):
        raise HTTPException(status_code=422, detail="Kind must be 'lost' or 'found'")
    if len(title.strip()) < 2:
        raise HTTPException(status_code=422, detail="Title is too short")

    image_path = None
    embedding = None
    if image is not None and image.filename:
        raw = image.file.read()
        if len(raw) > 8 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Image must be smaller than 8 MB")
        try:
            img = Image.open(io.BytesIO(raw)).convert("RGB")
            img.thumbnail((1280, 1280))
            out = io.BytesIO()
            img.save(out, format="JPEG", quality=86)
            data = out.getvalue()
            image_path = f"{uuid.uuid4().hex}.jpg"
            (settings.uploads_dir / image_path).write_bytes(data)
            embedding = clip_service.embed_image(data)
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=422, detail="Could not process the uploaded image")

    item = LostFoundItem(
        user_id=user.id,
        kind=kind,
        title=title.strip(),
        description=description.strip(),
        category=category.strip() or "Other",
        location=location.strip(),
        image_path=image_path,
        embedding=embedding,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    matches = _matches(db, item)
    if matches:
        item.status = "matched"
        db.commit()
    return {"item": _serialize(item, user), "matches": matches}


@router.get("/items")
def list_items(kind: str | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(LostFoundItem, User).join(User, User.id == LostFoundItem.user_id)
    if kind in ("lost", "found"):
        query = query.filter(LostFoundItem.kind == kind)
    rows = query.order_by(LostFoundItem.created_at.desc()).limit(60).all()
    return [_serialize(item, reporter) for item, reporter in rows]


@router.get("/items/{item_id}")
def item_detail(item_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.get(LostFoundItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    reporter = db.get(User, item.user_id)
    return {"item": _serialize(item, reporter), "matches": _matches(db, item)}


@router.post("/items/{item_id}/resolve")
def resolve_item(item_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.get(LostFoundItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if item.user_id != user.id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Only the reporter can resolve this item")
    item.status = "resolved"
    db.commit()
    reporter = db.get(User, item.user_id)
    return _serialize(item, reporter)
