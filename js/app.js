/**
 * Multi-Stop 3D Navigation Controller for GTA San Andreas
 */

let map = null;
let graph = null;
let rawData = null;

let waypoints = []; // Array of { marker, snapNode, gtaCoords, label }
let routeLegs = []; // Array of A* segment results [A->B, B->C, ...]
let routePolylines = [];
let debugLayerGroup = null;
let showDebugGraph = false;

let currentAlternativeRoutes = [];
let activeAltRouteIndex = 0;

document.addEventListener('DOMContentLoaded', async () => {
  initMap();
  await loadGraphData('data/san_andreas_official_nodes.json');
  setupUIEvents();
});

function initMap() {
  map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: GTA_MAP_CONFIG.defaultView.minZoom,
    maxZoom: GTA_MAP_CONFIG.defaultView.maxZoom,
    zoomControl: false,
    attributionControl: false
  });

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // Load Ultra HD (6144x6144 px) San Andreas Map Image
  L.imageOverlay(GTA_MAP_CONFIG.imagePath, GTA_MAP_CONFIG.bounds).addTo(map);

  // Initial view centered on the entire state of San Andreas
  map.setView(
    GTA_MAP_CONFIG.defaultView.center,
    GTA_MAP_CONFIG.defaultView.zoom
  );

  debugLayerGroup = L.layerGroup().addTo(map);

  // Live coordinate tracker control
  const coordDisplay = L.control({ position: 'bottomleft' });
  coordDisplay.onAdd = function() {
    const div = L.DomUtil.create('div', 'coord-display');
    div.id = 'coord-display';
    div.innerHTML = '📍 <strong>X:</strong> 0 | <strong>Y:</strong> 0';
    return div;
  };
  coordDisplay.addTo(map);

  map.on('mousemove', (e) => {
    const gta = GTA_MAP_CONFIG.latLngToGta(e.latlng);
    const el = document.getElementById('coord-display');
    if (el) el.innerHTML = `📍 <strong>X:</strong> ${gta.x} | <strong>Y:</strong> ${gta.y}`;
  });

  map.on('click', handleMapClick);
}

async function loadGraphData(datasetUrl) {
  const badge = document.querySelector('.badge');
  if (badge) badge.textContent = 'Loading network...';

  try {
    const response = await fetch(`${datasetUrl}?v=${Date.now()}`);
    rawData = await response.json();
    graph = new RoadGraph(rawData);
    console.log(`Official graph loaded: ${graph.nodes.size} nodes.`);
    if (badge) badge.textContent = `${graph.nodes.size.toLocaleString()} Nodes`;
  } catch (error) {
    console.error('Error loading official road nodes:', error);
    if (badge) badge.textContent = 'Error';
  }
}

function getWaypointLabel(index) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (index < letters.length) return letters[index];
  return `P${index + 1}`;
}

function handleMapClick(e) {
  if (!graph) return;
  const gtaCoords = GTA_MAP_CONFIG.latLngToGta(e.latlng);
  addWaypoint(gtaCoords);
}

