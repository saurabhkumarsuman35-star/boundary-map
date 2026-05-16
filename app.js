const SAMPLE_LOCATIONS = [
  { pincode: "110001", city: "New Delhi", town: "New Delhi", district: "Central Delhi", locality: "Connaught Place", lat: 28.6304, lng: 77.2177 },
  { pincode: "110016", city: "New Delhi", town: "New Delhi", district: "South Delhi", locality: "Hauz Khas", lat: 28.5494, lng: 77.2001 },
  { pincode: "122001", city: "Gurugram", town: "Gurugram", district: "Gurugram", locality: "Sector 29", lat: 28.4673, lng: 77.0646 },
  { pincode: "201301", city: "Noida", town: "Noida", district: "Gautam Buddh Nagar", locality: "Sector 18", lat: 28.5708, lng: 77.3261 },
  { pincode: "400001", city: "Mumbai", town: "Mumbai", district: "Mumbai City", locality: "Fort", lat: 18.9352, lng: 72.8356 },
  { pincode: "400050", city: "Mumbai", town: "Mumbai", district: "Mumbai Suburban", locality: "Bandra West", lat: 19.0596, lng: 72.8295 },
  { pincode: "411001", city: "Pune", town: "Pune", district: "Pune", locality: "Camp", lat: 18.5167, lng: 73.8762 },
  { pincode: "560001", city: "Bengaluru", town: "Bengaluru", district: "Bengaluru Urban", locality: "MG Road", lat: 12.9757, lng: 77.6046 },
  { pincode: "560034", city: "Bengaluru", town: "Bengaluru", district: "Bengaluru Urban", locality: "Koramangala", lat: 12.9352, lng: 77.6245 },
  { pincode: "600017", city: "Chennai", town: "Chennai", district: "Chennai", locality: "T Nagar", lat: 13.0418, lng: 80.2341 },
  { pincode: "700016", city: "Kolkata", town: "Kolkata", district: "Kolkata", locality: "Park Street", lat: 22.5535, lng: 88.3525 },
  { pincode: "500081", city: "Hyderabad", town: "Hyderabad", district: "Hyderabad", locality: "Madhapur", lat: 17.4483, lng: 78.3915 },
  { pincode: "380009", city: "Ahmedabad", town: "Ahmedabad", district: "Ahmedabad", locality: "Navrangpura", lat: 23.0365, lng: 72.5611 },
  { pincode: "302001", city: "Jaipur", town: "Jaipur", district: "Jaipur", locality: "Bapu Bazar", lat: 26.9163, lng: 75.8198 },
  { pincode: "682001", city: "Kochi", town: "Kochi", district: "Ernakulam", locality: "Fort Kochi", lat: 9.9658, lng: 76.2421 }
];

const map = L.map("map", { zoomControl: false }).setView([22.9734, 78.6569], 5);
L.control.zoom({ position: "bottomright" }).addTo(map);

const tileServices = {
  "OpenStreetMap": L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }),
  "Carto Light": L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 20,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
  }),
  "Carto Voyager": L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    maxZoom: 20,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
  }),
  "Esri Satellite": L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 19,
    attribution: "Tiles &copy; Esri"
  })
};

tileServices.OpenStreetMap.addTo(map);
L.control.layers(tileServices, null, { position: "topright" }).addTo(map);

const polygonLayer = L.featureGroup().addTo(map);
const pinLayer = L.featureGroup().addTo(map);
const draftLayer = L.layerGroup().addTo(map);
const handleLayer = L.layerGroup().addTo(map);
const POLYGON_STORAGE_KEY = "editable-area-map-polygons";
const MARKER_STORAGE_KEY = "editable-area-map-markers";

let locations = [...SAMPLE_LOCATIONS];
let drawMode = false;
let pinPlacementMode = false;
let draftPoints = [];
let draftLine = null;
let selectedPolygon = null;
let selectedMarker = null;
let installPrompt = null;

