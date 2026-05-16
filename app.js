const SAMPLE_LOCATIONS = [
  { pincode: "110001", city: "New Delhi", locality: "Connaught Place", lat: 28.6304, lng: 77.2177 },
  { pincode: "110016", city: "New Delhi", locality: "Hauz Khas", lat: 28.5494, lng: 77.2001 },
  { pincode: "122001", city: "Gurugram", locality: "Sector 29", lat: 28.4673, lng: 77.0646 },
  { pincode: "201301", city: "Noida", locality: "Sector 18", lat: 28.5708, lng: 77.3261 },
  { pincode: "400001", city: "Mumbai", locality: "Fort", lat: 18.9352, lng: 72.8356 },
  { pincode: "400050", city: "Mumbai", locality: "Bandra West", lat: 19.0596, lng: 72.8295 },
  { pincode: "411001", city: "Pune", locality: "Camp", lat: 18.5167, lng: 73.8762 },
  { pincode: "560001", city: "Bengaluru", locality: "MG Road", lat: 12.9757, lng: 77.6046 },
  { pincode: "560034", city: "Bengaluru", locality: "Koramangala", lat: 12.9352, lng: 77.6245 },
  { pincode: "600017", city: "Chennai", locality: "T Nagar", lat: 13.0418, lng: 80.2341 },
  { pincode: "700016", city: "Kolkata", locality: "Park Street", lat: 22.5535, lng: 88.3525 },
  { pincode: "500081", city: "Hyderabad", locality: "Madhapur", lat: 17.4483, lng: 78.3915 },
  { pincode: "380009", city: "Ahmedabad", locality: "Navrangpura", lat: 23.0365, lng: 72.5611 },
  { pincode: "302001", city: "Jaipur", locality: "Bapu Bazar", lat: 26.9163, lng: 75.8198 },
  { pincode: "682001", city: "Kochi", locality: "Fort Kochi", lat: 9.9658, lng: 76.2421 }
];

const map = L.map("map", { zoomControl: false }).setView([22.9734, 78.6569], 5);
L.control.zoom({ position: "bottomright" }).addTo(map);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

const polygonLayer = L.featureGroup().addTo(map);
const pinLayer = L.featureGroup().addTo(map);
const draftLayer = L.layerGroup().addTo(map);
const handleLayer = L.layerGroup().addTo(map);

let locations = [...SAMPLE_LOCATIONS];
let drawMode = false;
let pinPlacementMode = false;
let draftPoints = [];
let draftLine = null;
let selectedPolygon = null;
let installPrompt = null;

const els = {
  searchInput: document.querySelector("#searchInput"),
  searchButton: document.querySelector("#searchButton"),
  searchResults: document.querySelector("#searchResults"),
  installApp: document.querySelector("#installApp"),
  startPolygon: document.querySelector("#startPolygon"),
  finishPolygon: document.querySelector("#finishPolygon"),
  cancelPolygon: document.querySelector("#cancelPolygon"),
  deletePolygon: document.querySelector("#deletePolygon"),
  drawStatus: document.querySelector("#drawStatus"),
  pinPincode: document.querySelector("#pinPincode"),
  pinCity: document.querySelector("#pinCity"),
  pinLocality: document.querySelector("#pinLocality"),
  addPinMode: document.querySelector("#addPinMode"),
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
  els.cancelPolygon.disabled = !drawMode && draftPoints.length === 0;
  els.deletePolygon.disabled = !selectedPolygon;
  els.startPolygon.disabled = drawMode || pinPlacementMode;
  els.addPinMode.disabled = drawMode || pinPlacementMode;
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function popupHtml(place) {
  return `
    <strong>${place.locality}</strong><br>
    ${place.city}<br>
    Pincode: ${place.pincode}
  `;
}

function addPin(place, flyTo = false) {
  const marker = L.marker([place.lat, place.lng], { icon: pinIcon, draggable: true }).addTo(pinLayer);
  marker.place = place;
  marker.bindPopup(popupHtml(place));
  marker.on("dragend", () => {
    const position = marker.getLatLng();
    marker.place.lat = Number(position.lat.toFixed(6));
    marker.place.lng = Number(position.lng.toFixed(6));
  });

  if (flyTo) {
    map.setView([place.lat, place.lng], 14);
    marker.openPopup();
  }

  return marker;
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

  const polygon = L.polygon(draftPoints, {
    color: "#0e7c66",
    weight: 3,
    fillColor: "#18a88c",
    fillOpacity: 0.2
  }).addTo(polygonLayer);

  polygon.bindPopup("Editable polygon");
  polygon.on("click", (event) => {
    L.DomEvent.stopPropagation(event);
    selectPolygon(polygon);
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
  });
}

function deleteSelectedPolygon() {
  if (!selectedPolygon) return;
  polygonLayer.removeLayer(selectedPolygon);
  selectedPolygon = null;
  handleLayer.clearLayers();
  setStatus("Idle");
  refreshControls();
}

function enablePinPlacement() {
  const pincode = els.pinPincode.value.trim();
  const city = els.pinCity.value.trim();
  const locality = els.pinLocality.value.trim();

  if (!pincode || !city || !locality) {
    setStatus("Fill pin fields");
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
    locality: els.pinLocality.value.trim(),
    lat: Number(latlng.lat.toFixed(6)),
    lng: Number(latlng.lng.toFixed(6))
  };

  locations.push(place);
  addPin(place, false).openPopup();
  pinPlacementMode = false;
  setStatus("Idle");
  refreshControls();
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
    .filter((parts) => parts.length >= 5 && !Number.isNaN(Number(parts[3])) && !Number.isNaN(Number(parts[4])))
    .map(([pincode, city, locality, lat, lng]) => ({
      pincode,
      city,
      locality,
      lat: Number(lat),
      lng: Number(lng)
    }));
}

function importLocations() {
  const imported = parseLocationRows(els.importInput.value);
  if (!imported.length) {
    els.importStatus.textContent = "No valid rows found";
    return;
  }

  locations = [...locations, ...imported];
  imported.forEach((place) => addPin(place));
  els.importStatus.textContent = `${imported.length} row${imported.length === 1 ? "" : "s"} imported`;
  searchLocations();
}

els.searchButton.addEventListener("click", searchLocations);
els.searchInput.addEventListener("input", searchLocations);
els.startPolygon.addEventListener("click", startPolygon);
els.finishPolygon.addEventListener("click", finishPolygon);
els.cancelPolygon.addEventListener("click", cancelPolygon);
els.deletePolygon.addEventListener("click", deleteSelectedPolygon);
els.addPinMode.addEventListener("click", enablePinPlacement);
els.importLocations.addEventListener("click", importLocations);
els.exportGeojson.addEventListener("click", exportGeojson);
els.clearPins.addEventListener("click", () => {
  pinLayer.clearLayers();
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

locations.slice(0, 5).forEach((place) => addPin(place));
renderResults(locations.slice(0, 8));
refreshControls();
