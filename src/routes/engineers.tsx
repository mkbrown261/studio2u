import { Hono } from 'hono'
import type { AppEnv } from '../types'
import {
  getPublishedEngineers,
  getEngineerProfileById,
  getPortfolioItems,
  getReviewsForEngineer,
  getCompletedSessionCounts,
  getCompletedSessionCount
} from '../lib/db-engineers'
import { getAvailableHoursForDate } from '../lib/db-availability'
import { geocodeLocation, distanceMiles } from '../lib/geocode'
import { addToSearchWaitlist } from '../lib/db-waitlist'
import { EngineersDirectoryPage } from '../pages/engineers-directory'
import { EngineerProfilePage } from '../pages/engineer-profile'
import { logEvent } from '../lib/analytics'

export const engineersRoutes = new Hono<AppEnv>()

// Smart directory search (2026-09-05 "find an engineer more effectively" pass).
// Query params, all optional and combinable:
//   genre     - clicked genre chip (exact-ish match against the comma-separated list)
//   q         - free-text search (matches genres/bio/mic_spec/daw_spec)
//   remote    - '1' to restrict to remote-capable engineers
//   location  - customer-typed city/zip; geocoded server-side, then used to (a) drop
//               engineers whose travel_radius_miles can't reach them and (b) sort/
//               display distance. Remote-only results skip the radius check (a remote
//               engineer can serve anyone), but still show distance if we have it.
//   date      - YYYY-MM-DD; drops engineers with zero open hours that day
//   priceMin/priceMax - filters on hourly_rate
//   sort      - 'distance' | 'price' | 'rating' (default: distance if location known,
//               else the existing Bayesian/tier ranking)
engineersRoutes.get('/engineers', async (c) => {
  const genre = (c.req.query('genre') || '').trim()
  const q = (c.req.query('q') || '').trim()
  const remoteOnly = c.req.query('remote') === '1'
  const locationLabel = (c.req.query('location') || '').trim()
  const sessionDate = (c.req.query('date') || '').trim()
  const priceMinRaw = c.req.query('priceMin')
  const priceMaxRaw = c.req.query('priceMax')
  const priceMin = priceMinRaw ? parseFloat(priceMinRaw) : null
  const priceMax = priceMaxRaw ? parseFloat(priceMaxRaw) : null
  const sortParam = (c.req.query('sort') || '').trim()

  let engineers = await getPublishedEngineers(c.env.DB, {
    remoteOnly,
    priceMin: priceMin != null && !Number.isNaN(priceMin) ? priceMin : null,
    priceMax: priceMax != null && !Number.isNaN(priceMax) ? priceMax : null,
    textQuery: q || null
  })

  if (genre) {
    const needle = genre.toLowerCase()
    engineers = engineers.filter((e) => (e.genres || '').toLowerCase().includes(needle))
  }

  // Geocode the customer's typed location once, then filter/annotate distance.
  let searchCoords: { lat: number; lng: number } | null = null
  let geocodeFailed = false
  if (locationLabel) {
    searchCoords = await geocodeLocation(locationLabel)
    if (!searchCoords) geocodeFailed = true
  }

  const distanceById = new Map<number, number>()
  if (searchCoords) {
    engineers = engineers.filter((e) => {
      // Remote-only engineers can serve anyone regardless of travel radius, but we
      // still compute distance (if they have coordinates) purely for display/sort.
      if (e.lat == null || e.lng == null) {
        return e.offers_remote === 1
      }
      const dist = distanceMiles(searchCoords!.lat, searchCoords!.lng, e.lat, e.lng)
      distanceById.set(e.id, dist)
      if (e.offers_remote === 1) return true
      return dist <= e.travel_radius_miles
    })
  }

  // Availability filter: drop engineers with zero open hours on the requested date.
  // Cheap enough to check per-candidate since the directory list is already narrowed
  // by the filters above (typically a few dozen rows at most, not the whole table).
  if (sessionDate) {
    const checks = await Promise.all(
      engineers.map(async (e) => {
        const open = await getAvailableHoursForDate(c.env.DB, e.id, sessionDate)
        return open.length > 0
      })
    )
    engineers = engineers.filter((_, i) => checks[i])
  }

  // Trust signals: completed-session counts, batched in one query.
  const sessionCounts = await getCompletedSessionCounts(c.env.DB)

  // Sort. Default: distance if we have a location, otherwise leave the existing
  // Bayesian/tier ranking (already applied by getPublishedEngineers's ORDER BY).
  const effectiveSort = sortParam || (searchCoords ? 'distance' : '')
  if (effectiveSort === 'distance' && searchCoords) {
    engineers = [...engineers].sort((a, b) => {
      const da = distanceById.has(a.id) ? distanceById.get(a.id)! : Infinity
      const db_ = distanceById.has(b.id) ? distanceById.get(b.id)! : Infinity
      return da - db_
    })
  } else if (effectiveSort === 'price') {
    engineers = [...engineers].sort((a, b) => a.hourly_rate - b.hourly_rate)
  } else if (effectiveSort === 'rating') {
    engineers = [...engineers].sort((a, b) => b.rating_avg - a.rating_avg || b.rating_count - a.rating_count)
  }

  return c.render(
    <EngineersDirectoryPage
      engineers={engineers}
      genre={genre}
      q={q}
      remoteOnly={remoteOnly}
      locationLabel={locationLabel}
      geocodeFailed={geocodeFailed}
      sessionDate={sessionDate}
      priceMin={priceMinRaw || ''}
      priceMax={priceMaxRaw || ''}
      sort={effectiveSort}
      distanceById={distanceById}
      sessionCounts={sessionCounts}
    />,
    { title: 'Find an Engineer' }
  )
})

