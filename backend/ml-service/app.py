from io import BytesIO
from typing import Dict, List

import torch
from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image
from transformers import BlipForConditionalGeneration, BlipProcessor

MODEL_NAME = "Salesforce/blip-image-captioning-base"
SEVERITY_LEVELS = ("Low", "Medium", "High", "Critical")

SEVERITY_RULES: List[Dict] = [
    {"severity": "Critical", "weight": 4, "keywords": ["fire", "smoke", "spark", "electrical", "collapse", "open manhole", "fallen pole"]},
    {"severity": "Critical", "weight": 4, "keywords": ["flooded", "flooding", "large sinkhole", "uprooted tree", "hanging wire"]},
    {"severity": "High", "weight": 3, "keywords": ["pothole", "damaged road", "broken road", "leakage", "water leak", "construction debris"]},
    {"severity": "High", "weight": 3, "keywords": ["garbage overflow", "blocked drain", "broken signal", "animal on road"]},
    {"severity": "Medium", "weight": 2, "keywords": ["garbage", "trash", "debris", "damaged sign", "streetlight off"]},
    {"severity": "Medium", "weight": 2, "keywords": ["cracked pavement", "dirty area", "minor leak", "minor road damage"]},
]

LOW_SEVERITY_HINTS = {
    "building",
    "car",
    "cars",
    "road",
    "tree",
    "street",
    "sidewalk",
    "house",
    "park",
}

app = FastAPI(title="Civic Issue ML Service", version="1.1.0")
processor = BlipProcessor.from_pretrained(MODEL_NAME)
model = BlipForConditionalGeneration.from_pretrained(MODEL_NAME)
model.eval()


def generate_caption(image: Image.Image) -> str:
    inputs = processor(images=image, return_tensors="pt")
    with torch.no_grad():
        output = model.generate(**inputs, max_new_tokens=30)
    return processor.decode(output[0], skip_special_tokens=True).strip().lower()


def estimate_severity(caption: str) -> Dict[str, float | str]:
    score = 0
    hits = 0
    strongest = "Low"

    for rule in SEVERITY_RULES:
        rule_hits = sum(1 for kw in rule["keywords"] if kw in caption)
        if rule_hits == 0:
            continue
        hits += rule_hits
        score += rule_hits * int(rule["weight"])
        if SEVERITY_LEVELS.index(rule["severity"]) > SEVERITY_LEVELS.index(strongest):
            strongest = rule["severity"]

    if strongest == "Critical" or score >= 7:
        severity = "Critical" if strongest == "Critical" else "High"
    elif strongest == "High" or score >= 4:
        severity = "High"
    elif strongest == "Medium" or score >= 2:
        severity = "Medium"
    else:
        severity = "Low"

    if hits == 0:
        has_normal_scene = any(hint in caption for hint in LOW_SEVERITY_HINTS)
        confidence = 0.83 if has_normal_scene else 0.58
        severity = "Low"
    else:
        confidence = min(0.97, 0.60 + (hits * 0.08))
        if severity == "Critical":
            confidence = min(0.98, confidence + 0.05)

    return {"severity": severity, "confidence": round(confidence, 2)}


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok", "model": MODEL_NAME}


@app.post("/analyze-severity")
async def analyze_severity(image: UploadFile = File(...)) -> Dict[str, float | str]:
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image uploads are supported")

    raw_bytes = await image.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Image is empty")

    try:
        pil_image = Image.open(BytesIO(raw_bytes)).convert("RGB")
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=400, detail=f"Invalid image file: {exc}") from exc

    description = generate_caption(pil_image)
    severity_result = estimate_severity(description)

    return {
        "description": description,
        "severity": severity_result["severity"],
        "confidence": severity_result["confidence"],
    }