const els = {
  searchInput: document.querySelector("#searchInput"),
  searchButton: document.querySelector("#searchButton"),
  searchResults: document.querySelector("#searchResults"),
  installApp: document.querySelector("#installApp"),
  startPolygon: document.querySelector("#startPolygon"),
  finishPolygon: document.querySelector("#finishPolygon"),
  savePolygon: document.querySelector("#savePolygon"),
  cancelPolygon: document.querySelector("#cancelPolygon"),
  deletePolygon: document.querySelector("#deletePolygon"),
  polygonName: document.querySelector("#polygonName"),
  savedPolygons: document.querySelector("#savedPolygons"),
  drawStatus: document.querySelector("#drawStatus"),
  pinPincode: document.querySelector("#pinPincode"),
  pinCity: document.querySelector("#pinCity"),
  pinDistrict: document.querySelector("#pinDistrict"),
  pinLocality: document.querySelector("#pinLocality"),
  addPinMode: document.querySelector("#addPinMode"),
  saveMarker: document.querySelector("#saveMarker"),
  removeMarker: document.querySelector("#removeMarker"),
  markerStatus: document.querySelector("#markerStatus"),
  importInput: document.querySelector("#importInput"),
  importLocations: document.querySelector("#importLocations"),
  importStatus: document.querySelector("#importStatus"),
  exportGeojson: document.querySelector("#exportGeojson"),
  clearPins: document.querySelector("#clearPins"),
  geojsonOutput: document.querySelector("#geojsonOutput")
};

const vertexIcon = L.divIcon({ className: "vertex-handle", iconSize: [14, 14] });
const pinIcon = L.divIcon({ className: "pin-badge", iconSize: [30, 30], iconAnchor: [15, 30] });

function setStatus(text) {
  els.drawStatus.textContent = text;
}

