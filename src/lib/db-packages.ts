// Packages: prepaid hours bundles. See migrations/0016_packages.sql for the full design
// rationale (hours-bank model, instant-payout-at-purchase, redemption via the existing
// "mark completed" flow).

export interface PackageOffer {
  id: number
  engineer_profile_id: number
  title: string | null
  total_hours: number
  price_cents: number
  active: number
  created_at: string
  updated_at: string
}

export interface PackagePurchase {
  id: number
  package_offer_id: number
  engineer_profile_id: number
  customer_id: number | null
  customer_user_id: number | null
  customer_name: string
  customer_email: string
  customer_phone: string | null
  hours_total: number
  hours_remaining: number
  price_paid_cents: number
  platform_fee_percent: number | null
  platform_fee_amount: number | null
  engineer_payout_amount: number | null
  stripe_checkout_session_id: string | null
  stripe_payment_intent_id: string | null
  status: 'pending_payment' | 'active' | 'depleted' | 'cancelled'
  created_at: string
  updated_at: string
}

// ---------- Offers (engineer-authored) ----------

export async function getPackageOffersForEngineer(db: D1Database, engineerProfileId: number): Promise<PackageOffer[]> {
  const { results } = await db
    .prepare('SELECT * FROM package_offers WHERE engineer_profile_id = ? ORDER BY created_at DESC')
    .bind(engineerProfileId)
    .all()
  return (results as unknown as PackageOffer[]) || []
}

// Only offers an engineer is actively selling — what a customer sees on the booking page.
export async function getActivePackageOffersForEngineer(db: D1Database, engineerProfileId: number): Promise<PackageOffer[]> {
  const { results } = await db
    .prepare('SELECT * FROM package_offers WHERE engineer_profile_id = ? AND active = 1 ORDER BY total_hours ASC')
    .bind(engineerProfileId)
    .all()
  return (results as unknown as PackageOffer[]) || []
}

export async function getPackageOfferById(db: D1Database, id: number): Promise<PackageOffer | null> {
  const row = await db.prepare('SELECT * FROM package_offers WHERE id = ?').bind(id).first()
  return (row as unknown as PackageOffer) || null
}

export async function createPackageOffer(
  db: D1Database,
  p: { engineerProfileId: number; title: string; totalHours: number; priceCents: number }
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO package_offers (engineer_profile_id, title, total_hours, price_cents, active)
       VALUES (?, ?, ?, ?, 1)`
    )
    .bind(p.engineerProfileId, p.title || null, p.totalHours, p.priceCents)
    .run()
  return result.meta.last_row_id as number
}

export async function setPackageOfferActive(db: D1Database, id: number, engineerProfileId: number, active: boolean) {
  await db
    .prepare('UPDATE package_offers SET active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND engineer_profile_id = ?')
    .bind(active ? 1 : 0, id, engineerProfileId)
    .run()
}

export async function deletePackageOffer(db: D1Database, id: number, engineerProfileId: number) {
  // Purchases keep their own snapshotted hours_total/price_paid_cents (see migration
  // comment), so deleting the offer never affects an existing buyer's balance — it just
  // stops it from being sold going forward. package_offer_id on old purchases becomes a
  // dangling reference, which is fine since purchases never re-read the offer row.
  await db.prepare('DELETE FROM package_offers WHERE id = ? AND engineer_profile_id = ?').bind(id, engineerProfileId).run()
}

// ---------- Purchases ----------

export async function getPackagePurchaseById(db: D1Database, id: number): Promise<PackagePurchase | null> {
  const row = await db.prepare('SELECT * FROM package_purchases WHERE id = ?').bind(id).first()
  return (row as unknown as PackagePurchase) || null
}

export async function getPackagePurchaseByCheckoutSessionId(db: D1Database, sessionId: string): Promise<PackagePurchase | null> {
  const row = await db.prepare('SELECT * FROM package_purchases WHERE stripe_checkout_session_id = ?').bind(sessionId).first()
  return (row as unknown as PackagePurchase) || null
}

export async function getPackagePurchasesForEngineer(db: D1Database, engineerProfileId: number): Promise<PackagePurchase[]> {
  const { results } = await db
    .prepare('SELECT * FROM package_purchases WHERE engineer_profile_id = ? ORDER BY created_at DESC')
    .bind(engineerProfileId)
    .all()
  return (results as unknown as PackagePurchase[]) || []
}

// Active (paid, not yet fully spent) purchases a given email has with a given engineer —
// this is what powers the "redeem from your package" option in the booking flow.
export async function getActivePackagePurchasesForCustomer(
  db: D1Database,
  engineerProfileId: number,
  email: string
): Promise<PackagePurchase[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM package_purchases
       WHERE engineer_profile_id = ? AND customer_email = ? AND status = 'active' AND hours_remaining > 0
       ORDER BY created_at ASC`
    )
    .bind(engineerProfileId, email.trim().toLowerCase())
    .all()
  return (results as unknown as PackagePurchase[]) || []
}

