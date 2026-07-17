// Renders a single pulsing gold dot on a Leaflet/OpenStreetMap map for an engineer's
// rough (fuzzed) location. No API key needed — OSM tiles are free.
;(function () {
  const mapEl = document.getElementById('engineer-map')
  if (!mapEl || typeof L === 'undefined') return

  const lat = parseFloat(mapEl.dataset.lat)
  const lng = parseFloat(mapEl.dataset.lng)
  const name = mapEl.dataset.name || 'Engineer'

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    mapEl.innerHTML =
      '<div class="w-full h-full flex items-center justify-center text-muted text-xs bg-surface">Location not available</div>'
    return
  }

  const map = L.map(mapEl, { zoomControl: false, attributionControl: true, scrollWheelZoom: false }).setView([lat, lng], 12)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 15
  }).addTo(map)

  const pulsingIcon = L.divIcon({
    className: 'engineer-pulse-icon',
    html: '<span class="pulse-dot"></span><span class="pulse-ring"></span>',
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  })

  L.marker([lat, lng], { icon: pulsingIcon }).addTo(map).bindPopup(`${name} — approximate area`)
})()
