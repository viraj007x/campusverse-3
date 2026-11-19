import base64
import threading
import urllib.request
from pathlib import Path

import cv2
import numpy as np

from ..config import settings

_lock = threading.Lock()
_yunet = None
_sface = None

YUNET_URL = "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"
SFACE_URL = "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx"

MATCH_THRESHOLD = 0.40  # cosine similarity; OpenCV recommends ~0.363 for same identity


def _download(url: str, dest: Path) -> None:
    if dest.exists() and dest.stat().st_size > 1000:
        return
    tmp = dest.with_suffix(".part")
    with urllib.request.urlopen(url, timeout=120) as resp, open(tmp, "wb") as fh:
        fh.write(resp.read())
    tmp.replace(dest)


def _models() -> tuple:
    global _yunet, _sface
    with _lock:
        if _yunet is None:
            yunet_path = settings.models_dir / "face_detection_yunet_2023mar.onnx"
            sface_path = settings.models_dir / "face_recognition_sface_2021dec.onnx"
            _download(YUNET_URL, yunet_path)
            _download(SFACE_URL, sface_path)
            _yunet = cv2.FaceDetectorYN.create(str(yunet_path), "", (320, 320), 0.6, 0.3, 5000)
            _sface = cv2.FaceRecognizerSF.create(str(sface_path), "")
    return _yunet, _sface


def decode_image(data_url: str) -> np.ndarray:
    if "," in data_url and data_url.strip().startswith("data:"):
        data_url = data_url.split(",", 1)[1]
    raw = base64.b64decode(data_url)
    arr = np.frombuffer(raw, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image")
    return img


def detect_faces(img: np.ndarray) -> list[np.ndarray]:
    detector, _ = _models()
    h, w = img.shape[:2]
    detector.setInputSize((w, h))
    _, faces = detector.detect(img)
    if faces is None:
        return []
    return [f for f in faces]


def face_embedding(img: np.ndarray, face: np.ndarray) -> np.ndarray:
    _, recognizer = _models()
    aligned = recognizer.alignCrop(img, face)
    feat = recognizer.feature(aligned).flatten().astype(np.float32)
    return feat / (np.linalg.norm(feat) + 1e-9)


def cosine(a, b) -> float:
    a = np.asarray(a, dtype=np.float32)
    b = np.asarray(b, dtype=np.float32)
    return float(np.dot(a, b) / ((np.linalg.norm(a) * np.linalg.norm(b)) + 1e-9))


def face_box(face: np.ndarray, img_w: int, img_h: int) -> dict:
    x, y, w, h = (float(v) for v in face[:4])
    return {
        "x": round(max(0.0, x) / img_w, 4),
        "y": round(max(0.0, y) / img_h, 4),
        "w": round(w / img_w, 4),
        "h": round(h / img_h, 4),
        "score": round(float(face[-1]), 3),
    }


def yaw_estimate(face: np.ndarray) -> float:
    # YuNet landmarks: right eye (4,5), left eye (6,7), nose (8,9)
    right_eye = np.array([face[4], face[5]], dtype=np.float32)
    left_eye = np.array([face[6], face[7]], dtype=np.float32)
    nose = np.array([face[8], face[9]], dtype=np.float32)
    eye_mid_x = (right_eye[0] + left_eye[0]) / 2.0
    interocular = abs(left_eye[0] - right_eye[0]) + 1e-6
    return float((nose[0] - eye_mid_x) / interocular)


def enroll(images: list[str]) -> tuple[list[float], int, float]:
    """Average embeddings of the largest face detected in each image."""
    features = []
    scores = []
    for data_url in images[:5]:
        img = decode_image(data_url)
        faces = detect_faces(img)
        if not faces:
            continue
        largest = max(faces, key=lambda f: f[2] * f[3])
        features.append(face_embedding(img, largest))
        scores.append(float(largest[-1]))
    if not features:
        raise ValueError("No face detected. Use a clear, well-lit photo facing the camera.")
    mean = np.mean(np.vstack(features), axis=0)
    mean = mean / (np.linalg.norm(mean) + 1e-9)
    return mean.tolist(), len(features), float(np.mean(scores))
