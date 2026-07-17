// Renders a map with a pulsing gold dot for every published engineer (rough, fuzzed
// location). Reads engineer data from a JSON blob embedded in the page.
;(function () {
  const mapEl = document.getElementById('directory-map')
  if (!mapEl || typeof L === 'undefined') return

  let engineers = []
  try {
    engineers = JSON.parse(mapEl.dataset.engineers || '[]')
  } catch {
    engineers = []
  }

  const withLocation = engineers.filter((e) => e.lat != null && e.lng != null)
  if (withLocation.length === 0) {
    mapEl.innerHTML = '<div class="w-full h-full flex items-center justify-center text-muted text-xs bg-surface">No engineer locations to show yet</div>'
    return
  }

  const center = withLocation[0]
  const map = L.map(mapEl, { zoomControl: true, attributionControl: true }).setView([center.lat, center.lng], 8)
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

  const markers = []
  withLocation.forEach((e) => {
    const marker = L.marker([e.lat, e.lng], { icon: pulsingIcon }).addTo(map)
    marker.bindPopup(`<a href="/engineers/${e.id}" style="color:#D9A448;font-weight:600;">${e.name}</a><br/>$${e.rate}/hr`)
    markers.push(marker)
  })

  if (withLocation.length > 1) {
    const group = L.featureGroup(markers)
    map.fitBounds(group.getBounds().pad(0.3))
  }
})()
