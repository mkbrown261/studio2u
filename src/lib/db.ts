import type { Booking, Engineer, Service } from '../types'

export async function getEngineer(db: D1Database, id = 1): Promise<Engineer | null> {
  const row = await db.prepare('SELECT * FROM engineers WHERE id = ?').bind(id).first()
  return (row as unknown as Engineer) || null
}

export async function getServices(db: D1Database): Promise<Service[]> {
  const { results } = await db.prepare('SELECT * FROM services ORDER BY sort_order ASC').all()
  return (results as unknown as Service[]) || []
}

export async function getServiceBySlug(db: D1Database, slug: string): Promise<Service | null> {
  const row = await db.prepare('SELECT * FROM services WHERE slug = ?').bind(slug).first()
  return (row as unknown as Service) || null
}

export async function getServiceById(db: D1Database, id: number): Promise<Service | null> {
  const row = await db.prepare('SELECT * FROM services WHERE id = ?').bind(id).first()
  return (row as unknown as Service) || null
}

export async function findCustomerByEmail(db: D1Database, email: string) {
  const row = await db
    .prepare('SELECT * FROM customers WHERE email = ?')
    .bind(email.trim().toLowerCase())
    .first()
  return row as { id: number; email: string; name: string; phone: string | null; is_first_booking_used: number } | null
}

export async function upsertCustomer(db: D1Database, params: { email: string; name: string; phone: string }) {
  const email = params.email.trim().toLowerCase()
  const existing = await findCustomerByEmail(db, email)
  if (existing) {
    await db
      .prepare('UPDATE customers SET name = ?, phone = ? WHERE id = ?')
      .bind(params.name, params.phone, existing.id)
      .run()
    return existing.id
  }
  const result = await db
    .prepare('INSERT INTO customers (email, name, phone) VALUES (?, ?, ?)')
    .bind(email, params.name, params.phone)
    .run()
  return result.meta.last_row_id as number
}

export async function markCustomerFirstBookingUsed(db: D1Database, customerId: number) {
  await db.prepare('UPDATE customers SET is_first_booking_used = 1 WHERE id = ?').bind(customerId).run()
}

export interface CreateBookingParams {
  customerId: number
  engineerId: number
  engineerProfileId?: number | null
  customerUserId?: number | null
  serviceId: number
  sessionDate: string
  sessionTime: string
  durationHours: number
  isCustomTimeRequest: boolean
  locationType: string
  locationAddress: string
  specialNotes: string
  songCount: number | null
  genre: string
  customerName: string
  customerEmail: string
  customerPhone: string
  isFirstTimeRate: boolean
  priceAmount: number
  priceBreakdown: string
}

export async function createBooking(db: D1Database, p: CreateBookingParams) {
  const result = await db
    .prepare(
      `INSERT INTO bookings (
        customer_id, engineer_id, engineer_profile_id, customer_user_id, service_id,
        session_date, session_time, duration_hours, is_custom_time_request,
        location_type, location_address, special_notes, song_count, genre,
        customer_name, customer_email, customer_phone,
        is_first_time_rate, price_amount, price_breakdown,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      p.customerId,
      p.engineerId,
      p.engineerProfileId ?? null,
      p.customerUserId ?? null,
      p.serviceId,
      p.sessionDate,
      p.sessionTime,
      p.durationHours,
      p.isCustomTimeRequest ? 1 : 0,
      p.locationType,
      p.locationAddress,
      p.specialNotes,
      p.songCount,
      p.genre,
      p.customerName,
      p.customerEmail.trim().toLowerCase(),
      p.customerPhone,
      p.isFirstTimeRate ? 1 : 0,
      p.priceAmount,
      p.priceBreakdown,
      'pending_payment'
    )
    .run()
  return result.meta.last_row_id as number
}

// "First time" is now scoped per-engineer: has this email ever booked with THIS
// specific engineer profile before?
export async function hasCustomerBookedEngineerBefore(
  db: D1Database,
  email: string,
  engineerProfileId: number
): Promise<boolean> {
  const row = await db
    .prepare('SELECT id FROM bookings WHERE customer_email = ? AND engineer_profile_id = ? LIMIT 1')
    .bind(email.trim().toLowerCase(), engineerProfileId)
    .first()
  return !!row
}

export async function getBookingsByEngineerProfile(db: D1Database, engineerProfileId: number): Promise<Booking[]> {
  const { results } = await db
    .prepare('SELECT * FROM bookings WHERE engineer_profile_id = ? ORDER BY created_at DESC')
    .bind(engineerProfileId)
    .all()
  return (results as unknown as Booking[]) || []
}

export async function getCompletedUnreviewedBookingsByEmail(db: D1Database, email: string): Promise<Booking[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM bookings WHERE customer_email = ? AND status = 'completed' AND reviewed = 0 AND engineer_profile_id IS NOT NULL ORDER BY session_date DESC`
    )
    .bind(email.trim().toLowerCase())
    .all()
  return (results as unknown as Booking[]) || []
}

export async function getBookingById(db: D1Database, id: number): Promise<Booking | null> {
  const row = await db.prepare('SELECT * FROM bookings WHERE id = ?').bind(id).first()
  return (row as unknown as Booking) || null
}

export async function getBookingsByEmail(db: D1Database, email: string): Promise<Booking[]> {
  const { results } = await db
    .prepare('SELECT * FROM bookings WHERE customer_email = ? ORDER BY session_date DESC, session_time DESC')
    .bind(email.trim().toLowerCase())
    .all()
  return (results as unknown as Booking[]) || []
}

export async function getAllBookings(db: D1Database, statusFilter?: string): Promise<Booking[]> {
  if (statusFilter && statusFilter !== 'all') {
    const { results } = await db
      .prepare('SELECT * FROM bookings WHERE status = ? ORDER BY created_at DESC')
      .bind(statusFilter)
      .all()
    return (results as unknown as Booking[]) || []
  }
  const { results } = await db.prepare('SELECT * FROM bookings ORDER BY created_at DESC').all()
  return (results as unknown as Booking[]) || []
}

export async function attachPaymentProof(
  db: D1Database,
  bookingId: number,
  params: { proofUrl?: string; transactionId?: string }
) {
  await db
    .prepare(
      `UPDATE bookings SET
        payment_proof_url = COALESCE(?, payment_proof_url),
        payment_transaction_id = COALESCE(?, payment_transaction_id),
        status = 'pending_approval',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`
    )
    .bind(params.proofUrl || null, params.transactionId || null, bookingId)
    .run()
}

export async function updateBookingStatus(
  db: D1Database,
  bookingId: number,
  status: string,
  adminNotes?: string
) {
  await db
    .prepare(
      `UPDATE bookings SET status = ?, admin_notes = COALESCE(?, admin_notes), updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    )
    .bind(status, adminNotes || null, bookingId)
    .run()
}
