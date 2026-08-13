import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { getSessionUser } from '../lib/session'
import {
  getEngineerProfileByUserId,
  upsertEngineerProfile,
  getPortfolioItems,
  addPortfolioItem,
  deletePortfolioItem,
  setEngineerStripeAccountId,
  updateEngineerStripeStatus
} from '../lib/db-engineers'
import { getBookingsByEngineerProfile, updateBookingStatus, getBookingById } from '../lib/db'
import { setUserRoles } from '../lib/db-users'
import { geocodeLocation, jitterCoordinate } from '../lib/geocode'
import {
  getWeeklyAvailability,
  setWeeklyAvailability,
  getOverridesForDate,
  setOverridesForDate,
  deleteOverrideDate,
  getUpcomingOverrides
} from '../lib/db-availability'
import { getStripeClient, createConnectAccount, createAccountOnboardingLink, getAccountStatus } from '../lib/stripe'
import { DashboardHomePage } from '../pages/dashboard-home'
import { DashboardProfilePage } from '../pages/dashboard-profile'
import { DashboardPortfolioPage } from '../pages/dashboard-portfolio'
import { DashboardBookingsPage } from '../pages/dashboard-bookings'
import { DashboardAvailabilityPage } from '../pages/dashboard-availability'
import { DashboardPaymentsPage } from '../pages/dashboard-payments'
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

// ---------- Availability calendar ----------

dashboardRoutes.get('/dashboard/availability', async (c) => {
  const user = await getSessionUser(c.env.DB, c.req.raw)
  if (!user) return c.redirect('/login')
  const profile = await getEngineerProfileByUserId(c.env.DB, user.id)
  if (!profile) return c.redirect('/dashboard/profile')

  const weekly = await getWeeklyAvailability(c.env.DB, profile.id)
  const overrideDate = c.req.query('override_date') || ''
  const overrideHours = new Set<number>()
  if (overrideDate) {
    const overrides = await getOverridesForDate(c.env.DB, profile.id, overrideDate)
    // Seed the checkbox grid with the effective open hours for that date: start
    // from the weekly template for that day-of-week, then apply overrides.
    const dow = new Date(`${overrideDate}T00:00:00`).getDay()
    for (const h of weekly[dow] || []) overrideHours.add(h)
    for (const o of overrides) {
      if (o.isAvailable) overrideHours.add(o.hour)
      else overrideHours.delete(o.hour)
    }
  }
  const today = new Date().toISOString().split('T')[0]
  const upcoming = await getUpcomingOverrides(c.env.DB, profile.id, today)
  const upcomingDates = Array.from(new Set(upcoming.map((o) => o.date))).sort()

  return c.render(
    <DashboardAvailabilityPage
      weekly={weekly}
      overrideDate={overrideDate}
      overrideHours={overrideHours}
      upcomingOverrideDates={upcomingDates}
    />,
    { title: 'Your Availability' }
  )
})

dashboardRoutes.post('/dashboard/availability', async (c) => {
  const user = await getSessionUser(c.env.DB, c.req.raw)
  if (!user) return c.redirect('/login')
  const profile = await getEngineerProfileByUserId(c.env.DB, user.id)
  if (!profile) return c.redirect('/dashboard/profile')

  const body = await c.req.parseBody({ all: true })
  const raw = body['slot']
  const values = Array.isArray(raw) ? raw : raw ? [raw] : []
  const slots = (values as string[])
    .map((v) => {
      const [dayStr, hourStr] = v.split('-')
      return { dayOfWeek: parseInt(dayStr, 10), hour: parseInt(hourStr, 10) }
    })
    .filter((s) => !Number.isNaN(s.dayOfWeek) && !Number.isNaN(s.hour))

  await setWeeklyAvailability(c.env.DB, profile.id, slots)

  const weekly = await getWeeklyAvailability(c.env.DB, profile.id)
  const today = new Date().toISOString().split('T')[0]
  const upcoming = await getUpcomingOverrides(c.env.DB, profile.id, today)
  const upcomingDates = Array.from(new Set(upcoming.map((o) => o.date))).sort()

  return c.render(
    <DashboardAvailabilityPage
      weekly={weekly}
      overrideDate=""
      overrideHours={new Set()}
      upcomingOverrideDates={upcomingDates}
      success="Weekly availability saved."
    />,
    { title: 'Your Availability' }
  )
})

