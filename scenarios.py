"""
Satellite & SAR Scenario Imagery Generator for OceanGuard
Generates realistic Synthetic Aperture Radar (SAR) simulation scenes:
1. Tanker Spill & Drift Filament (Heavy crude discharge)
2. Trailing Bilge Slick behind moving vessel
3. Offshore Drilling Platform Anomaly
4. Clean Ocean Control (True negative validation)
"""

import cv2
import numpy as np
import os
from typing import Dict, Any

SCENARIOS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sample_scenes")
os.makedirs(SCENARIOS_DIR, exist_ok=True)


def _generate_sar_ocean_clutter(width: int = 700, height: int = 500, base_brightness: int = 140) -> np.ndarray:
    """Generates realistic SAR ocean clutter with Rayleigh/Gamma speckle and swell waves."""
    # Sea surface swell lines
    x = np.linspace(0, 10 * np.pi, width)
    y = np.linspace(0, 8 * np.pi, height)
    xv, yv = np.meshgrid(x, y)
    swell = (np.sin(xv * 0.8 + yv * 0.6) * 12).astype(np.float32)

    # Multiplicative SAR speckle (Rayleigh distributed)
    speckle = np.random.rayleigh(scale=18.0, size=(height, width)).astype(np.float32)

    # Combine
    ocean = base_brightness + swell + speckle
    return np.clip(ocean, 20, 255).astype(np.uint8)


def create_scenario_tanker_spill() -> str:
    """Scenario 1: Large crude tanker spill with elongated drift plume (OS-2026-014)."""
    filepath = os.path.join(SCENARIOS_DIR, "sar_tanker_spill.png")
    width, height = 750, 520
    img = _generate_sar_ocean_clutter(width, height, base_brightness=145)

    # Dark slick mask: complex elongated organic shape
    mask = np.zeros((height, width), dtype=np.uint8)
    
    # Main slick body (dark patch)
    center = (int(width * 0.45), int(height * 0.45))
    cv2.ellipse(mask, center, (140, 75), 32, 0, 360, 255, -1)
    
    # Secondary trailing plume
    center2 = (int(width * 0.60), int(height * 0.58))
    cv2.ellipse(mask, center2, (110, 45), 28, 0, 360, 255, -1)
    
    # Third thin tail
    center3 = (int(width * 0.72), int(height * 0.68))
    cv2.ellipse(mask, center3, (80, 25), 25, 0, 360, 255, -1)

    # Add organic turbulence to edges
    noise = np.random.randint(0, 50, (height, width), dtype=np.uint8)
    mask = cv2.bitwise_and(mask, cv2.bitwise_not((noise > 38).astype(np.uint8) * 255))
    mask = cv2.GaussianBlur(mask, (21, 21), 9)

    # Attenuate backscatter in slick zone (radar specular reflection away from sensor)
    attenuation = (mask.astype(np.float32) / 255.0) * 0.78  # 78% darker
    img_float = img.astype(np.float32)
    img_float = img_float * (1.0 - attenuation) + (attenuation * 28.0)
    
    result = np.clip(img_float, 0, 255).astype(np.uint8)
    cv2.imwrite(filepath, result)
    return filepath


def create_scenario_bilge_trail() -> str:
    """Scenario 2: Moving vessel trailing illegal bilge discharge streak."""
    filepath = os.path.join(SCENARIOS_DIR, "sar_bilge_trail.png")
    width, height = 750, 520
    img = _generate_sar_ocean_clutter(width, height, base_brightness=135)

    # Draw trailing streak
    pts = np.array([
        [150, 400], [280, 320], [420, 240], [550, 170]
    ], np.int32)
    
    mask = np.zeros((height, width), dtype=np.uint8)
    cv2.polylines(mask, [pts], False, 255, thickness=28)
    mask = cv2.GaussianBlur(mask, (19, 19), 7)

    attenuation = (mask.astype(np.float32) / 255.0) * 0.72
    img_float = img.astype(np.float32) * (1.0 - attenuation) + (attenuation * 32.0)
    result = np.clip(img_float, 0, 255).astype(np.uint8)

    # Add bright point reflector (the metallic vessel at head of track)
    cv2.circle(result, (555, 168), 5, 255, -1)
    cv2.circle(result, (555, 168), 9, 240, 1)

    cv2.imwrite(filepath, result)
    return filepath