// Zero-results waitlist capture — see migrations/0015_search_waitlist.sql. Fired from
// the "no engineers matched" state on the directory page.
engineersRoutes.post('/engineers/waitlist', async (c) => {
  const body = await c.req.parseBody()
  const email = String(body.email || '').trim()
  if (!email || !email.includes('@')) {
    return c.render(
      <EngineersDirectoryPage
        engineers={[]}
        genre=""
        q=""
        remoteOnly={false}
        locationLabel={String(body.location || '')}
        geocodeFailed={false}
        sessionDate={String(body.date || '')}
        priceMin=""
        priceMax=""
        sort=""
        distanceById={new Map()}
        sessionCounts={new Map()}
        waitlistError="Please enter a valid email address."
      />,
      { title: 'Find an Engineer' }
    )
  }

  let lat: number | null = null
  let lng: number | null = null
  const locationLabel = String(body.location || '').trim() || null
  if (locationLabel) {
    const geo = await geocodeLocation(locationLabel)
    if (geo) {
      lat = geo.lat
      lng = geo.lng
    }
  }

  await addToSearchWaitlist(c.env.DB, {
    email,
    locationLabel,
    lat,
    lng,
    sessionDate: String(body.date || '').trim() || null,
    genre: String(body.genre || '').trim() || null
  })

  return c.render(
    <EngineersDirectoryPage
      engineers={[]}
      genre=""
      q=""
      remoteOnly={false}
      locationLabel={locationLabel || ''}
      geocodeFailed={false}
      sessionDate={String(body.date || '')}
      priceMin=""
      priceMax=""
      sort=""
      distanceById={new Map()}
      sessionCounts={new Map()}
      waitlistSuccess
    />,
    { title: 'Find an Engineer' }
  )
})

engineersRoutes.get('/engineers/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  const profile = await getEngineerProfileById(c.env.DB, id)
  if (!profile || profile.is_published !== 1 || profile.is_suspended === 1 || profile.stripe_charges_enabled !== 1) {
    return c.notFound()
  }

  const portfolio = await getPortfolioItems(c.env.DB, profile.id)
  const reviews = await getReviewsForEngineer(c.env.DB, profile.id)
  const completedSessions = await getCompletedSessionCount(c.env.DB, profile.id)

  await logEvent(c.env.DB, { eventType: 'engineer_view', path: c.req.path, engineerProfileId: profile.id })

  // schema.org Person + AggregateRating structured data — helps engineer profiles show
  // star ratings directly in search results and gives search engines a clean signal of
  // who/what this page is about beyond the plain HTML.
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: profile.display_name,
    jobTitle: 'Recording Engineer',
    description: profile.bio || undefined,
    image: profile.photo_url || undefined,
    ...(profile.rating_count > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: profile.rating_avg,
            reviewCount: profile.rating_count
          }
        }
      : {})
  })

  return c.render(
    <EngineerProfilePage profile={profile} portfolio={portfolio} reviews={reviews} completedSessions={completedSessions} />,
    {
      title: profile.display_name,
      description: profile.bio ? profile.bio.slice(0, 160) : `Book a recording session with ${profile.display_name} on Studio2U.`,
      jsonLd
    }
  )
})

// Serves engineer photo / equipment photo uploads stored in R2 (public, read-only).
engineersRoutes.get('/media/*', async (c) => {
  const key = c.req.path.replace(/^\/media\//, '')
  if (!key) return c.notFound()
  const object = await c.env.R2.get(key)
  if (!object) return c.notFound()
  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=86400'
    }
  })
})
