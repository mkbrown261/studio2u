// Studio2U Engineer Subscription Tiers — Free / Pro / Elite.
//
// Business rules locked with platform owner 2026-09-05:
//   Free:  10% platform fee, 5GB storage,   no badge, standard support, standard directory placement
//   Pro:   5%  platform fee, 150GB storage, verified badge, priority support, directory boost
//   Elite: 2%  platform fee, 750GB storage, verified badge, top-priority support, directory boost
//          (ranked above Pro), exclusive Studio2U events/mixers invites
//
// Annual = 2 months free vs. monthly (Pro $190/yr, Elite $350/yr).
//
// Storage limits are backed by real Cloudflare R2 cost math (R2 = $0.015/GB-month storage,
// egress is FREE — this is a real revenue line, not just a perk: even at Elite's 750GB the
// platform's R2 cost is ~$11.25/mo against a $35/mo subscription price).
//
// IMPORTANT: a booking's platform_fee_percent is captured at booking-CREATION time (see
// index.tsx) and never retroactively changed if the engineer's tier changes later.

export type SubscriptionTier = 'free' | 'pro' | 'elite'
export type BillingPeriod = 'monthly' | 'annual'

export interface TierConfig {
  tier: SubscriptionTier
  label: string
  feePercent: number
  storageLimitGb: number
  hasBadge: boolean
  supportLevel: 'standard' | 'priority' | 'top_priority'
  directoryPriority: number // higher sorts first; used as `ORDER BY directory_priority DESC, ...`
  priceMonthly: number // dollars, 0 for free
  priceAnnual: number // dollars, 0 for free
  perks: string[]
}

// Storage limits, fee percents, and overage rate are also mirrored into platform_settings
// (migrations/0011) so admin can tune them from the DB without a redeploy — these constants
// are the fallback/default and the source of truth for anything NOT stored there (pricing,
// labels, perks copy).
export const TIERS: Record<SubscriptionTier, TierConfig> = {
  free: {
    tier: 'free',
    label: 'Free',
    feePercent: 10,
    storageLimitGb: 5,
    hasBadge: false,
    supportLevel: 'standard',
    directoryPriority: 0,
    priceMonthly: 0,
    priceAnnual: 0,
    perks: ['10% platform fee per session', '5GB Project storage', 'Public profile & booking listing', 'Standard support']
  },
  pro: {
    tier: 'pro',
    label: 'Pro',
    feePercent: 5,
    storageLimitGb: 150,
    hasBadge: true,
    supportLevel: 'priority',
    directoryPriority: 10,
    priceMonthly: 19,
    priceAnnual: 190,
    perks: [
      'Only 5% platform fee per session',
      '150GB Project storage',
      'Verified Badge on your profile',
      'Priority support',
      'Boosted directory placement'
    ]
  },
  elite: {
    tier: 'elite',
    label: 'Elite',
    feePercent: 2,
    storageLimitGb: 750,
    hasBadge: true,
    supportLevel: 'top_priority',
    directoryPriority: 20,
    priceMonthly: 35,
    priceAnnual: 350,
    perks: [
      'Just 2% platform fee per session',
      '750GB Project storage',
      'Verified Badge on your profile',
      'Top-priority support',
      'Highest directory placement',
      'Exclusive Studio2U events & mixers'
    ]
  }
}

export const STORAGE_OVERAGE_PRICE_PER_GB = 0.1

