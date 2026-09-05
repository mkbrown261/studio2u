// Review-request infrastructure (migration 0013) — schema/logic complete, Resend-ready.
//
// When a booking is marked 'completed' we create a review_requests row with a secure
// random token. Today (before Resend is wired) an admin manually copies the token link
// from the "Review Requests" queue (getReviewRequestQueueForAdmin) and sends it by hand;
// once Resend is wired, the same createReviewRequest() call is reused and `sent_at` gets
// stamped by the actual send instead of staying NULL forever. The token link itself
// (/r/:token) works today regardless — it's just not auto-emailed yet.

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export interface ReviewRequest {
  id: number
  booking_id: number
  token: string
  sent_at: string | null
  reminder_sent_at: string | null
  reviewed_at: string | null
  created_at: string
}

// Idempotent: a booking can only ever have one review_requests row (UNIQUE booking_id).
// Safe to call multiple times if the completion path is ever hit twice for a booking.
export async function createReviewRequestIfMissing(db: D1Database, bookingId: number): Promise<void> {
  const existing = await db.prepare('SELECT id FROM review_requests WHERE booking_id = ?').bind(bookingId).first()
  if (existing) return
  const token = randomToken()
  await db.prepare('INSERT INTO review_requests (booking_id, token) VALUES (?, ?)').bind(bookingId, token).run()
}

export async function getReviewRequestByToken(db: D1Database, token: string): Promise<ReviewRequest | null> {
  const row = await db.prepare('SELECT * FROM review_requests WHERE token = ?').bind(token).first()
  return (row as unknown as ReviewRequest) || null
}

export async function markReviewRequestReviewed(db: D1Database, bookingId: number): Promise<void> {
  await db
    .prepare(`UPDATE review_requests SET reviewed_at = CURRENT_TIMESTAMP WHERE booking_id = ? AND reviewed_at IS NULL`)
    .bind(bookingId)
    .run()
}

export async function markReviewRequestSent(db: D1Database, id: number): Promise<void> {
  await db.prepare(`UPDATE review_requests SET sent_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(id).run()
}

// Admin "manual nudge" queue: completed, unreviewed bookings joined with their
// review_requests row (created automatically at completion time) plus enough booking
// context to build a copy/paste message. Ordered oldest-completed-first since those are
// the most overdue for a nudge.
export interface ReviewRequestQueueRow {
  review_request_id: number
  token: string
  sent_at: string | null
  reminder_sent_at: string | null
  booking_id: number
  customer_name: string
  customer_email: string
  session_date: string
  completed_at: string
}

export async function getReviewRequestQueueForAdmin(db: D1Database): Promise<ReviewRequestQueueRow[]> {
  const { results } = await db
    .prepare(
      `SELECT
         rr.id as review_request_id, rr.token, rr.sent_at, rr.reminder_sent_at,
         b.id as booking_id, b.customer_name, b.customer_email, b.session_date,
         b.updated_at as completed_at
       FROM review_requests rr
       JOIN bookings b ON b.id = rr.booking_id
       WHERE b.status = 'completed' AND (b.reviewed IS NULL OR b.reviewed != 1) AND rr.reviewed_at IS NULL
       ORDER BY b.updated_at ASC`
    )
    .all()
  return (results as unknown as ReviewRequestQueueRow[]) || []
}
