import base64
import threading

import cv2
import numpy as np

from ..config import settings

_lock = threading.Lock()
_model = None


def _get_model():
    global _model
    with _lock:
        if _model is None:
            from ultralytics import YOLO

            weight = settings.models_dir / "yolov8n.pt"
            _model = YOLO(str(weight))
    return _model


def count_people(img: np.ndarray) -> tuple[int, str, list[dict]]:
    model = _get_model()
    results = model.predict(img, classes=[0], conf=0.35, iou=0.45, verbose=False)
    boxes = []
    annotated = img.copy()
    for r in results:
        for box in r.boxes:
            x1, y1, x2, y2 = [int(v) for v in box.xyxy[0].tolist()]
            conf = float(box.conf[0])
            boxes.append({"x1": x1, "y1": y1, "x2": x2, "y2": y2, "confidence": round(conf, 3)})
            cv2.rectangle(annotated, (x1, y1), (x2, y2), (99, 102, 241), 2)
            cv2.putText(annotated, f"{conf:.2f}", (x1, max(12, y1 - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (99, 102, 241), 1)
    count = len(boxes)
    banner = f"Occupancy: {count} person{'s' if count != 1 else ''}"
    cv2.rectangle(annotated, (0, 0), (330, 42), (24, 24, 39), -1)
    cv2.putText(annotated, banner, (12, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (165, 180, 252), 2)
    ok, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 82])
    b64 = base64.b64encode(buf.tobytes()).decode()
    return count, "data:image/jpeg;base64," + b64, boxes
