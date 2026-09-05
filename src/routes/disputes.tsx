import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { getBookingById } from '../lib/db'
import { getSessionUser } from '../lib/session'
import { createDispute, getOpenDisputeForBooking, type DisputeReason } from '../lib/db-disputes'
import { DisputeFormPage } from '../pages/dispute-form'

export const disputesRoutes = new Hono<AppEnv>()

const VALID_REASONS: DisputeReason[] = ['no_show', 'quality_issue', 'billing_issue', 'other']

// Gate: same shape as the review flow (loadReviewableBooking in reviews.tsx) — a booking
// is only disputable once it's confirmed or completed (i.e. money has actually moved),
// and the requester must either match the customer email on file (?email=) or be logged
// in as that customer. Engineers dispute through their own dashboard session instead
// (see dashboard.tsx), so this public route only ever raises disputes as 'customer'.
async function loadDisputableBooking(c: any, id: number) {
  const booking = await getBookingById(c.env.DB, id)
  if (!booking) return { booking: null, reason: 'not_found' as const }
  if (booking.status !== 'confirmed' && booking.status !== 'completed') {
    return { booking: null, reason: 'not_eligible' as const }
  }

  const existingOpen = await getOpenDisputeForBooking(c.env.DB, id)
  if (existingOpen) return { booking: null, reason: 'already_open' as const }

  const providedEmail = (c.req.query('email') || '').trim().toLowerCase()
  const sessionUser = await getSessionUser(c.env.DB, c.req.raw)
  const authorizedByEmail = providedEmail && providedEmail === booking.customer_email.toLowerCase()
  const authorizedBySession = sessionUser && sessionUser.email.toLowerCase() === booking.customer_email.toLowerCase()

  if (!authorizedByEmail && !authorizedBySession) {
    return { booking: null, reason: 'unauthorized' as const }
  }

  return { booking, reason: null }
}

disputesRoutes.get('/disputes/new/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  const { booking, reason } = await loadDisputableBooking(c, id)
  if (!booking) {
    return c.render(
      <div class="max-w-lg mx-auto px-5 py-24 text-center text-muted">
        <i class="fa-solid fa-circle-exclamation text-3xl mb-4 text-gold"></i>
        <p>
          {reason === 'already_open'
            ? "There's already an open report for this booking — our team is reviewing it."
            : reason === 'unauthorized'
            ? 'We could not verify this is your booking. Try the link from your booking status page.'
            : "This booking isn't eligible for a dispute report yet."}
        </p>
      </div>,
      { title: 'Report Unavailable' }
    )
  }
  return c.render(<DisputeFormPage booking={booking} />, { title: 'Report a Problem' })
})

disputesRoutes.post('/disputes/new/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  const body = await c.req.parseBody()
  const email = ((body['email'] as string) || '').trim().toLowerCase()
  const reason = (body['reason'] as string) || ''
  const description = ((body['description'] as string) || '').trim()

  const { booking, reason: gateReason } = await loadDisputableBooking(c, id)
  if (!booking) {
    return c.text(gateReason === 'already_open' ? 'Already reported' : 'Unauthorized', 403)
  }
  if (email !== booking.customer_email.toLowerCase()) {
    return c.text('Unauthorized', 403)
  }
  if (!VALID_REASONS.includes(reason as DisputeReason)) {
    return c.render(<DisputeFormPage booking={booking} error="Please choose a valid reason." />, { title: 'Report a Problem' })
  }
  if (description.length < 10) {
    return c.render(<DisputeFormPage booking={booking} error="Please add a few more details (at least 10 characters) so we can help." />, {
      title: 'Report a Problem'
    })
  }

  const sessionUser = await getSessionUser(c.env.DB, c.req.raw)

  await createDispute(c.env.DB, {
    bookingId: booking.id,
    raisedBy: 'customer',
    raisedByUserId: sessionUser?.id ?? null,
    reason: reason as DisputeReason,
    description
  })

  return c.render(
    <div class="max-w-lg mx-auto px-5 py-24 text-center">
      <i class="fa-solid fa-circle-check text-3xl mb-4 text-emerald-400"></i>
      <h1 class="font-display text-2xl font-bold mb-3">Report received</h1>
      <p class="text-muted mb-6">
        Our team will review your report on booking #{booking.id} and follow up by email. Thanks for letting us know.
      </p>
      <a href={`/status?email=${encodeURIComponent(booking.customer_email)}`} class="text-gold hover:underline">
        Back to my bookings
      </a>
    </div>,
    { title: 'Report Received' }
  )
})
