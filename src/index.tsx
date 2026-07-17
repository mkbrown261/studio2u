import { Hono } from 'hono'
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
  attachPaymentProof,
  updateBookingStatus,
  hasCustomerBookedEngineerBefore
} from './lib/db'
import { calculatePrice, isWithinStandardAvailability } from './lib/pricing'
import { getEngineerProfileById, getEngineerDisplayForBooking, getAllEngineersForAdmin, setEngineerSuspended } from './lib/db-engineers'
import { getCommissionPercent, setCommissionPercent } from './lib/db-settings'
import { HomePage } from './pages/home'
import { BookPage } from './pages/book'
import { ConfirmationPage } from './pages/confirmation'
import { PayPage } from './pages/pay'
import { StatusPage } from './pages/status'
import { AdminLoginPage } from './pages/admin-login'
import { AdminDashboardPage } from './pages/admin-dashboard'
import { buildSessionCookie, buildClearCookie, expectedSessionToken, isAdminAuthenticated } from './lib/auth'
import { authRoutes } from './routes/auth'
import { dashboardRoutes } from './routes/dashboard'
import { engineersRoutes } from './routes/engineers'
import { reviewsRoutes } from './routes/reviews'

const app = new Hono<AppEnv>()

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

// Customer picks an engineer first (from the directory), then books that specific
// engineer here. Pricing is pulled from that engineer's own profile, not a fixed rate.
app.get('/book/:engineerId', async (c) => {
  const engineerId = parseInt(c.req.param('engineerId'), 10)
  const engineer = await getEngineerProfileById(c.env.DB, engineerId)
  if (!engineer || engineer.is_published !== 1 || engineer.is_suspended === 1) {
    return c.notFound()
  }
  return c.render(<BookPage engineer={engineer} />, { title: `Book ${engineer.display_name}` })
})

// Legacy /book with no engineer picked — send them to the directory instead.
app.get('/book', async (c) => {
  return c.redirect('/engineers')
})

// ---------- Booking API ----------

app.get('/api/availability-check', async (c) => {
  const date = c.req.query('date') || ''
  const time = c.req.query('time') || ''
  const ok = isWithinStandardAvailability(date, time)
  return c.json({ withinStandardHours: ok })
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
      customerPhone
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

    const engineer = await getEngineerProfileById(c.env.DB, parseInt(engineerId, 10))
    if (!engineer || engineer.is_published !== 1 || engineer.is_suspended === 1) {
      return c.json({ error: 'This engineer is not available for booking.' }, 404)
    }

    const service = await getServiceById(c.env.DB, 1) // Recording — the only bookable service in V1
    if (!service) {
      return c.json({ error: 'Booking service unavailable.' }, 500)
    }

    const existingCustomer = await findCustomerByEmail(c.env.DB, customerEmail)
    const isFirstTimeWithEngineer = !(await hasCustomerBookedEngineerBefore(c.env.DB, customerEmail, engineer.id))

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
    const isCustomTimeRequest = !isWithinStandardAvailability(sessionDate, sessionTime)

    const bookingId = await createBooking(c.env.DB, {
      customerId,
      engineerId: 1, // legacy FK kept for backward compat; real routing uses engineerProfileId
      engineerProfileId: engineer.id,
      serviceId: service.id,
      sessionDate,
      sessionTime,
      durationHours: parseFloat(durationHours),
      isCustomTimeRequest,
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

    return c.json({ bookingId })
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

// ---------- Payment proof upload ----------

app.get('/book/pay/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  const booking = await getBookingById(c.env.DB, id)
  if (!booking) return c.notFound()
  const engineerDisplay = await getEngineerDisplayForBooking(c.env.DB, booking)
  return c.render(<PayPage booking={booking} engineerDisplay={engineerDisplay} />, { title: 'Submit Payment' })
})

app.post('/book/pay/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  const booking = await getBookingById(c.env.DB, id)
  if (!booking) return c.notFound()
  const engineerDisplay = await getEngineerDisplayForBooking(c.env.DB, booking)

  const formData = await c.req.formData()
  const file = formData.get('proof') as File | null
  const transactionId = (formData.get('transaction_id') as string) || ''

  if (!file && !transactionId) {
    return c.render(
      <PayPage booking={booking} engineerDisplay={engineerDisplay} error="Please upload a screenshot or enter a transaction ID." />,
      { title: 'Submit Payment' }
    )
  }

  let proofUrl: string | undefined
  if (file && file.size > 0) {
    const allowedTypes = ['image/png', 'image/jpeg', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      return c.render(
        <PayPage booking={booking} engineerDisplay={engineerDisplay} error="File must be PNG, JPEG, or PDF." />,
        { title: 'Submit Payment' }
      )
    }
    const ext = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/png' ? 'png' : 'jpg'
    const key = `payment-proofs/booking-${id}-${Date.now()}.${ext}`
    const arrayBuffer = await file.arrayBuffer()
    await c.env.R2.put(key, arrayBuffer, { httpMetadata: { contentType: file.type } })
    proofUrl = key
  }

  await attachPaymentProof(c.env.DB, id, { proofUrl, transactionId })

  return c.redirect(`/status?email=${encodeURIComponent(booking.customer_email)}`)
})

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

  if (password !== adminPassword) {
    return c.render(<AdminLoginPage error="Incorrect password." />, { title: 'Admin Login' })
  }

  const token = await expectedSessionToken(adminPassword)
  c.header('Set-Cookie', buildSessionCookie(token))
  return c.redirect('/admin')
})