// Reads tier config with any admin-tunable overrides from platform_settings (fee percents,
// storage limits) layered on top of the TIERS defaults above.
//
// Free tier's fee percent intentionally reuses the pre-existing `commission_percent`
// setting (the "Platform Commission" field already on /admin, predating subscription
// tiers) rather than a brand-new `fee_percent_free` key — that field always meant "the
// default marketplace fee," which is exactly what an engineer on Free pays. Pro/Elite
// get their own dedicated, independently-tunable settings since they're new.
export async function getTierConfig(db: D1Database, tier: SubscriptionTier): Promise<TierConfig> {
  const base = TIERS[tier] || TIERS.free

  if (tier === 'free') {
    const row = await db.prepare(`SELECT value FROM platform_settings WHERE key = 'commission_percent'`).first<{ value: string }>()
    const feePercent = row ? parseFloat(row.value) : base.feePercent
    return { ...base, feePercent: Number.isFinite(feePercent) ? feePercent : base.feePercent }
  }

  const keys = [`fee_percent_${tier}`, `storage_limit_${tier}_gb`]
  const { results } = await db
    .prepare(`SELECT key, value FROM platform_settings WHERE key IN (${keys.map(() => '?').join(',')})`)
    .bind(...keys)
    .all<{ key: string; value: string }>()

  const overrides: Record<string, string> = {}
  for (const row of results || []) overrides[row.key] = row.value

  const feePercent = overrides[`fee_percent_${tier}`] ? parseFloat(overrides[`fee_percent_${tier}`]) : base.feePercent
  const storageLimitGb = overrides[`storage_limit_${tier}_gb`]
    ? parseFloat(overrides[`storage_limit_${tier}_gb`])
    : base.storageLimitGb

  return {
    ...base,
    feePercent: Number.isFinite(feePercent) ? feePercent : base.feePercent,
    storageLimitGb: Number.isFinite(storageLimitGb) ? storageLimitGb : base.storageLimitGb
  }
}

// The fee percent to lock onto a NEW booking right now, for this engineer. Always reflects
// their CURRENT tier at the moment of booking creation — once locked onto the booking row,
// nothing here affects that booking again.
export async function getPlatformFeePercentForEngineer(
  db: D1Database,
  engineer: { subscription_tier?: string | null }
): Promise<number> {
  const tier = (engineer.subscription_tier as SubscriptionTier) || 'free'
  const config = await getTierConfig(db, TIERS[tier] ? tier : 'free')
  return config.feePercent
}

export function splitCommission(grossAmount: number, commissionPercent: number) {
  const platformFee = Math.round(grossAmount * (commissionPercent / 100) * 100) / 100
  const engineerPayout = Math.round((grossAmount - platformFee) * 100) / 100
  return { platformFee, engineerPayout }
}

// Stripe subscription Price IDs are created once via the admin-only setup route (see
// routes/admin-subscriptions.ts) using the server-side STRIPE_SECRET_KEY secret — never
// hand-typed, never passed through chat. Stored in platform_settings so they survive
// redeploys and don't need to be hardcoded per-environment.
export interface SubscriptionPriceIds {
  pro_monthly?: string
  pro_annual?: string
  elite_monthly?: string
  elite_annual?: string
}

const PRICE_ID_SETTING_KEYS: Record<keyof SubscriptionPriceIds, string> = {
  pro_monthly: 'stripe_price_pro_monthly',
  pro_annual: 'stripe_price_pro_annual',
  elite_monthly: 'stripe_price_elite_monthly',
  elite_annual: 'stripe_price_elite_annual'
}

export async function getSubscriptionPriceIds(db: D1Database): Promise<SubscriptionPriceIds> {
  const keys = Object.values(PRICE_ID_SETTING_KEYS)
  const { results } = await db
    .prepare(`SELECT key, value FROM platform_settings WHERE key IN (${keys.map(() => '?').join(',')})`)
    .bind(...keys)
    .all<{ key: string; value: string }>()

  const byKey: Record<string, string> = {}
  for (const row of results || []) byKey[row.key] = row.value

  const out: SubscriptionPriceIds = {}
  for (const [field, settingKey] of Object.entries(PRICE_ID_SETTING_KEYS) as [keyof SubscriptionPriceIds, string][]) {
    if (byKey[settingKey]) out[field] = byKey[settingKey]
  }
  return out
}

export async function setSubscriptionPriceId(db: D1Database, field: keyof SubscriptionPriceIds, priceId: string): Promise<void> {
  const settingKey = PRICE_ID_SETTING_KEYS[field]
  await db
    .prepare(
      `INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`
    )
    .bind(settingKey, priceId)
    .run()
}

export function priceIdFieldFor(tier: 'pro' | 'elite', period: BillingPeriod): keyof SubscriptionPriceIds {
  return `${tier}_${period === 'annual' ? 'annual' : 'monthly'}` as keyof SubscriptionPriceIds
}
