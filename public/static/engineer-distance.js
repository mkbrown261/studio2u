// Computes "X mi away from you" on the engineer profile page using the browser's
// geolocation API compared against the engineer's rough (1-2mi fuzzed) coordinates.
// No map is shown here and no exact address is ever used — just a distance figure.
;(function () {
  const el = document.getElementById('engineer-distance')
  if (!el) return

  const textEl = el.querySelector('.distance-text')
  const lat = parseFloat(el.dataset.lat)
  const lng = parseFloat(el.dataset.lng)

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    if (textEl) textEl.textContent = 'Distance unavailable'
    return
  }

  if (!('geolocation' in navigator)) {
    if (textEl) textEl.textContent = 'Location not supported on this device'
    return
  }

  // Haversine formula — great-circle distance between two lat/lng points, in miles.
  function haversineMiles(lat1, lng1, lat2, lng2) {
    const toRad = (deg) => (deg * Math.PI) / 180
    const R = 3958.8 // Earth radius in miles
    const dLat = toRad(lat2 - lat1)
    const dLng = toRad(lng2 - lng1)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  if (textEl) textEl.textContent = 'Finding your distance…'

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const dist = haversineMiles(pos.coords.latitude, pos.coords.longitude, lat, lng)
      if (textEl) {
        const rounded = dist < 1 ? dist.toFixed(1) : Math.round(dist)
        textEl.textContent = `~${rounded} mi away from you`
      }
    },
    () => {
      if (textEl) textEl.textContent = 'Enable location access to see distance'
    },
    { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 }
  )
})()
