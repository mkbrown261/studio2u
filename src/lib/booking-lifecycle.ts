// Shared hook for "a booking just became completed" — called from both the admin status
// route (index.tsx) and the engineer's own dashboard status route (routes/dashboard.tsx)
// so neither path can complete a booking without also triggering these side effects.
// Every step here is best-effort and independently try/caught: a hiccup in the referral
// or review-request pipeline must never leave a booking stuck or throw a 500 back to the
// admin/engineer who just clicked "Mark Completed".
import { createReviewRequestIfMissing } from './db-review-requests'
import { maybeCreditReferralReward } from './db-referrals'
import { logEvent } from './analytics'

export async function onBookingCompleted(db: D1Database, bookingId: number): Promise<void> {
  try {
    await createReviewRequestIfMissing(db, bookingId)
  } catch (err) {
    console.error('createReviewRequestIfMissing failed', err)
  }
  try {
    await maybeCreditReferralReward(db, bookingId)
  } catch (err) {
    console.error('maybeCreditReferralReward failed', err)
  }
  try {
    await logEvent(db, { eventType: 'booking_completed', metadata: { bookingId } })
  } catch (err) {
    console.error('logEvent(booking_completed) failed', err)
  }
}
