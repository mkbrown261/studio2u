import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { getPublishedEngineers, getEngineerProfileById, getPortfolioItems, getReviewsForEngineer } from '../lib/db-engineers'
import { EngineersDirectoryPage } from '../pages/engineers-directory'
import { EngineerProfilePage } from '../pages/engineer-profile'

export const engineersRoutes = new Hono<AppEnv>()

engineersRoutes.get('/engineers', async (c) => {
  const genre = (c.req.query('genre') || '').trim()
  let engineers = await getPublishedEngineers(c.env.DB)

  if (genre) {
    const needle = genre.toLowerCase()
    engineers = engineers.filter((e) => (e.genres || '').toLowerCase().includes(needle))
  }

  return c.render(<EngineersDirectoryPage engineers={engineers} genre={genre} />, { title: 'Find an Engineer' })
})

engineersRoutes.get('/engineers/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  const profile = await getEngineerProfileById(c.env.DB, id)
  if (!profile || profile.is_published !== 1 || profile.is_suspended === 1) {
    return c.notFound()
  }

  const portfolio = await getPortfolioItems(c.env.DB, profile.id)
  const reviews = await getReviewsForEngineer(c.env.DB, profile.id)

  return c.render(<EngineerProfilePage profile={profile} portfolio={portfolio} reviews={reviews} />, {
    title: profile.display_name
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
