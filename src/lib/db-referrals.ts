// Referral mechanic (migration 0013) — invite a friend, get rewarded when they actually
// spend money (not just sign up, to prevent farming). Every user gets a unique
// referral_code at signup; a new signup that arrives with ?ref=<code> gets stamped with
// referred_by_user_id. The reward only fires once — when that referred user's FIRST
// booking is marked 'completed' (see maybeCreditReferralReward, called from the booking
// status-update code paths in index.tsx and dashboard.tsx).
//
// Reward type depends on what the *referrer* is: if they have an engineer profile, they
// get 'engineer_free_month' (a credit note — see account_credits header comment; actual
// Stripe coupon/discount redemption at Checkout time is a follow-up, not yet wired). If
// they're customer-only, they get a flat 'customer_credit' redeemable toward a future
// booking via the same account_credits ledger.

const CUSTOMER_CREDIT_VALUE = 20 // dollars off a future booking
const ENGINEER_FREE_MONTH_VALUE = 19 // nominal value = Pro monthly price, for ledger/display purposes

function randomReferralCode(): string {
  // Short, easy to say/type/share — 8 chars from an unambiguous alphabet (no 0/O/1/I).
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(bytes)
    .map((b) => alphabet[b % alphabet.length])
    .join('')
}

export async function generateUniqueReferralCode(db: D1Database): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = randomReferralCode()
    const existing = await db.prepare('SELECT id FROM users WHERE referral_code = ?').bind(code).first()
    if (!existing) return code
  }
  // Astronomically unlikely fallback: timestamp-suffixed code, still checked against the
  // unique index by the INSERT itself (createUser's caller handles the rare collision).
  return randomReferralCode() + Date.now().toString(36).slice(-4).toUpperCase()
}

export async function findUserByReferralCode(db: D1Database, code: string): Promise<{ id: number; name: string } | null> {
  if (!code) return null
  const row = await db
    .prepare('SELECT id, name FROM users WHERE referral_code = ?')
    .bind(code.trim().toUpperCase())
    .first<{ id: number; name: string }>()
  return row || null
}

// Lazy backfill: users created before migration 0013 (or via any path that doesn't call
// generateUniqueReferralCode) won't have a referral_code yet. Called the first time a
// user visits their "Invite & Earn" dashboard section so every existing account gets a
// code on-demand instead of requiring a bulk migration backfill job.
export async function ensureReferralCode(db: D1Database, userId: number): Promise<string> {
  const existing = await db.prepare('SELECT referral_code FROM users WHERE id = ?').bind(userId).first<{ referral_code: string | null }>()
  if (existing?.referral_code) return existing.referral_code
  const code = await generateUniqueReferralCode(db)
  await db.prepare('UPDATE users SET referral_code = ? WHERE id = ?').bind(code, userId).run()
  return code
}

export interface ReferralStats {
  referral_code: string | null
  total_referred: number
  total_rewards_credited: number
  pending_referrals: number
}

export async function getReferralStatsForUser(db: D1Database, userId: number): Promise<ReferralStats> {
  const user = await db.prepare('SELECT referral_code FROM users WHERE id = ?').bind(userId).first<{ referral_code: string | null }>()
  const totalReferred = await db
    .prepare('SELECT COUNT(*) as count FROM users WHERE referred_by_user_id = ?')
    .bind(userId)
    .first<{ count: number }>()
  const rewards = await db
    .prepare(`SELECT COUNT(*) as count FROM referral_rewards WHERE referrer_user_id = ? AND status = 'credited'`)
    .bind(userId)
    .first<{ count: number }>()
  const pending = await db
    .prepare(`SELECT COUNT(*) as count FROM users u WHERE u.referred_by_user_id = ? AND NOT EXISTS (SELECT 1 FROM referral_rewards rr WHERE rr.referred_user_id = u.id)`)
    .bind(userId)
    .first<{ count: number }>()

  return {
    referral_code: user?.referral_code ?? null,
    total_referred: totalReferred?.count || 0,
    total_rewards_credited: rewards?.count || 0,
    pending_referrals: pending?.count || 0
  }
}

export async function getAccountCreditBalance(db: D1Database, userId: number): Promise<number> {
  const row = await db
    .prepare('SELECT COALESCE(SUM(amount), 0) as balance FROM account_credits WHERE user_id = ?')
    .bind(userId)
    .first<{ balance: number }>()
  return row?.balance || 0
}

// Called whenever a booking transitions to 'completed'. No-ops instantly (single indexed
// lookup) unless: (a) the customer on this booking is a registered user, (b) that user
// was referred by someone, and (c) no reward has been credited for them yet (the UNIQUE
// index on referral_rewards.referred_user_id makes this a one-shot). Best-effort —
// wrapped in try/catch by the caller pattern used everywhere else in this codebase
// (see audit-log.ts) so a referral hiccup never blocks a real booking-completion action.
export async function maybeCreditReferralReward(db: D1Database, bookingId: number): Promise<void> {
  const booking = await db
    .prepare('SELECT customer_user_id FROM bookings WHERE id = ?')
    .bind(bookingId)
    .first<{ customer_user_id: number | null }>()
  if (!booking?.customer_user_id) return // guest checkout, no account to credit against

  const referredUserId = booking.customer_user_id

  const alreadyRewarded = await db
    .prepare('SELECT id FROM referral_rewards WHERE referred_user_id = ?')
    .bind(referredUserId)
    .first()
  if (alreadyRewarded) return // already credited (or a reward record already exists) — one-shot

  const referredUser = await db
    .prepare('SELECT referred_by_user_id FROM users WHERE id = ?')
    .bind(referredUserId)
    .first<{ referred_by_user_id: number | null }>()
  if (!referredUser?.referred_by_user_id) return // this user wasn't referred by anyone

  const referrerId = referredUser.referred_by_user_id

  const referrerIsEngineer = await db
    .prepare('SELECT id FROM engineer_profiles WHERE user_id = ?')
    .bind(referrerId)
    .first()

  const rewardType = referrerIsEngineer ? 'engineer_free_month' : 'customer_credit'
  const rewardValue = referrerIsEngineer ? ENGINEER_FREE_MONTH_VALUE : CUSTOMER_CREDIT_VALUE

  await db
    .prepare(
      `INSERT INTO referral_rewards (referrer_user_id, referred_user_id, triggering_booking_id, reward_type, reward_value, status, credited_at)
       VALUES (?, ?, ?, ?, ?, 'credited', CURRENT_TIMESTAMP)`
    )
    .bind(referrerId, referredUserId, bookingId, rewardType, rewardValue)
    .run()

  await db
    .prepare(`INSERT INTO account_credits (user_id, amount, reason, related_booking_id) VALUES (?, ?, 'referral_reward', ?)`)
    .bind(referrerId, rewardValue, bookingId)
    .run()
}
