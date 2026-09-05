-- Studio2U Engineer Subscription Tiers: Free / Pro ($19/mo) / Elite ($35/mo).
--
-- Business model (locked with platform owner 2026-09-05):
--   Free:  10% platform fee, 5GB storage,   no badge, standard support, standard directory placement
--   Pro:   5%  platform fee, 150GB storage, verified badge, priority support, directory boost
--   Elite: 2%  platform fee, 750GB storage, verified badge, top-priority support, directory boost (higher
--          than Pro), exclusive Studio2U events/mixers
--
-- Annual pricing = 2 months free (Pro $190/yr, Elite $350/yr) — billing_period tracks which the
-- engineer is on so we know what to renew them into.
--
-- IMPORTANT: platform_fee_percent is captured onto EACH BOOKING at creation time (see
-- bookings.platform_fee_percent below and index.tsx booking-creation flow) and is never
-- retroactively recalculated if the engineer upgrades/downgrades later — a booking's fee is
-- locked forever the moment it's created. subscription_tier here only affects future bookings.
--
-- Downgrade/cancel semantics: when an engineer cancels or downgrades, they keep their CURRENT
-- tier's benefits (fee rate, storage, badge, placement) until subscription_period_end — Stripe
-- subscription webhooks flip subscription_tier down to the new tier only once the paid period
-- actually ends (see stripe-webhook.ts customer.subscription.updated/deleted handling).

ALTER TABLE engineer_profiles ADD COLUMN subscription_tier TEXT NOT NULL DEFAULT 'free'; -- 'free' | 'pro' | 'elite'
ALTER TABLE engineer_profiles ADD COLUMN subscription_billing_period TEXT; -- 'monthly' | 'annual' | NULL (free)
ALTER TABLE engineer_profiles ADD COLUMN subscription_status TEXT; -- Stripe subscription status mirror: 'active' | 'past_due' | 'canceled' | NULL
ALTER TABLE engineer_profiles ADD COLUMN subscription_period_end DATETIME; -- when current paid period ends; benefits held until this timestamp even after cancel
ALTER TABLE engineer_profiles ADD COLUMN subscription_cancel_at_period_end INTEGER NOT NULL DEFAULT 0; -- 1 = will drop to free (or requested downgrade) at subscription_period_end
ALTER TABLE engineer_profiles ADD COLUMN pending_tier TEXT; -- tier to switch to at subscription_period_end (downgrade requested but not yet effective); NULL = no pending change
ALTER TABLE engineer_profiles ADD COLUMN stripe_customer_id TEXT; -- Stripe Customer object for this engineer (subscription billing identity — distinct from stripe_account_id, which is their Connect PAYOUT account)
ALTER TABLE engineer_profiles ADD COLUMN stripe_subscription_id TEXT; -- current Stripe Subscription id, NULL if on Free
ALTER TABLE engineer_profiles ADD COLUMN storage_used_bytes INTEGER NOT NULL DEFAULT 0; -- running total across all their projects' files, maintained by upload/delete code paths (see db-projects.ts)

CREATE INDEX IF NOT EXISTS idx_engineer_profiles_stripe_customer ON engineer_profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_engineer_profiles_stripe_subscription ON engineer_profiles(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_engineer_profiles_tier ON engineer_profiles(subscription_tier);

-- Booking-level fee lock: captured from getPlatformFeePercentForEngineer() at the moment
-- POST /api/bookings creates the row, so a later tier change never rewrites history.
-- (price_amount / platform_fee_amount / engineer_payout_amount already existed from 0007;
-- this just stores WHICH percent produced them, for admin/reporting clarity.)
ALTER TABLE bookings ADD COLUMN platform_fee_percent REAL;

-- Platform-wide Stripe subscription Price IDs, set once via the admin-only
-- /admin/subscriptions/setup route (creates live Stripe Products/Prices using the
-- already-configured STRIPE_SECRET_KEY secret, never a key pasted into chat/files again).
-- Generic key/value reuses platform_settings (see 0004) rather than a new table.
INSERT OR IGNORE INTO platform_settings (key, value) VALUES ('storage_limit_free_gb', '5');
INSERT OR IGNORE INTO platform_settings (key, value) VALUES ('storage_limit_pro_gb', '150');
INSERT OR IGNORE INTO platform_settings (key, value) VALUES ('storage_limit_elite_gb', '750');
INSERT OR IGNORE INTO platform_settings (key, value) VALUES ('storage_overage_price_per_gb', '0.10');
-- Free tier's fee percent deliberately reuses the pre-existing commission_percent key
-- (see migrations/0004) rather than a new fee_percent_free — no separate seed needed.
INSERT OR IGNORE INTO platform_settings (key, value) VALUES ('fee_percent_pro', '5');
INSERT OR IGNORE INTO platform_settings (key, value) VALUES ('fee_percent_elite', '2');