function refreshControls() {
  els.finishPolygon.disabled = draftPoints.length < 3;
  els.savePolygon.disabled = !selectedPolygon;
  els.cancelPolygon.disabled = !drawMode && draftPoints.length === 0;
  els.deletePolygon.disabled = !selectedPolygon;
  els.startPolygon.disabled = drawMode || pinPlacementMode;
  els.addPinMode.disabled = drawMode || pinPlacementMode;
  els.saveMarker.disabled = !selectedMarker;
  els.removeMarker.disabled = !selectedMarker;
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function popupHtml(place) {
  const town = place.town || place.city || "";
  const district = place.district || "";
  return `
    <strong>${escapeHtml(place.locality)}</strong><br>
    ${escapeHtml(town)}${district ? `, ${escapeHtml(district)}` : ""}<br>
    Pincode: ${escapeHtml(place.pincode)}
  `;
}

function markerId() {
  return `marker-${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

function normalizePlace(place) {
  const town = place.town || place.city || "";
  return {
    id: place.id || markerId(),
    pincode: String(place.pincode || "").trim(),
    city: String(place.city || town).trim(),
    town: String(town).trim(),
    district: String(place.district || "").trim(),
    locality: String(place.locality || "").trim(),
    lat: Number(place.lat),
    lng: Number(place.lng)
  };
}

function addPin(place, flyTo = false, managed = true) {
  const normalized = normalizePlace(place);
  if (Number.isNaN(normalized.lat) || Number.isNaN(normalized.lng)) return null;

  const marker = L.marker([normalized.lat, normalized.lng], { icon: pinIcon, draggable: true }).addTo(pinLayer);
  marker.place = normalized;
  marker.managed = managed;
  marker.bindPopup(popupHtml(normalized));
  marker.on("click", () => selectMarker(marker));
  marker.on("dragend", () => {
    const position = marker.getLatLng();
    marker.place.lat = Number(position.lat.toFixed(6));
    marker.place.lng = Number(position.lng.toFixed(6));
    updateMarkerForm(marker);
    if (marker.managed) persistMarkers();
  });

  if (flyTo) {
    map.setView([normalized.lat, normalized.lng], 14);
    marker.openPopup();
    selectMarker(marker);
  }

  return marker;
}

function selectedMarkerRecords() {
  return pinLayer.getLayers()
    .filter((marker) => marker.managed)
    .map((marker) => ({ ...marker.place }));
}

function persistMarkers() {
  localStorage.setItem(MARKER_STORAGE_KEY, JSON.stringify(selectedMarkerRecords()));
}

function loadSavedMarkers() {
  const stored = localStorage.getItem(MARKER_STORAGE_KEY);
  if (!stored) return;

  try {
    JSON.parse(stored).forEach((place) => {
      const marker = addPin(place, false, true);
      if (marker) locations.push(marker.place);
    });
  } catch (error) {
    localStorage.removeItem(MARKER_STORAGE_KEY);
  }
}

function updateMarkerForm(marker) {
  const place = marker.place || {};
  const position = marker.getLatLng();
  els.pinPincode.value = place.pincode || "";
  els.pinCity.value = place.town || place.city || "";
  els.pinDistrict.value = place.district || "";
  els.pinLocality.value = place.locality || "";
  els.markerStatus.textContent = `${Number(position.lat).toFixed(4)}, ${Number(position.lng).toFixed(4)}`;
}

function clearMarkerSelection() {
  selectedMarker = null;
  els.markerStatus.textContent = "No marker";
  refreshControls();
}

function selectMarker(marker) {
  selectedMarker = marker;
  updateMarkerForm(marker);
  refreshControls();
}

function renderResults(results) {
  els.searchResults.innerHTML = "";

  if (!results.length) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = "No local match found. Add it as a pin by filling the pincode, city, and locality fields.";
    els.searchResults.appendChild(empty);
    return;
  }

  results.forEach((place) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "result-card";
    button.innerHTML = `
      <strong>${place.locality}, ${place.city}</strong>
      <span>${place.pincode} · ${place.lat.toFixed(4)}, ${place.lng.toFixed(4)}</span>
    `;
    button.addEventListener("click", () => addPin(place, true));
    els.searchResults.appendChild(button);
  });
}

function searchLocations() {
  const query = normalize(els.searchInput.value);
  if (!query) {
    renderResults(locations.slice(0, 8));
    return;
  }

  const results = locations
    .filter((place) => {
      return [place.pincode, place.city, place.locality].some((field) => normalize(field).includes(query));
    })
    .slice(0, 12);

  renderResults(results);
}

function clearDraft() {
  draftPoints = [];
  draftLayer.clearLayers();
  draftLine = null;
}

function polygonId() {
  return `polygon-${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

function polygonPoints(polygon) {
  return polygon.getLatLngs()[0].map((point) => ({
    lat: Number(point.lat.toFixed(6)),
    lng: Number(point.lng.toFixed(6))
  }));
}

function savedPolygonRecords() {
  return polygonLayer.getLayers().map((polygon, index) => ({
    id: polygon.savedId || polygonId(),
    name: polygon.savedName || `Polygon ${index + 1}`,
    points: polygonPoints(polygon)
  }));
}

function persistPolygons() {
  localStorage.setItem(POLYGON_STORAGE_KEY, JSON.stringify(savedPolygonRecords()));
  renderSavedPolygons();
}

function polygonPopup(name) {
  return `<strong>${escapeHtml(name)}</strong><br>Select it to edit, then click Save polygon.`;
}

function createPolygon(points, options = {}) {
  const polygon = L.polygon(points, {
    color: "#0e7c66",
    weight: 3,
    fillColor: "#18a88c",
    fillOpacity: 0.2
  }).addTo(polygonLayer);

  polygon.savedId = options.id || polygonId();
  polygon.savedName = options.name || "Unsaved polygon";
  polygon.bindPopup(polygonPopup(polygon.savedName));
  polygon.on("click", (event) => {
    L.DomEvent.stopPropagation(event);
    selectPolygon(polygon);
  });

  return polygon;
}

function startPolygon() {
  drawMode = true;
  pinPlacementMode = false;
  clearDraft();
  clearSelection();
  setStatus("Drawing");
  refreshControls();
}

function cancelPolygon() {
  drawMode = false;
  clearDraft();
  setStatus("Idle");
  refreshControls();
}

function redrawDraft() {
  draftLayer.clearLayers();
  draftPoints.forEach((point) => L.circleMarker(point, {
    radius: 5,
    color: "#075f4d",
    fillColor: "#0e7c66",
    fillOpacity: 1
  }).addTo(draftLayer));

  if (draftPoints.length > 1) {
    draftLine = L.polyline(draftPoints, {
      color: "#0e7c66",
      weight: 3,
      dashArray: "6 6"
    }).addTo(draftLayer);
  }
}

function finishPolygon() {
  if (draftPoints.length < 3) return;

  const polygon = createPolygon(draftPoints, {
    name: els.polygonName.value.trim() || `Polygon ${polygonLayer.getLayers().length + 1}`
  });

  clearDraft();
  drawMode = false;
  selectPolygon(polygon);
  setStatus("Selected");
  refreshControls();
}

function clearSelection() {
  if (selectedPolygon) {
    selectedPolygon.setStyle({ color: "#0e7c66", fillOpacity: 0.2 });
  }

  selectedPolygon = null;
  handleLayer.clearLayers();
  refreshControls();
}

function selectPolygon(polygon) {
  clearSelection();
  selectedPolygon = polygon;
  els.polygonName.value = selectedPolygon.savedName || "";
  selectedPolygon.setStyle({ color: "#d14c2f", fillOpacity: 0.28 });
  renderHandles();
  setStatus("Editing");
  refreshControls();
}

function renderHandles() {
  handleLayer.clearLayers();
  if (!selectedPolygon) return;

  const points = selectedPolygon.getLatLngs()[0];
  points.forEach((point, index) => {
    const handle = L.marker(point, {
      icon: vertexIcon,
      draggable: true,
      keyboard: false
    }).addTo(handleLayer);

    handle.on("drag", () => {
      points[index] = handle.getLatLng();
      selectedPolygon.setLatLngs([points]);
    });

    handle.on("dragend", () => {
      persistPolygons();
    });
  });
}

function saveSelectedPolygon() {
  if (!selectedPolygon) return;
  selectedPolygon.savedName = els.polygonName.value.trim() || selectedPolygon.savedName || "Saved polygon";
  selectedPolygon.setPopupContent(polygonPopup(selectedPolygon.savedName));
  persistPolygons();
  setStatus("Saved");
}

function deleteSelectedPolygon() {
  if (!selectedPolygon) return;
  polygonLayer.removeLayer(selectedPolygon);
  selectedPolygon = null;
  handleLayer.clearLayers();
  els.polygonName.value = "";
  persistPolygons();
  setStatus("Idle");
  refreshControls();
}

function renderSavedPolygons() {
  const polygons = polygonLayer.getLayers();
  els.savedPolygons.innerHTML = "";

  if (!polygons.length) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = "No saved polygons yet";
    els.savedPolygons.appendChild(empty);
    return;
  }

  polygons.forEach((polygon, index) => {
    const card = document.createElement("div");
    card.className = "saved-card";

    const text = document.createElement("div");
    const name = document.createElement("strong");
    const count = document.createElement("span");
    const button = document.createElement("button");

    name.textContent = polygon.savedName || `Polygon ${index + 1}`;
    count.textContent = `${polygon.getLatLngs()[0].length} points`;
    button.type = "button";
    button.textContent = "Edit";
    button.addEventListener("click", () => {
      selectPolygon(polygon);
      map.fitBounds(polygon.getBounds(), { padding: [30, 30] });
    });

    text.append(name, count);
    card.append(text, button);
    els.savedPolygons.appendChild(card);
  });
}

function loadSavedPolygons() {
  const stored = localStorage.getItem(POLYGON_STORAGE_KEY);
  if (!stored) {
    renderSavedPolygons();
    return;
  }

  try {
    JSON.parse(stored).forEach((record) => {
      if (Array.isArray(record.points) && record.points.length >= 3) {
        createPolygon(record.points, { id: record.id, name: record.name });
      }
    });
  } catch (error) {
    localStorage.removeItem(POLYGON_STORAGE_KEY);
  }

  renderSavedPolygons();
}

function enablePinPlacement() {
  const pincode = els.pinPincode.value.trim();
  const city = els.pinCity.value.trim();
  const district = els.pinDistrict.value.trim();
  const locality = els.pinLocality.value.trim();

  if (!pincode || !city || !district || !locality) {
    setStatus("Fill pin fields");
    els.markerStatus.textContent = "Fill all fields";
    return;
  }

  pinPlacementMode = true;
  drawMode = false;
  clearDraft();
  clearSelection();
  setStatus("Click map");
  refreshControls();
}

function placeCustomPin(latlng) {
  const place = {
    pincode: els.pinPincode.value.trim(),
    city: els.pinCity.value.trim(),
    town: els.pinCity.value.trim(),
    district: els.pinDistrict.value.trim(),
    locality: els.pinLocality.value.trim(),
    lat: Number(latlng.lat.toFixed(6)),
    lng: Number(latlng.lng.toFixed(6))
  };

  locations.push(place);
  const marker = addPin(place, false, true);
  if (marker) {
    selectMarker(marker);
    marker.openPopup();
    persistMarkers();
  }
  pinPlacementMode = false;
  setStatus("Idle");
  refreshControls();
}

function saveSelectedMarker() {
  if (!selectedMarker) return;
  const position = selectedMarker.getLatLng();
  selectedMarker.place = normalizePlace({
    ...selectedMarker.place,
    pincode: els.pinPincode.value.trim(),
    city: els.pinCity.value.trim(),
    town: els.pinCity.value.trim(),
    district: els.pinDistrict.value.trim(),
    locality: els.pinLocality.value.trim(),
    lat: Number(position.lat.toFixed(6)),
    lng: Number(position.lng.toFixed(6))
  });
  selectedMarker.managed = true;
  selectedMarker.setPopupContent(popupHtml(selectedMarker.place));
  locations = [...locations.filter((place) => place.id !== selectedMarker.place.id), selectedMarker.place];
  persistMarkers();
  searchLocations();
  els.markerStatus.textContent = "Saved";
}

function removeSelectedMarker() {
  if (!selectedMarker) return;
  const removedId = selectedMarker.place && selectedMarker.place.id;
  pinLayer.removeLayer(selectedMarker);
  locations = locations.filter((place) => place.id !== removedId);
  persistMarkers();
  clearMarkerSelection();
  els.geojsonOutput.value = "";
  els.markerStatus.textContent = "Removed";
}

function exportGeojson() {
  const pins = [];
  pinLayer.eachLayer((marker) => {
    const place = marker.place || {};
    pins.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [marker.getLatLng().lng, marker.getLatLng().lat]
      },
      properties: {
        pincode: place.pincode || "",
        city: place.city || "",
        town: place.town || place.city || "",
        district: place.district || "",
        locality: place.locality || ""
      }
    });
  });

  const polygons = [];
  polygonLayer.eachLayer((polygon) => {
    const coords = polygon.getLatLngs()[0].map((point) => [point.lng, point.lat]);
    if (coords.length) coords.push(coords[0]);
    polygons.push({
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [coords]
      },
      properties: {
        type: "editable-polygon"
      }
    });
  });

  els.geojsonOutput.value = JSON.stringify({
    type: "FeatureCollection",
    features: [...pins, ...polygons]
  }, null, 2);
}

