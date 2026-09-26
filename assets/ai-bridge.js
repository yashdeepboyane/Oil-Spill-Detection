/**
 * OceanGuard Live AI Bridge
 * Fully connects the in-page React UI and the AI Studio to the Python FastAPI + OpenCV backend.
 * Dynamically updates all detection results, area calculations, confidence scores,
 * analyst notes, inspection overlays, and the LIVE 6-STAGE PIPELINE STATUS with accurate values.
 * Provides clear image requirements and guidelines for optimal detection,
 * and includes a dedicated Delete / Remove button to clear uploaded images.
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
      <span><b>OpenCV AI Active</b> (v${health.opencv_version})</span>
      <span style="color:#38bdf8;text-decoration:underline;margin-left:4px;">Live Studio</span>
    `;
    pill.onclick = () => openAiStudioModal();
    document.body.appendChild(pill);
  }

  // Inject in-page instructions and guidelines card onto the /detection page
  function injectInPageGuidelines() {
    const fileInput = document.querySelector('input[type="file"]');
    if (!fileInput) return;
    const uploadCard = fileInput.closest(".rounded-2xl");
    if (!uploadCard || !uploadCard.parentElement) return;

    if (document.getElementById("og-image-guidelines")) return;

    const guide = document.createElement("div");
    guide.id = "og-image-guidelines";
    guide.className = "mb-6 rounded-2xl border border-sky-200 bg-sky-50/70 p-5 text-slate-800 shadow-sm";
    guide.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="display:flex;width:22px;height:22px;border-radius:50%;background:#0284c7;color:white;font-size:11px;font-weight:800;align-items:center;justify-content:center;">i</span>
          <h3 style="margin:0;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#0c4a6e;">Satellite & Drone Image Requirements</h3>
        </div>
        <span style="background:#e0f2fe;color:#0369a1;padding:3px 8px;border-radius:6px;font-family:monospace;font-size:10px;font-weight:700;">SAR & Optical Remote Sensing</span>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:12px;">
        <div style="background:white;border:1px solid #bae6fd;border-radius:12px;padding:12px 14px;">
          <div style="font-weight:800;font-size:11px;color:#047857;display:flex;align-items:center;gap:6px;margin-bottom:6px;">
            <span>✅ What Should Be Present in the Image</span>
          </div>
          <ul style="margin:0;padding-left:16px;font-size:11px;line-height:1.6;color:#334155;">
            <li><b>Marine Water Surface:</b> Open sea, ocean, bay, or coastal waterway background.</li>
            <li><b>Satellite SAR / Aerial Sensors:</b> Radar backscatter (Sentinel-1, RADARSAT, TerraSAR-X) or aerial sea surface photography.</li>
            <li><b>Oil Slicks (if present):</b> Low-backscatter dark damping patches, sheen, or trailing bilge streaks where oil dampens surface capillary waves.</li>
            <li><b>Vessels / Rigs:</b> Bright point radar reflectors or wakes (helpful for correlation).</li>
          </ul>
        </div>

        <div style="background:white;border:1px solid #bae6fd;border-radius:12px;padding:12px 14px;">
          <div style="font-weight:800;font-size:11px;color:#be123c;display:flex;align-items:center;gap:6px;margin-bottom:6px;">
            <span>❌ What NOT to Upload (Will Be Flagged Invalid)</span>
          </div>
          <ul style="margin:0;padding-left:16px;font-size:11px;line-height:1.6;color:#334155;">
            <li><b>Non-Marine Photos:</b> Indoor scenes, human portraits, faces, animals, or city street photos.</li>
            <li><b>Documents & Screenshots:</b> Text pages, paper scans, code, or user interface diagrams.</li>
            <li><b>Solid / Corrupted Files:</b> Solid black, pure white, or zero-variance images.</li>
            <li><b>Land-Only Terrain:</b> Forests, mountains, or deserts with no visible ocean water.</li>
          </ul>
        </div>
      </div>

      <div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(186,230,253,0.7);display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;font-family:monospace;font-size:10px;color:#0369a1;">
        <span><b>Supported Formats:</b> .png, .jpg, .jpeg, .tif, .tiff</span>
        <span><b>Recommended Res:</b> 500×500 to 4000×4000 px</span>
        <span><b>Max Size:</b> 50 MB</span>
      </div>
    `;

    uploadCard.parentElement.insertBefore(guide, uploadCard);
  }

  // Inject a status bar with a "Delete / Remove Image" button below the file input
  function injectFileStatusBar(fileName, fileSizeKb) {
    const fileInput = document.querySelector('input[type="file"]');
    if (!fileInput) return;
    const uploadLabel = fileInput.closest("label");
    if (!uploadLabel || !uploadLabel.parentElement) return;

    let statusBar = document.getElementById("og-file-status-bar");
    if (!statusBar) {
      statusBar = document.createElement("div");
      statusBar.id = "og-file-status-bar";
      statusBar.style.cssText = `
        margin-top: 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 12px;
        padding: 10px 14px;
        box-shadow: 0 2px 8px -2px rgba(0,0,0,0.05);
      `;
      uploadLabel.parentElement.insertBefore(statusBar, uploadLabel.nextElementSibling);
    }

    statusBar.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;min-width:0;">
        <span style="font-size:18px;">🛰️</span>
        <div style="min-width:0;">
          <div style="font-size:12px;font-weight:700;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${fileName}
          </div>
          <div style="font-size:10px;font-family:monospace;color:#64748b;">
            ${fileSizeKb > 0 ? `${fileSizeKb.toFixed(1)} KB · Active Scene` : "Built-in Satellite Scenario"}
          </div>
        </div>
      </div>
      <button id="og-remove-inpage-file" style="
        background: #fee2e2;
        border: 1px solid #fca5a5;
        color: #b91c1c;
        font-size: 11px;
        font-weight: 700;
        padding: 6px 12px;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s ease;
        white-space: nowrap;
      ">
        <span>🗑️</span>
        <span>Delete Image</span>
      </button>
    `;

    document.getElementById("og-remove-inpage-file").onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearUploadedImage();
    };
  }

  // Clear/Reset the uploaded image and restore initial standby state
  function clearUploadedImage() {
    console.log("Clearing uploaded image and resetting pipeline...");

    // 1. Clear file input value
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach((input) => {
      input.value = "";
    });

    // 2. Remove in-page status bar
    const statusBar = document.getElementById("og-file-status-bar");
    if (statusBar) statusBar.remove();

    // 3. Reset in-page label dropzone text
    const dropzoneTexts = document.querySelectorAll("label div");
    dropzoneTexts.forEach((div) => {
      if (div.textContent?.includes(".png") || div.textContent?.includes(".jpg") || div.textContent?.includes(".tif") || div.textContent?.includes("Scenario")) {
        div.textContent = "Drop a scene or browse locally";
      }
    });

    // 4. Reset Result Package Header & Badge
    let resultHeader = null;
    document.querySelectorAll("h2").forEach((h2) => {
      if (
        h2.textContent?.includes("OS-2026-") ||
        h2.textContent?.includes("possible oil") ||
        h2.textContent?.includes("Clean Water") ||
        h2.textContent?.includes("Invalid Image") ||
        h2.textContent?.includes("Invalid Scene") ||
        h2.textContent?.includes("·")
      ) {
        resultHeader = h2;
      }
    });

    if (resultHeader) {
      resultHeader.textContent = "No image selected · Standby";
      resultHeader.style.color = "#475569";

      const badge = resultHeader?.parentElement?.parentElement?.querySelector("span");
      if (badge) {
        badge.textContent = "Waiting for Upload";
        badge.className = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase bg-slate-100 text-slate-600";
      }
    }

    // 5. Reset Metric Cards
    updateMetricCards("0.00 km²", "0%", "Standby", "None");

    // 6. Reset Analyst Note
    updateAnalystNote(
      "Upload a satellite Synthetic Aperture Radar (SAR) or aerial drone ocean image above to execute the real-time computer vision oil spill detection pipeline.",
      "blue"
    );

    // 7. Reset In-Page Pipeline Status Card to 0% Standby
    resetInPagePipelineStatus();

    // 8. Remove in-page visual evidence panel
    const visuals = document.getElementById("og-inpage-visuals");
    if (visuals) visuals.remove();

    // 9. Reset Modal elements if open
    const modalFileName = document.getElementById("og-file-name");
    if (modalFileName) modalFileName.textContent = "or select a scenario above";
    const modalRemoveBtn = document.getElementById("og-remove-modal-file-btn");
    if (modalRemoveBtn) modalRemoveBtn.style.display = "none";
  }

  // --- Real-time In-Page Pipeline Status Controller ---
  function updateInPagePipeline(percentage, isProcessing, stagesData = null) {
    let pipelineCard = null;
    document.querySelectorAll("h2").forEach((h2) => {
      if (h2.textContent?.includes("Live detection experience") || h2.textContent?.includes("Pipeline status")) {
        pipelineCard = h2.closest("div.rounded-2xl");
      }
    });

    if (!pipelineCard) return;

    // 1. Percentage number
    const percentEl = pipelineCard.querySelector(".font-mono-app.text-xl") || pipelineCard.querySelector("span.text-xl") || pipelineCard.querySelector("span");
    if (percentEl) {
      percentEl.textContent = isProcessing ? `${percentage}%` : `${percentage}%`;
      percentEl.style.color = percentage === 100 ? "#38bdf8" : percentage === 0 ? "#64748b" : "#fb923c";
    }

    // 2. Progress Bar
    const progressBar = pipelineCard.querySelector(".rounded-full.bg-cyan-300");
    if (progressBar) {
      progressBar.style.width = `${percentage}%`;
      progressBar.style.backgroundColor = percentage === 100 ? "#38bdf8" : "#38bdf8";
      progressBar.style.transition = "width 0.4s ease";
    }

    // 3. Stage Items
    const defaultStageNames = [
      "SAR image intake",
      "Noise filtering",
      "Super resolution",
      "Dark-region segmentation",
      "AIS correlation",
      "Review package",
    ];

    const stagesContainer = pipelineCard.querySelector(".space-y-3") || pipelineCard.querySelectorAll("div.space-y-3")[0];
    if (stagesContainer) {
      const stageRows = stagesContainer.children;
      for (let i = 0; i < stageRows.length && i < 6; i++) {
        const row = stageRows[i];
        const circle = row.querySelector("div");
        const titleSpan = row.querySelector("span");

        const stageCompleted = percentage >= (i + 1) * 16;
        const stageWorking = percentage < (i + 1) * 16 && percentage >= i * 16 && isProcessing;

        // Update Circle
        if (circle) {
          if (stageCompleted) {
            circle.className = "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-cyan-300 bg-cyan-300 text-[10px] text-[#092747] font-bold";
            circle.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
          } else if (stageWorking) {
            circle.className = "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-orange-300 bg-orange-400/20 text-[10px] text-orange-200 font-bold animate-pulse";
            circle.textContent = String(i + 1);
          } else {
            circle.className = "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/20 text-[10px] text-slate-500 font-medium";
            circle.textContent = String(i + 1);
          }
        }

        // Update Stage Text & Dynamic Subtitle
        if (titleSpan) {
          titleSpan.className = stageCompleted ? "text-[11px] font-semibold text-white truncate" : "text-[11px] text-slate-400 truncate";
        }

        // Detail Subtitle badge on the right
        let detailSpan = row.querySelector(".og-stage-detail");
        if (!detailSpan) {
          detailSpan = document.createElement("span");
          detailSpan.className = "og-stage-detail ml-auto shrink-0 font-mono-app text-[9px]";
          row.appendChild(detailSpan);
        }

        if (stagesData && stagesData[i] && stageCompleted) {
          detailSpan.textContent = stagesData[i].detail;
          detailSpan.style.color = "#38bdf8";
        } else if (stageWorking) {
          detailSpan.textContent = "working...";
          detailSpan.style.color = "#fb923c";
        } else if (percentage === 0) {
          detailSpan.textContent = "waiting";
          detailSpan.style.color = "#64748b";
        } else {
          detailSpan.textContent = "";
        }
      }
    }
  }

  function resetInPagePipelineStatus() {
    updateInPagePipeline(0, false, null);
  }

  // Hook into in-page elements on the /detection page
  function attachInPageDetectionHandlers() {
    injectInPageGuidelines();

    // Find all file inputs on the page
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach((input) => {
      if (input.dataset.ogBound) return;
      input.dataset.ogBound = "true";

      input.addEventListener("change", async (e) => {
        const file = e.target.files?.[0];
        if (file) {
          injectFileStatusBar(file.name, file.size / 1024);
          await processInPageUpload(file);
        }
      });
    });

    // Handle "Load sample scene" button in-page
    const buttons = document.querySelectorAll("button");
    buttons.forEach((btn) => {
      if (btn.dataset.ogBound) return;
      const text = btn.textContent?.trim().toLowerCase();
      if (text === "load sample scene") {
        btn.dataset.ogBound = "true";
        btn.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          injectFileStatusBar("OS-2026-014 Tanker Plume (Sentinel-1 C-SAR)", 0);
          await runInPageScenario("tanker_spill");
        });
      } else if (text === "run detection") {
        btn.dataset.ogBound = "true";
        btn.addEventListener("click", async (e) => {
          const fileInput = document.querySelector('input[type="file"]');
          if (fileInput?.files?.[0]) {
            e.preventDefault();
            e.stopPropagation();
            injectFileStatusBar(fileInput.files[0].name, fileInput.files[0].size / 1024);
            await processInPageUpload(fileInput.files[0]);
          } else {
            openAiStudioModal();
          }
        });
      }
    });
  }

  // Periodic observer to catch DOM changes on client-side routing
  setInterval(attachInPageDetectionHandlers, 600);

  // Process file upload directly for in-page UI with simulated step progression
  async function processInPageUpload(file) {
    // Animate pipeline stages
    animatePipelineProgression();

    const formData = new FormData();
    formData.append("file", file);
    formData.append("gsd_meters", 10.0);
    formData.append("confidence_threshold", 35.0);

    try {
      const res = await fetch("/api/detect", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      updateInPagePipeline(100, false, data.pipeline_stages);
      updateInPageDetectionResults(file.name, data);
    } catch (err) {
      console.error("Detection error:", err);
      updateInPageError(file.name, "Failed to connect to AI Detection API: " + err.message);
      resetInPagePipelineStatus();
    }
  }

  // Run a built-in scenario for in-page UI with live pipeline progression
  async function runInPageScenario(scenarioId) {
    animatePipelineProgression();

    try {
      const res = await fetch(`/api/scenarios/run/${scenarioId}?gsd_meters=10.0&threshold=35.0`, {
        method: "POST",
      });
      const data = await res.json();
      const sceneName = data.scenario_info?.name || scenarioId;
      updateInPagePipeline(100, false, data.pipeline_stages);
      updateInPageDetectionResults(sceneName, data);
    } catch (err) {
      console.error("Scenario error:", err);
      updateInPageError("Scenario", err.message);
      resetInPagePipelineStatus();
    }
  }

  function animatePipelineProgression() {
    let p = 10;
    updateInPagePipeline(p, true);
    const timer = setInterval(() => {
      p += 18;
      if (p >= 90) {
        clearInterval(timer);
        updateInPagePipeline(90, true);
      } else {
        updateInPagePipeline(p, true);
      }
    }, 120);
  }

  // Dynamically update all DOM elements in the /detection Result Package
  function updateInPageDetectionResults(filename, data) {
    console.log("Updating in-page detection view with real data:", data);

    let resultHeader = null;
    document.querySelectorAll("h2").forEach((h2) => {
      if (
        h2.textContent?.includes("OS-2026-") ||
        h2.textContent?.includes("possible oil") ||
        h2.textContent?.includes("Clean Water") ||
        h2.textContent?.includes("Invalid Image") ||
        h2.textContent?.includes("Invalid Scene") ||
        h2.textContent?.includes("Standby") ||
        h2.textContent?.includes("·")
      ) {
        resultHeader = h2;
      }
    });

    if (data.is_valid_image === false) {
      // Handle Invalid Image
      if (resultHeader) {
        resultHeader.textContent = `${filename} · ⚠️ Invalid Scene`;
        resultHeader.style.color = "#f43f5e";
      }

      const badge = resultHeader?.parentElement?.parentElement?.querySelector("span");
      if (badge) {
        badge.textContent = "Invalid Image";
        badge.className = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase bg-red-100 text-red-700";
      }

      updateMetricCards("N/A", "0%", "Failed", "Invalid Scene");
      updateAnalystNote(data.analyst_note || "The uploaded file does not match marine satellite or sea surface radar characteristics. Please upload SAR (.tif, .png) or sea surface imagery.", "red");
      renderInPageVisuals(data, false);
      return;
    }

    // Handle Valid Image
    if (resultHeader) {
      if (data.spill_detected) {
        resultHeader.textContent = `${filename} · ${data.severity}`;
        resultHeader.style.color = "#0f172a";
      } else {
        resultHeader.textContent = `${filename} · Clean Water Surface`;
        resultHeader.style.color = "#0f172a";
      }
    }

    const badge = resultHeader?.parentElement?.parentElement?.querySelector("span");
    if (badge) {
      if (data.spill_detected) {
        badge.textContent = "Oil Spill Detected";
        badge.className = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase bg-orange-100 text-orange-700";
      } else {
        badge.textContent = "Clean Water (Clear)";
        badge.className = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-700";
      }
    }

    const areaStr = data.spill_detected ? `${data.total_area_km2} km²` : "0.00 km²";
    const confStr = `${data.overall_confidence}%`;
    const timeStr = data.detection_time_utc || new Date().toISOString().slice(11, 16) + " UTC";
    const riskStr = data.severity;

    updateMetricCards(areaStr, confStr, timeStr, riskStr);
    updateAnalystNote(data.analyst_note, data.severity_tone);
    renderInPageVisuals(data, true);
  }

  function updateMetricCards(area, conf, time, risk) {
    const labels = ["Estimated area", "Correlation", "Detection", "Risk"];
    const values = [area, conf, time, risk];

    document.querySelectorAll("div").forEach((div) => {
      const text = div.textContent?.trim();
      const idx = labels.indexOf(text);
      if (idx !== -1 && div.nextElementSibling) {
        div.nextElementSibling.textContent = values[idx];
      }
    });
  }

  function updateAnalystNote(noteText, tone) {
    let analystHeading = null;
    document.querySelectorAll("h2").forEach((h2) => {
      if (h2.textContent?.trim() === "Analyst note") {
        analystHeading = h2;
      }
    });

    if (analystHeading) {
      const parentCard = analystHeading.closest("div.rounded-2xl");
      const notePara = parentCard?.querySelector("p");
      if (notePara) {
        notePara.textContent = noteText;
      }

      if (parentCard) {
        if (tone === "red") {
          parentCard.className = "rounded-2xl border border-red-200 bg-red-50/80 p-5";
        } else if (tone === "green") {
          parentCard.className = "rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5";
        } else if (tone === "orange") {
          parentCard.className = "rounded-2xl border border-orange-200 bg-orange-50/80 p-5";
        } else {
          parentCard.className = "rounded-2xl border border-blue-200 bg-blue-50/80 p-5";
        }
      }
    }
  }

  function renderInPageVisuals(data, isValid) {
    let container = document.getElementById("og-inpage-visuals");
    if (!container) {
      const analystNote = document.querySelector("h2")?.closest(".grid");
      if (!analystNote || !analystNote.parentElement) return;

      container = document.createElement("div");
      container.id = "og-inpage-visuals";
      container.className = "mt-6 space-y-5";
      analystNote.parentElement.appendChild(container);
    }

    if (!isValid) {
      container.innerHTML = `
        <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 16px; padding: 20px; color: #9f1239;">
          <div style="display:flex;align-items:center;gap:10px;font-weight:800;font-size:14px;">
            <span style="font-size:18px;">⚠️</span>
            <span>Image Validation Failed</span>
          </div>
          <p style="margin: 8px 0 0 0; font-size: 12px; line-height: 1.6; color: #be123c;">
            ${data.error_message || "The uploaded image is not a valid marine ocean surface or satellite radar scene."}
          </p>
          <div style="margin-top: 12px; font-size: 11px; color: #881337; background: white; padding: 10px 14px; border-radius: 8px; border: 1px dashed #fda4af;">
            <b>Required Format:</b> Sentinel-1 SAR, RADARSAT, TerraSAR-X, or aerial sea surface photography in .png, .jpg, or .tif formats.
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; box-shadow: 0 4px 20px -4px rgba(0,0,0,0.05);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <div>
            <span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:#0284c7;">Computer Vision Evidence</span>
            <h3 style="margin:2px 0 0 0;font-size:15px;font-weight:800;color:#0f172a;">Live Pixel-Level Segmentation & Radar Attenuation</h3>
          </div>
          <div style="margin-left:auto;display:flex;gap:8px;">
            <span style="font-size:11px;background:#f1f5f9;color:#475569;padding:4px 10px;border-radius:6px;font-family:monospace;">${data.image_dimensions.width}×${data.image_dimensions.height} px</span>
            <span style="font-size:11px;background:#f0fdf4;color:#166534;padding:4px 10px;border-radius:6px;font-weight:700;">GSD: ${data.ground_sampling_distance_m}m/px</span>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:16px;">
          <!-- Segmented Mask Overlay -->
          <div style="background:#092544;border-radius:12px;overflow:hidden;border:1px solid #1e3a5f;">
            <div style="padding:8px 12px;background:rgba(255,255,255,0.04);border-bottom:1px solid rgba(255,255,255,0.08);font-size:11px;font-weight:700;color:#38bdf8;display:flex;justify-content:space-between;">
              <span>OpenCV Segmentation Mask Overlay</span>
              <span style="color:#94a3b8;font-size:10px;">${data.slick_count} Slicks Identified</span>
            </div>
            <div style="min-height:220px;display:flex;align-items:center;justify-content:center;background:#030d17;">
              <img src="${data.processed_overlay_image}" style="width:100%;height:auto;display:block;object-fit:contain;" />
            </div>
          </div>

          <!-- Heatmap -->
          <div style="background:#092544;border-radius:12px;overflow:hidden;border:1px solid #1e3a5f;">
            <div style="padding:8px 12px;background:rgba(255,255,255,0.04);border-bottom:1px solid rgba(255,255,255,0.08);font-size:11px;font-weight:700;color:#fb923c;display:flex;justify-content:space-between;">
              <span>Radar Capillary Wave Damping Heatmap</span>
              <span style="color:#94a3b8;font-size:10px;">Inferno Scale</span>
            </div>
            <div style="min-height:220px;display:flex;align-items:center;justify-content:center;background:#030d17;">
              <img src="${data.heatmap_image}" style="width:100%;height:auto;display:block;object-fit:contain;" />
            </div>
          </div>
        </div>

        ${
          data.slicks && data.slicks.length > 0
            ? `
          <div style="margin-top:16px;border-top:1px solid #f1f5f9;padding-top:14px;">
            <div style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">Identified Slick Geometries</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:8px;">
              ${data.slicks
                .map(
                  (s) => `
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;font-size:11px;">
                  <div style="font-weight:700;color:#0f172a;display:flex;justify-content:space-between;">
                    <span>Slick #${s.id}</span>
                    <span style="color:#0284c7;">${s.confidence_pct}%</span>
                  </div>
                  <div style="color:#64748b;margin-top:4px;font-family:monospace;font-size:10px;">
                    Area: <b>${s.area_km2} km²</b><br>
                    Perimeter: ${s.perimeter_km} km<br>
                    Elongation: ${s.elongation_ratio}x<br>
                    Contrast Deficit: ${s.contrast_ratio}x
                  </div>
                </div>
              `
                )
                .join("")}
            </div>
          </div>
        `
            : ""
        }
      </div>
    `;
  }

  function updateInPageError(filename, errorMsg) {
    updateInPageDetectionResults(filename, {
      is_valid_image: false,
      error_message: errorMsg,
      spill_detected: false,
      overall_confidence: 0,
      severity: "Error",
      total_area_km2: 0,
      analyst_note: "Error processing image: " + errorMsg,
    });
  }

  // --- Live AI Studio Modal ---
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
            <!-- Guidelines Bar inside Modal -->
            <div style="background: rgba(56,189,248,0.06); border: 1px solid rgba(56,189,248,0.2); border-radius: 12px; padding: 12px 16px; font-size: 11px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px;">
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="color:#38bdf8;font-weight:800;">ℹ️ Input Guide:</span>
                <span style="color:#cbd5e1;">Upload satellite Synthetic Aperture Radar (SAR) or aerial ocean imagery showing water surfaces.</span>
              </div>
              <span style="color:#94a3b8;font-family:monospace;font-size:10px;">.png, .jpg, .tif (max 50 MB)</span>
            </div>

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
                <button id="og-remove-modal-file-btn" style="display:none;background:rgba(244,63,94,0.15);border:1px solid rgba(244,63,94,0.3);color:#f43f5e;font-size:11px;font-weight:700;padding:4px 8px;border-radius:6px;cursor:pointer;">✕ Remove Image</button>
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

              <!-- Visual Inspection Viewer -->
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 16px;">
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

      // Modal Remove file button
      const modalRemoveBtn = document.getElementById("og-remove-modal-file-btn");
      if (modalRemoveBtn) {
        modalRemoveBtn.onclick = () => {
          clearUploadedImage();
        };
      }

      // Scenario buttons
      const sceneButtons = modal.querySelectorAll(".og-scene-btn");
      sceneButtons.forEach((btn) => {
        btn.onclick = () => {
          sceneButtons.forEach((b) => (b.style.borderColor = "rgba(255,255,255,0.1)"));
          btn.style.borderColor = "#38bdf8";
          const sceneId = btn.getAttribute("data-scene");
          runStudioScenario(sceneId);
        };
      });

      // File input in modal
      const modalFileInput = document.getElementById("og-file-input");
      modalFileInput.onchange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
          document.getElementById("og-file-name").textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
          if (modalRemoveBtn) modalRemoveBtn.style.display = "inline-block";
          injectFileStatusBar(file.name, file.size / 1024);
          uploadAndDetectStudio(file);
          processInPageUpload(file);
        }
      };
    }

    modal.style.display = "flex";
    if (initialScenario) {
      runStudioScenario(initialScenario);
    } else {
      runStudioScenario("tanker_spill");
    }
  }

  // API Call from studio
  async function runStudioScenario(scenarioId) {
    setStudioLoading(true);
    const gsd = document.getElementById("og-gsd")?.value || 10.0;
    const thresh = document.getElementById("og-conf-thresh")?.value || 35.0;

    try {
      const res = await fetch(`/api/scenarios/run/${scenarioId}?gsd_meters=${gsd}&threshold=${thresh}`, {
        method: "POST",
      });
      const data = await res.json();
      renderStudioResults(data);
    } catch (err) {
      alert("Error running scenario: " + err.message);
    } finally {
      setStudioLoading(false);
    }
  }

  async function uploadAndDetectStudio(file) {
    setStudioLoading(true);
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
      const data = await res.json();
      renderStudioResults(data);
    } catch (err) {
      alert("Detection error: " + err.message);
    } finally {
      setStudioLoading(false);
    }
  }

  function setStudioLoading(loading) {
    const stateEl = document.getElementById("m-state");
    if (stateEl) {
      stateEl.textContent = loading ? "Analyzing..." : "Complete";
      stateEl.style.color = loading ? "#fb923c" : "#38bdf8";
    }
  }

  function renderStudioResults(data) {
    const stateEl = document.getElementById("m-state");
    const confEl = document.getElementById("m-conf");
    const areaEl = document.getElementById("m-area");
    const slicksEl = document.getElementById("m-slicks");
    const sevEl = document.getElementById("m-severity");

    if (data.is_valid_image === false) {
      stateEl.textContent = "INVALID IMAGE";
      stateEl.style.color = "#f43f5e";
      confEl.textContent = "0%";
      areaEl.textContent = "N/A";
      slicksEl.textContent = "0";
      sevEl.textContent = "Invalid Scene";
      sevEl.style.color = "#f43f5e";
    } else if (data.spill_detected) {
      stateEl.textContent = "SPILL DETECTED";
      stateEl.style.color = "#f43f5e";
      confEl.textContent = `${data.overall_confidence}%`;
      areaEl.textContent = `${data.total_area_km2} km²`;
      slicksEl.textContent = data.slick_count;
      sevEl.textContent = data.severity;
      sevEl.style.color = data.severity_tone === "red" ? "#f43f5e" : data.severity_tone === "orange" ? "#fb923c" : "#10b981";
    } else {
      stateEl.textContent = "CLEAN WATER";
      stateEl.style.color = "#10b981";
      confEl.textContent = "0%";
      areaEl.textContent = "0.00 km²";
      slicksEl.textContent = "0";
      sevEl.textContent = "Clean Water";
      sevEl.style.color = "#10b981";
    }

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

  // Expose globally
  window.OceanGuardAI = {
    openStudio: openAiStudioModal,
    runScenario: runInPageScenario,
    processUpload: processInPageUpload,
    clearImage: clearUploadedImage,
  };
})();
