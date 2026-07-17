import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { getSessionUser } from '../lib/session'
import {
  getEngineerProfileByUserId,
  upsertEngineerProfile,
  getPortfolioItems,
  addPortfolioItem,
  deletePortfolioItem
} from '../lib/db-engineers'
import { getBookingsByEngineerProfile, updateBookingStatus, getBookingById } from '../lib/db'
import { setUserRoles } from '../lib/db-users'
import { geocodeLocation, jitterCoordinate } from '../lib/geocode'
import { DashboardHomePage } from '../pages/dashboard-home'
import { DashboardProfilePage } from '../pages/dashboard-profile'
import { DashboardPortfolioPage } from '../pages/dashboard-portfolio'
import { DashboardBookingsPage } from '../pages/dashboard-bookings'
import { BecomeEngineerPage } from '../pages/dashboard-become-engineer'

export const dashboardRoutes = new Hono<AppEnv>()

// Require login for everything under /dashboard
dashboardRoutes.use('/dashboard/*', async (c, next) => {
  const user = await getSessionUser(c.env.DB, c.req.raw)
  if (!user) return c.redirect('/login')
  c.set('sessionUser' as never, user as never)
  await next()
})
dashboardRoutes.use('/dashboard', async (c, next) => {
  const user = await getSessionUser(c.env.DB, c.req.raw)
  if (!user) return c.redirect('/login')
  c.set('sessionUser' as never, user as never)
  await next()
})

dashboardRoutes.get('/dashboard', async (c) => {
  const user = await getSessionUser(c.env.DB, c.req.raw)
  if (!user) return c.redirect('/login')
  const profile = user.is_engineer === 1 ? await getEngineerProfileByUserId(c.env.DB, user.id) : null
  return c.render(<DashboardHomePage user={user} engineerProfile={profile} />, { title: 'Dashboard' })
})

dashboardRoutes.get('/dashboard/become-engineer', async (c) => {
  const user = await getSessionUser(c.env.DB, c.req.raw)
  if (!user) return c.redirect('/login')
  if (user.is_engineer === 1) return c.redirect('/dashboard/profile')
  return c.render(<BecomeEngineerPage />, { title: 'Become an Engineer' })
})

dashboardRoutes.post('/dashboard/become-engineer', async (c) => {
  const user = await getSessionUser(c.env.DB, c.req.raw)
  if (!user) return c.redirect('/login')
  await setUserRoles(c.env.DB, user.id, true, user.is_artist === 1)
  return c.redirect('/dashboard/profile')
})

// ---------- Engineer profile builder ----------

dashboardRoutes.get('/dashboard/profile', async (c) => {
  const user = await getSessionUser(c.env.DB, c.req.raw)
  if (!user) return c.redirect('/login')
  if (user.is_engineer !== 1) return c.redirect('/dashboard/become-engineer')

  const profile = await getEngineerProfileByUserId(c.env.DB, user.id)
  return c.render(<DashboardProfilePage profile={profile} />, { title: 'Your Profile' })
})

dashboardRoutes.post('/dashboard/profile', async (c) => {
  const user = await getSessionUser(c.env.DB, c.req.raw)
  if (!user) return c.redirect('/login')
  if (user.is_engineer !== 1) return c.redirect('/dashboard/become-engineer')

  const existing = await getEngineerProfileByUserId(c.env.DB, user.id)
  const formData = await c.req.formData()

  const displayName = ((formData.get('display_name') as string) || '').trim()
  const bio = ((formData.get('bio') as string) || '').trim()
  const hourlyRate = parseFloat((formData.get('hourly_rate') as string) || '40')
  const travelRadiusMiles = parseInt((formData.get('travel_radius_miles') as string) || '30', 10)
  const offerDiscount = formData.get('offer_discount') === '1'
  const discountAmount = offerDiscount ? parseFloat((formData.get('discount_amount') as string) || '0') : null
  const discountHours = offerDiscount ? parseFloat((formData.get('discount_hours') as string) || '0') : null
  const genres = ((formData.get('genres') as string) || '').trim()
  const equipmentText = ((formData.get('equipment_text') as string) || '').trim()
  const micSpec = ((formData.get('mic_spec') as string) || '').trim()
  const dawSpec = ((formData.get('daw_spec') as string) || '').trim()
  const interfaceSpec = ((formData.get('interface_spec') as string) || '').trim()
  const cashappHandle = ((formData.get('cashapp_handle') as string) || '').trim()
  const locationLabel = ((formData.get('location_label') as string) || '').trim()

  if (!displayName || !bio || !cashappHandle || !locationLabel) {
    return c.render(<DashboardProfilePage profile={existing} error="Please fill out all required fields." />, { title: 'Your Profile' })
  }

  // Photo uploads
  let photoUrl: string | undefined
  const photoFile = formData.get('photo') as File | null
  if (photoFile && photoFile.size > 0) {
    const ext = photoFile.type === 'image/png' ? 'png' : 'jpg'
    const key = `engineer-photos/${user.id}-${Date.now()}.${ext}`
    await c.env.R2.put(key, await photoFile.arrayBuffer(), { httpMetadata: { contentType: photoFile.type } })
    photoUrl = key
  }

  let equipmentPhotoUrl: string | undefined
  const equipmentPhotoFile = formData.get('equipment_photo') as File | null
  if (equipmentPhotoFile && equipmentPhotoFile.size > 0) {
    const ext = equipmentPhotoFile.type === 'image/png' ? 'png' : 'jpg'
    const key = `engineer-equipment/${user.id}-${Date.now()}.${ext}`
    await c.env.R2.put(key, await equipmentPhotoFile.arrayBuffer(), { httpMetadata: { contentType: equipmentPhotoFile.type } })
    equipmentPhotoUrl = key
  }

  // Geocode only if location changed (or first time) to avoid hammering Nominatim on every save
  let lat = existing?.lat ?? null
  let lng = existing?.lng ?? null
  if (!existing || existing.location_label !== locationLabel || lat == null) {
    const geo = await geocodeLocation(locationLabel)
    if (geo) {
      const jittered = jitterCoordinate(geo.lat, geo.lng)
      lat = jittered.lat
      lng = jittered.lng
    }
  }

  await upsertEngineerProfile(c.env.DB, {
    userId: user.id,
    displayName,
    bio,
    photoUrl,
    hourlyRate,
    firstTimeDiscountAmount: discountAmount,
    firstTimeDiscountHours: discountHours,
    genres,
    travelRadiusMiles,
    equipmentText,
    equipmentPhotoUrl,
    micSpec,
    dawSpec,
    interfaceSpec,
    cashappHandle,
    locationLabel,
    lat,
    lng
  })

  const updated = await getEngineerProfileByUserId(c.env.DB, user.id)
  return c.render(<DashboardProfilePage profile={updated} success="Profile published! It's live on the engineer directory." />, { title: 'Your Profile' })
})

