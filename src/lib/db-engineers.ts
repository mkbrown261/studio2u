export interface EngineerProfile {
  id: number
  user_id: number
  display_name: string
  bio: string | null
  photo_url: string | null
  hourly_rate: number
  first_time_discount_amount: number | null
  first_time_discount_hours: number | null
  genres: string | null
  travel_radius_miles: number
  equipment_text: string | null
  equipment_photo_url: string | null
  cashapp_handle: string | null
  location_label: string | null
  lat: number | null
  lng: number | null
  is_published: number
  is_new: number
  is_suspended: number
  rating_avg: number
  rating_count: number
  created_at: string
  updated_at: string
}

export async function getEngineerProfileByUserId(db: D1Database, userId: number): Promise<EngineerProfile | null> {
  const row = await db.prepare('SELECT * FROM engineer_profiles WHERE user_id = ?').bind(userId).first()
  return (row as unknown as EngineerProfile) || null
}

export async function getEngineerProfileById(db: D1Database, id: number): Promise<EngineerProfile | null> {
  const row = await db.prepare('SELECT * FROM engineer_profiles WHERE id = ?').bind(id).first()
  return (row as unknown as EngineerProfile) || null
}

export async function getPublishedEngineers(db: D1Database): Promise<EngineerProfile[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM engineer_profiles WHERE is_published = 1 AND is_suspended = 0 ORDER BY rating_avg DESC, created_at ASC`
    )
    .all()
  return (results as unknown as EngineerProfile[]) || []
}

export async function getAllEngineersForAdmin(db: D1Database): Promise<EngineerProfile[]> {
  const { results } = await db.prepare('SELECT * FROM engineer_profiles ORDER BY created_at DESC').all()
  return (results as unknown as EngineerProfile[]) || []
}

export interface UpsertEngineerParams {
  userId: number
  displayName: string
  bio: string
  photoUrl?: string
  hourlyRate: number
  firstTimeDiscountAmount: number | null
  firstTimeDiscountHours: number | null
  genres: string
  travelRadiusMiles: number
  equipmentText: string
  equipmentPhotoUrl?: string
  cashappHandle: string
  locationLabel: string
  lat: number | null
  lng: number | null
}

export async function upsertEngineerProfile(db: D1Database, p: UpsertEngineerParams): Promise<number> {
  const existing = await getEngineerProfileByUserId(db, p.userId)

  if (existing) {
    await db
      .prepare(
        `UPDATE engineer_profiles SET
          display_name = ?, bio = ?, photo_url = COALESCE(?, photo_url),
          hourly_rate = ?, first_time_discount_amount = ?, first_time_discount_hours = ?,
          genres = ?, travel_radius_miles = ?,
          equipment_text = ?, equipment_photo_url = COALESCE(?, equipment_photo_url),
          cashapp_handle = ?, location_label = ?, lat = ?, lng = ?,
          is_published = 1, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?`
      )
      .bind(
        p.displayName,
        p.bio,
        p.photoUrl || null,
        p.hourlyRate,
        p.firstTimeDiscountAmount,
        p.firstTimeDiscountHours,
        p.genres,
        p.travelRadiusMiles,
        p.equipmentText,
        p.equipmentPhotoUrl || null,
        p.cashappHandle,
        p.locationLabel,
        p.lat,
        p.lng,
        p.userId
      )
      .run()
    return existing.id
  }

  const result = await db
    .prepare(
      `INSERT INTO engineer_profiles (
        user_id, display_name, bio, photo_url, hourly_rate,
        first_time_discount_amount, first_time_discount_hours,
        genres, travel_radius_miles, equipment_text, equipment_photo_url,
        cashapp_handle, location_label, lat, lng, is_published
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
    )
    .bind(
      p.userId,
      p.displayName,
      p.bio,
      p.photoUrl || null,
      p.hourlyRate,
      p.firstTimeDiscountAmount,
      p.firstTimeDiscountHours,
      p.genres,
      p.travelRadiusMiles,
      p.equipmentText,
      p.equipmentPhotoUrl || null,
      p.cashappHandle,
      p.locationLabel,
      p.lat,
      p.lng
    )
    .run()
  return result.meta.last_row_id as number
}

export async function setEngineerSuspended(db: D1Database, id: number, suspended: boolean) {
  await db.prepare('UPDATE engineer_profiles SET is_suspended = ? WHERE id = ?').bind(suspended ? 1 : 0, id).run()
}

