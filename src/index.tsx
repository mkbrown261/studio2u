import { Hono } from 'hono'
import { csrf } from 'hono/csrf'
import { secureHeaders } from 'hono/secure-headers'
import { renderer } from './renderer'
import type { AppEnv } from './types'
import {
  getServices,
  getServiceById,
  findCustomerByEmail,
  upsertCustomer,
  markCustomerFirstBookingUsed,
  createBooking,
  getBookingById,
  getBookingsByEmail,
  getAllBookings,
  attachCheckoutSession,
  updateBookingStatus,
  hasCustomerBookedEngineerBefore
} from './lib/db'
import { calculatePrice } from './lib/pricing'
import {
  getEngineerProfileById,
  getEngineerProfileByUserId,
  getEngineerDisplayForBooking,
  getAllEngineersForAdmin,
  setEngineerSuspended
} from './lib/db-engineers'
import { getCommissionPercent, setCommissionPercent } from './lib/db-settings'
import { getPlatformFeePercentForEngineer, getSubscriptionPriceIds, setSubscriptionPriceId, splitCommission } from './lib/subscriptions'
import { getAvailableHoursForDate, isRangeAvailable } from './lib/db-availability'
import { getStripeClient, createBookingCheckoutSession, createSubscriptionProductAndPrices, toCents } from './lib/stripe'
import { HomePage } from './pages/home'
import { BookPage } from './pages/book'
import { ConfirmationPage } from './pages/confirmation'
import { StatusPage } from './pages/status'
import { AdminLoginPage } from './pages/admin-login'
import { AdminDashboardPage } from './pages/admin-dashboard'
import { buildSessionCookie, buildClearCookie, createAdminSession, destroyAdminSession, isAdminAuthenticated, getCookie, COOKIE_NAME as ADMIN_COOKIE_NAME } from './lib/auth'
import { constantTimeEqual } from './lib/password'
import { isRateLimited, recordAttempt, rateLimitKey, getClientIp } from './lib/rate-limit'
import { logAuditEvent } from './lib/audit-log'
import { logConsentEvent, CURRENT_RECORDING_CONSENT_VERSION } from './lib/consent-log'
import { getSessionUser } from './lib/session'
import { TermsPage } from './pages/terms'
import { ConsentPage } from './pages/consent'
import { PrivacyPage } from './pages/privacy'
import { SecurityPolicyPage } from './pages/security-policy'
import { RefundPolicyPage } from './pages/refund-policy'
import { PricingPage } from './pages/pricing'
import { authRoutes } from './routes/auth'
import { dashboardRoutes } from './routes/dashboard'
import { engineersRoutes } from './routes/engineers'
import { reviewsRoutes } from './routes/reviews'
import { stripeWebhookRoutes } from './routes/stripe-webhook'

const app = new Hono<AppEnv>()

// Stripe webhook must be mounted BEFORE `app.use(renderer)` — the renderer middleware
// calls getSessionUser() on every request, which is harmless here but unnecessary
// overhead on a high-frequency webhook endpoint, and more importantly this route
// needs the raw, untouched request body for signature verification.
app.route('/', stripeWebhookRoutes)

// Security hardening pass (pre-Stripe-go-live):
// - CSRF: rejects cross-site form POSTs whose Origin/Sec-Fetch-Site doesn't match
//   this app — mounted globally so every state-changing route is covered, not just
//   ones we remember to protect individually. Stripe webhook is exempt (mounted
//   above, before this) since it's a legitimate cross-origin POST from Stripe
//   verified by signature instead.
// - secureHeaders: sets CSP, X-Frame-Options, HSTS, etc. CSP is scoped to the actual
//   third-party origins this app loads (Tailwind CDN, jsDelivr, Google Fonts, unpkg
//   for Leaflet, SoundCloud/YouTube portfolio embeds) rather than left wide open.
app.use(csrf())
app.use(
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.tailwindcss.com', 'https://cdn.jsdelivr.net', 'https://unpkg.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdn.jsdelivr.net', 'https://unpkg.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdn.jsdelivr.net'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'https://api.stripe.com'],
      frameSrc: ["'self'", 'https://w.soundcloud.com', 'https://www.youtube.com', 'https://youtube.com', 'https://www.youtube-nocookie.com', 'https://checkout.stripe.com', 'https://js.stripe.com'],
      objectSrc: ["'none'"]
    },
    // hono's secureHeaders() defaults Referrer-Policy to "no-referrer" when this
    // isn't set explicitly. YouTube's embedded player uses the referrer to
    // validate which site is embedding it — with no referrer at all, YouTube
    // rejects the embed with a "video player config error" even though the
    // iframe src/CSP are otherwise correct. strict-origin-when-cross-origin
    // still sends only the origin (not full path/query) to cross-origin
    // destinations, which is enough for YouTube while staying privacy-conscious.
    referrerPolicy: 'strict-origin-when-cross-origin'
  })
)