function parseLocationRows(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(",").map((item) => item.trim()))
    .map((parts) => {
      if (parts.length >= 6) {
        const [pincode, city, district, locality, lat, lng] = parts;
        return { pincode, city, town: city, district, locality, lat: Number(lat), lng: Number(lng) };
      }
      const [pincode, city, locality, lat, lng] = parts;
      return { pincode, city, town: city, district: "", locality, lat: Number(lat), lng: Number(lng) };
    })
    .filter((place) => place.pincode && place.city && place.locality && !Number.isNaN(place.lat) && !Number.isNaN(place.lng));
}

function importLocations() {
  const imported = parseLocationRows(els.importInput.value);
  if (!imported.length) {
    els.importStatus.textContent = "No valid rows found";
    return;
  }

  locations = [...locations, ...imported];
  imported.forEach((place) => addPin(place, false, true));
  persistMarkers();
  els.importStatus.textContent = `${imported.length} row${imported.length === 1 ? "" : "s"} imported`;
  searchLocations();
}

function renderResults(results) {
  els.searchResults.innerHTML = "";

  if (!results.length) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = "No local match found. Add it as a marker by filling the pincode, town, district, and locality fields.";
    els.searchResults.appendChild(empty);
    return;
  }

  results.forEach((place) => {
    const button = document.createElement("button");
    const town = place.town || place.city || "";
    const district = place.district || "District not set";
    button.type = "button";
    button.className = "result-card";
    button.innerHTML = `
      <strong>${escapeHtml(place.locality)}, ${escapeHtml(town)}</strong>
      <span>${escapeHtml(place.pincode)} | ${escapeHtml(district)} | ${place.lat.toFixed(4)}, ${place.lng.toFixed(4)}</span>
    `;
    button.addEventListener("click", () => {
      const marker = addPin(place, true, true);
      if (marker) persistMarkers();
    });
    els.searchResults.appendChild(button);
  });
}

