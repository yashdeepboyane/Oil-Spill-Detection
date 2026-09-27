"""
OceanGuard AI / Image Processing Backend (FastAPI + OpenCV)
Provides real-time marine oil spill detection, SAR analysis, drift metrics,
and bounded chronology calculations.
"""

import os
import sys
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List

from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# Add current directory to path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from engine import detector
from scenarios import ensure_sample_scenes

app = FastAPI(
    title="OceanGuard AI Oil Spill Detection Engine",
    description="Maritime SAR & Optical Satellite Oil Spill Segmentation and Spill Age Tracking Backend",
    version="2.0.0"
)

# Enable CORS for cross-origin local testing or remote dashboards
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize sample satellite scenes
SAMPLE_SCENES = ensure_sample_scenes()
demo_counter = 0


# --- Models ---
class AgeingRequest(BaseModel):
    last_clear_utc: str
    first_detected_utc: str


# --- API Routes ---

@app.get("/api/health", tags=["System"])
def health_check() -> Dict[str, Any]:
    """Returns system status, CV2 version, and detector capabilities."""
    import cv2
    import numpy as np
    return {
        "status": "online",
        "service": "OceanGuard AI Detection Engine",
        "opencv_version": cv2.__version__,
        "numpy_version": np.__version__,
        "supported_formats": [".tif", ".tiff", ".png", ".jpg", ".jpeg"],
        "default_gsd_meters": detector.default_gsd,
        "sample_scenarios_count": len(SAMPLE_SCENES)
    }


@app.get("/api/scenarios", tags=["Scenarios"])
def list_scenarios() -> List[Dict[str, Any]]:
    """List all available built-in satellite SAR scenarios for immediate one-click testing."""
    return [
        {
            "id": s["id"],
            "name": s["name"],
            "location": s["location"],
            "sensor": s["sensor"],
            "description": s["description"],
            "expected_spill": s["expected_spill"]
        }
        for s in SAMPLE_SCENES.values()
    ]


@app.post("/api/scenarios/run/{scenario_id}", tags=["Scenarios"])
def run_scenario(scenario_id: str, gsd_meters: float = 10.0, threshold: float = 35.0) -> Dict[str, Any]:
    """Runs the real CV2 detection pipeline on a built-in satellite scenario."""
    if scenario_id not in SAMPLE_SCENES:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found.")
    
    scene = SAMPLE_SCENES[scenario_id]
    with open(scene["file"], "rb") as f:
        image_bytes = f.read()
    
    result = detector.analyze_image(image_bytes, gsd_meters=gsd_meters, confidence_threshold=threshold)
    result["scenario_info"] = {
        "id": scene["id"],
        "name": scene["name"],
        "location": scene["location"],
        "sensor": scene["sensor"]
    }
    return result


@app.post("/api/demo/next", tags=["Scenarios"])
def run_next_demo() -> Dict[str, Any]:
    """
    Every time this is called, it selects a different scenario with dynamic variance,
    ensuring that every 'Run Demo' click yields a fresh, unique result.
    """
    global demo_counter
    scenario_keys = list(SAMPLE_SCENES.keys())
    selected_key = scenario_keys[demo_counter % len(scenario_keys)]
    demo_counter += 1

    scene = SAMPLE_SCENES[selected_key]
    with open(scene["file"], "rb") as f:
        image_bytes = f.read()

    # Subtle realistic GSD variance per iteration
    variance = round(0.92 + (demo_counter % 5) * 0.04, 2)
    gsd_meters = round(10.0 * variance, 1)

    result = detector.analyze_image(image_bytes, gsd_meters=gsd_meters, confidence_threshold=35.0)
    result["scenario_info"] = {
        "id": scene["id"],
        "name": scene["name"],
        "location": scene["location"],
        "sensor": scene["sensor"]
    }
    result["demo_iteration"] = demo_counter
    return result