app.use(renderer)

app.route('/', authRoutes)
app.route('/', dashboardRoutes)
app.route('/', engineersRoutes)
app.route('/', reviewsRoutes)

// ---------- Public marketing pages ----------

app.get('/', async (c) => {
  const services = await getServices(c.env.DB)
  return c.render(<HomePage services={services} />, { title: 'Home' })
})

// Engineer Subscription Tiers (Free / Pro / Elite) — distinct from the customer-facing
// "Pricing" section on the homepage (#pricing, about per-session booking rates).
app.get('/pricing', async (c) => {
  const user = await getSessionUser(c.env.DB, c.req.raw)
  const profile = user && user.is_engineer === 1 ? await getEngineerProfileByUserId(c.env.DB, user.id) : null
  return c.render(<PricingPage user={user} profile={profile} />, { title: 'Engineer Plans' })
})

// Customer picks an engineer first (from the directory), then books that specific
// engineer here. Pricing is pulled from that engineer's own profile, not a fixed rate.
app.get('/book/:engineerId', async (c) => {
  const engineerId = parseInt(c.req.param('engineerId'), 10)
  const engineer = await getEngineerProfileById(c.env.DB, engineerId)
  if (!engineer || engineer.is_published !== 1 || engineer.is_suspended === 1 || engineer.stripe_charges_enabled !== 1) {
    return c.notFound()
  }
  return c.render(<BookPage engineer={engineer} />, { title: `Book ${engineer.display_name}` })
})

// Legacy /book with no engineer picked — send them to the directory instead.
app.get('/book', async (c) => {
  return c.redirect('/engineers')
})

// ---------- Legal documents ----------
// Real, linkable pages for the legal docs stored in /legal/*.md (source of
// truth). Both the signup ToS checkbox and the booking-flow recording-consent
// checkbox link here so users can actually read what they're agreeing to
// instead of trusting an unopened PDF.
app.get('/terms', async (c) => {
  return c.render(<TermsPage />, { title: 'Terms of Service' })
})

app.get('/consent', async (c) => {
  return c.render(<ConsentPage />, { title: 'Recording Consent Agreement' })
})

app.get('/privacy', async (c) => {
  return c.render(<PrivacyPage />, { title: 'Privacy Policy' })
})

app.get('/security', async (c) => {
  return c.render(<SecurityPolicyPage />, { title: 'Security & Acceptable Use Policy' })
})

app.get('/refund-policy', async (c) => {
  return c.render(<RefundPolicyPage />, { title: 'Refund & Cancellation Policy' })
})

// ---------- Booking API ----------

// Returns every open hour for this engineer on this date (weekly template +
// overrides, minus anything already booked) so the booking UI can only ever
// show real, currently-open slots.
app.get('/api/available-slots', async (c) => {
  const engineerId = parseInt(c.req.query('engineerId') || '', 10)
  const date = c.req.query('date') || ''
  if (!engineerId || !date) {
    return c.json({ hours: [] })
  }
  const hours = await getAvailableHoursForDate(c.env.DB, engineerId, date)
  return c.json({ hours })
})