function searchTokens(value) {
  const raw = String(value || "").trim();
  if (!raw) return [];
  const commaTokens = raw.split(/[,;\n]+/).map((item) => normalize(item)).filter(Boolean);
  if (commaTokens.length > 1) return commaTokens;

  const spaceTokens = raw.split(/\s+/).map((item) => normalize(item)).filter(Boolean);
  if (spaceTokens.length > 1 && spaceTokens.every((item) => /^\d{3,6}$/.test(item))) {
    return spaceTokens;
  }

  return [normalize(raw)];
}

function searchableFields(place) {
  return [
    place.pincode,
    place.city,
    place.town,
    place.locality,
    place.district
  ].map(normalize);
}

function searchLocations() {
  const tokens = searchTokens(els.searchInput.value);
  if (!tokens.length) {
    renderResults(locations.slice(0, 8));
    return;
  }

  const results = locations
    .filter((place) => {
      const fields = searchableFields(place);
      return tokens.some((token) => fields.some((field) => field.includes(token)));
    })
    .slice(0, 30);

  renderResults(results);
}

els.searchButton.addEventListener("click", searchLocations);
els.searchInput.addEventListener("input", searchLocations);
els.startPolygon.addEventListener("click", startPolygon);
els.finishPolygon.addEventListener("click", finishPolygon);
els.savePolygon.addEventListener("click", saveSelectedPolygon);
els.cancelPolygon.addEventListener("click", cancelPolygon);
els.deletePolygon.addEventListener("click", deleteSelectedPolygon);
els.addPinMode.addEventListener("click", enablePinPlacement);
els.saveMarker.addEventListener("click", saveSelectedMarker);
els.removeMarker.addEventListener("click", removeSelectedMarker);
els.importLocations.addEventListener("click", importLocations);
els.exportGeojson.addEventListener("click", exportGeojson);
els.clearPins.addEventListener("click", () => {
  pinLayer.clearLayers();
  persistMarkers();
  clearMarkerSelection();
  els.geojsonOutput.value = "";
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  els.installApp.hidden = false;
});

els.installApp.addEventListener("click", async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  els.installApp.hidden = true;
});

map.on("click", (event) => {
  if (drawMode) {
    draftPoints.push(event.latlng);
    redrawDraft();
    refreshControls();
    return;
  }

  if (pinPlacementMode) {
    placeCustomPin(event.latlng);
    return;
  }

  clearSelection();
  setStatus("Idle");
});

locations.slice(0, 5).forEach((place) => addPin(place, false, false));
loadSavedMarkers();
loadSavedPolygons();
renderResults(locations.slice(0, 8));
refreshControls();