export interface CreatePackagePurchaseParams {
  packageOfferId: number
  engineerProfileId: number
  customerId: number | null
  customerUserId: number | null
  customerName: string
  customerEmail: string
  customerPhone: string
  hoursTotal: number
  priceCents: number
}

export async function createPackagePurchase(db: D1Database, p: CreatePackagePurchaseParams): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO package_purchases (
        package_offer_id, engineer_profile_id, customer_id, customer_user_id,
        customer_name, customer_email, customer_phone,
        hours_total, hours_remaining, price_paid_cents, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment')`
    )
    .bind(
      p.packageOfferId,
      p.engineerProfileId,
      p.customerId,
      p.customerUserId,
      p.customerName,
      p.customerEmail.trim().toLowerCase(),
      p.customerPhone,
      p.hoursTotal,
      p.hoursTotal,
      p.priceCents
    )
    .run()
  return result.meta.last_row_id as number
}

export async function attachPackageCheckoutSession(
  db: D1Database,
  purchaseId: number,
  params: { checkoutSessionId: string; platformFeeAmount: number; engineerPayoutAmount: number; platformFeePercent: number }
) {
  await db
    .prepare(
      `UPDATE package_purchases SET
        stripe_checkout_session_id = ?,
        platform_fee_amount = ?,
        engineer_payout_amount = ?,
        platform_fee_percent = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`
    )
    .bind(params.checkoutSessionId, params.platformFeeAmount, params.engineerPayoutAmount, params.platformFeePercent, purchaseId)
    .run()
}

// Called by the Stripe webhook once checkout.session.completed fires for a package
// purchase — mirrors markBookingPaid() in lib/db.ts. Idempotent: only flips
// pending_payment -> active.
export async function markPackagePurchasePaid(db: D1Database, purchaseId: number, paymentIntentId: string) {
  await db
    .prepare(
      `UPDATE package_purchases SET
        stripe_payment_intent_id = ?,
        status = 'active',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'pending_payment'`
    )
    .bind(paymentIntentId, purchaseId)
    .run()
}

// Deducts hours from a purchase when a redeemed booking is marked completed (see
// lib/booking-lifecycle.ts). Flips to 'depleted' once the balance hits zero (floating
// point: treat <= 0.01 remaining as fully spent). Best-effort caller pattern — no-ops
// safely if the purchase is missing.
export async function deductPackageHours(db: D1Database, purchaseId: number, hours: number): Promise<void> {
  const purchase = await getPackagePurchaseById(db, purchaseId)
  if (!purchase) return
  const remaining = Math.max(0, purchase.hours_remaining - hours)
  const status = remaining <= 0.01 ? 'depleted' : purchase.status
  await db
    .prepare('UPDATE package_purchases SET hours_remaining = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(remaining, status, purchaseId)
    .run()
}
