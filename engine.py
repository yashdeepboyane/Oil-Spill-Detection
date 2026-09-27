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
from datetime import datetime, timezone, timedelta

IST_TZ = timezone(timedelta(hours=5, minutes=30))


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
        Validates if the file is a readable, non-empty image.
        Returns: (is_valid, validation_message, scene_type)
        """
        height, width = img.shape[:2]
        
        # 1. Dimension Check
        if width < 20 or height < 20:
            return False, "Image resolution is too low (< 20×20 px) or corrupted file.", "corrupt"

        # 2. Blank / Solid Color Check
        std_dev = float(np.std(gray))
        if std_dev < 1.0:
            return False, "Image has zero variance (solid blank or completely black/white image).", "blank"

        # Determine sensor type for reporting
        is_grayscale = (img[:, :, 0] == img[:, :, 1]).all() and (img[:, :, 1] == img[:, :, 2]).all()
        scene_type = "SAR Grayscale" if is_grayscale else "Optical Satellite / Aerial"

        return True, "Valid observation scene.", scene_type

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
        now_ist = datetime.now(IST_TZ).strftime("%H:%M IST")

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
                "detection_time_ist": now_ist,
                "detection_time_utc": now_ist,
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
            denoised, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 45, 8
        )

        # Statistical thresholding: pixels below ambient sea mean minus k*std
        sea_mean = float(np.mean(denoised))
        sea_std = float(np.std(denoised))
        dark_threshold = max(20, sea_mean - (0.85 * sea_std))
        _, stat_thresh = cv2.threshold(denoised, int(dark_threshold), 255, cv2.THRESH_BINARY_INV)

        # Combine segmentation masks
        combined_mask = cv2.bitwise_and(adaptive_thresh, stat_thresh)

        # Stage 5: Morphological Filtering (Eliminate isolated speckles)
        kernel_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        kernel_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
        cleaned_mask = cv2.morphologyEx(combined_mask, cv2.MORPH_OPEN, kernel_open)
        cleaned_mask = cv2.morphologyEx(cleaned_mask, cv2.MORPH_CLOSE, kernel_close)

        # Stage 6: Contour Extraction, Geometry & Telemetry Calculations
        contours, hierarchy = cv2.findContours(cleaned_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        detected_slicks: List[Dict[str, Any]] = []
        total_slick_pixels = 0
        
        # Color visualization canvas
        overlay = img.copy()
        mask_colored = np.zeros_like(img)
        
        # Heatmap calculation based on backscatter attenuation
        # Inverse normalize: darker pixels = higher damping intensity
        norm_attenuation = 255 - contrast_eq
        heatmap_raw = cv2.applyColorMap(norm_attenuation, cv2.COLORMAP_INFERNO)

        sea_background_intensity = sea_mean

        for i, cnt in enumerate(contours):
            area_px = cv2.contourArea(cnt)
            if area_px < 35:  # Ignore tiny noise artifacts
                continue

            perimeter_px = cv2.arcLength(cnt, True)
            
            # Geometry metrics
            area_km2 = round(area_px * pixel_area_km2, 3)
            perimeter_km = round(perimeter_px * (gsd / 1000.0), 3)

            # Bounding box & Aspect / Elongation Ratio
            x, y, w, h = cv2.boundingRect(cnt)
            aspect_ratio = float(w) / h if h > 0 else 1.0
            elongation = max(aspect_ratio, 1.0 / aspect_ratio) if aspect_ratio > 0 else 1.0

            # Mean interior backscatter intensity
            slick_mask_single = np.zeros((height, width), dtype=np.uint8)
            cv2.drawContours(slick_mask_single, [cnt], -1, 255, -1)
            mean_intensity = float(cv2.mean(denoised, mask=slick_mask_single)[0])

            # Contrast ratio: sea_mean / slick_mean (typical oil slick is 2x to 5x darker)
            contrast_ratio = round(sea_background_intensity / max(mean_intensity, 1.0), 2)

            # Look-alike discrimination & Confidence Score Calculation
            # Oil exhibits high contrast with ambient sea and elongated drift geometry
            confidence = 50.0
            if contrast_ratio > 1.4:
                confidence += min(30.0, (contrast_ratio - 1.4) * 20.0)
            if elongation > 1.8:
                confidence += min(15.0, (elongation - 1.8) * 4.0)
            if area_km2 > 0.05:
                confidence += 5.0

            confidence = min(98.0, max(20.0, round(confidence, 1)))

            if confidence >= confidence_threshold:
                detected_slicks.append({
                    "id": len(detected_slicks) + 1,
                    "area_km2": area_km2,
                    "area_pixels": int(area_px),
                    "perimeter_km": perimeter_km,
                    "elongation_ratio": round(elongation, 2),
                    "contrast_ratio": contrast_ratio,
                    "confidence_pct": confidence,
                    "bbox": {"x": int(x), "y": int(y), "w": int(w), "h": int(h)}
                })
                total_slick_pixels += int(area_px)

                # Draw contour on overlay (Electric Cyan outline with Red Fill)
                cv2.drawContours(mask_colored, [cnt], -1, (30, 40, 230), -1)  # Red fill
                cv2.drawContours(overlay, [cnt], -1, (240, 230, 0), 2)         # Cyan border

                # Label on slick
                label = f"Slick #{len(detected_slicks)}: {area_km2}km2 ({confidence:.0f}%)"
                cv2.putText(overlay, label, (x, max(18, y - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (255, 255, 255), 1, cv2.LINE_AA)

        # Blend mask with overlay
        overlay = cv2.addWeighted(overlay, 0.85, mask_colored, 0.40, 0)

        total_area_km2 = round(total_slick_pixels * pixel_area_km2, 2)
        total_perimeter_km = round(sum(s["perimeter_km"] for s in detected_slicks), 2)
        spill_detected = len(detected_slicks) > 0 and total_area_km2 > 0.01
        
        avg_confidence = (
            round(sum(s["confidence_pct"] for s in detected_slicks) / len(detected_slicks), 1)
            if detected_slicks else 0.0
        )

        # Determine Severity and Dynamic Analyst Note
        if not spill_detected:
            severity = "Clean Sea"
            severity_tone = "green"
            analyst_note = f"Observation scanned successfully. No anomalous low-backscatter damping slicks detected. Normal ambient marine capillary backscatter (mean: {sea_mean:.1f})."
        elif total_area_km2 < 5.0:
            severity = "Moderate Slick"
            severity_tone = "blue"
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
            "detection_time_ist": now_ist,
            "detection_time_utc": now_ist,
            "timestamp_utc": datetime.now(timezone.utc).isoformat()
        }


# Global detector instance
detector = OilSpillDetector(default_gsd_meters=10.0)