app.get('/api/price-check', async (c) => {
  const engineerId = parseInt(c.req.query('engineerId') || '', 10)
  const email = (c.req.query('email') || '').trim().toLowerCase()
  const duration = parseFloat(c.req.query('duration') || '3')

  const engineer = await getEngineerProfileById(c.env.DB, engineerId)
  if (!engineer) {
    return c.json({ error: 'Engineer not found.' }, 404)
  }

  let isFirstTime = true
  if (email) {
    isFirstTime = !(await hasCustomerBookedEngineerBefore(c.env.DB, email, engineer.id))
  }

  const price = calculatePrice(duration, isFirstTime, {
    hourlyRate: engineer.hourly_rate,
    firstTimeDiscountAmount: engineer.first_time_discount_amount,
    firstTimeDiscountHours: engineer.first_time_discount_hours
  })
  return c.json(price)
})

app.post('/api/bookings', async (c) => {
  try {
    const body = await c.req.json()
    const {
      engineerId,
      sessionDate,
      sessionTime,
      durationHours,
      locationType,
      locationAddress,
      specialNotes,
      songCount,
      genre,
      customerName,
      customerEmail,
      customerPhone,
      recordingConsentAccepted
    } = body

    if (
      !engineerId ||
      !sessionDate ||
      !sessionTime ||
      !durationHours ||
      !locationType ||
      !customerName ||
      !customerEmail ||
      !customerPhone
    ) {
      return c.json({ error: 'Missing required fields.' }, 400)
    }

    // Server-side enforcement of the Recording Consent Agreement checkbox — never
    // trust the client's disabled-button UX alone, since a direct API call could
    // skip it entirely. Mirrors the "never trust the client" pattern already used
    // below for calendar availability.
    if (recordingConsentAccepted !== true) {
      return c.json({ error: 'You must confirm the Recording Consent Agreement before booking.' }, 400)
    }

    const engineer = await getEngineerProfileById(c.env.DB, parseInt(engineerId, 10))
    if (!engineer || engineer.is_published !== 1 || engineer.is_suspended === 1) {
      return c.json({ error: 'This engineer is not available for booking.' }, 404)
    }
    if (!engineer.stripe_account_id || engineer.stripe_charges_enabled !== 1) {
      return c.json({ error: 'This engineer has not finished payment setup yet. Please try another engineer.' }, 409)
    }
    if (!c.env.STRIPE_SECRET_KEY) {
      return c.json({ error: 'Payments are not configured on this deployment yet.' }, 500)
    }

    const service = await getServiceById(c.env.DB, 1) // Recording — the only bookable service in V1
    if (!service) {
      return c.json({ error: 'Booking service unavailable.' }, 500)
    }

    // Hard server-side enforcement against this engineer's real calendar — never
    // trust the client's earlier /api/available-slots read, since availability
    // can change between page load and submit (e.g. another booking landed first).
    const startHour = parseInt((sessionTime as string).split(':')[0], 10)
    const durationOk = await isRangeAvailable(c.env.DB, engineer.id, sessionDate, startHour, parseFloat(durationHours))
    if (!durationOk) {
      return c.json({ error: 'That time is no longer available. Please pick an open slot.' }, 409)
    }

    const existingCustomer = await findCustomerByEmail(c.env.DB, customerEmail)
    const isFirstTimeWithEngineer = !(await hasCustomerBookedEngineerBefore(c.env.DB, customerEmail, engineer.id))

    // Link this booking to a real account when the customer is logged in, so
    // "My Bookings" and rebooking can eventually be account-based instead of an
    // email lookup every time. Guest checkout (no session) still works fine —
    // this column just stays null for those, same as before.
    const sessionUser = await getSessionUser(c.env.DB, c.req.raw)
    const customerUserId = sessionUser ? sessionUser.id : null

    const customerId = await upsertCustomer(c.env.DB, {
      email: customerEmail,
      name: customerName,
      phone: customerPhone
    })

    const price = calculatePrice(parseFloat(durationHours), isFirstTimeWithEngineer, {
      hourlyRate: engineer.hourly_rate,
      firstTimeDiscountAmount: engineer.first_time_discount_amount,
      firstTimeDiscountHours: engineer.first_time_discount_hours
    })

    const bookingId = await createBooking(c.env.DB, {
      customerId,
      engineerId: 1, // legacy FK kept for backward compat; real routing uses engineerProfileId
      engineerProfileId: engineer.id,
      customerUserId,
      serviceId: service.id,
      sessionDate,
      sessionTime,
      durationHours: parseFloat(durationHours),
      // Every booking is now hard-validated against the engineer's real calendar
      // above, so there's no more "outside standard hours, needs manual OK" case —
      // column kept for backward-compat with pre-M3 bookings.
      isCustomTimeRequest: false,
      locationType,
      locationAddress: locationAddress || '',
      specialNotes: specialNotes || '',
      songCount: songCount ? parseInt(songCount, 10) : null,
      genre: genre || '',
      customerName,
      customerEmail,
      customerPhone,
      isFirstTimeRate: price.isFirstTimeRate,
      priceAmount: price.amount,
      priceBreakdown: price.breakdown
    })

    if (!existingCustomer) {
      await markCustomerFirstBookingUsed(c.env.DB, customerId)
    }

    // Evidence-trail write: who accepted the Recording Consent Agreement, which
    // version, tied to this exact booking. Best-effort — never blocks the booking.
    await logConsentEvent(c.env.DB, {
      bookingId,
      documentType: 'recording_consent',
      documentVersion: CURRENT_RECORDING_CONSENT_VERSION,
      email: customerEmail,
      ipAddress: getClientIp(c.req.raw),
      userAgent: c.req.header('User-Agent') || null
    })

    // Create the Stripe Checkout Session right away — the customer is sent straight
    // into Stripe's hosted payment page next; there's no more "book now, pay later
    // via Cash App" gap. Commission math reuses the same splitCommission() helper
    // built in M1, now finally wired into a real payment.
    //
    // Fee percent is resolved from the ENGINEER's current subscription tier (Free
    // 10% / Pro 5% / Elite 2% — see lib/subscriptions.ts) rather than the old flat
    // platform-wide commission_percent setting. It's locked onto this booking row
    // right now (platform_fee_percent, via attachCheckoutSession below) and never
    // recalculated later even if the engineer upgrades/downgrades afterward.
    const commissionPercent = await getPlatformFeePercentForEngineer(c.env.DB, engineer)
    const { platformFee, engineerPayout } = splitCommission(price.amount, commissionPercent)

    const stripe = getStripeClient(c.env.STRIPE_SECRET_KEY)
    const origin = new URL(c.req.url).origin

    const checkout = await createBookingCheckoutSession(stripe, {
      bookingId,
      engineerStripeAccountId: engineer.stripe_account_id,
      grossAmountCents: toCents(price.amount),
      platformFeeCents: toCents(platformFee),
      customerEmail,
      description: `Recording session with ${engineer.display_name} — ${sessionDate} @ ${sessionTime} (${durationHours}h)`,
      successUrl: `${origin}/book/confirmation/${bookingId}?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/book/${engineer.id}`
    })

    await attachCheckoutSession(c.env.DB, bookingId, {
      checkoutSessionId: checkout.sessionId,
      platformFeeAmount: platformFee,
      engineerPayoutAmount: engineerPayout,
      platformFeePercent: commissionPercent
    })

    return c.json({ bookingId, checkoutUrl: checkout.url })
  } catch (err) {
    console.error(err)
    return c.json({ error: 'Something went wrong creating your booking.' }, 500)
  }
})

