# OceanGuard — AI Marine Oil Spill Detection & Chronology Platform

OceanGuard is an AI-powered maritime environmental decision-support system designed to detect oil spills in seas and oceans using **Synthetic Aperture Radar (SAR)** and optical satellite/drone imagery, track nearby vessel routes via AIS, forecast drift trajectories, and calculate defensible spill age intervals.

---

## ⚡ Quick Start

The entire platform (both the modern React frontend and the Python OpenCV + FastAPI AI backend) is **running live on your local machine**:

```bash
# Install dependencies
pip install -r requirements.txt

# Start the unified backend & frontend server (Port 3000)
python main.py 3000
```

* **Interactive Web App & Live AI Studio:** [http://localhost:3000](http://localhost:3000)
* **Interactive OpenAPI / Swagger Documentation:** [http://localhost:3000/docs](http://localhost:3000/docs)

---

## 🔬 Computer Vision & AI Detection Engine (`engine.py`)

In Synthetic Aperture Radar (SAR), oil slicks dampen ocean capillary and short gravity waves. Without rough capillary wave facet reflections (Bragg scattering), radar pulses bounce away specularly, appearing as **distinct dark patches** against brighter sea clutter.

The 6-stage detection pipeline implemented in `engine.py` includes:

1. **Format Normalization & Ingestion:** Ingests SAR / Optical satellite formats (`.tif`, `.tiff`, `.png`, `.jpg`, `.jpeg`).
2. **Speckle Reduction (Bilateral & Adaptive Filtering):** Removes multiplicative radar speckle noise without blurring sharp slick edges.
3. **Clutter & Contrast Normalization:** Local Contrast-Limited Adaptive Histogram Equalization (CLAHE) to normalize variable incidence angles across the swath.
4. **Multi-Scale Dark-Spot Segmentation:** Combines Otsu global thresholding with adaptive Gaussian thresholding, followed by morphological opening and closing to bridge voids and reject speckle artifacts.
5. **Morphological Feature Extraction:**
   - **Ground Sampling Distance (GSD) Area Telemetry:** Calculates physical slick area ($km^2$) and boundary perimeter ($km$).
   - **Elongation & Heading:** Computes minimum rotated bounding boxes, aspect ratio ($length / width$), and drift angle.
   - **Compactness & Circularity:** Evaluates $4\pi A / P^2$ (true oil slicks under wind drift form elongated filaments or irregular plumes).
   - **Contrast Ratio:** Analyzes local intensity deficit relative to surrounding ambient ocean clutter ($mean(sea) / mean(slick)$).
   - **Texture Homogeneity:** Standard deviation within candidate dark spots.
6. **Look-Alike Discrimination & Explainable Confidence:**
   - Filters out non-slick ocean phenomena (calm wind zones, internal waves).
   - Generates an explainable confidence score ($0 - 100\%$) and severity classification (*Minor*, *Moderate*, *High Priority*, *Critical Marine Emergency*).
   - Produces neon coral overlay annotations and radar backscatter attenuation heatmaps.

---

## 🛰️ Satellite & Aerial Image Requirements

To ensure accurate computer vision segmentation and prevent invalid image rejections, uploaded imagery should follow these guidelines:

### ✅ What Should Be Present in the Image
* **Marine Water Surface:** Open ocean, sea, bay, or coastal water background with natural surface wave clutter.
* **Sensor Types:**
  - **Synthetic Aperture Radar (SAR):** Sentinel-1 C-band, RADARSAT-2, TerraSAR-X, ALOS PALSAR.
  - **Optical / Aerial:** High-resolution multispectral satellite (Sentinel-2, Landsat) or drone sea surface photography.
* **Key Visual Signatures:**
  - **Oil Slicks / Sheen:** Low-backscatter dark patches, filaments, or irregular plumes where oil dampens capillary surface waves.
  - **Vessel Bilge Trails:** Trailing linear dark discharge streaks aligned with vessel trajectories.
  - **Vessels / Rigs (Optional):** Bright point radar reflectors (metallic hulls/platforms).

### ❌ What Will Be Rejected (Flagged as Invalid Scene)
* **Non-Marine Photos:** Indoor environments, human faces/portraits, animals, urban street photography.
* **Documents & Screenshots:** Text pages, scanned papers, source code, UI mockups, or line diagrams.
* **Solid / Blank Images:** Completely black, white, or zero-variance corrupt images.
* **Land-Only Terrain:** Forests, mountains, or urban areas without sea water bodies.

### 📐 Technical Specifications
* **Supported Formats:** `.png`, `.jpg`, `.jpeg`, `.tif`, `.tiff`
* **Resolution Range:** Min 50×50 px (Recommended: 500×500 to 4000×4000 px)
* **Max File Size:** 50 MB
* **Default Ground Sampling Distance (GSD):** 10.0 meters/pixel (adjustable in API)

---

## 📡 API Endpoints

### 1. `POST /api/detect`
Upload a satellite or drone image file to run the full detection pipeline.
- **Form Parameters:**
  - `file`: Image file (`.tif`, `.png`, `.jpg`)
  - `gsd_meters`: Ground Sampling Distance in meters/pixel (default: `10.0` for Sentinel-1 IW)
  - `confidence_threshold`: Minimum confidence score percentage to flag a slick (default: `40.0%`)
- **Returns:** JSON containing `spill_detected`, `slick_count`, `total_area_km2`, `total_perimeter_km`, `overall_confidence`, `slicks` list with individual coordinates and metrics, `pipeline_stages` timing, and Base64-encoded `processed_overlay_image` and `heatmap_image`.

### 2. `GET /api/scenarios`
Returns the built-in realistic satellite SAR scenarios for one-click testing:
- **`tanker_spill`**: OS-2026-014 Tanker Plume (Gulf of Guinea Sentinel-1 C-SAR).
- **`bilge_trail`**: Trailing Bilge Slick behind moving cargo vessel (Strait of Malacca RADARSAT-2).
- **`platform_leak`**: Offshore Rig Radial Anomaly (North Sea Sentinel-1 EW).
- **`clean_ocean`**: Rough Open Ocean Baseline (negative control test).

### 3. `POST /api/scenarios/run/{scenario_id}`
Runs the detection pipeline directly on a sample scenario without needing an upload.

### 4. `POST /api/ageing/calculate`
Calculates defensible chronological bounds for the spill:
- **Request Body:**
  ```json
  {
    "last_clear_utc": "2026-09-20T10:00:00Z",
    "first_detected_utc": "2026-09-24T14:30:00Z"
  }
  ```
- **Returns:** Earliest possible age, latest possible age, and observation uncertainty interval.

### 5. `GET /api/health`
System status, OpenCV version, and detector capabilities.

---

## 🖥️ Live AI Studio in the Browser

When you open **[http://localhost:3000](http://localhost:3000)**, an **"OpenCV Engine Active"** pill appears in the bottom right corner (and clicking "Run detection" on the Detection tab opens the studio):
* Drag and drop your own satellite/drone images.
* Switch between any of the 4 satellite scenarios with 1 click.
* Inspect the segmented contour overlay, the backscatter attenuation heatmap, and real-time physical telemetry ($km^2$, slick count, severity tier).
