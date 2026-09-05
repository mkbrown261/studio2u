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
  mic_spec: string | null
  daw_spec: string | null
  interface_spec: string | null
  cashapp_handle: string | null
  location_label: string | null
  lat: number | null
  lng: number | null
  offers_remote: number
  remote_details: string | null
  is_published: number
  is_new: number
  is_suspended: number
  rating_avg: number
  rating_count: number
  stripe_account_id: string | null
  stripe_onboarding_complete: number
  stripe_charges_enabled: number
  subscription_tier: string
  subscription_billing_period: string | null
  subscription_status: string | null
  subscription_period_end: string | null
  subscription_cancel_at_period_end: number
  pending_tier: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  storage_used_bytes: number
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

// Phase 3 M5: mandatory Stripe onboarding — an engineer never appears in the public
// directory (and can't be booked) until Stripe confirms charges_enabled on their
// connected account. No exceptions, no Cash App fallback.
//
// Directory ranking (updated 2026-09-05): tier gives a real but MODEST boost — it's
// a paid perk, not an absolute wall. Review quality/volume can outweigh it, so a Free
// engineer with a genuinely great track record is never buried below a mediocre paid
// one. This is a deliberate business decision: subscriptions still matter (structural
// head start), but the marketplace stays merit-based — trust/quality wins long-term,
// which is what keeps customers coming back and keeps top engineers on the platform
// even before they upgrade.
//
// Composite score = tier_weight + review_weight
//   tier_weight: elite=4.0, pro=2.0, free=0.0
//   review_weight: Bayesian-adjusted rating (C=4 "confidence" reviews, prior mean 4.0),
//     re-centered on 0 and scaled by 5 so it swings roughly -5..+5:
//       bayesian = (rating_count*rating_avg + 4*4.0) / (rating_count + 4)
//       review_weight = (bayesian - 4.0) * 5
//   A brand-new profile (0 reviews) has bayesian=4.0 -> review_weight=0 (fully neutral,
//   doesn't help or hurt vs. the old scheme). As real 5-star reviews accumulate, bayesian
//   climbs toward 5.0 and review_weight approaches +5 — enough to outrank a Pro engineer
//   with weak/no reviews (tier_weight 2.0) and get close to an Elite with weak reviews
//   (tier_weight 4.0). A few one-star reviews pull bayesian toward/below 4.0 and can sink
//   a paid engineer below unproven competitors — ranking reflects real service quality,
//   not just who's paying.
// Implemented as an inline SQL expression (not a stored column) so it can never drift out
// of sync with rating_avg/rating_count/subscription_tier; ties fall back to rating_avg,
// then oldest-profile-first, unchanged from before.
const DIRECTORY_RANK_SQL = `(
  (CASE subscription_tier WHEN 'elite' THEN 4.0 WHEN 'pro' THEN 2.0 ELSE 0.0 END)
  + (((rating_count * rating_avg) + 16.0) / (rating_count + 4.0) - 4.0) * 5.0
) DESC`

export async function getPublishedEngineers(db: D1Database, remoteOnly?: boolean): Promise<EngineerProfile[]> {
  const remoteClause = remoteOnly ? 'AND offers_remote = 1' : ''
  const { results } = await db
    .prepare(
      `SELECT * FROM engineer_profiles
       WHERE is_published = 1 AND is_suspended = 0 AND stripe_charges_enabled = 1 ${remoteClause}
       ORDER BY ${DIRECTORY_RANK_SQL}, rating_avg DESC, created_at ASC`
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
  micSpec: string
  dawSpec: string
  interfaceSpec: string
  cashappHandle: string
  locationLabel: string
  lat: number | null
  lng: number | null
  offersRemote: boolean
  remoteDetails: string
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
          mic_spec = ?, daw_spec = ?, interface_spec = ?,
          cashapp_handle = ?, location_label = ?, lat = ?, lng = ?,
          offers_remote = ?, remote_details = ?,
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
        p.micSpec,
        p.dawSpec,
        p.interfaceSpec,
        p.cashappHandle,
        p.locationLabel,
        p.lat,
        p.lng,
        p.offersRemote ? 1 : 0,
        p.remoteDetails || null,
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
        mic_spec, daw_spec, interface_spec,
        cashapp_handle, location_label, lat, lng, offers_remote, remote_details, is_published
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
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
      p.micSpec,
      p.dawSpec,
      p.interfaceSpec,
      p.cashappHandle,
      p.locationLabel,
      p.lat,
      p.lng,
      p.offersRemote ? 1 : 0,
      p.remoteDetails || null
    )
    .run()
  return result.meta.last_row_id as number
}

export async function setEngineerSuspended(db: D1Database, id: number, suspended: boolean) {
  await db.prepare('UPDATE engineer_profiles SET is_suspended = ? WHERE id = ?').bind(suspended ? 1 : 0, id).run()
}

// ---------- Stripe Connect (Phase 3 M5) ----------