app.get('/book/confirmation/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  const booking = await getBookingById(c.env.DB, id)
  if (!booking) return c.notFound()
  const engineerDisplay = await getEngineerDisplayForBooking(c.env.DB, booking)
  return c.render(<ConfirmationPage booking={booking} engineerDisplay={engineerDisplay} />, { title: 'Booking Confirmed' })
})

// Lightweight polling endpoint the confirmation page hits a few times in case the
// Stripe webhook hasn't landed yet by the time the customer's browser redirects back
// from Checkout. Intentionally minimal — just the status, nothing sensitive.
app.get('/api/bookings/:id/status', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  const booking = await getBookingById(c.env.DB, id)
  if (!booking) return c.json({ status: null }, 404)
  return c.json({ status: booking.status })
})

// Note: the old Cash App deposit-screenshot flow (/book/pay/:id) was retired in
// Phase 3 M5 — payment now happens entirely inside Stripe Checkout, confirmed
// automatically via webhook (see src/routes/stripe-webhook.ts). "NO MORE CASHAPP."

// ---------- Customer status lookup ----------

app.get('/status', async (c) => {
  const email = c.req.query('email')
  if (!email) {
    return c.render(<StatusPage bookings={[]} />, { title: 'My Bookings' })
  }
  const bookings = await getBookingsByEmail(c.env.DB, email)
  return c.render(<StatusPage bookings={bookings} email={email} searched={true} />, { title: 'My Bookings' })
})

