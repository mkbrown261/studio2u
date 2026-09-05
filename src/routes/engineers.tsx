import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { getPublishedEngineers, getEngineerProfileById, getPortfolioItems, getReviewsForEngineer } from '../lib/db-engineers'
import { EngineersDirectoryPage } from '../pages/engineers-directory'
import { EngineerProfilePage } from '../pages/engineer-profile'
import { logEvent } from '../lib/analytics'

export const engineersRoutes = new Hono<AppEnv>()

engineersRoutes.get('/engineers', async (c) => {
  const genre = (c.req.query('genre') || '').trim()
  const remoteOnly = c.req.query('remote') === '1'
  let engineers = await getPublishedEngineers(c.env.DB, remoteOnly)

  if (genre) {
    const needle = genre.toLowerCase()
    engineers = engineers.filter((e) => (e.genres || '').toLowerCase().includes(needle))
  }

  return c.render(<EngineersDirectoryPage engineers={engineers} genre={genre} remoteOnly={remoteOnly} />, { title: 'Find an Engineer' })
})

engineersRoutes.get('/engineers/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  const profile = await getEngineerProfileById(c.env.DB, id)
  if (!profile || profile.is_published !== 1 || profile.is_suspended === 1 || profile.stripe_charges_enabled !== 1) {
    return c.notFound()
  }

  const portfolio = await getPortfolioItems(c.env.DB, profile.id)
  const reviews = await getReviewsForEngineer(c.env.DB, profile.id)

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

  return c.render(<EngineerProfilePage profile={profile} portfolio={portfolio} reviews={reviews} />, {
    title: profile.display_name,
    description: profile.bio ? profile.bio.slice(0, 160) : `Book a recording session with ${profile.display_name} on Studio2U.`,
    jsonLd
  })
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