// ---------- Portfolio ----------

dashboardRoutes.get('/dashboard/portfolio', async (c) => {
  const user = await getSessionUser(c.env.DB, c.req.raw)
  if (!user) return c.redirect('/login')
  const profile = await getEngineerProfileByUserId(c.env.DB, user.id)
  if (!profile) return c.redirect('/dashboard/profile')

  const items = await getPortfolioItems(c.env.DB, profile.id)
  return c.render(<DashboardPortfolioPage items={items} />, { title: 'Your Portfolio' })
})

dashboardRoutes.post('/dashboard/portfolio', async (c) => {
  const user = await getSessionUser(c.env.DB, c.req.raw)
  if (!user) return c.redirect('/login')
  const profile = await getEngineerProfileByUserId(c.env.DB, user.id)
  if (!profile) return c.redirect('/dashboard/profile')

  const body = await c.req.parseBody()
  const title = ((body['title'] as string) || '').trim()
  const embedUrl = ((body['embed_url'] as string) || '').trim()

  if (!title || !embedUrl) {
    const items = await getPortfolioItems(c.env.DB, profile.id)
    return c.render(<DashboardPortfolioPage items={items} error="Please fill out both fields." />, { title: 'Your Portfolio' })
  }

  await addPortfolioItem(c.env.DB, profile.id, title, embedUrl)
  return c.redirect('/dashboard/portfolio')
})

dashboardRoutes.post('/dashboard/portfolio/:id/delete', async (c) => {
  const user = await getSessionUser(c.env.DB, c.req.raw)
  if (!user) return c.redirect('/login')
  const profile = await getEngineerProfileByUserId(c.env.DB, user.id)
  if (!profile) return c.redirect('/dashboard/profile')

  const itemId = parseInt(c.req.param('id'), 10)
  await deletePortfolioItem(c.env.DB, itemId, profile.id)
  return c.redirect('/dashboard/portfolio')
})

// ---------- Engineer's own booking queue ----------

dashboardRoutes.get('/dashboard/bookings', async (c) => {
  const user = await getSessionUser(c.env.DB, c.req.raw)
  if (!user) return c.redirect('/login')
  const profile = await getEngineerProfileByUserId(c.env.DB, user.id)
  if (!profile) return c.redirect('/dashboard/profile')

  const bookings = await getBookingsByEngineerProfile(c.env.DB, profile.id)
  return c.render(<DashboardBookingsPage bookings={bookings} />, { title: 'Your Bookings' })
})

dashboardRoutes.post('/dashboard/bookings/:id/status', async (c) => {
  const user = await getSessionUser(c.env.DB, c.req.raw)
  if (!user) return c.redirect('/login')
  const profile = await getEngineerProfileByUserId(c.env.DB, user.id)
  if (!profile) return c.redirect('/dashboard/profile')

  const bookingId = parseInt(c.req.param('id'), 10)
  const booking = await getBookingById(c.env.DB, bookingId)
  if (!booking || booking.engineer_profile_id !== profile.id) {
    return c.text('Unauthorized', 403)
  }

  const body = await c.req.parseBody()
  const status = body['status'] as string
  const validStatuses = ['confirmed', 'rejected', 'completed', 'cancelled']
  if (validStatuses.includes(status)) {
    await updateBookingStatus(c.env.DB, bookingId, status)
  }
  return c.redirect('/dashboard/bookings')
})

dashboardRoutes.get('/dashboard/bookings/:id/proof', async (c) => {
  const user = await getSessionUser(c.env.DB, c.req.raw)
  if (!user) return c.redirect('/login')
  const profile = await getEngineerProfileByUserId(c.env.DB, user.id)
  if (!profile) return c.redirect('/dashboard/profile')

  const bookingId = parseInt(c.req.param('id'), 10)
  const booking = await getBookingById(c.env.DB, bookingId)
  if (!booking || booking.engineer_profile_id !== profile.id || !booking.payment_proof_url) {
    return c.notFound()
  }

  const object = await c.env.R2.get(booking.payment_proof_url)
  if (!object) return c.notFound()

  return new Response(object.body, {
    headers: { 'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream' }
  })
})