dashboardRoutes.post('/dashboard/availability/override', async (c) => {
  const user = await getSessionUser(c.env.DB, c.req.raw)
  if (!user) return c.redirect('/login')
  const profile = await getEngineerProfileByUserId(c.env.DB, user.id)
  if (!profile) return c.redirect('/dashboard/profile')

  const body = await c.req.parseBody({ all: true })
  const overrideDate = (body['override_date'] as string) || ''
  const raw = body['ohour']
  const values = Array.isArray(raw) ? raw : raw ? [raw] : []
  const openHours = new Set((values as string[]).map((v) => parseInt(v, 10)).filter((n) => !Number.isNaN(n)))

  if (overrideDate) {
    const weekly = await getWeeklyAvailability(c.env.DB, profile.id)
    const dow = new Date(`${overrideDate}T00:00:00`).getDay()
    const templateOpen = new Set(weekly[dow] || [])

    // Only store rows where the override actually DIFFERS from the weekly
    // template (is_available=1 for hours opened beyond the template, =0 for
    // hours in the template that got closed for this date).
    const overrides: Array<{ hour: number; isAvailable: boolean }> = []
    for (const h of Array.from({ length: 24 }, (_, i) => i)) {
      const inTemplate = templateOpen.has(h)
      const inSelection = openHours.has(h)
      if (inSelection && !inTemplate) overrides.push({ hour: h, isAvailable: true })
      if (!inSelection && inTemplate) overrides.push({ hour: h, isAvailable: false })
    }
    await setOverridesForDate(c.env.DB, profile.id, overrideDate, overrides)
  }

  const weekly = await getWeeklyAvailability(c.env.DB, profile.id)
  const today = new Date().toISOString().split('T')[0]
  const upcoming = await getUpcomingOverrides(c.env.DB, profile.id, today)
  const upcomingDates = Array.from(new Set(upcoming.map((o) => o.date))).sort()

  return c.render(
    <DashboardAvailabilityPage
      weekly={weekly}
      overrideDate={overrideDate}
      overrideHours={openHours}
      upcomingOverrideDates={upcomingDates}
      success={`Overrides saved for ${overrideDate}.`}
    />,
    { title: 'Your Availability' }
  )
})

dashboardRoutes.post('/dashboard/availability/override/delete', async (c) => {
  const user = await getSessionUser(c.env.DB, c.req.raw)
  if (!user) return c.redirect('/login')
  const profile = await getEngineerProfileByUserId(c.env.DB, user.id)
  if (!profile) return c.redirect('/dashboard/profile')

  const body = await c.req.parseBody()
  const overrideDate = (body['override_date'] as string) || ''
  if (overrideDate) {
    await deleteOverrideDate(c.env.DB, profile.id, overrideDate)
  }
  return c.redirect('/dashboard/availability')
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

// ---------- Stripe Connect onboarding (Phase 3 M5) ----------

dashboardRoutes.get('/dashboard/payments', async (c) => {
  const user = await getSessionUser(c.env.DB, c.req.raw)
  if (!user) return c.redirect('/login')
  const profile = await getEngineerProfileByUserId(c.env.DB, user.id)
  if (!profile) return c.redirect('/dashboard/profile')

  // If they already have a connected account but our local flags haven't been
  // refreshed (e.g. they just returned from Stripe's hosted onboarding), re-check
  // live status against Stripe before rendering so the page never shows stale info.
  if (profile.stripe_account_id && !profile.stripe_charges_enabled && c.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = getStripeClient(c.env.STRIPE_SECRET_KEY)
      const status = await getAccountStatus(stripe, profile.stripe_account_id)
      await updateEngineerStripeStatus(c.env.DB, profile.id, status)
      profile.stripe_charges_enabled = status.chargesEnabled ? 1 : 0
      profile.stripe_onboarding_complete = status.detailsSubmitted ? 1 : 0
    } catch (err) {
      console.error('Failed to refresh Stripe account status', err)
    }
  }

  return c.render(<DashboardPaymentsPage profile={profile} />, { title: 'Payments' })
})

dashboardRoutes.post('/dashboard/payments/connect', async (c) => {
  const user = await getSessionUser(c.env.DB, c.req.raw)
  if (!user) return c.redirect('/login')
  const profile = await getEngineerProfileByUserId(c.env.DB, user.id)
  if (!profile) return c.redirect('/dashboard/profile')

  if (!c.env.STRIPE_SECRET_KEY) {
    return c.render(
      <DashboardPaymentsPage profile={profile} error="Stripe is not configured on this deployment yet." />,
      { title: 'Payments' }
    )
  }

  const stripe = getStripeClient(c.env.STRIPE_SECRET_KEY)
  const origin = new URL(c.req.url).origin

  try {
    let accountId = profile.stripe_account_id
    if (!accountId) {
      accountId = await createConnectAccount(stripe, { email: user.email, name: profile.display_name })
      await setEngineerStripeAccountId(c.env.DB, profile.id, accountId)
    }

    const onboardingUrl = await createAccountOnboardingLink(
      stripe,
      accountId,
      `${origin}/dashboard/payments`, // return_url
      `${origin}/dashboard/payments/connect` // refresh_url — re-hit this route to get a fresh link
    )

    return c.redirect(onboardingUrl)
  } catch (err) {
    console.error('Stripe Connect onboarding error', err)
    return c.render(
      <DashboardPaymentsPage profile={profile} error="Could not start Stripe onboarding. Please try again." />,
      { title: 'Payments' }
    )
  }
})
