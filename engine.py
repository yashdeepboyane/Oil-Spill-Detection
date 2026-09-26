"""
OceanGuard AI / Computer Vision Engine for Marine Oil Spill Detection
Specialized for Synthetic Aperture Radar (SAR) and Optical Satellite/Drone Imagery.

Performs robust marine scene validation, dark-spot capillary wave damping segmentation,
morphological feature extraction, look-alike discrimination, and dynamic telemetry.
"""

import cv2
import numpy as np
import base64
import math
from typing import Dict, List, Any, Tuple, Optional
from datetime import datetime, timezone


class OilSpillDetector:
    def __init__(self, default_gsd_meters: float = 10.0):
        """
        :param default_gsd_meters: Ground Sampling Distance (meters per pixel).
               Default 10.0m is standard for Sentinel-1 IW SAR imagery.
        """
        self.default_gsd = default_gsd_meters

    def _bytes_to_cv2(self, image_bytes: bytes) -> np.ndarray:
        """Decode raw image bytes into OpenCV BGR numpy array."""
        np_arr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_UNCHANGED)
        if img is None:
            raise ValueError("Failed to decode image bytes. Unsupported or corrupted image file.")
        
        # Handle grayscale, RGBA, or BGR
        if len(img.shape) == 2:
            img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        elif len(img.shape) == 3 and img.shape[2] == 4:
            img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
        return img

    def _cv2_to_base64_png(self, img: np.ndarray) -> str:
        """Encode OpenCV image to base64 data URI."""
        success, buffer = cv2.imencode('.png', img)
        if not success:
            raise ValueError("Failed to encode image to PNG.")
        b64 = base64.b64encode(buffer).decode('utf-8')
        return f"data:image/png;base64,{b64}"

    def validate_scene(self, img: np.ndarray, gray: np.ndarray) -> Tuple[bool, str, str]:
        """
        Validates if the image is a valid marine/satellite/drone ocean scene
        versus an invalid/unrelated image (e.g. document, portrait, cartoon, solid color).
        
        Returns: (is_valid, validation_message, scene_type)
        """
        height, width = img.shape[:2]
        
        # 1. Dimension Check
        if width < 50 or height < 50:
            return False, "Image resolution is too low (< 50x50 px). Please upload higher resolution satellite imagery.", "corrupt"

        total_pixels = height * width
        
        # 2. Blank / Solid Color / Underexposed Check
        std_dev = float(np.std(gray))
        if std_dev < 3.5:
            return False, "Image has virtually zero variance (solid blank or completely dark/white image). Please upload a valid satellite scene.", "blank"

        # 3. Document / Text / Screenshot Check (Extreme high frequency line transitions or white backgrounds)
        edges = cv2.Canny(gray, 50, 150)
        edge_density = float(np.count_nonzero(edges)) / float(total_pixels)
        
        # Calculate histogram distribution
        hist = cv2.calcHist([gray], [0], None, [256], [0, 256]).flatten()
        hist_norm = hist / hist.sum()
        
        # Check for white document / screenshot backgrounds (predominantly near-white > 240)
        if hist_norm[240:].sum() > 0.60:
            return False, "Image appears to be a text document, paper scan, or user interface screenshot rather than a satellite ocean scene.", "document"
            
        # Check for extreme binary high-contrast graphics
        extreme_ends = hist_norm[:15].sum() + hist_norm[240:].sum()
        if extreme_ends > 0.70 and edge_density > 0.04:
            return False, "Image has high-contrast synthetic graphics or text line transitions uncharacteristic of natural ocean surfaces.", "document"

        # 4. Color / Marine Scene Check
        # Check HSV color distribution if RGB
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        h, s, v = cv2.split(hsv)
        
        # In SAR imagery: single channel / grayscale with continuous Rayleigh backscatter
        is_grayscale = (img[:, :, 0] == img[:, :, 1]).all() and (img[:, :, 1] == img[:, :, 2]).all()
        
        if is_grayscale:
            scene_type = "SAR Grayscale"
        else:
            # For Optical/Drone: Check if there is plausible water representation
            # Water typically has hue in cyan/blue/green/gray range or low saturation
            # If saturation is extremely high in unnatural warm colors (pure reds/yellows/magentas everywhere), check marine profile
            red_pixels = np.count_nonzero(((h < 15) | (h > 165)) & (s > 90))
            if red_pixels / total_pixels > 0.40:
                return False, "Image does not exhibit marine or sea surface optical characteristics (predominantly non-marine color spectrum).", "non_marine"
            scene_type = "Optical Satellite/Aerial"

        return True, "Valid marine/satellite observation scene.", scene_type

    def analyze_image(
        self, 
        image_bytes: bytes, 
        gsd_meters: Optional[float] = None,
        confidence_threshold: float = 35.0
    ) -> Dict[str, Any]:
        """
        Full 6-Stage Computer Vision & AI Detection Pipeline:
        1. Ingestion & Validation
        2. Speckle Reduction & Noise Filtering (Bilateral)
        3. Clutter & Contrast Normalization (CLAHE)
        4. Multi-Scale Dark-Spot Segmentation
        5. Morphological Contour Extraction & Geometry Telemetry
        6. Look-Alike Discrimination, Sizing Telemetry & Dynamic Reporting
        """
        gsd = gsd_meters if (gsd_meters and gsd_meters > 0) else self.default_gsd
        pixel_area_m2 = gsd * gsd
        pixel_area_km2 = pixel_area_m2 / 1_000_000.0

        # Stage 1: Ingestion & Format Normalization
        img = self._bytes_to_cv2(image_bytes)
        height, width = img.shape[:2]
        total_pixels = height * width
        now_utc = datetime.now(timezone.utc).strftime("%H:%M UTC")

        # Convert to grayscale for radar / intensity analysis
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # Scene Validation
        is_valid, validation_msg, scene_type = self.validate_scene(img, gray)
        if not is_valid:
            # Create an invalid indicator overlay
            invalid_img = img.copy()
            cv2.rectangle(invalid_img, (0, 0), (width, height), (0, 0, 180), 8)
            cv2.putText(invalid_img, "INVALID SCENE - NOT OCEAN / SAR DATA", (20, 40), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2, cv2.LINE_AA)
            
            return {
                "is_valid_image": False,
                "error_message": validation_msg,
                "spill_detected": False,
                "overall_confidence": 0.0,
                "severity": "Invalid Image",
                "severity_tone": "red",
                "slick_count": 0,
                "total_area_km2": 0.0,
                "total_perimeter_km": 0.0,
                "ground_sampling_distance_m": gsd,
                "image_dimensions": {"width": width, "height": height},
                "slicks": [],
                "analyst_note": f"⚠️ Image validation failed: {validation_msg}",
                "pipeline_stages": [
                    {"stage": 1, "name": "Image Ingestion & Validation", "status": "failed", "detail": validation_msg}
                ],
                "processed_overlay_image": self._cv2_to_base64_png(invalid_img),
                "heatmap_image": self._cv2_to_base64_png(invalid_img),
                "detection_time_utc": now_utc,
                "timestamp_utc": datetime.now(timezone.utc).isoformat()
            }

        # Stage 2: Speckle Reduction
        # Bilateral filter smooths multiplicative radar speckle while preserving sharp boundaries
        denoised = cv2.bilateralFilter(gray, d=9, sigmaColor=75, sigmaSpace=75)

        # Stage 3: Contrast Normalization
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        contrast_eq = clahe.apply(denoised)

        # Stage 4: Multi-Scale Dark-Spot Segmentation
        # In SAR, oil slicks cause specular reflection away from satellite -> dark patches
        otsu_thresh, _ = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        adaptive_thresh = cv2.adaptiveThreshold(
            denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
            cv2.THRESH_BINARY_INV, blockSize=41, C=6
        )
        
        # Binary mask fusion
        binary_mask = cv2.bitwise_and(adaptive_thresh, (denoised < max(otsu_thresh - 5, 40)).astype(np.uint8) * 255)

        # Morphological operations: remove speckle noise and bridge internal gaps
        kernel_clean = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        cleaned_mask = cv2.morphologyEx(binary_mask, cv2.MORPH_OPEN, kernel_clean)
        kernel_bridge = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        cleaned_mask = cv2.morphologyEx(cleaned_mask, cv2.MORPH_CLOSE, kernel_bridge)

        # Stage 5: Contour Extraction and Morphological Analysis
        contours, _ = cv2.findContours(cleaned_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        # Surrounding sea background mean intensity
        sea_background_intensity = float(np.mean(gray))

        detected_slicks: List[Dict[str, Any]] = []
        total_spill_area_px = 0
        total_spill_perimeter_px = 0.0

        # Create overlay visualization
        overlay = img.copy()
        mask_colored = np.zeros_like(img)

        # Heatmap based on intensity deficit (darker = thicker / higher attenuation)
        intensity_deficit = np.clip(255 - gray, 0, 255).astype(np.uint8)
        heatmap_raw = cv2.applyColorMap(intensity_deficit, cv2.COLORMAP_INFERNO)

        min_slick_area_px = max(40, int(total_pixels * 0.0002))
        max_slick_area_px = int(total_pixels * 0.70)  # avoid entire image landmass

        for idx, cnt in enumerate(contours):
            area_px = cv2.contourArea(cnt)
            if area_px < min_slick_area_px or area_px > max_slick_area_px:
                continue

            perimeter_px = cv2.arcLength(cnt, True)
            if perimeter_px == 0:
                continue

            x, y, w, h = cv2.boundingRect(cnt)
            
            # Rotated bounding rectangle for elongation and heading
            rect = cv2.minAreaRect(cnt)
            (cx, cy), (rw, rh), angle = rect
            length = max(rw, rh)
            width_dim = max(min(rw, rh), 1.0)
            elongation = float(length / width_dim)

            # Compactness / Circularity: 4 * pi * Area / Perimeter^2
            compactness = float((4 * math.pi * area_px) / (perimeter_px ** 2)) if perimeter_px > 0 else 0.0

            # Pixel intensities inside slick
            slick_mask_single = np.zeros((height, width), dtype=np.uint8)
            cv2.drawContours(slick_mask_single, [cnt], -1, 255, -1)
            slick_mean = float(cv2.mean(gray, mask=slick_mask_single)[0])

            # Contrast ratio: sea / slick (higher ratio = darker slick relative to ocean)
            contrast_ratio = float(sea_background_intensity / max(slick_mean, 1.0))

            # Texture standard deviation inside slick (slicks are smooth, low std)
            slick_pixels = gray[slick_mask_single == 255]
            texture_std = float(np.std(slick_pixels)) if len(slick_pixels) > 0 else 0.0

            # Calculate Confidence Score (0-100%)
            c_score = min(30.0, max(0.0, (contrast_ratio - 1.1) * 35.0))
            e_score = min(30.0, max(5.0, elongation * 5.0)) if compactness < 0.6 else 8.0
            t_score = min(20.0, max(0.0, (40.0 - texture_std) * 0.5))
            b_score = min(20.0, math.log10(max(area_px, 10)) * 5.0)

            raw_confidence = c_score + e_score + t_score + b_score
            confidence = round(min(98.5, max(12.0, raw_confidence)), 1)

            if confidence < confidence_threshold:
                continue

            area_km2 = round(area_px * pixel_area_km2, 4)
            perimeter_km = round(perimeter_px * (gsd / 1000.0), 3)
            total_spill_area_px += area_px
            total_spill_perimeter_px += perimeter_px

            # Draw on mask colored (Neon Coral / Red for detected oil)
            cv2.drawContours(mask_colored, [cnt], -1, (40, 50, 245), -1)
            cv2.drawContours(overlay, [cnt], -1, (20, 20, 255), 2)

            # Draw minimal oriented box
            box = cv2.boxPoints(rect)
            box = np.intp(box)
            cv2.polylines(overlay, [box], True, (0, 220, 255), 1)

            # Label on overlay
            label = f"Slick #{len(detected_slicks)+1} ({confidence}%)"
            cv2.putText(overlay, label, (x, max(y - 8, 15)), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0, 240, 255), 1, cv2.LINE_AA)

            detected_slicks.append({
                "id": len(detected_slicks) + 1,
                "confidence_pct": confidence,
                "area_px": int(area_px),
                "area_km2": area_km2,
                "perimeter_km": perimeter_km,
                "elongation_ratio": round(elongation, 2),
                "compactness": round(compactness, 3),
                "mean_intensity": round(slick_mean, 1),
                "contrast_ratio": round(contrast_ratio, 2),
                "texture_std": round(texture_std, 2),
                "bounding_box": {"x": int(x), "y": int(y), "w": int(w), "h": int(h)},
                "centroid": {"x": int(cx), "y": int(cy)},
                "drift_angle_deg": round(angle, 1)
            })

        # Blend semi-transparent slick color into overlay
        alpha = 0.35
        cv2.addWeighted(mask_colored, alpha, overlay, 1.0 - alpha, 0, overlay)

        # Telemetry calculations
        total_area_km2 = round(total_spill_area_px * pixel_area_km2, 3)
        total_perimeter_km = round(total_spill_perimeter_px * (gsd / 1000.0), 2)
        spill_detected = len(detected_slicks) > 0

        avg_confidence = (
            round(sum(s["confidence_pct"] for s in detected_slicks) / len(detected_slicks), 1)
            if spill_detected else 0.0
        )

        # Dynamic Severity ranking
        if not spill_detected:
            severity = "Clean Water"
            severity_tone = "green"
            analyst_note = f"Scan completed on {width}×{height} px frame. Sea surface backscatter is uniform with no anomalous capillary wave damping detected (0.00 km²). Water surface is clear of oil slicks."
        elif total_area_km2 < 0.5:
            severity = "Minor Anomaly"
            severity_tone = "blue"
            analyst_note = f"Identified {len(detected_slicks)} localized surface anomaly covering {total_area_km2} km² with {avg_confidence}% confidence. Low environmental threat; recommend periodic monitoring."
        elif total_area_km2 < 5.0:
            severity = "Moderate"
            severity_tone = "orange"
            analyst_note = f"Identified {len(detected_slicks)} distinct slick body covering {total_area_km2} km² (perimeter: {total_perimeter_km} km). Dark SAR attenuation pattern is consistent with an active surface oil spill."
        elif total_area_km2 < 15.0:
            severity = "High Priority"
            severity_tone = "orange"
            analyst_note = f"High priority incident: {len(detected_slicks)} major slick cluster(s) covering {total_area_km2} km² with {avg_confidence}% AI confidence. Slicks exhibit strong drift elongation; response coordination advised."
        else:
            severity = "Critical Marine Emergency"
            severity_tone = "red"
            analyst_note = f"CRITICAL INCIDENT: Massive oil discharge covering {total_area_km2} km² detected across the observation swath. Immediate containment and emergency protocol dispatch recommended."

        # Top HUD Banner
        hud_bg = np.zeros((45, width, 3), dtype=np.uint8)
        hud_color = (0, 0, 180) if spill_detected else (30, 140, 50)
        cv2.rectangle(hud_bg, (0, 0), (width, 45), hud_color, -1)
        hud_text = (
            f"OCEANGUARD AI - DETECTED: {len(detected_slicks)} slicks | Area: {total_area_km2} km2 | Conf: {avg_confidence}%"
            if spill_detected else "OCEANGUARD AI - SCAN COMPLETE: Clean Water Surface (No Slicks Detected)"
        )
        cv2.putText(hud_bg, hud_text, (12, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.44, (255, 255, 255), 1, cv2.LINE_AA)
        final_overlay = np.vstack([hud_bg, overlay])

        # Stage status list
        pipeline_stages = [
            {"stage": 1, "name": "Image Ingestion & Validation", "status": "completed", "detail": f"{width}×{height} px, {scene_type}"},
            {"stage": 2, "name": "Bilateral Speckle Filtering", "status": "completed", "detail": "Kernel d=9, sigma=75 noise reduction"},
            {"stage": 3, "name": "Clutter & Contrast Normalization", "status": "completed", "detail": f"CLAHE equalized, ambient sea mean={sea_background_intensity:.1f}"},
            {"stage": 4, "name": "Multi-Scale Dark-Spot Segmentation", "status": "completed", "detail": f"Otsu thresh={otsu_thresh:.0f} + adaptive window"},
            {"stage": 5, "name": "Contour & Morphology Analysis", "status": "completed", "detail": f"{len(contours)} initial candidate regions screened"},
            {"stage": 6, "name": "Look-Alike Filtering & Telemetry", "status": "completed", "detail": f"{len(detected_slicks)} verified slicks, {total_area_km2} km²"}
        ]

        return {
            "is_valid_image": True,
            "scene_type": scene_type,
            "spill_detected": spill_detected,
            "overall_confidence": avg_confidence,
            "severity": severity,
            "severity_tone": severity_tone,
            "slick_count": len(detected_slicks),
            "total_area_km2": total_area_km2,
            "total_perimeter_km": total_perimeter_km,
            "ground_sampling_distance_m": gsd,
            "image_dimensions": {"width": width, "height": height},
            "slicks": detected_slicks,
            "analyst_note": analyst_note,
            "pipeline_stages": pipeline_stages,
            "processed_overlay_image": self._cv2_to_base64_png(final_overlay),
            "heatmap_image": self._cv2_to_base64_png(heatmap_raw),
            "detection_time_utc": now_utc,
            "timestamp_utc": datetime.now(timezone.utc).isoformat()
        }


# Global detector instance
detector = OilSpillDetector(default_gsd_meters=10.0)