def create_scenario_platform_leak() -> str:
    """Scenario 3: Offshore oil platform radial leakage with current deflection."""
    filepath = os.path.join(SCENARIOS_DIR, "sar_platform_leak.png")
    width, height = 750, 520
    img = _generate_sar_ocean_clutter(width, height, base_brightness=150)

    mask = np.zeros((height, width), dtype=np.uint8)
    # Radial spill expanding from rig
    rig_pos = (240, 260)
    cv2.ellipse(mask, rig_pos, (110, 85), -15, 0, 360, 255, -1)
    cv2.ellipse(mask, (340, 275), (95, 55), -5, 0, 360, 255, -1)
    mask = cv2.GaussianBlur(mask, (25, 25), 11)

    attenuation = (mask.astype(np.float32) / 255.0) * 0.75
    img_float = img.astype(np.float32) * (1.0 - attenuation) + (attenuation * 35.0)
    result = np.clip(img_float, 0, 255).astype(np.uint8)

    # Bright offshore rig target
    cv2.rectangle(result, (rig_pos[0]-6, rig_pos[1]-6), (rig_pos[0]+6, rig_pos[1]+6), 255, -1)

    cv2.imwrite(filepath, result)
    return filepath


def create_scenario_clean_water() -> str:
    """Scenario 4: Rough open sea control with no oil slick (Tests false positive rejection)."""
    filepath = os.path.join(SCENARIOS_DIR, "sar_clean_ocean.png")
    width, height = 750, 520
    img = _generate_sar_ocean_clutter(width, height, base_brightness=140)
    cv2.imwrite(filepath, img)
    return filepath


def ensure_sample_scenes() -> Dict[str, Dict[str, Any]]:
    """Generates all sample scenes on startup if not already existing."""
    scenes = {
        "tanker_spill": {
            "id": "tanker_spill",
            "name": "OS-2026-014 Tanker Plume",
            "location": "Gulf of Guinea (12.4°N, 78.2°E)",
            "sensor": "Sentinel-1 C-SAR IW",
            "description": "Large crude oil slick exhibiting distinct capillary wave dampening and wind-driven elongation.",
            "file": create_scenario_tanker_spill(),
            "expected_spill": True
        },
        "bilge_trail": {
            "id": "bilge_trail",
            "name": "Vessel Bilge Trailing Streak",
            "location": "Strait of Malacca (3.2°N, 101.5°E)",
            "sensor": "RADARSAT-2 Fine SAR",
            "description": "Linear trailing dark discharge behind commercial cargo vessel heading 112°.",
            "file": create_scenario_bilge_trail(),
            "expected_spill": True
        },
        "platform_leak": {
            "id": "platform_leak",
            "name": "Offshore Rig Radial Anomaly",
            "location": "North Sea (57.8°N, 1.4°E)",
            "sensor": "Sentinel-1 EW",
            "description": "Radial surface sheen accumulating around offshore production platform with current drift.",
            "file": create_scenario_platform_leak(),
            "expected_spill": True
        },
        "clean_ocean": {
            "id": "clean_ocean",
            "name": "Clean Open Ocean Baseline",
            "location": "Bay of Bengal (14.1°N, 84.5°E)",
            "sensor": "Sentinel-1 C-SAR IW",
            "description": "Rough sea clutter with wind swell. Baseline negative control test.",
            "file": create_scenario_clean_water(),
            "expected_spill": False
        }
    }
    return scenes
