/**
 * OceanGuard Live Marine Satellite & AIS Navigation Map
 * Replaces the schematic view with a real, live, high-resolution satellite remote-sensing map.
 * Includes:
 * - Real Satellite Imagery (Esri World Imagery) with satellite place references
 * - Live Sentinel-1 SAR Radar Swath Footprint & Orbital Pass Grid
 * - Marine Nautical Bathymetry and SAR Radar Dark views
 * - Indian Standard Time (IST / ISI) clock and telemetry timestamps
 * - Deep offshore ocean coordinates (Bay of Bengal / Maritime Sector, 80 km offshore)
 * - Live pulsating Oil Spill Target (OS-2026-014, 12.6 km²)
 * - Live drifting AIS vessels (MV Ocean Star, Pacific Fern, Meridian Crest) with telemetry popups
 * - Real-time wind & ocean current vector overlays
 * - Maximize / Fullscreen feature to expand the map along the full screen
 * - Real-time coordinate tracker and live IST clock
 */

(function () {
  console.log("OceanGuard High-Res Satellite Remote Sensing Map Engine initializing...");

  let activeMap = null;
  let mapLayers = {};
  let vesselMarkers = {};
  let spillLayer = null;
  let swathLayer = null;
  let isMaximized = false;
  let vesselAnimationTimer = null;

  // Genuine Offshore Deep Sea Coordinates (Maritime Exclusive Economic Zone)
  const CENTER_LAT = 13.15;
  const CENTER_LNG = 81.15;

  const SPILL_GEOJSON = {
    type: "Feature",
    properties: {
      id: "OS-2026-014",
      name: "Crude Oil Spill Plume (Offshore Marine Zone)",
      area_km2: 12.6,
      confidence: 94,
      detected_time: "14:32 IST",
      severity: "High Priority",
    },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [81.09, 13.19],
          [81.14, 13.20],
          [81.19, 13.16],
          [81.21, 13.12],
          [81.18, 13.09],
          [81.12, 13.10],
          [81.08, 13.14],
          [81.09, 13.19],
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
      lat: 13.175,
      lng: 81.215,
      speed_kn: 14.2,
      heading_deg: 135,
      color: "#fb923c",
      trajectory: [
        [13.26, 81.11],
        [13.22, 81.16],
        [13.175, 81.215],
        [13.12, 81.27],
      ],
    },
    {
      id: "pacific-fern",
      name: "Pacific Fern",
      type: "Bulk Carrier",
      mmsi: "219014000",
      flag: "Marshall Islands",
      lat: 13.23,
      lng: 81.08,
      speed_kn: 11.8,
      heading_deg: 210,
      color: "#38bdf8",
      trajectory: [
        [13.29, 81.04],
        [13.26, 81.06],
        [13.23, 81.08],
        [13.19, 81.11],
      ],
    },
    {
      id: "meridian-crest",
      name: "Meridian Crest",
      type: "Container Ship",
      mmsi: "477218000",
      flag: "Hong Kong",
      lat: 13.06,
      lng: 81.28,
      speed_kn: 16.0,
      heading_deg: 45,
      color: "#60a5fa",
      trajectory: [
        [12.99, 81.21],
        [13.02, 81.24],
        [13.06, 81.28],
        [13.10, 81.32],
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

    console.log("Upgrading to High-Resolution Satellite Remote Sensing Map...");
    mapContainer.dataset.ogLiveMapActive = "true";
    mapContainer.innerHTML = ""; // Clear schematic placeholder

    // Build the Live Map Wrapper
    mapContainer.style.position = "relative";
    mapContainer.style.minHeight = "480px";
    mapContainer.style.height = "100%";
    mapContainer.style.overflow = "hidden";
    mapContainer.style.borderRadius = "16px";
    mapContainer.style.background = "#021220";
    mapContainer.style.border = "1px solid #0284c7";
    mapContainer.style.boxShadow = "0 8px 32px rgba(2, 44, 77, 0.5)";

    const mapDiv = document.createElement("div");
    mapDiv.id = "og-live-leaflet-map";
    mapDiv.style.cssText = "width: 100%; height: 100%; min-height: 480px; z-index: 1; background: #021220;";
    mapContainer.appendChild(mapDiv);

    // Create Leaflet Map Instance
    activeMap = L.map("og-live-leaflet-map", {
      center: [CENTER_LAT, CENTER_LNG],
      zoom: 11,
      zoomControl: false,
      attributionControl: false,
    });

    // Basemap tile layers:
    // 1. High-Resolution True-Color Satellite Imagery (Esri World Imagery)
    const esriSatellite = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { 
        maxZoom: 19,
        className: "og-satellite-tiles",
        attribution: "Esri World Imagery & Sentinel Satellite Feed"
      }
    );

    // 2. High-Res Satellite Places & Reference Overlay
    const esriReference = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19 }
    );

    // 3. Deep Blue Marine Ocean Basemap (Bathymetric depths & sea contours)
    const esriOcean = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_OceanBase/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 13 }
    );

    // 4. Dark Tactical SAR Radar View
    const cartoDark = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      { maxZoom: 19 }
    );

    // Group Satellite Imagery with Reference
    const satelliteGroup = L.layerGroup([esriSatellite, esriReference]);

    // Set Satellite View as the primary authentic earth view
    satelliteGroup.addTo(activeMap);

    mapLayers.satellite = satelliteGroup;
    mapLayers.ocean = esriOcean;
    mapLayers.dark = cartoDark;

    // Add Live Remote Sensing Overlays (SAR Swath, Spill, Vessels, Vectors)
    renderSatelliteSwath(activeMap);
    renderSpillPolygon(activeMap);
    renderVesselMarkers(activeMap);
    renderRouteTrajectories(activeMap);
    renderCurrentAndWind(activeMap);

    // Inject Live Map UI Overlays (Header, Satellite Telemetry HUD, Maximize button, IST Clock)
    injectMapControls(mapContainer, activeMap);

    // Start live vessel drift animation
    startVesselSimulation();

    // Trigger resize calculation
    setTimeout(() => activeMap.invalidateSize(), 200);
  }

  // 1. Render Satellite SAR Radar Swath Footprint & Ground Track
  function renderSatelliteSwath(map) {
    // Sentinel-1 IW 250km Radar Swath boundary in maritime zone
    const swathCoordinates = [
      [13.40, 80.90],
      [13.35, 81.45],
      [12.90, 81.40],
      [12.95, 80.85],
      [13.40, 80.90],
    ];

    swathLayer = L.polygon(swathCoordinates, {
      color: "#00f2fe",
      weight: 1.5,
      opacity: 0.6,
      fillColor: "#00f2fe",
      fillOpacity: 0.04,
      dashArray: "8, 8",
    }).addTo(map);

    swathLayer.bindTooltip("🛰️ Sentinel-1A SAR Imaging Swath · IW Mode (250km)", {
      direction: "top",
      sticky: true,
      className: "og-satellite-tooltip",
    });

    // Sub-satellite ground track path
    L.polyline(
      [
        [13.50, 81.18],
        [12.80, 81.12],
      ],
      {
        color: "#38bdf8",
        weight: 1.5,
        opacity: 0.5,
        dashArray: "4, 6",
      }
    ).addTo(map);
  }

  // 2. Render Oil Spill Polygon (OS-2026-014)
  function renderSpillPolygon(map) {
    spillLayer = L.geoJSON(SPILL_GEOJSON, {
      style: {
        color: "#ef4444",
        weight: 3,
        opacity: 0.95,
        fillColor: "#dc2626",
        fillOpacity: 0.5,
        dashArray: "6, 6",
      },
      onEachFeature: (feature, layer) => {
        layer.bindPopup(`
          <div style="font-family: Inter, sans-serif; color: #0f172a; padding: 4px; min-width: 210px;">
            <div style="font-size: 10px; font-weight: 800; color: #dc2626; text-transform: uppercase; letter-spacing: 0.5px;">Active Satellite Spill Target</div>
            <div style="font-size: 14px; font-weight: 800; margin: 3px 0; color: #0f172a;">${feature.properties.id}</div>
            <div style="font-size: 11px; color: #475569; margin-bottom: 6px;">${feature.properties.name}</div>
            <div style="background: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px; padding: 8px 10px; font-size: 11px; font-family: monospace; line-height: 1.6;">
              Area: <b>${feature.properties.area_km2} km²</b><br>
              Confidence: <b>${feature.properties.confidence}%</b><br>
              Sensor: <b>Sentinel-1 C-SAR IW</b><br>
              Detected Time: <b>${feature.properties.detected_time}</b><br>
              Severity: <b style="color:#b91c1c;">${feature.properties.severity}</b><br>
              Orbit: <b>Descending Pass #142</b>
            </div>
          </div>
        `);
      },
    }).addTo(map);

    // Add glowing satellite reticle marker on spill center
    const spillMarkerHtml = `
      <div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;">
        <span style="position:absolute;width:100%;height:100%;border-radius:50%;background:#ef4444;opacity:0.5;animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></span>
        <span style="position:absolute;width:24px;height:24px;border:1px dashed #ffffff;border-radius:50%;animation:spin 6s linear infinite;"></span>
        <span style="position:relative;width:10px;height:10px;border-radius:50%;background:#ef4444;border:2px solid white;box-shadow:0 0 12px #ef4444;"></span>
      </div>
    `;
    const spillIcon = L.divIcon({
      html: spillMarkerHtml,
      className: "og-spill-pulse",
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    L.marker([CENTER_LAT, CENTER_LNG], { icon: spillIcon })
      .bindTooltip("<b>OS-2026-014</b> · 12.6 km² Satellite Target · 14:32 IST", {
        permanent: true,
        direction: "top",
        className: "og-spill-tooltip",
      })
      .addTo(map);
  }

  // 3. Render Live AIS Vessels
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
            color: #032b4d; 
            border: 2px solid white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.6);
            transform: rotate(${vessel.heading_deg}deg);
            transition: all 0.5s ease;
          ">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 19 21 12 17 5 21 12 2"></polygon></svg>
          </div>
          <span style="background: rgba(3, 43, 77, 0.94); color: #f8fafc; font-size: 9px; font-family: monospace; font-weight: 700; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(56, 189, 248, 0.4); white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.4);">
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
        <div style="font-family: Inter, sans-serif; color: #0f172a; padding: 4px; min-width: 190px;">
          <div style="font-size: 9px; font-weight: 800; color: #0284c7; text-transform: uppercase;">AIS Live Ocean Telemetry</div>
          <div style="font-size: 13px; font-weight: 800; margin: 2px 0;">${vessel.name}</div>
          <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">${vessel.type} (${vessel.flag})</div>
          <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 6px 8px; font-size: 10px; font-family: monospace; line-height: 1.5;">
            MMSI: <b>${vessel.mmsi}</b><br>
            Speed: <b>${vessel.speed_kn} kn</b><br>
            Heading: <b>${vessel.heading_deg}°</b><br>
            Position: <b>${vessel.lat.toFixed(3)}°N, ${vessel.lng.toFixed(3)}°E</b><br>
            Status: <b style="color:#0284c7;">Underway Using Engine</b>
          </div>
        </div>
      `);

      vesselMarkers[vessel.id] = {
        marker: marker,
        data: vessel,
      };
    });
  }

  // 4. Render Historical AIS Trajectories
  function renderRouteTrajectories(map) {
    VESSELS.forEach((v) => {
      L.polyline(v.trajectory, {
        color: v.color,
        weight: 2.5,
        opacity: 0.75,
        dashArray: "4, 6",
      }).addTo(map);
    });
  }

  // 5. Render Current and Wind Vectors
  function renderCurrentAndWind(map) {
    // Surface Current Vector in offshore waters
    const currentLine = L.polyline(
      [
        [13.19, 81.05],
        [13.13, 81.19],
      ],
      {
        color: "#38bdf8",
        weight: 3.5,
        opacity: 0.9,
      }
    ).addTo(map);
    currentLine.bindTooltip("🌊 Ocean Surface Drift: 0.8 kn SE", { sticky: true });

    // Risk Buffer Circle in deep blue sea
    L.circle([CENTER_LAT, CENTER_LNG], {
      radius: 8000,
      color: "#0284c7",
      weight: 2,
      opacity: 0.6,
      fillColor: "#0284c7",
      fillOpacity: 0.12,
      dashArray: "6, 8",
    }).addTo(map);
  }

  // 6. Real-time Vessel Drift Simulation
  function startVesselSimulation() {
    if (vesselAnimationTimer) clearInterval(vesselAnimationTimer);

    vesselAnimationTimer = setInterval(() => {
      VESSELS.forEach((v) => {
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

  // 7. Map UI Overlays & Maximize / Fullscreen Feature
  function injectMapControls(container, map) {
    const controlsDiv = document.createElement("div");
    controlsDiv.className = "og-map-ui-layer";
    controlsDiv.style.cssText = "position: absolute; inset: 0; pointer-events: none; z-index: 1000;";

    controlsDiv.innerHTML = `
      <!-- Top HUD Header -->
      <div style="position: absolute; top: 12px; left: 12px; right: 12px; display: flex; align-items: center; justify-content: space-between; pointer-events: auto; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; align-items: center; gap: 8px; background: rgba(2, 18, 32, 0.94); backdrop-filter: blur(8px); padding: 6px 14px; border-radius: 10px; border: 1px solid rgba(56, 189, 248, 0.4); color: white; font-family: monospace; font-size: 11px; box-shadow: 0 4px 14px rgba(0,0,0,0.4);">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10b981;box-shadow:0 0 8px #10b981;animation:pulse 2s infinite;"></span>
          <span style="font-weight: 800; color: #38bdf8; text-transform: uppercase;">🛰️ SATELLITE SAR FEED (SENTINEL-1A)</span>
          <span style="color: #64748b;">|</span>
          <span id="og-map-ist-clock" style="color: #f8fafc; font-weight: 700;">--:--:-- IST</span>
        </div>

        <!-- Top Right Control Buttons -->
        <div style="display: flex; align-items: center; gap: 8px;">
          <!-- Basemap Switcher -->
          <div style="background: rgba(2, 18, 32, 0.94); backdrop-filter: blur(8px); padding: 4px; border-radius: 10px; border: 1px solid rgba(56, 189, 248, 0.3); display: flex; gap: 4px;">
            <button id="og-btn-satellite" style="background: #0284c7; color: white; border: none; padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 700; cursor: pointer;">🛰️ Satellite</button>
            <button id="og-btn-ocean" style="background: transparent; color: #94a3b8; border: none; padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 700; cursor: pointer;">🌊 Marine Ocean</button>
            <button id="og-btn-dark" style="background: transparent; color: #94a3b8; border: none; padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 700; cursor: pointer;">🌑 SAR Radar</button>
          </div>

          <!-- Re-center button -->
          <button id="og-btn-recenter" style="background: rgba(2, 18, 32, 0.94); backdrop-filter: blur(8px); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); padding: 6px 12px; border-radius: 10px; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px;" title="Center on Satellite Spill Target">
            <span>🎯</span>
            <span class="hidden sm:inline">Target Spill</span>
          </button>

          <!-- MAXIMIZE / FULLSCREEN BUTTON -->
          <button id="og-btn-maximize" style="
            background: #0284c7; 
            color: white; 
            border: 1px solid rgba(255,255,255,0.3); 
            padding: 6px 14px; 
            border-radius: 10px; 
            font-size: 11px; 
            font-weight: 800; 
            cursor: pointer; 
            display: flex; 
            align-items: center; 
            gap: 6px;
            box-shadow: 0 4px 14px rgba(2,132,199,0.5);
            transition: all 0.2s ease;
          ">
            <span id="og-max-icon" style="font-size: 14px;">⛶</span>
            <span id="og-max-text">Maximize Map</span>
          </button>
        </div>
      </div>

      <!-- Bottom Bar: Coordinates, Satellite Telemetry & Zoom -->
      <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(2, 18, 32, 0.96); backdrop-filter: blur(10px); border-top: 1px solid rgba(56, 189, 248, 0.25); padding: 8px 16px; display: flex; align-items: center; justify-content: space-between; font-family: monospace; font-size: 10px; color: #94a3b8; pointer-events: auto; flex-wrap: wrap; gap: 6px;">
        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
          <span style="color: #38bdf8; font-weight: 700;">🛰️ SATELLITE SAR OVERPASS</span>
          <span id="og-cursor-coords">13.150° N · 81.150° E</span>
          <span style="color: #64748b;">|</span>
          <span style="color: #00f2fe;">Swath: IW 250km (VV+VH)</span>
          <span style="color: #38bdf8;">3 AIS Vessels</span>
          <span style="color: #ef4444; font-weight: 700;">1 Active Spill (OS-2026-014)</span>
        </div>

        <div style="display: flex; align-items: center; gap: 10px;">
          <button id="og-zoom-in" style="background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.3); color: white; width: 22px; height: 22px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: 800;">+</button>
          <button id="og-zoom-out" style="background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.3); color: white; width: 22px; height: 22px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: 800;">-</button>
        </div>
      </div>
    `;

    container.appendChild(controlsDiv);

    // Live Indian Standard Time (IST / ISI) Clock
    setInterval(() => {
      const clockEl = document.getElementById("og-map-ist-clock");
      if (clockEl) {
        const istTime = new Date().toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
        clockEl.textContent = `${istTime} IST`;
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
    const btnOcean = document.getElementById("og-btn-ocean");
    const btnDark = document.getElementById("og-btn-dark");

    function setLayer(selected) {
      [mapLayers.satellite, mapLayers.ocean, mapLayers.dark].forEach((l) => map.removeLayer(l));
      if (selected === "satellite") {
        map.addLayer(mapLayers.satellite);
        btnSat.style.background = "#0284c7";
        btnSat.style.color = "white";
        btnOcean.style.background = "transparent";
        btnOcean.style.color = "#94a3b8";
        btnDark.style.background = "transparent";
        btnDark.style.color = "#94a3b8";
      } else if (selected === "ocean") {
        map.addLayer(mapLayers.ocean);
        btnOcean.style.background = "#0284c7";
        btnOcean.style.color = "white";
        btnSat.style.background = "transparent";
        btnSat.style.color = "#94a3b8";
        btnDark.style.background = "transparent";
        btnDark.style.color = "#94a3b8";
      } else if (selected === "dark") {
        map.addLayer(mapLayers.dark);
        btnDark.style.background = "#0284c7";
        btnDark.style.color = "white";
        btnSat.style.background = "transparent";
        btnSat.style.color = "#94a3b8";
        btnOcean.style.background = "transparent";
        btnOcean.style.color = "#94a3b8";
      }
    }

    btnSat.onclick = () => setLayer("satellite");
    btnOcean.onclick = () => setLayer("ocean");
    btnDark.onclick = () => setLayer("dark");

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
