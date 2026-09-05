// Studio2U Messaging v1 (migrations/0017): one message thread per booking, gated to
// confirmed/completed bookings. Polling/real-time is out of scope (see migration
// comments) — callers just re-fetch on page load.

export interface Message {
  id: number
  booking_id: number
  sender_type: 'engineer' | 'customer'
  sender_name: string | null
  body: string
  read_by_engineer: number
  read_by_customer: number
  created_at: string
}

export async function getMessagesForBooking(db: D1Database, bookingId: number): Promise<Message[]> {
  const { results } = await db
    .prepare('SELECT * FROM messages WHERE booking_id = ? ORDER BY created_at ASC, id ASC')
    .bind(bookingId)
    .all()
  return (results as unknown as Message[]) || []
}

export async function sendMessage(
  db: D1Database,
  params: { bookingId: number; senderType: 'engineer' | 'customer'; senderName: string | null; body: string }
): Promise<number> {
  // A new message is unread by the side that didn't send it, and (trivially) already
  // "read" by its own sender.
  const readByEngineer = params.senderType === 'engineer' ? 1 : 0
  const readByCustomer = params.senderType === 'customer' ? 1 : 0
  const result = await db
    .prepare(
      `INSERT INTO messages (booking_id, sender_type, sender_name, body, read_by_engineer, read_by_customer)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(params.bookingId, params.senderType, params.senderName, params.body, readByEngineer, readByCustomer)
    .run()
  return result.meta.last_row_id as number
}

// Called when the engineer opens a booking's thread — marks everything as seen so the
// unread badge on the bookings list clears.
export async function markMessagesReadByEngineer(db: D1Database, bookingId: number): Promise<void> {
  await db.prepare('UPDATE messages SET read_by_engineer = 1 WHERE booking_id = ?').bind(bookingId).run()
}

export async function markMessagesReadByCustomer(db: D1Database, bookingId: number): Promise<void> {
  await db.prepare('UPDATE messages SET read_by_customer = 1 WHERE booking_id = ?').bind(bookingId).run()
}

// Unread counts keyed by booking_id, for badges on the bookings list — one query
// covering every booking for that engineer/customer rather than N+1 per-card queries.
export async function getUnreadCountsForEngineer(db: D1Database, engineerProfileId: number): Promise<Record<number, number>> {
  const { results } = await db
    .prepare(
      `SELECT m.booking_id as booking_id, COUNT(*) as cnt
       FROM messages m
       JOIN bookings b ON b.id = m.booking_id
       WHERE b.engineer_profile_id = ? AND m.read_by_engineer = 0 AND m.sender_type = 'customer'
       GROUP BY m.booking_id`
    )
    .bind(engineerProfileId)
    .all()
  const out: Record<number, number> = {}
  for (const row of (results as unknown as { booking_id: number; cnt: number }[]) || []) {
    out[row.booking_id] = row.cnt
  }
  return out
}

export async function getUnreadCountsForCustomerEmail(db: D1Database, email: string): Promise<Record<number, number>> {
  const { results } = await db
    .prepare(
      `SELECT m.booking_id as booking_id, COUNT(*) as cnt
       FROM messages m
       JOIN bookings b ON b.id = m.booking_id
       WHERE LOWER(b.customer_email) = LOWER(?) AND m.read_by_customer = 0 AND m.sender_type = 'engineer'
       GROUP BY m.booking_id`
    )
    .bind(email)
    .all()
  const out: Record<number, number> = {}
  for (const row of (results as unknown as { booking_id: number; cnt: number }[]) || []) {
    out[row.booking_id] = row.cnt
  }
  return out
}