// Resolve display name / Cash App handle / photo for a booking — used on confirmation,
// pay, and status pages so they never hardcode "Mason" once a booking is tied to a real
// engineer_profile. Falls back to platform defaults for legacy/pre-migration bookings.
export async function getEngineerDisplayInfoForBooking(
  db: D1Database,
  booking: { engineer_profile_id: number | null }
): Promise<{ name: string; cashappHandle: string; photoUrl: string | null }> {
  if (booking.engineer_profile_id) {
    const profile = await getEngineerProfileById(db, booking.engineer_profile_id)
    if (profile) {
      return {
        name: profile.display_name,
        cashappHandle: profile.cashapp_handle || '$KEYZGMG',
        photoUrl: profile.photo_url
      }
    }
  }
  return { name: 'Studio2You', cashappHandle: '$KEYZGMG', photoUrl: null }
}

export async function recalculateEngineerRating(db: D1Database, engineerProfileId: number) {
  const row = await db
    .prepare('SELECT AVG(mic_rating) as avg_rating, COUNT(*) as count FROM reviews WHERE engineer_profile_id = ?')
    .bind(engineerProfileId)
    .first<{ avg_rating: number | null; count: number }>()

  const avg = row?.avg_rating || 0
  const count = row?.count || 0

  await db
    .prepare('UPDATE engineer_profiles SET rating_avg = ?, rating_count = ?, is_new = 0 WHERE id = ?')
    .bind(avg, count, engineerProfileId)
    .run()
}

// ---------- Portfolio ----------

export interface PortfolioItem {
  id: number
  engineer_profile_id: number
  title: string
  embed_url: string
  sort_order: number
}

export async function getPortfolioItems(db: D1Database, engineerProfileId: number): Promise<PortfolioItem[]> {
  const { results } = await db
    .prepare('SELECT * FROM portfolio_items WHERE engineer_profile_id = ? ORDER BY sort_order ASC, id ASC')
    .bind(engineerProfileId)
    .all()
  return (results as unknown as PortfolioItem[]) || []
}

export async function addPortfolioItem(db: D1Database, engineerProfileId: number, title: string, embedUrl: string) {
  await db
    .prepare('INSERT INTO portfolio_items (engineer_profile_id, title, embed_url) VALUES (?, ?, ?)')
    .bind(engineerProfileId, title, embedUrl)
    .run()
}

export async function deletePortfolioItem(db: D1Database, id: number, engineerProfileId: number) {
  await db
    .prepare('DELETE FROM portfolio_items WHERE id = ? AND engineer_profile_id = ?')
    .bind(id, engineerProfileId)
    .run()
}

// ---------- Reviews ----------

export interface Review {
  id: number
  booking_id: number
  engineer_profile_id: number
  customer_user_id: number | null
  customer_name: string
  mic_rating: number
  comment: string | null
  created_at: string
}

export async function getReviewsForEngineer(db: D1Database, engineerProfileId: number): Promise<Review[]> {
  const { results } = await db
    .prepare('SELECT * FROM reviews WHERE engineer_profile_id = ? ORDER BY created_at DESC')
    .bind(engineerProfileId)
    .all()
  return (results as unknown as Review[]) || []
}

export async function getReviewByBookingId(db: D1Database, bookingId: number): Promise<Review | null> {
  const row = await db.prepare('SELECT * FROM reviews WHERE booking_id = ?').bind(bookingId).first()
  return (row as unknown as Review) || null
}

// Best-effort display info for a booking, preferring the new per-engineer profile and
// falling back to the legacy single-row `engineers` seed (Mason, Phase 1) for any
// bookings that predate the marketplace migration.
export async function getEngineerDisplayForBooking(
  db: D1Database,
  booking: { engineer_profile_id: number | null; engineer_id: number }
): Promise<{ name: string; cashappHandle: string | null; photoUrl: string | null }> {
  if (booking.engineer_profile_id) {
    const profile = await getEngineerProfileById(db, booking.engineer_profile_id)
    if (profile) {
      return { name: profile.display_name, cashappHandle: profile.cashapp_handle, photoUrl: profile.photo_url }
    }
  }
  const legacy = await db.prepare('SELECT * FROM engineers WHERE id = ?').bind(booking.engineer_id).first<{
    name: string
    cashapp_handle: string | null
  }>()
  if (legacy) {
    return { name: legacy.name, cashappHandle: legacy.cashapp_handle, photoUrl: null }
  }
  return { name: 'Studio2You Engineer', cashappHandle: '$KEYZGMG', photoUrl: null }
}

export async function createReview(
  db: D1Database,
  params: {
    bookingId: number
    engineerProfileId: number
    customerUserId: number | null
    customerName: string
    micRating: number
    comment: string
  }
) {
  await db
    .prepare(
      `INSERT INTO reviews (booking_id, engineer_profile_id, customer_user_id, customer_name, mic_rating, comment)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(params.bookingId, params.engineerProfileId, params.customerUserId, params.customerName, params.micRating, params.comment)
    .run()

  await db.prepare('UPDATE bookings SET reviewed = 1 WHERE id = ?').bind(params.bookingId).run()
  await recalculateEngineerRating(db, params.engineerProfileId)
}