function createCustomPin(label, pinClass) {
  return L.divIcon({
    className: '',
    html: `<div class="custom-pin ${pinClass}"><span>${label}</span></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28]
  });
}

function updateMarkerVisuals() {
  const total = waypoints.length;
  waypoints.forEach((wp, idx) => {
    wp.label = getWaypointLabel(idx);
    let pinClass = 'pin-waypoint';
    if (idx === 0) pinClass = 'pin-start';
    else if (idx === total - 1) pinClass = 'pin-end';

    wp.marker.setIcon(createCustomPin(wp.label, pinClass));
  });
}

function addWaypoint(coords) {
  const nearest = graph.findNearestNode(coords.x, coords.y);
  const snapNode = nearest.node;
  const latlng = GTA_MAP_CONFIG.gtaToLatLng(coords.x, coords.y);
  const index = waypoints.length;
  const label = getWaypointLabel(index);

  let pinClass = 'pin-end';
  if (index === 0) pinClass = 'pin-start';

  const marker = L.marker(latlng, {
    draggable: true,
    icon: createCustomPin(label, pinClass)
  }).addTo(map);

  const waypointObj = {
    marker,
    snapNode,
    gtaCoords: coords,
    label
  };

  marker.on('dragend', (ev) => {
    const pos = GTA_MAP_CONFIG.latLngToGta(ev.target.getLatLng());
    waypointObj.gtaCoords = pos;
    waypointObj.snapNode = graph.findNearestNode(pos.x, pos.y).node;
    renderWaypointsList();
    calculateAndRenderMultiRoute();
  });

  waypoints.push(waypointObj);
  updateMarkerVisuals();
  renderWaypointsList();

  if (waypoints.length >= 2) {
    calculateAndRenderMultiRoute();
  }
}

function removeWaypoint(index) {
  if (index < 0 || index >= waypoints.length) return;

  const [removed] = waypoints.splice(index, 1);
  if (removed && removed.marker) {
    map.removeLayer(removed.marker);
  }

  updateMarkerVisuals();
  renderWaypointsList();

  if (waypoints.length >= 2) {
    calculateAndRenderMultiRoute();
  } else {
    routePolylines.forEach(p => map.removeLayer(p));
    routePolylines = [];
    document.getElementById('routes-list').innerHTML = `
      <div class="instruction-hint">
        💡 Click on the map to set the next waypoint (A, B, C...).
      </div>
    `;
  }
}

function renderWaypointsList() {
  const container = document.getElementById('waypoints-container');
  container.innerHTML = '';

  const total = waypoints.length;
  waypoints.forEach((wp, idx) => {
    const card = document.createElement('div');
    card.className = 'point-card';

    let indClass = 'indicator-waypoint';
    let roleText = `Stop ${wp.label}`;
    if (idx === 0) {
      indClass = 'indicator-start';
      roleText = 'Origin (Start)';
    } else if (idx === total - 1 && total > 1) {
      indClass = 'indicator-end';
      roleText = 'Final Destination';
    }

    card.innerHTML = `
      <div class="point-indicator ${indClass}">${wp.label}</div>
      <div class="point-text">
        <span class="point-label">${roleText}</span>
        <span class="point-val">X: ${wp.snapNode.x}, Y: ${wp.snapNode.y}</span>
      </div>
      <button class="btn-remove-point" title="Remove waypoint ${wp.label}">✖</button>
    `;

    card.querySelector('.btn-remove-point').addEventListener('click', (e) => {
      e.stopPropagation();
      removeWaypoint(idx);
    });

    container.appendChild(card);
  });

  if (waypoints.length === 0) {
    container.innerHTML = `
      <div class="instruction-hint" style="margin: 0; width: 100%;">
        Click on the map to set route waypoints.
      </div>
    `;
  }
}

function calculateAndRenderMultiRoute() {
  if (waypoints.length < 2) return;

  const startTime = performance.now();

  // CASE 1: Exactly 2 waypoints (A and B) -> Generate Optimal + Alternative Routes
  if (waypoints.length === 2) {
    const fromNode = waypoints[0].snapNode;
    const toNode = waypoints[1].snapNode;

    currentAlternativeRoutes = graph.findRoutesWithAlternatives(fromNode.id, toNode.id, 3);
    activeAltRouteIndex = 0;

    const elapsed = (performance.now() - startTime).toFixed(1);
    console.log(`Alternative routes calculated in ${elapsed} ms.`);

    renderAlternativeRoutesOnMap();
    renderAlternativeRoutesInPanel();
    return;
  }

  // CASE 2: 3 or more waypoints (A -> B -> C -> D...) -> Multi-Stop Continuous Route
  routeLegs = [];
  let totalDist = 0;
  let totalTime = 0;
  let allPathNodes = [];

  for (let i = 0; i < waypoints.length - 1; i++) {
    const fromNode = waypoints[i].snapNode;
    const toNode = waypoints[i + 1].snapNode;

    const result = graph.findShortestPath(fromNode.id, toNode.id);
    if (result) {
      routeLegs.push({
        fromLabel: waypoints[i].label,
        toLabel: waypoints[i + 1].label,
        result
      });
      totalDist += result.totalDistance;
      totalTime += result.totalTimeSeconds;
      allPathNodes = allPathNodes.concat(result.path);
    }
  }

  const elapsed = (performance.now() - startTime).toFixed(1);
  console.log(`Multi-stop route calculated in ${elapsed} ms.`);

  renderMultiRouteOnMap(allPathNodes);
  renderMultiRouteInPanel(totalDist, totalTime);
}

function renderAlternativeRoutesOnMap() {
  routePolylines.forEach(p => map.removeLayer(p));
  routePolylines = [];

  if (currentAlternativeRoutes.length === 0) return;

  // Draw alternative routes first (dashed gray, clickable)
  currentAlternativeRoutes.forEach((route, idx) => {
    if (idx === activeAltRouteIndex) return;

    const latlngs = route.path.map(n => GTA_MAP_CONFIG.gtaToLatLng(n.x, n.y));
    const polyline = L.polyline(latlngs, {
      color: '#64748b',
      weight: 6,
      opacity: 0.6,
      dashArray: '6, 8',
      lineCap: 'round'
    }).addTo(map);

    polyline.on('click', () => selectAlternativeRoute(idx));
    routePolylines.push(polyline);
  });

  // Draw selected active route (glowing bright cyan)
  const activeRoute = currentAlternativeRoutes[activeAltRouteIndex];
  if (activeRoute) {
    const latlngs = activeRoute.path.map(n => GTA_MAP_CONFIG.gtaToLatLng(n.x, n.y));

    const glow = L.polyline(latlngs, {
      color: '#0284c7',
      weight: 10,
      opacity: 0.4,
      lineCap: 'round'
    }).addTo(map);
    routePolylines.push(glow);

    const mainLine = L.polyline(latlngs, {
      color: '#38bdf8',
      weight: 5.5,
      opacity: 0.95,
      lineCap: 'round'
    }).addTo(map);
    routePolylines.push(mainLine);
  }
}

function renderAlternativeRoutesInPanel() {
  const container = document.getElementById('routes-list');
  container.innerHTML = '';

  if (currentAlternativeRoutes.length === 0) {
    container.innerHTML = `
      <div class="instruction-hint">
        ⚠️ No road connection found between these points.
      </div>`;
    return;
  }

  currentAlternativeRoutes.forEach((route, idx) => {
    const card = document.createElement('div');
    card.className = `route-card ${idx === activeAltRouteIndex ? 'active' : ''}`;

    const distKm = (route.totalDistance / 1000).toFixed(2);
    const minutes = Math.floor(route.totalTimeSeconds / 60);
    const seconds = route.totalTimeSeconds % 60;
    const timeFormatted = minutes > 0 ? `${minutes} min ${seconds} s` : `${seconds} s`;
    const gain = route.elevationProfile?.elevationGain || 0;
    const loss = route.elevationProfile?.elevationLoss || 0;

    card.innerHTML = `
      <div class="route-title">
        <span>${route.label}</span>
        ${route.isOptimal ? '<span class="badge">Optimal</span>' : ''}
      </div>
      <div class="route-stats">
        <span>📏 <strong>${distKm} km</strong> (3D)</span>
        <span>⏱️ <strong>${timeFormatted}</strong></span>
      </div>
      <div class="route-stats" style="margin-top: 3px; font-size: 11px; color: #94a3b8;">
        <span>⛰️ Elevation: +${gain}m / -${loss}m</span>
      </div>
    `;

    card.addEventListener('click', () => selectAlternativeRoute(idx));
    container.appendChild(card);
  });
}

function selectAlternativeRoute(index) {
  activeAltRouteIndex = index;
  renderAlternativeRoutesOnMap();
  renderAlternativeRoutesInPanel();
}

function renderMultiRouteOnMap(allPathNodes) {
  routePolylines.forEach(p => map.removeLayer(p));
  routePolylines = [];

  if (allPathNodes.length === 0) return;

  const latlngs = allPathNodes.map(n => GTA_MAP_CONFIG.gtaToLatLng(n.x, n.y));

  const glow = L.polyline(latlngs, {
    color: '#0284c7',
    weight: 10,
    opacity: 0.4,
    lineCap: 'round'
  }).addTo(map);
  routePolylines.push(glow);

  const mainLine = L.polyline(latlngs, {
    color: '#38bdf8',
    weight: 5.5,
    opacity: 0.95,
    lineCap: 'round'
  }).addTo(map);
  routePolylines.push(mainLine);
}

function renderMultiRouteInPanel(totalDist, totalTime) {
  const container = document.getElementById('routes-list');
  container.innerHTML = '';

  if (routeLegs.length === 0) {
    container.innerHTML = `
      <div class="instruction-hint">
        ⚠️ No road connection found between some waypoints.
      </div>`;
    return;
  }

  const distKm = (totalDist / 1000).toFixed(2);
  const minutes = Math.floor(totalTime / 60);
  const seconds = totalTime % 60;
  const timeFormatted = minutes > 0 ? `${minutes} min ${seconds} s` : `${seconds} s`;

  let totalGain = 0;
  let totalLoss = 0;
  let minZ = Infinity;
  let maxZ = -Infinity;

  routeLegs.forEach(leg => {
    if (leg.result.elevationProfile) {
      totalGain += leg.result.elevationProfile.elevationGain;
      totalLoss += leg.result.elevationProfile.elevationLoss;
      minZ = Math.min(minZ, leg.result.elevationProfile.minElevation);
      maxZ = Math.max(maxZ, leg.result.elevationProfile.maxElevation);
    }
  });

  const summaryCard = document.createElement('div');
  summaryCard.className = 'route-card active';
  summaryCard.innerHTML = `
    <div class="route-title">
      <span>🏁 Total Route (${waypoints[0].label} ➔ ${waypoints[waypoints.length - 1].label})</span>
      <span class="badge">${waypoints.length} Stops</span>
    </div>
    <div class="route-stats">
      <span>📏 <strong>${distKm} km</strong> (3D)</span>
      <span>⏱️ <strong>${timeFormatted}</strong></span>
    </div>
    <div class="route-stats" style="margin-top: 4px; font-size: 11px; color: #cbd5e1;">
      <span>⛰️ Elevation: <strong>+${totalGain}m / -${totalLoss}m</strong></span>
      <span>🏔️ Altitude: <strong>${minZ}m to ${maxZ}m</strong></span>
    </div>
  `;
  container.appendChild(summaryCard);

  if (routeLegs.length > 1) {
    const detailsContainer = document.createElement('div');
    detailsContainer.style.display = 'flex';
    detailsContainer.style.flexDirection = 'column';
    detailsContainer.style.gap = '6px';
    detailsContainer.style.marginTop = '6px';

    routeLegs.forEach((leg, i) => {
      const legDistKm = (leg.result.totalDistance / 1000).toFixed(2);
      const legMins = Math.floor(leg.result.totalTimeSeconds / 60);
      const legSecs = leg.result.totalTimeSeconds % 60;
      const legTime = legMins > 0 ? `${legMins}m ${legSecs}s` : `${legSecs}s`;
      const gain = leg.result.elevationProfile?.elevationGain || 0;

      const legCard = document.createElement('div');
      legCard.className = 'route-card';
      legCard.style.padding = '8px 10px';
      legCard.innerHTML = `
        <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 600;">
          <span>Leg ${i + 1}: ${leg.fromLabel} ➔ ${leg.toLabel}</span>
          <span style="color: #38bdf8;">${legDistKm} km (${legTime})</span>
        </div>
        <div style="font-size: 10px; color: #94a3b8; margin-top: 3px;">
          Accumulated climb: +${gain}m
        </div>
      `;
      detailsContainer.appendChild(legCard);
    });

    container.appendChild(detailsContainer);
  }
}

function setupUIEvents() {
  document.getElementById('btn-clear').addEventListener('click', () => {
    waypoints.forEach(wp => {
      if (wp.marker) map.removeLayer(wp.marker);
    });
    waypoints = [];
    routeLegs = [];
    routePolylines.forEach(p => map.removeLayer(p));
    routePolylines = [];
    renderWaypointsList();
    document.getElementById('routes-list').innerHTML = `
      <div class="instruction-hint">
        💡 Click on the map to set <strong>Point A</strong> (Start), then <strong>B</strong>, <strong>C</strong>, etc.
      </div>
    `;
  });

  document.getElementById('btn-reverse').addEventListener('click', () => {
    if (waypoints.length < 2) return;
    waypoints.reverse();
    updateMarkerVisuals();
    renderWaypointsList();
    calculateAndRenderMultiRoute();
  });

  document.getElementById('toggle-debug').addEventListener('change', (e) => {
    showDebugGraph = e.target.checked;
    renderDebugGraph();
  });

  const btnFocusAll = document.getElementById('btn-focus-all');
  if (btnFocusAll) {
    btnFocusAll.addEventListener('click', () => {
      map.setView([0, 0], -1);
    });
  }

  const scopeSelect = document.getElementById('select-scope');
  if (scopeSelect) {
    scopeSelect.addEventListener('change', async (e) => {
      const file = e.target.value === 'all'
        ? 'data/san_andreas_official_nodes.json'
        : 'data/san_fierro_official_nodes.json';
      await loadGraphData(file);
      if (showDebugGraph) renderDebugGraph();
      if (waypoints.length >= 2) calculateAndRenderMultiRoute();
    });
  }
}

function renderDebugGraph() {
  debugLayerGroup.clearLayers();
  if (!showDebugGraph || !rawData) return;

  const bounds = map.getBounds();
  const minGta = GTA_MAP_CONFIG.latLngToGta(bounds.getSouthWest());
  const maxGta = GTA_MAP_CONFIG.latLngToGta(bounds.getNorthEast());

  const visibleNodes = rawData.nodes.filter(n =>
    n.x >= minGta.x && n.x <= maxGta.x &&
    n.y >= minGta.y && n.y <= maxGta.y
  );

  visibleNodes.slice(0, 1500).forEach(node => {
    const latlng = GTA_MAP_CONFIG.gtaToLatLng(node.x, node.y);
    L.circleMarker(latlng, {
      radius: 2.5,
      fillColor: '#38bdf8',
      color: '#fff',
      weight: 0.5,
      opacity: 0.8,
      fillOpacity: 0.9
    }).addTo(debugLayerGroup);
  });
}
