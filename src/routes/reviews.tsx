import { Hono } from 'hono'
import type { AppEnv } from '../types'
import { getBookingById } from '../lib/db'
import { getReviewByBookingId, createReview } from '../lib/db-engineers'
import { getSessionUser } from '../lib/session'
import { ReviewFormPage } from '../pages/review-form'

export const reviewsRoutes = new Hono<AppEnv>()

// Gate: only the customer on a completed, unreviewed booking with a real engineer_profile
// link can review it. We check by email match (?email=) since not every booking is tied
// to a logged-in account yet.
async function loadReviewableBooking(c: any, id: number) {
  const booking = await getBookingById(c.env.DB, id)
  if (!booking) return { booking: null, reason: 'not_found' as const }
  if (booking.status !== 'completed') return { booking: null, reason: 'not_completed' as const }
  if (!booking.engineer_profile_id) return { booking: null, reason: 'no_engineer' as const }

  const existingReview = await getReviewByBookingId(c.env.DB, id)
  if (existingReview) return { booking: null, reason: 'already_reviewed' as const }

  const providedEmail = (c.req.query('email') || '').trim().toLowerCase()
  const sessionUser = await getSessionUser(c.env.DB, c.req.raw)
  const authorizedByEmail = providedEmail && providedEmail === booking.customer_email.toLowerCase()
  const authorizedBySession = sessionUser && sessionUser.email.toLowerCase() === booking.customer_email.toLowerCase()

  if (!authorizedByEmail && !authorizedBySession) {
    return { booking: null, reason: 'unauthorized' as const }
  }

  return { booking, reason: null }
}

reviewsRoutes.get('/review/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  const { booking, reason } = await loadReviewableBooking(c, id)
  if (!booking) {
    return c.render(
      <div class="max-w-lg mx-auto px-5 py-24 text-center text-muted">
        <i class="fa-solid fa-circle-exclamation text-3xl mb-4 text-gold"></i>
        <p>
          {reason === 'already_reviewed'
            ? "You've already reviewed this booking."
            : reason === 'unauthorized'
            ? 'We could not verify this is your booking. Try the review link from your booking status page.'
            : "This booking isn't eligible for a review yet."}
        </p>
      </div>,
      { title: 'Review Unavailable' }
    )
  }
  return c.render(<ReviewFormPage booking={booking} />, { title: 'Leave a Review' })
})

reviewsRoutes.post('/review/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  const body = await c.req.parseBody()
  const email = ((body['email'] as string) || '').trim().toLowerCase()
  const micRating = parseInt((body['mic_rating'] as string) || '0', 10)
  const comment = ((body['comment'] as string) || '').trim()

  const booking = await getBookingById(c.env.DB, id)
  if (!booking || booking.status !== 'completed' || !booking.engineer_profile_id) {
    return c.notFound()
  }
  if (email !== booking.customer_email.toLowerCase()) {
    return c.text('Unauthorized', 403)
  }
  const existingReview = await getReviewByBookingId(c.env.DB, id)
  if (existingReview) {
    return c.redirect(`/status?email=${encodeURIComponent(booking.customer_email)}`)
  }
  if (micRating < 1 || micRating > 5) {
    return c.render(<ReviewFormPage booking={booking} error="Please select a mic rating from 1 to 5." />, { title: 'Leave a Review' })
  }

  const sessionUser = await getSessionUser(c.env.DB, c.req.raw)

  await createReview(c.env.DB, {
    bookingId: booking.id,
    engineerProfileId: booking.engineer_profile_id,
    customerUserId: sessionUser?.id ?? null,
    customerName: booking.customer_name,
    micRating,
    comment
  })

  return c.redirect(`/status?email=${encodeURIComponent(booking.customer_email)}`)
})
