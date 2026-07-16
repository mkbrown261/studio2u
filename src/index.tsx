import { Hono } from 'hono'
import { renderer } from './renderer'
import type { AppEnv } from './types'
import {
  getEngineer,
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
  updateBookingStatus
} from './lib/db'
import { calculatePrice, isWithinStandardAvailability } from './lib/pricing'
import { HomePage } from './pages/home'
import { BookPage } from './pages/book'
import { ConfirmationPage } from './pages/confirmation'
import { PayPage } from './pages/pay'
import { StatusPage } from './pages/status'
import { AdminLoginPage } from './pages/admin-login'
import { AdminDashboardPage } from './pages/admin-dashboard'
import { buildSessionCookie, buildClearCookie, expectedSessionToken, isAdminAuthenticated } from './lib/auth'

const app = new Hono<AppEnv>()

app.use(renderer)

// ---------- Public marketing pages ----------

app.get('/', async (c) => {
  const engineer = await getEngineer(c.env.DB, 1)
  const services = await getServices(c.env.DB)
  return c.render(<HomePage engineer={engineer} services={services} />, { title: 'Home' })
})

app.get('/book', async (c) => {
  return c.render(<BookPage />, { title: 'Book a Session' })
})

// ---------- Booking API ----------

app.get('/api/availability-check', async (c) => {
  const date = c.req.query('date') || ''
  const time = c.req.query('time') || ''
  const ok = isWithinStandardAvailability(date, time)
  return c.json({ withinStandardHours: ok })
})

app.get('/api/price-check', async (c) => {
  const email = (c.req.query('email') || '').trim().toLowerCase()
  const duration = parseFloat(c.req.query('duration') || '3')
  let isFirstTime = true
  if (email) {
    const customer = await findCustomerByEmail(c.env.DB, email)
    if (customer && customer.is_first_booking_used === 1) {
      isFirstTime = false
    }
  }
  const price = calculatePrice(duration, isFirstTime)
  return c.json(price)
})

app.post('/api/bookings', async (c) => {
  try {
    const body = await c.req.json()
    const {
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
      serviceSlug
    } = body

    if (!sessionDate || !sessionTime || !durationHours || !locationType || !customerName || !customerEmail || !customerPhone) {
      return c.json({ error: 'Missing required fields.' }, 400)
    }

    const service = await getServiceById(c.env.DB, 1) // Recording — the only bookable service in V1
    if (!service) {
      return c.json({ error: 'Booking service unavailable.' }, 500)
    }

    const existingCustomer = await findCustomerByEmail(c.env.DB, customerEmail)
    const isFirstTime = !existingCustomer || existingCustomer.is_first_booking_used === 0

    const customerId = await upsertCustomer(c.env.DB, {
      email: customerEmail,
      name: customerName,
      phone: customerPhone
    })

    const price = calculatePrice(parseFloat(durationHours), isFirstTime)
    const isCustomTimeRequest = !isWithinStandardAvailability(sessionDate, sessionTime)

    const bookingId = await createBooking(c.env.DB, {
      customerId,
      engineerId: 1,
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

    if (isFirstTime) {
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
  const engineer = await getEngineer(c.env.DB, booking.engineer_id)
  return c.render(<ConfirmationPage booking={booking} engineer={engineer} />, { title: 'Booking Confirmed' })
})

// ---------- Payment proof upload ----------

app.get('/book/pay/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  const booking = await getBookingById(c.env.DB, id)
  if (!booking) return c.notFound()
  const engineer = await getEngineer(c.env.DB, booking.engineer_id)
  return c.render(<PayPage booking={booking} engineer={engineer} />, { title: 'Submit Payment' })
})

app.post('/book/pay/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  const booking = await getBookingById(c.env.DB, id)
  if (!booking) return c.notFound()
  const engineer = await getEngineer(c.env.DB, booking.engineer_id)

  const formData = await c.req.formData()
  const file = formData.get('proof') as File | null
  const transactionId = (formData.get('transaction_id') as string) || ''

  if (!file && !transactionId) {
    return c.render(
      <PayPage booking={booking} engineer={engineer} error="Please upload a screenshot or enter a transaction ID." />,
      { title: 'Submit Payment' }
    )
  }

  let proofUrl: string | undefined
  if (file && file.size > 0) {
    const allowedTypes = ['image/png', 'image/jpeg', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      return c.render(
        <PayPage booking={booking} engineer={engineer} error="File must be PNG, JPEG, or PDF." />,
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

app.get('/admin', async (c) => {
  const statusFilter = c.req.query('status') || 'all'
  const bookings = await getAllBookings(c.env.DB, statusFilter)
  return c.render(<AdminDashboardPage bookings={bookings} statusFilter={statusFilter} />, { title: 'Admin Dashboard' })
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

export default app