// ---------- Admin ----------

app.get('/admin/login', async (c) => {
  return c.render(<AdminLoginPage />, { title: 'Admin Login' })
})

app.post('/admin/login', async (c) => {
  const body = await c.req.parseBody()
  const password = (body['password'] as string) || ''
  const adminPassword = c.env.ADMIN_PASSWORD || ''

  if (!adminPassword) {
    return c.render(
      <AdminLoginPage error="Admin password not configured. Set ADMIN_PASSWORD secret." />,
      { title: 'Admin Login' }
    )
  }

  // Rate limit: max 10 attempts per 15 min per IP, checked BEFORE verifying the
  // password so a lockout can't be bypassed by a correct-on-the-11th-try guess.
  const limitKey = rateLimitKey('admin-login', c.req.raw)
  if (await isRateLimited(c.env.DB, limitKey)) {
    return c.render(<AdminLoginPage error="Too many attempts. Try again in a few minutes." />, { title: 'Admin Login' })
  }

  if (!constantTimeEqual(password, adminPassword)) {
    await recordAttempt(c.env.DB, limitKey)
    return c.render(<AdminLoginPage error="Incorrect password." />, { title: 'Admin Login' })
  }

  const token = await createAdminSession(c.env.DB)
  c.header('Set-Cookie', buildSessionCookie(token))
  return c.redirect('/admin')
})

app.post('/admin/logout', async (c) => {
  const token = getCookie(c.req.raw, ADMIN_COOKIE_NAME)
  if (token) {
    await destroyAdminSession(c.env.DB, token)
  }
  c.header('Set-Cookie', buildClearCookie())
  return c.redirect('/admin/login')
})

// Auth middleware for every /admin/* route. Kept as five explicit blocks (rather than
// relying on Hono's bare `app.use('/admin', ...)` to cascade) because that pattern
// does NOT reliably match nested sub-paths without an explicit `/*` — verified during
// the security audit by enumerating every `/admin/...` route definition and live-
// testing each one unauthenticated against production; all five blocks below cover
// 100% of the current route list (login/logout routes are intentionally excluded).
app.use('/admin', async (c, next) => {
  const authed = await isAdminAuthenticated(c.env.DB, c.req.raw)
  if (!authed) return c.redirect('/admin/login')
  await next()
})

app.use('/admin/bookings/*', async (c, next) => {
  const authed = await isAdminAuthenticated(c.env.DB, c.req.raw)
  if (!authed) return c.redirect('/admin/login')
  await next()
})

app.use('/admin/proof/*', async (c, next) => {
  const authed = await isAdminAuthenticated(c.env.DB, c.req.raw)
  if (!authed) return c.text('Unauthorized', 401)
  await next()
})

app.use('/admin/engineers/*', async (c, next) => {
  const authed = await isAdminAuthenticated(c.env.DB, c.req.raw)
  if (!authed) return c.redirect('/admin/login')
  await next()
})

app.use('/admin/settings/*', async (c, next) => {
  const authed = await isAdminAuthenticated(c.env.DB, c.req.raw)
  if (!authed) return c.redirect('/admin/login')
  await next()
})

