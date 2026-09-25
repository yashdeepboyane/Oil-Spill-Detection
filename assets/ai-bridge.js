/**
 * OceanGuard Live AI Bridge
 * Connects the frontend UI to the real Python FastAPI + OpenCV computer vision backend.
 */

(function () {
  console.log("OceanGuard AI Computer Vision Bridge loaded.");

  // Check backend health on load
  fetch("/api/health")
    .then((r) => r.json())
    .then((data) => {
      console.log("Connected to OceanGuard AI Backend:", data);
      injectBackendStatusIndicator(data);
    })
    .catch((err) => {
      console.warn("Backend not detected:", err);
    });

  function injectBackendStatusIndicator(health) {
    if (document.getElementById("og-backend-pill")) return;
    const pill = document.createElement("div");
    pill.id = "og-backend-pill";
    pill.style.cssText = `
      position: fixed;
      bottom: 16px;
      right: 16px;
      z-index: 9999;
      background: #092747;
      color: #e2e8f0;
      border: 1px solid rgba(56, 189, 248, 0.35);
      border-radius: 9999px;
      padding: 6px 14px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
      cursor: pointer;
      backdrop-filter: blur(8px);
      transition: all 0.2s ease;
    `;
    pill.innerHTML = `
      <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#38bdf8;box-shadow:0 0 8px #38bdf8;animation:pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;"></span>
      <span><b>OpenCV Engine Active</b> (v${health.opencv_version})</span>
      <span style="color:#38bdf8;text-decoration:underline;margin-left:4px;">Open Live Studio</span>
    `;
    pill.onclick = () => openAiStudioModal();
    document.body.appendChild(pill);
  }

  // Create the interactive AI Detection Studio Modal
  function openAiStudioModal(initialScenario = null) {
    let modal = document.getElementById("og-ai-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "og-ai-modal";
      modal.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 10000;
        background: rgba(6, 24, 45, 0.85);
        backdrop-filter: blur(10px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        overflow-y: auto;
      `;
      modal.innerHTML = `
        <div style="
          background: #0b1f35;
          border: 1px solid rgba(56, 189, 248, 0.3);
          border-radius: 20px;
          max-width: 1100px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          color: #f8fafc;
          font-family: Inter, system-ui, -apple-system, sans-serif;
          box-shadow: 0 25px 60px -15px rgba(0,0,0,0.7);
          display: flex;
          flex-direction: column;
        ">
          <!-- Header -->
          <div style="padding: 18px 24px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: space-between; background: #071729;">
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="background: rgba(56,189,248,0.15); border: 1px solid rgba(56,189,248,0.3); border-radius: 10px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; color: #38bdf8; font-weight: 800; font-size: 14px;">AI</div>
              <div>
                <div style="font-size: 10px; font-weight: 700; letter-spacing: 0.15em; color: #38bdf8; text-transform: uppercase;">Real Computer Vision Pipeline</div>
                <h2 style="margin: 0; font-size: 17px; font-weight: 800;">SAR & Optical Oil Slick Segmentation Studio</h2>
              </div>
            </div>
            <div style="display:flex;gap:10px;align-items:center;">
              <a href="/docs" target="_blank" style="color: #94a3b8; font-size: 12px; text-decoration: none; padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03);">API Swagger Docs ↗</a>
              <button id="og-modal-close" style="background: transparent; border: none; color: #94a3b8; font-size: 24px; cursor: pointer; padding: 4px 8px; line-height: 1;">&times;</button>
            </div>
          </div>

          <!-- Body -->
          <div style="padding: 24px; display: flex; flex-direction: column; gap: 20px;">
            <!-- Controls / Scenario Selection -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px;">
              <button class="og-scene-btn" data-scene="tanker_spill" style="padding: 12px 14px; background: rgba(56,189,248,0.08); border: 1px solid rgba(56,189,248,0.25); border-radius: 12px; color: white; cursor: pointer; text-align: left; transition: all 0.2s;">
                <div style="font-size: 9px; font-weight: 700; color: #38bdf8; text-transform: uppercase;">Sentinel-1 C-SAR</div>
                <div style="font-weight: 700; font-size: 13px; margin: 2px 0;">OS-2026-014 Tanker Plume</div>
                <div style="font-size: 11px; color: #94a3b8;">Large spreading drift slick</div>
              </button>
              <button class="og-scene-btn" data-scene="bilge_trail" style="padding: 12px 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: white; cursor: pointer; text-align: left; transition: all 0.2s;">
                <div style="font-size: 9px; font-weight: 700; color: #fb923c; text-transform: uppercase;">RADARSAT-2</div>
                <div style="font-weight: 700; font-size: 13px; margin: 2px 0;">Vessel Bilge Streak</div>
                <div style="font-size: 11px; color: #94a3b8;">Trailing discharge streak</div>
              </button>
              <button class="og-scene-btn" data-scene="platform_leak" style="padding: 12px 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: white; cursor: pointer; text-align: left; transition: all 0.2s;">
                <div style="font-size: 9px; font-weight: 700; color: #f43f5e; text-transform: uppercase;">North Sea EW</div>
                <div style="font-weight: 700; font-size: 13px; margin: 2px 0;">Offshore Rig Anomaly</div>
                <div style="font-size: 11px; color: #94a3b8;">Radial surface accumulation</div>
              </button>
              <button class="og-scene-btn" data-scene="clean_ocean" style="padding: 12px 14px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: white; cursor: pointer; text-align: left; transition: all 0.2s;">
                <div style="font-size: 9px; font-weight: 700; color: #10b981; text-transform: uppercase;">Negative Control</div>
                <div style="font-weight: 700; font-size: 13px; margin: 2px 0;">Clean Open Ocean</div>
                <div style="font-size: 11px; color: #94a3b8;">Zero false positive test</div>
              </button>
            </div>

            <!-- Upload Area & Parameters -->
            <div style="display: flex; flex-wrap: wrap; gap: 14px; align-items: center; justify-content: space-between; padding: 14px 18px; background: rgba(255,255,255,0.02); border: 1px dashed rgba(56,189,248,0.3); border-radius: 12px;">
              <div style="display:flex;align-items:center;gap:12px;">
                <label style="cursor: pointer; background: #0284c7; color: white; padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">
                  <span>Upload Satellite Image</span>
                  <input type="file" id="og-file-input" accept=".tif,.tiff,.png,.jpg,.jpeg" style="display:none;" />
                </label>
                <span id="og-file-name" style="font-size: 12px; color: #94a3b8;">or select a scenario above</span>
              </div>
              <div style="display:flex;align-items:center;gap:16px;">
                <div style="display:flex;align-items:center;gap:8px;font-size:11px;color:#94a3b8;">
                  <span>Pixel Res (GSD):</span>
                  <input type="number" id="og-gsd" value="10.0" step="1.0" min="0.5" style="width: 55px; background: #071729; border: 1px solid rgba(255,255,255,0.15); color: white; padding: 4px 6px; border-radius: 6px; font-family: monospace; font-size: 11px;" />
                  <span>m/px</span>
                </div>
                <div style="display:flex;align-items:center;gap:8px;font-size:11px;color:#94a3b8;">
                  <span>Min Conf:</span>
                  <input type="number" id="og-conf-thresh" value="35" step="5" min="10" max="90" style="width: 48px; background: #071729; border: 1px solid rgba(255,255,255,0.15); color: white; padding: 4px 6px; border-radius: 6px; font-family: monospace; font-size: 11px;" />
                  <span>%</span>
                </div>
              </div>
            </div>

            <!-- Results Section -->
            <div id="og-results-area" style="display: flex; flex-direction: column; gap: 16px;">
              <!-- Telemetry Bar -->
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px;" id="og-metrics-grid">
                <div style="background: #071729; padding: 12px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.06);">
                  <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase;">Detection State</div>
                  <div id="m-state" style="font-size: 18px; font-weight: 800; color: #38bdf8; margin-top: 4px;">Ready</div>
                </div>
                <div style="background: #071729; padding: 12px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.06);">
                  <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase;">AI Confidence</div>
                  <div id="m-conf" style="font-size: 18px; font-weight: 800; color: #f8fafc; margin-top: 4px;">-- %</div>
                </div>
                <div style="background: #071729; padding: 12px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.06);">
                  <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase;">Spill Area</div>
                  <div id="m-area" style="font-size: 18px; font-weight: 800; color: #f8fafc; margin-top: 4px;">-- km²</div>
                </div>
                <div style="background: #071729; padding: 12px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.06);">
                  <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase;">Slicks Identified</div>
                  <div id="m-slicks" style="font-size: 18px; font-weight: 800; color: #f8fafc; margin-top: 4px;">0</div>
                </div>
                <div style="background: #071729; padding: 12px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.06);">
                  <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase;">Severity Tier</div>
                  <div id="m-severity" style="font-size: 16px; font-weight: 800; color: #94a3b8; margin-top: 4px;">--</div>
                </div>
              </div>

              <!-- Visual Inspection Viewer (Side by side or tabs) -->
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 16px;">
                <!-- Main Overlay -->
                <div style="background: #071729; border-radius: 14px; border: 1px solid rgba(255,255,255,0.08); overflow: hidden; display: flex; flex-direction: column;">
                  <div style="padding: 10px 14px; background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 11px; font-weight: 700; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.1em; display: flex; justify-content: space-between;">
                    <span>OpenCV Segmentation Overlay</span>
                    <span id="img-dim-label" style="color: #64748b; font-family: monospace;"></span>
                  </div>
                  <div style="min-height: 280px; display: flex; align-items: center; justify-content: center; background: #030d17;">
                    <img id="og-overlay-view" style="width: 100%; height: auto; display: none; object-fit: contain;" />
                    <div id="og-overlay-placeholder" style="color: #64748b; font-size: 12px; text-align: center; padding: 30px;">Select a scenario or upload an image to view real CV2 segmentation.</div>
                  </div>
                </div>

                <!-- Heatmap / Attenuation -->
                <div style="background: #071729; border-radius: 14px; border: 1px solid rgba(255,255,255,0.08); overflow: hidden; display: flex; flex-direction: column;">
                  <div style="padding: 10px 14px; background: rgba(255,255,255,0.03); border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 11px; font-weight: 700; color: #fb923c; text-transform: uppercase; letter-spacing: 0.1em; display: flex; justify-content: space-between;">
                    <span>Radar Backscatter Attenuation Heatmap</span>
                    <span style="color: #64748b; font-size: 10px;">Inferno scale</span>
                  </div>
                  <div style="min-height: 280px; display: flex; align-items: center; justify-content: center; background: #030d17;">
                    <img id="og-heatmap-view" style="width: 100%; height: auto; display: none; object-fit: contain;" />
                    <div id="og-heatmap-placeholder" style="color: #64748b; font-size: 12px; text-align: center; padding: 30px;">Intensity deficit attenuation map will render here.</div>
                  </div>
                </div>
              </div>

              <!-- Pipeline Execution Stages -->
              <div id="og-stages-box" style="background: #071729; border-radius: 12px; border: 1px solid rgba(255,255,255,0.06); padding: 14px 18px;">
                <div style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 10px;">Computer Vision Processing Stages</div>
                <div id="og-stages-list" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 8px;">
                  <div style="color: #64748b; font-size: 12px;">Pipeline idle.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      // Close handlers
      document.getElementById("og-modal-close").onclick = () => (modal.style.display = "none");
      modal.onclick = (e) => {
        if (e.target === modal) modal.style.display = "none";
      };

      // Scenario buttons
      const buttons = modal.querySelectorAll(".og-scene-btn");
      buttons.forEach((btn) => {
        btn.onclick = () => {
          buttons.forEach((b) => (b.style.borderColor = "rgba(255,255,255,0.1)"));
          btn.style.borderColor = "#38bdf8";
          const sceneId = btn.getAttribute("data-scene");
          runScenario(sceneId);
        };
      });

      // File input
      const fileInput = document.getElementById("og-file-input");
      fileInput.onchange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
          document.getElementById("og-file-name").textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
          uploadAndDetect(file);
        }
      };
    }

    modal.style.display = "flex";
    if (initialScenario) {
      runScenario(initialScenario);
    } else {
      runScenario("tanker_spill");
    }
  }

  // API Call: Run built-in scenario
  async function runScenario(scenarioId) {
    setLoadingState(true);
    const gsd = document.getElementById("og-gsd")?.value || 10.0;
    const thresh = document.getElementById("og-conf-thresh")?.value || 35.0;

    try {
      const res = await fetch(`/api/scenarios/run/${scenarioId}?gsd_meters=${gsd}&threshold=${thresh}`, {
        method: "POST",
      });
      const data = await res.json();
      renderDetectionResults(data);
    } catch (err) {
      alert("Error running scenario: " + err.message);
    } finally {
      setLoadingState(false);
    }
  }

  // API Call: Upload user file
  async function uploadAndDetect(file) {
    setLoadingState(true);
    const gsd = document.getElementById("og-gsd")?.value || 10.0;
    const thresh = document.getElementById("og-conf-thresh")?.value || 35.0;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("gsd_meters", gsd);
    formData.append("confidence_threshold", thresh);

    try {
      const res = await fetch("/api/detect", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Detection failed");
      }
      const data = await res.json();
      renderDetectionResults(data);
    } catch (err) {
      alert("Detection error: " + err.message);
    } finally {
      setLoadingState(false);
    }
  }

  function setLoadingState(loading) {
    const stateEl = document.getElementById("m-state");
    if (stateEl) {
      stateEl.textContent = loading ? "Analyzing..." : "Complete";
      stateEl.style.color = loading ? "#fb923c" : "#38bdf8";
    }
  }

  function renderDetectionResults(data) {
    // Metrics
    const stateEl = document.getElementById("m-state");
    const confEl = document.getElementById("m-conf");
    const areaEl = document.getElementById("m-area");
    const slicksEl = document.getElementById("m-slicks");
    const sevEl = document.getElementById("m-severity");

    if (data.spill_detected) {
      stateEl.textContent = "SPILL DETECTED";
      stateEl.style.color = "#f43f5e";
    } else {
      stateEl.textContent = "CLEAN WATER";
      stateEl.style.color = "#10b981";
    }

    confEl.textContent = `${data.overall_confidence}%`;
    areaEl.textContent = `${data.total_area_km2} km²`;
    slicksEl.textContent = data.slick_count;
    sevEl.textContent = data.severity;
    sevEl.style.color = data.severity_tone === "red" ? "#f43f5e" : data.severity_tone === "orange" ? "#fb923c" : "#10b981";

    // Images
    const overlayImg = document.getElementById("og-overlay-view");
    const overlayPlaceholder = document.getElementById("og-overlay-placeholder");
    const heatmapImg = document.getElementById("og-heatmap-view");
    const heatmapPlaceholder = document.getElementById("og-heatmap-placeholder");
    const dimLabel = document.getElementById("img-dim-label");

    if (data.processed_overlay_image) {
      overlayImg.src = data.processed_overlay_image;
      overlayImg.style.display = "block";
      overlayPlaceholder.style.display = "none";
    }

    if (data.heatmap_image) {
      heatmapImg.src = data.heatmap_image;
      heatmapImg.style.display = "block";
      heatmapPlaceholder.style.display = "none";
    }

    if (data.image_dimensions) {
      dimLabel.textContent = `${data.image_dimensions.width} × ${data.image_dimensions.height} px`;
    }

    // Stages
    const stagesList = document.getElementById("og-stages-list");
    if (data.pipeline_stages && stagesList) {
      stagesList.innerHTML = data.pipeline_stages
        .map(
          (s) => `
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 8px 10px; display: flex; align-items: center; justify-content: space-between;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="display:inline-flex;width:18px;height:18px;border-radius:50%;background:#0284c7;color:white;font-size:10px;font-weight:700;align-items:center;justify-content:center;">${s.stage}</span>
            <span style="font-size:11px;font-weight:600;color:#e2e8f0;">${s.name}</span>
          </div>
          <span style="font-size:10px;color:#94a3b8;font-family:monospace;">${s.detail}</span>
        </div>
      `
        )
        .join("");
    }
  }

  // Intercept any click on "Run detection" or buttons inside the React app if desired
  document.addEventListener("click", (e) => {
    const target = e.target.closest("button");
    if (!target) return;
    const text = target.textContent?.trim().toLowerCase();
    if (text?.includes("run detection") || text?.includes("load sample scene")) {
      openAiStudioModal();
    }
  });

  // Expose globally
  window.OceanGuardAI = {
    openStudio: openAiStudioModal,
    runScenario: runScenario,
    uploadAndDetect: uploadAndDetect,
  };
})();
