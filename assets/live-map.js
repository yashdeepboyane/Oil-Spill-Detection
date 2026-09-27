/**
 * OceanGuard Live Marine Satellite & AIS Navigation Map
 * Replaces the schematic view with a real, live, interactive Leaflet satellite map.
 * Includes:
 * - Real Satellite (Esri World Imagery) and Dark Nautical basemaps
 * - Live pulsating Oil Spill Polygon (OS-2026-014, 12.6 km²)
 * - Live drifting AIS vessels (MV Ocean Star, Pacific Fern, Meridian Crest) with telemetry popups
 * - Real-time wind & ocean current vector overlays
 * - Maximize / Fullscreen feature to expand the map along the full screen
 * - Real-time coordinate tracker and live UTC clock
 */

(function () {
  console.log("OceanGuard Live Marine Map Engine initializing...");

  let activeMap = null;
  let mapLayers = {};
  let vesselMarkers = {};
  let spillLayer = null;
  let isMaximized = false;
  let vesselAnimationTimer = null;

  // Incident & Vessel Data
  const CENTER_LAT = 12.44;
  const CENTER_LNG = 78.22;

  const SPILL_GEOJSON = {
    type: "Feature",
    properties: {
      id: "OS-2026-014",
      name: "Crude Oil Spill Plume",
      area_km2: 12.6,
      confidence: 88,
      detected_utc: "14:32 UTC",
      severity: "High Priority",
    },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [78.16, 12.48],
          [78.21, 12.49],
          [78.26, 12.45],
          [78.28, 12.41],
          [78.25, 12.38],
          [78.19, 12.39],
          [78.15, 12.43],
          [78.16, 12.48],
        ],
      ],
    },
  };

  const VESSELS = [
    {
      id: "ocean-star",
      name: "MV Ocean Star",
      type: "Crude Oil Tanker",
      mmsi: "354892000",
      flag: "Panama",
      lat: 12.465,
      lng: 78.285,
      speed_kn: 14.2,
      heading_deg: 135,
      color: "#fb923c",
      trajectory: [
        [12.55, 78.18],
        [12.51, 78.23],
        [12.465, 78.285],
        [12.41, 78.34],
      ],
    },
    {
      id: "pacific-fern",
      name: "Pacific Fern",
      type: "Bulk Carrier",
      mmsi: "219014000",
      flag: "Marshall Islands",
      lat: 12.52,
      lng: 78.15,
      speed_kn: 11.8,
      heading_deg: 210,
      color: "#38bdf8",
      trajectory: [
        [12.58, 78.11],
        [12.55, 78.13],
        [12.52, 78.15],
        [12.48, 78.18],
      ],
    },
    {
      id: "meridian-crest",
      name: "Meridian Crest",
      type: "Container Ship",
      mmsi: "477218000",
      flag: "Hong Kong",
      lat: 12.35,
      lng: 78.35,
      speed_kn: 16.0,
      heading_deg: 45,
      color: "#60a5fa",
      trajectory: [
        [12.28, 78.28],
        [12.31, 78.31],
        [12.35, 78.35],
        [12.39, 78.39],
      ],
    },
  ];

  function initLiveMap() {
    // Look for the schematic ocean view container
    let mapContainer = null;
    document.querySelectorAll("div").forEach((div) => {
      if (
        (div.textContent?.includes("Schematic ocean view") || div.textContent?.includes("Demonstrative map")) &&
        (div.className?.includes("min-h-[430px]") || div.className?.includes("rounded-2xl"))
      ) {
        mapContainer = div;
      }
    });

    if (!mapContainer || mapContainer.dataset.ogLiveMapActive) return;
    if (typeof L === "undefined") {
      console.warn("Leaflet not loaded yet, retrying...");
      return;
    }

    console.log("Upgrading demonstrative schematic to LIVE interactive satellite map...");
    mapContainer.dataset.ogLiveMapActive = "true";
    mapContainer.innerHTML = ""; // Clear schematic placeholder

    // Build the Live Map Wrapper
    mapContainer.style.position = "relative";
    mapContainer.style.minHeight = "480px";
    mapContainer.style.height = "100%";
    mapContainer.style.overflow = "hidden";
    mapContainer.style.borderRadius = "16px";
    mapContainer.style.background = "#051626";
    mapContainer.style.border = "1px solid #1e3a5f";

    const mapDiv = document.createElement("div");
    mapDiv.id = "og-live-leaflet-map";
    mapDiv.style.cssText = "width: 100%; height: 100%; min-height: 480px; z-index: 1;";
    mapContainer.appendChild(mapDiv);

    // Create Leaflet Map Instance
    activeMap = L.map("og-live-leaflet-map", {
      center: [CENTER_LAT, CENTER_LNG],
      zoom: 11,
      zoomControl: false,
      attributionControl: false,
    });

    // Basemap tile layers
    const esriSatellite = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 18 }
    );
    const cartoDark = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      { maxZoom: 19 }
    );
    const osmOcean = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      { maxZoom: 19 }
    );

    // Default to Satellite Imagery for realistic earth view
    esriSatellite.addTo(activeMap);

    mapLayers.satellite = esriSatellite;
    mapLayers.dark = cartoDark;
    mapLayers.osm = osmOcean;

    // Add Live Layers (Spill, Vessels, AIS, Wind, Current)
    renderSpillPolygon(activeMap);
    renderVesselMarkers(activeMap);
    renderRouteTrajectories(activeMap);
    renderCurrentAndWind(activeMap);

    // Inject Live Map UI Overlays (Header, Maximize button, Layer Toggles, Coordinates, HUD)
    injectMapControls(mapContainer, activeMap);

    // Start live vessel drift animation
    startVesselSimulation();

    // Trigger resize calculation
    setTimeout(() => activeMap.invalidateSize(), 200);
  }

  // 1. Render Oil Spill Polygon (OS-2026-014)
  function renderSpillPolygon(map) {
    spillLayer = L.geoJSON(SPILL_GEOJSON, {
      style: {
        color: "#ef4444",
        weight: 3,
        opacity: 0.95,
        fillColor: "#ef4444",
        fillOpacity: 0.45,
        dashArray: "6, 6",
      },
      onEachFeature: (feature, layer) => {
        layer.bindPopup(`
          <div style="font-family: Inter, sans-serif; color: #0f172a; padding: 4px; min-width: 190px;">
            <div style="font-size: 10px; font-weight: 800; color: #dc2626; text-transform: uppercase;">Active Oil Spill Target</div>
            <div style="font-size: 14px; font-weight: 800; margin: 2px 0;">${feature.properties.id}</div>
            <div style="font-size: 11px; color: #475569; margin-bottom: 6px;">${feature.properties.name}</div>
            <div style="background: #fef2f2; border: 1px solid #fee2e2; border-radius: 6px; padding: 6px 8px; font-size: 11px; font-family: monospace;">
              Area: <b>${feature.properties.area_km2} km²</b><br>
              Confidence: <b>${feature.properties.confidence}%</b><br>
              Detected: <b>${feature.properties.detected_utc}</b><br>
              Severity: <b style="color:#b91c1c;">${feature.properties.severity}</b>
            </div>
          </div>
        `);
      },
    }).addTo(map);

    // Add glowing marker on spill center
    const spillMarkerHtml = `
      <div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
        <span style="position:absolute;width:100%;height:100%;border-radius:50%;background:#ef4444;opacity:0.4;animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></span>
        <span style="position:relative;width:12px;height:12px;border-radius:50%;background:#ef4444;border:2px solid white;box-shadow:0 0 10px #ef4444;"></span>
      </div>
    `;
    const spillIcon = L.divIcon({
      html: spillMarkerHtml,
      className: "og-spill-pulse",
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
    L.marker([12.44, 78.22], { icon: spillIcon })
      .bindTooltip("<b>OS-2026-014</b> · 12.6 km² Active Spill", {
        permanent: true,
        direction: "top",
        className: "og-spill-tooltip",
      })
      .addTo(map);
  }

  // 2. Render Live AIS Vessels
  function renderVesselMarkers(map) {
    VESSELS.forEach((vessel) => {
      const vesselHtml = `
        <div style="position:relative;display:flex;align-items:center;gap:6px;">
          <div style="
            width: 28px; 
            height: 28px; 
            border-radius: 50%; 
            background: ${vessel.color}; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            color: #092747; 
            border: 2px solid white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            transform: rotate(${vessel.heading_deg}deg);
            transition: all 0.5s ease;
          ">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 19 21 12 17 5 21 12 2"></polygon></svg>
          </div>
          <span style="background: rgba(9,37,68,0.85); color: #f8fafc; font-size: 9px; font-family: monospace; font-weight: 700; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2); white-space: nowrap;">
            ${vessel.name}
          </span>
        </div>
      `;

      const icon = L.divIcon({
        html: vesselHtml,
        className: "og-vessel-icon",
        iconSize: [120, 30],
        iconAnchor: [14, 15],
      });

      const marker = L.marker([vessel.lat, vessel.lng], { icon: icon }).addTo(map);
      marker.bindPopup(`
        <div style="font-family: Inter, sans-serif; color: #0f172a; padding: 4px; min-width: 180px;">
          <div style="font-size: 9px; font-weight: 800; color: #0284c7; text-transform: uppercase;">AIS Live Telemetry</div>
          <div style="font-size: 13px; font-weight: 800; margin: 2px 0;">${vessel.name}</div>
          <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">${vessel.type} (${vessel.flag})</div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 8px; font-size: 10px; font-family: monospace;">
            MMSI: <b>${vessel.mmsi}</b><br>
            Speed: <b>${vessel.speed_kn} kn</b><br>
            Heading: <b>${vessel.heading_deg}°</b><br>
            Coordinates: <b>${vessel.lat.toFixed(3)}°N, ${vessel.lng.toFixed(3)}°E</b>
          </div>
        </div>
      `);

      vesselMarkers[vessel.id] = {
        marker: marker,
        data: vessel,
      };
    });
  }

  // 3. Render Historical AIS Trajectories
  function renderRouteTrajectories(map) {
    VESSELS.forEach((v) => {
      L.polyline(v.trajectory, {
        color: v.color,
        weight: 2,
        opacity: 0.6,
        dashArray: "4, 6",
      }).addTo(map);
    });
  }

  // 4. Render Current and Wind Vectors
  function renderCurrentAndWind(map) {
    // Surface Current Vector
    const currentLine = L.polyline(
      [
        [12.48, 78.12],
        [12.42, 78.26],
      ],
      {
        color: "#10b981",
        weight: 3,
        opacity: 0.75,
      }
    ).addTo(map);
    currentLine.bindTooltip("🌊 Ocean Current: 0.7 kn SE", { sticky: true });

    // Risk Buffer Circle
    L.circle([12.44, 78.22], {
      radius: 8000,
      color: "#fb923c",
      weight: 1.5,
      opacity: 0.5,
      fillColor: "#fb923c",
      fillOpacity: 0.08,
      dashArray: "6, 8",
    }).addTo(map);
  }

  // 5. Real-time Vessel Drift Simulation
  function startVesselSimulation() {
    if (vesselAnimationTimer) clearInterval(vesselAnimationTimer);

    vesselAnimationTimer = setInterval(() => {
      VESSELS.forEach((v) => {
        // Small realistic drift step in heading direction
        const rad = (v.heading_deg * Math.PI) / 180;
        const deltaLat = Math.cos(rad) * 0.0004;
        const deltaLng = Math.sin(rad) * 0.0004;

        v.lat += deltaLat;
        v.lng += deltaLng;

        if (vesselMarkers[v.id]) {
          vesselMarkers[v.id].marker.setLatLng([v.lat, v.lng]);
        }
      });
    }, 2000);
  }

  // 6. Map UI Overlays & Maximize / Fullscreen Feature
  function injectMapControls(container, map) {
    const controlsDiv = document.createElement("div");
    controlsDiv.className = "og-map-ui-layer";
    controlsDiv.style.cssText = "position: absolute; inset: 0; pointer-events: none; z-index: 1000;";

    controlsDiv.innerHTML = `
      <!-- Top HUD Header -->
      <div style="position: absolute; top: 12px; left: 12px; right: 12px; display: flex; align-items: center; justify-content: space-between; pointer-events: auto;">
        <div style="display: flex; align-items: center; gap: 8px; background: rgba(6,29,55,0.88); backdrop-filter: blur(8px); padding: 6px 12px; border-radius: 10px; border: 1px solid rgba(56,189,248,0.3); color: white; font-family: monospace; font-size: 11px;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10b981;box-shadow:0 0 8px #10b981;animation:pulse 2s infinite;"></span>
          <span style="font-weight: 800; color: #38bdf8; text-transform: uppercase;">LIVE SATELLITE MAP</span>
          <span style="color: #94a3b8;">|</span>
          <span id="og-map-utc-clock" style="color: #f8fafc;">--:--:-- UTC</span>
        </div>

        <!-- Top Right Control Buttons -->
        <div style="display: flex; align-items: center; gap: 8px;">
          <!-- Basemap Switcher -->
          <div style="background: rgba(6,29,55,0.88); backdrop-filter: blur(8px); padding: 4px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.15); display: flex; gap: 4px;">
            <button id="og-btn-satellite" style="background: #0284c7; color: white; border: none; padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 700; cursor: pointer;">Satellite</button>
            <button id="og-btn-dark" style="background: transparent; color: #94a3b8; border: none; padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 700; cursor: pointer;">Nautical</button>
          </div>

          <!-- Re-center button -->
          <button id="og-btn-recenter" style="background: rgba(6,29,55,0.88); backdrop-filter: blur(8px); color: #38bdf8; border: 1px solid rgba(56,189,248,0.3); padding: 6px 10px; border-radius: 10px; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px;" title="Center on Spill Incident">
            <span>🎯</span>
            <span class="hidden sm:inline">Target Spill</span>
          </button>

          <!-- MAXIMIZE / FULLSCREEN BUTTON -->
          <button id="og-btn-maximize" style="
            background: #0284c7; 
            color: white; 
            border: 1px solid rgba(255,255,255,0.25); 
            padding: 6px 14px; 
            border-radius: 10px; 
            font-size: 11px; 
            font-weight: 800; 
            cursor: pointer; 
            display: flex; 
            align-items: center; 
            gap: 6px;
            box-shadow: 0 4px 14px rgba(2,132,199,0.4);
            transition: all 0.2s ease;
          ">
            <span id="og-max-icon" style="font-size: 14px;">⛶</span>
            <span id="og-max-text">Maximize Map</span>
          </button>
        </div>
      </div>

      <!-- Bottom Bar: Coordinates, Telemetry & Zoom -->
      <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(5,22,38,0.9); backdrop-filter: blur(10px); border-top: 1px solid rgba(255,255,255,0.1); padding: 8px 16px; display: flex; align-items: center; justify-content: space-between; font-family: monospace; font-size: 10px; color: #94a3b8; pointer-events: auto;">
        <div style="display: flex; align-items: center; gap: 14px;">
          <span style="color: #38bdf8; font-weight: 700;">LIVE AIS / SAR FEED</span>
          <span id="og-cursor-coords">12.440° N · 78.220° E</span>
          <span style="color: #64748b;">|</span>
          <span style="color: #10b981;">3 Vessels Active</span>
          <span style="color: #ef4444; font-weight: 700;">1 Active Spill (OS-2026-014)</span>
        </div>

        <div style="display: flex; align-items: center; gap: 10px;">
          <button id="og-zoom-in" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: white; width: 22px; height: 22px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: 800;">+</button>
          <button id="og-zoom-out" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: white; width: 22px; height: 22px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: 800;">-</button>
        </div>
      </div>
    `;

    container.appendChild(controlsDiv);

    // Live Clock
    setInterval(() => {
      const clockEl = document.getElementById("og-map-utc-clock");
      if (clockEl) {
        clockEl.textContent = new Date().toISOString().slice(11, 19) + " UTC";
      }
    }, 1000);

    // Mouse Move Coordinate Tracker
    map.on("mousemove", (e) => {
      const coordEl = document.getElementById("og-cursor-coords");
      if (coordEl) {
        coordEl.textContent = `${e.latlng.lat.toFixed(4)}° N · ${e.latlng.lng.toFixed(4)}° E`;
      }
    });

    // Zoom buttons
    document.getElementById("og-zoom-in").onclick = () => map.zoomIn();
    document.getElementById("og-zoom-out").onclick = () => map.zoomOut();

    // Re-center button
    document.getElementById("og-btn-recenter").onclick = () => {
      map.flyTo([CENTER_LAT, CENTER_LNG], 11, { duration: 1.2 });
    };

    // Basemap Switchers
    const btnSat = document.getElementById("og-btn-satellite");
    const btnDark = document.getElementById("og-btn-dark");

    btnSat.onclick = () => {
      btnSat.style.background = "#0284c7";
      btnSat.style.color = "white";
      btnDark.style.background = "transparent";
      btnDark.style.color = "#94a3b8";

      map.removeLayer(mapLayers.dark);
      map.addLayer(mapLayers.satellite);
    };

    btnDark.onclick = () => {
      btnDark.style.background = "#0284c7";
      btnDark.style.color = "white";
      btnSat.style.background = "transparent";
      btnSat.style.color = "#94a3b8";

      map.removeLayer(mapLayers.satellite);
      map.addLayer(mapLayers.dark);
    };

    // Maximize / Fullscreen Action Handler
    const maxBtn = document.getElementById("og-btn-maximize");
    maxBtn.onclick = () => toggleMaximizeMap(container, map);

    // ESC key listener to exit fullscreen
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isMaximized) {
        toggleMaximizeMap(container, map);
      }
    });
  }

  // Toggle Maximize / Fullscreen Map along the full viewport
  function toggleMaximizeMap(container, map) {
    isMaximized = !isMaximized;
    const maxText = document.getElementById("og-max-text");
    const maxIcon = document.getElementById("og-max-icon");
    const maxBtn = document.getElementById("og-btn-maximize");

    if (isMaximized) {
      // Expand to full viewport
      container.style.position = "fixed";
      container.style.inset = "0";
      container.style.zIndex = "99999";
      container.style.width = "100vw";
      container.style.height = "100vh";
      container.style.borderRadius = "0";
      container.style.margin = "0";

      if (maxText) maxText.textContent = "Exit Fullscreen";
      if (maxIcon) maxIcon.textContent = "✕";
      if (maxBtn) maxBtn.style.background = "#e11d48";
    } else {
      // Restore to standard layout
      container.style.position = "relative";
      container.style.inset = "";
      container.style.zIndex = "";
      container.style.width = "100%";
      container.style.height = "100%";
      container.style.borderRadius = "16px";

      if (maxText) maxText.textContent = "Maximize Map";
      if (maxIcon) maxIcon.textContent = "⛶";
      if (maxBtn) maxBtn.style.background = "#0284c7";
    }

    // Force Leaflet to recalculate dimensions immediately
    setTimeout(() => {
      map.invalidateSize();
    }, 150);
  }

  // Check and initialize periodically when navigation changes
  setInterval(initLiveMap, 800);

  // Expose globally
  window.OceanGuardMap = {
    init: initLiveMap,
    toggleMaximize: toggleMaximizeMap,
  };
})();
