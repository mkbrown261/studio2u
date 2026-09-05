// Trust & Safety: dispute/refund flow (migration 0013).
//
// Either party (customer or engineer) can raise a dispute on a booking that went
// wrong. Admin reviews in a dedicated queue (/admin?tab=disputes) and can issue a
// full/partial Stripe refund straight from the dispute record — see
// lib/stripe.ts refundBookingPayment() for the actual Stripe call.

export type DisputeReason = 'no_show' | 'quality_issue' | 'billing_issue' | 'other'
export type DisputeStatus = 'open' | 'resolved_refunded' | 'resolved_partial_refund' | 'resolved_no_refund' | 'dismissed'

export interface Dispute {
  id: number
  booking_id: number
  raised_by: 'customer' | 'engineer'
  raised_by_user_id: number | null
  reason: DisputeReason
  description: string
  status: DisputeStatus
  admin_notes: string | null
  refund_amount: number | null
  stripe_refund_id: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export async function getOpenDisputeForBooking(db: D1Database, bookingId: number): Promise<Dispute | null> {
  const row = await db
    .prepare(`SELECT * FROM disputes WHERE booking_id = ? AND status = 'open' LIMIT 1`)
    .bind(bookingId)
    .first()
  return (row as unknown as Dispute) || null
}

export async function createDispute(
  db: D1Database,
  params: {
    bookingId: number
    raisedBy: 'customer' | 'engineer'
    raisedByUserId?: number | null
    reason: DisputeReason
    description: string
  }
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO disputes (booking_id, raised_by, raised_by_user_id, reason, description)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(params.bookingId, params.raisedBy, params.raisedByUserId ?? null, params.reason, params.description)
    .run()
  return result.meta.last_row_id as number
}

// Admin queue: open disputes first (oldest first, so nothing sits ignored), then
// resolved/dismissed ones for reference, most-recent first.
export async function getAllDisputesForAdmin(db: D1Database): Promise<Dispute[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM disputes
       ORDER BY CASE WHEN status = 'open' THEN 0 ELSE 1 END ASC,
                CASE WHEN status = 'open' THEN created_at END ASC,
                CASE WHEN status != 'open' THEN created_at END DESC`
    )
    .all()
  return (results as unknown as Dispute[]) || []
}

export async function getDisputeById(db: D1Database, id: number): Promise<Dispute | null> {
  const row = await db.prepare('SELECT * FROM disputes WHERE id = ?').bind(id).first()
  return (row as unknown as Dispute) || null
}

export async function resolveDispute(
  db: D1Database,
  id: number,
  params: {
    status: DisputeStatus
    adminNotes?: string | null
    refundAmount?: number | null
    stripeRefundId?: string | null
  }
): Promise<void> {
  await db
    .prepare(
      `UPDATE disputes SET
        status = ?, admin_notes = COALESCE(?, admin_notes),
        refund_amount = ?, stripe_refund_id = ?,
        resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .bind(params.status, params.adminNotes ?? null, params.refundAmount ?? null, params.stripeRefundId ?? null, id)
    .run()
}

export async function countOpenDisputes(db: D1Database): Promise<number> {
  const row = await db.prepare(`SELECT COUNT(*) as count FROM disputes WHERE status = 'open'`).first<{ count: number }>()
  return row?.count || 0
}