app.get('/admin', async (c) => {
  const statusFilter = c.req.query('status') || 'all'
  const bookings = await getAllBookings(c.env.DB, statusFilter)
  const engineers = await getAllEngineersForAdmin(c.env.DB)
  const commissionPercent = await getCommissionPercent(c.env.DB)
  const priceIds = await getSubscriptionPriceIds(c.env.DB)
  const subscriptionPricesConfigured = !!(priceIds.pro_monthly && priceIds.pro_annual && priceIds.elite_monthly && priceIds.elite_annual)
  return c.render(
    <AdminDashboardPage
      bookings={bookings}
      statusFilter={statusFilter}
      engineers={engineers}
      commissionPercent={commissionPercent}
      subscriptionPricesConfigured={subscriptionPricesConfigured}
    />,
    { title: 'Admin Dashboard' }
  )
})

// One-time setup: creates the Stripe Products/Prices for Pro/Elite subscription tiers
// using the server-side STRIPE_SECRET_KEY secret (never a key pasted in chat/files —
// see subscriptions.ts header comment). Idempotent-by-convention only: it does NOT
// check whether prices already exist before creating new ones, so the admin UI hides
// this button entirely once platform_settings already has all 4 price IDs stored.
app.post('/admin/subscriptions/setup', async (c) => {
  if (!c.env.STRIPE_SECRET_KEY) return c.redirect('/admin')
  try {
    const stripe = getStripeClient(c.env.STRIPE_SECRET_KEY)
    const prices = await createSubscriptionProductAndPrices(stripe)
    await setSubscriptionPriceId(c.env.DB, 'pro_monthly', prices.pro_monthly)
    await setSubscriptionPriceId(c.env.DB, 'pro_annual', prices.pro_annual)
    await setSubscriptionPriceId(c.env.DB, 'elite_monthly', prices.elite_monthly)
    await setSubscriptionPriceId(c.env.DB, 'elite_annual', prices.elite_annual)
    await logAuditEvent(c.env.DB, { actorType: 'admin', action: 'subscriptions.setup', metadata: { productId: prices.productId } })
  } catch (err) {
    console.error('Subscription product/price setup failed', err)
  }
  return c.redirect('/admin')
})

// Platform-wide commission percentage — admin-editable, read live by the booking/payout
// flow instead of being hardcoded anywhere in app code (Phase 3 M1).
app.post('/admin/settings/commission', async (c) => {
  const body = await c.req.parseBody()
  const percent = parseFloat((body['commission_percent'] as string) || '')
  if (Number.isFinite(percent)) {
    await setCommissionPercent(c.env.DB, percent)
    await logAuditEvent(c.env.DB, { actorType: 'admin', action: 'commission.update', metadata: { percent } })
  }
  return c.redirect('/admin')
})

app.post('/admin/bookings/:id/status', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  const body = await c.req.parseBody()
  const status = body['status'] as string
  const validStatuses = ['confirmed', 'rejected', 'completed', 'cancelled']
  if (validStatuses.includes(status)) {
    await updateBookingStatus(c.env.DB, id, status)
    await logAuditEvent(c.env.DB, { actorType: 'admin', action: 'booking.status_change', targetType: 'booking', targetId: id, metadata: { status } })
  }
  return c.redirect('/admin')
})

app.get('/admin/proof/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  const booking = await getBookingById(c.env.DB, id)
  if (!booking || !booking.payment_proof_url) return c.notFound()

  const object = await c.env.R2.get(booking.payment_proof_url)
  if (!object) return c.notFound()

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream'
    }
  })
})

// Platform-oversight kill switch — suspend/reactivate any engineer profile. Separate
// from each engineer's own booking approval flow (Option A payment routing).
app.post('/admin/engineers/:id/suspend', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  const body = await c.req.parseBody()
  const suspended = body['suspended'] === '1'
  await setEngineerSuspended(c.env.DB, id, suspended)
  await logAuditEvent(c.env.DB, { actorType: 'admin', action: 'engineer.suspend', targetType: 'engineer_profile', targetId: id, metadata: { suspended } })
  return c.redirect('/admin?tab=engineers')
})

export default app