app.post('/admin/logout', async (c) => {
  c.header('Set-Cookie', buildClearCookie())
  return c.redirect('/admin/login')
})

app.use('/admin', async (c, next) => {
  const authed = await isAdminAuthenticated(c.req.raw, c.env.ADMIN_PASSWORD || '')
  if (!authed) return c.redirect('/admin/login')
  await next()
})

app.use('/admin/bookings/*', async (c, next) => {
  const authed = await isAdminAuthenticated(c.req.raw, c.env.ADMIN_PASSWORD || '')
  if (!authed) return c.redirect('/admin/login')
  await next()
})

app.use('/admin/proof/*', async (c, next) => {
  const authed = await isAdminAuthenticated(c.req.raw, c.env.ADMIN_PASSWORD || '')
  if (!authed) return c.text('Unauthorized', 401)
  await next()
})

app.use('/admin/engineers/*', async (c, next) => {
  const authed = await isAdminAuthenticated(c.req.raw, c.env.ADMIN_PASSWORD || '')
  if (!authed) return c.redirect('/admin/login')
  await next()
})

app.use('/admin/settings/*', async (c, next) => {
  const authed = await isAdminAuthenticated(c.req.raw, c.env.ADMIN_PASSWORD || '')
  if (!authed) return c.redirect('/admin/login')
  await next()
})

app.get('/admin', async (c) => {
  const statusFilter = c.req.query('status') || 'all'
  const bookings = await getAllBookings(c.env.DB, statusFilter)
  const engineers = await getAllEngineersForAdmin(c.env.DB)
  const commissionPercent = await getCommissionPercent(c.env.DB)
  return c.render(
    <AdminDashboardPage bookings={bookings} statusFilter={statusFilter} engineers={engineers} commissionPercent={commissionPercent} />,
    { title: 'Admin Dashboard' }
  )
})

// Platform-wide commission percentage — admin-editable, read live by the booking/payout
// flow instead of being hardcoded anywhere in app code (Phase 3 M1).
app.post('/admin/settings/commission', async (c) => {
  const body = await c.req.parseBody()
  const percent = parseFloat((body['commission_percent'] as string) || '')
  if (Number.isFinite(percent)) {
    await setCommissionPercent(c.env.DB, percent)
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
  return c.redirect('/admin?tab=engineers')
})

export default app
