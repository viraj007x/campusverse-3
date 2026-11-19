import io
import threading

import numpy as np
from PIL import Image

from ..config import settings

_lock = threading.Lock()
_model = None
_preprocess = None
_tokenizer = None


def _get():
    global _model, _preprocess, _tokenizer
    with _lock:
        if _model is None:
            import open_clip
            import torch

            torch.set_num_threads(max(2, torch.get_num_threads()))
            model, _, preprocess = open_clip.create_model_and_transforms(
                settings.clip_model, pretrained=settings.clip_pretrained, cache_dir=str(settings.models_dir)
            )
            model.eval()
            _model = model
            _preprocess = preprocess
            _tokenizer = open_clip.get_tokenizer(settings.clip_model)
    return _model, _preprocess, _tokenizer


def embed_image(raw: bytes) -> list[float]:
    import torch

    model, preprocess, _ = _get()
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    tensor = preprocess(img).unsqueeze(0)
    with torch.no_grad():
        feat = model.encode_image(tensor)
        feat = feat / feat.norm(dim=-1, keepdim=True)
    return feat[0].tolist()


def embed_text(text: str) -> list[float]:
    import torch

    model, _, tokenizer = _get()
    tokens = tokenizer([text[:400]])
    with torch.no_grad():
        feat = model.encode_text(tokens)
        feat = feat / feat.norm(dim=-1, keepdim=True)
    return feat[0].tolist()


def cosine(a, b) -> float:
    a = np.asarray(a, dtype=np.float32)
    b = np.asarray(b, dtype=np.float32)
    return float(np.dot(a, b) / ((np.linalg.norm(a) * np.linalg.norm(b)) + 1e-9))
