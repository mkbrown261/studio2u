// Free geocoding via OpenStreetMap's Nominatim (no API key, no billing). We geocode a
// city/zip the engineer types — never a street address — and then jitter the result
// 1-2 miles so the map pin is never their exact location.

export interface GeocodeResult {
  lat: number
  lng: number
}

export async function geocodeLocation(locationLabel: string): Promise<GeocodeResult | null> {
  // Bias to the US: a bare zip code like "19802" has no country context on its own and
  // Nominatim can match an identical postal code in another country (seen in production:
  // "19802" resolved to a village in Turkey instead of Wilmington, DE). countrycodes=us
  // scopes results to the US, which is correct for Studio2U's current market.
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(locationLabel)}`
  try {
    const res = await fetch(url, {
      headers: {
        // Nominatim's usage policy requires a descriptive User-Agent.
        'User-Agent': 'Studio2U/1.0 (booking app; contact via studio2u.pages.dev)'
      }
    })
    if (!res.ok) return null
    const data = (await res.json()) as Array<{ lat: string; lon: string }>
    if (!data || data.length === 0) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch {
    return null
  }
}

// Jitter a coordinate randomly within a 1-2 mile radius so the public map pin never
// reveals an engineer's exact location.
export function jitterCoordinate(lat: number, lng: number): GeocodeResult {
  const minMiles = 1
  const maxMiles = 2
  const distanceMiles = minMiles + Math.random() * (maxMiles - minMiles)
  const angle = Math.random() * 2 * Math.PI

  // 1 degree latitude ≈ 69 miles; 1 degree longitude ≈ 69 * cos(latitude) miles
  const milesPerDegreeLat = 69
  const milesPerDegreeLng = 69 * Math.cos((lat * Math.PI) / 180)

  const deltaLat = (distanceMiles * Math.sin(angle)) / milesPerDegreeLat
  const deltaLng = (distanceMiles * Math.cos(angle)) / milesPerDegreeLng

  return { lat: lat + deltaLat, lng: lng + deltaLng }
}
