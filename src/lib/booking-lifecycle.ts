// Shared hook for "a booking just became completed" — called from both the admin status
// route (index.tsx) and the engineer's own dashboard status route (routes/dashboard.tsx)
// so neither path can complete a booking without also triggering these side effects.
// Every step here is best-effort and independently try/caught: a hiccup in the referral
// or review-request pipeline must never leave a booking stuck or throw a 500 back to the
// admin/engineer who just clicked "Mark Completed".
import { createReviewRequestIfMissing } from './db-review-requests'
import { maybeCreditReferralReward } from './db-referrals'
import { logEvent } from './analytics'
import { getBookingById } from './db'
import { deductPackageHours } from './db-packages'

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
    // Packages: this is THE redemption moment (see migrations/0016_packages.sql) — a
    // booking made against an active package has package_purchase_id set and was priced
    // at $0, so no Stripe charge happens here; we just deduct the hours it used now that
    // the engineer has confirmed the session actually happened.
    const booking = await getBookingById(db, bookingId)
    if (booking?.package_purchase_id) {
      await deductPackageHours(db, booking.package_purchase_id, booking.duration_hours)
    }
  } catch (err) {
    console.error('deductPackageHours failed', err)
  }
  try {
    await logEvent(db, { eventType: 'booking_completed', metadata: { bookingId } })
  } catch (err) {
    console.error('logEvent(booking_completed) failed', err)
  }
}