@app.post("/api/detect", tags=["Detection"])
async def detect_oil_spill(
    file: UploadFile = File(...),
    gsd_meters: Optional[float] = Form(10.0),
    confidence_threshold: Optional[float] = Form(40.0)
) -> Dict[str, Any]:
    """
    Accepts uploaded satellite/drone imagery (.tif, .png, .jpg), runs the 6-stage
    OpenCV computer vision detection pipeline, and returns complete slick contours,
    physical area telemetry, and visual overlays.
    """
    allowed_exts = (".tif", ".tiff", ".png", ".jpg", ".jpeg")
    filename = file.filename or "unknown"
    if not any(filename.lower().endswith(ext) for ext in allowed_exts):
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported file type for '{filename}'. Supported formats: {', '.join(allowed_exts)}"
        )

    image_bytes = await file.read()
    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        result = detector.analyze_image(
            image_bytes=image_bytes,
            gsd_meters=gsd_meters or 10.0,
            confidence_threshold=confidence_threshold or 40.0
        )
        result["filename"] = filename
        result["file_size_kb"] = round(len(image_bytes) / 1024.0, 1)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Computer vision analysis error: {str(e)}")


@app.post("/api/ageing/calculate", tags=["Ageing"])
def calculate_spill_age(req: AgeingRequest) -> Dict[str, Any]:
    """
    Computes a mathematically defensible spill age interval bounded between
    the Last-Known-Clear observation and First-Detection observation.
    """
    try:
        t_clear = datetime.fromisoformat(req.last_clear_utc.replace("Z", "+00:00"))
        t_detect = datetime.fromisoformat(req.first_detected_utc.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid ISO timestamp format: {str(e)}")

    if t_clear > now or t_detect > now:
        raise HTTPException(status_code=400, detail="Timestamps cannot be in the future.")
    
    if t_clear >= t_detect:
        raise HTTPException(status_code=400, detail="Last-known-clear timestamp must be strictly earlier than first detection.")

    interval_sec = (t_detect - t_clear).total_seconds()
    interval_hours = round(interval_sec / 3600.0, 2)
    interval_days = round(interval_hours / 24.0, 2)

    min_elapsed_hours = round((now - t_detect).total_seconds() / 3600.0, 2)
    max_elapsed_hours = round((now - t_clear).total_seconds() / 3600.0, 2)

    return {
        "valid": True,
        "observation_gap_hours": interval_hours,
        "observation_gap_days": interval_days,
        "earliest_possible_age_hours": min_elapsed_hours,
        "latest_possible_age_hours": max_elapsed_hours,
        "age_bound_summary": f"Spill onset occurred between {min_elapsed_hours}h and {max_elapsed_hours}h ago.",
        "uncertainty_window_hours": interval_hours,
        "analyst_interpretation": (
            "A coarse observation schedule creates a wider interval, not false precision. "
            "Pair these age bounds with SAR texture, wind drift, and vessel trajectories."
        )
    }


# --- Static Files & Single Page App (SPA) Routing ---

assets_dir = os.path.join(BASE_DIR, "assets")
if os.path.exists(assets_dir):
    app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

@app.get("/favicon.svg")
def serve_favicon():
    favicon_path = os.path.join(BASE_DIR, "favicon.svg")
    if os.path.exists(favicon_path):
        return FileResponse(favicon_path, media_type="image/svg+xml")
    raise HTTPException(status_code=404)

@app.get("/{full_path:path}")
def serve_spa(full_path: str):
    """Fallback handler to serve the Single Page App index.html for all frontend routes."""
    local_file = os.path.join(BASE_DIR, full_path)
    if full_path and os.path.isfile(local_file):
        return FileResponse(local_file)
    
    index_file = os.path.join(BASE_DIR, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file, media_type="text/html")
    return HTMLResponse("<h1>OceanGuard AI Backend Ready</h1><p>index.html not found</p>")


if __name__ == "__main__":
    import uvicorn
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
    print(f"Starting OceanGuard AI Backend on http://localhost:{port} ...")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