// Persists the newly-created Connect account id the first time an engineer clicks
// "Connect with Stripe". Onboarding status columns start at 0/false and only flip
// once we re-check the account against Stripe's API (see refreshEngineerStripeStatus).
export async function setEngineerStripeAccountId(db: D1Database, engineerProfileId: number, stripeAccountId: string) {
  await db
    .prepare('UPDATE engineer_profiles SET stripe_account_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(stripeAccountId, engineerProfileId)
    .run()
}

// Called after the engineer returns from Stripe's hosted onboarding flow (or any time
// we want a fresh read) — reflects Stripe's own account.charges_enabled /
// details_submitted flags into our local row so booking-eligibility checks never have
// to call Stripe's API on the hot path.
export async function updateEngineerStripeStatus(
  db: D1Database,
  engineerProfileId: number,
  params: { chargesEnabled: boolean; detailsSubmitted: boolean }
) {
  await db
    .prepare(
      `UPDATE engineer_profiles SET
        stripe_charges_enabled = ?,
        stripe_onboarding_complete = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`
    )
    .bind(params.chargesEnabled ? 1 : 0, params.detailsSubmitted ? 1 : 0, engineerProfileId)
    .run()
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

// ---------- Subscription Tiers (Free / Pro / Elite) ----------

export async function getEngineerByStripeCustomerId(db: D1Database, stripeCustomerId: string): Promise<EngineerProfile | null> {
  const row = await db.prepare('SELECT * FROM engineer_profiles WHERE stripe_customer_id = ?').bind(stripeCustomerId).first()
  return (row as unknown as EngineerProfile) || null
}

export async function getEngineerByStripeSubscriptionId(db: D1Database, stripeSubscriptionId: string): Promise<EngineerProfile | null> {
  const row = await db.prepare('SELECT * FROM engineer_profiles WHERE stripe_subscription_id = ?').bind(stripeSubscriptionId).first()
  return (row as unknown as EngineerProfile) || null
}

export async function setEngineerStripeCustomerId(db: D1Database, engineerProfileId: number, stripeCustomerId: string) {
  await db
    .prepare('UPDATE engineer_profiles SET stripe_customer_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(stripeCustomerId, engineerProfileId)
    .run()
}

// Called from the Stripe webhook (customer.subscription.created/updated) once a
// subscription is confirmed active — flips the engineer onto the new tier immediately.
// Downgrades/cancellations do NOT call this directly; see
// scheduleSubscriptionDowngrade / applyScheduledDowngradeIfDue below for the
// "keep benefits until period end" flow.
export async function setEngineerSubscription(
  db: D1Database,
  engineerProfileId: number,
  params: {
    tier: 'free' | 'pro' | 'elite'
    billingPeriod: 'monthly' | 'annual' | null
    status: string | null
    subscriptionId: string | null
    periodEnd: string | null
  }
) {
  await db
    .prepare(
      `UPDATE engineer_profiles SET
        subscription_tier = ?, subscription_billing_period = ?, subscription_status = ?,
        stripe_subscription_id = ?, subscription_period_end = ?,
        subscription_cancel_at_period_end = 0, pending_tier = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`
    )
    .bind(params.tier, params.billingPeriod, params.status, params.subscriptionId, params.periodEnd, engineerProfileId)
    .run()
}

// Cancellation/downgrade: Stripe's Billing Portal defaults to cancel-at-period-end, so
// the webhook calls this instead of immediately dropping the tier — benefits (fee rate,
// storage, badge, placement) are intentionally preserved until subscription_period_end.
export async function scheduleSubscriptionDowngrade(
  db: D1Database,
  engineerProfileId: number,
  params: { pendingTier: 'free' | 'pro' | 'elite'; periodEnd: string | null }
) {
  await db
    .prepare(
      `UPDATE engineer_profiles SET
        subscription_cancel_at_period_end = 1, pending_tier = ?, subscription_period_end = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`
    )
    .bind(params.pendingTier, params.periodEnd, engineerProfileId)
    .run()
}

// Actually applies a previously-scheduled downgrade once the period has genuinely
// ended. Called both from the webhook (customer.subscription.deleted, i.e. Stripe
// itself ending the subscription) and lazily on dashboard page loads as a safety net
// in case a webhook was ever missed — mirrors the existing "lazy re-check" pattern
// already used for Stripe Connect status refresh in routes/dashboard.tsx.
export async function applyScheduledDowngradeIfDue(db: D1Database, profile: EngineerProfile): Promise<EngineerProfile> {
  if (!profile.subscription_cancel_at_period_end || !profile.pending_tier || !profile.subscription_period_end) {
    return profile
  }
  if (new Date(profile.subscription_period_end).getTime() > Date.now()) {
    return profile
  }
  const tier = profile.pending_tier as 'free' | 'pro' | 'elite'
  await db
    .prepare(
      `UPDATE engineer_profiles SET
        subscription_tier = ?, subscription_billing_period = NULL, subscription_status = NULL,
        stripe_subscription_id = NULL, subscription_cancel_at_period_end = 0, pending_tier = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`
    )
    .bind(tier, profile.id)
    .run()
  return { ...profile, subscription_tier: tier, subscription_cancel_at_period_end: 0, pending_tier: null }
}

export async function addToEngineerStorageUsed(db: D1Database, engineerProfileId: number, deltaBytes: number) {
  await db
    .prepare(
      `UPDATE engineer_profiles SET storage_used_bytes = MAX(0, storage_used_bytes + ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    )
    .bind(deltaBytes, engineerProfileId)
    .run()
}
