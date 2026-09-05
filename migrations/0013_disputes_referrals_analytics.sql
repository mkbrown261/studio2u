-- Studio2U growth + trust pass (2026-09-05): disputes/refunds, referrals, review-request
-- infrastructure, and lightweight self-hosted analytics. No new external services —
-- everything below is D1-backed, matching the rest of this project's architecture.

-- ---------- Disputes (Trust & Safety) ----------
-- A customer or engineer can flag a booking as having gone wrong (no-show, quality
-- issue, etc). Admin reviews in a dedicated queue and can issue a full/partial Stripe
-- refund straight from the dispute record. One booking can only have one open dispute
-- at a time (enforced in app code, not a DB constraint, since a booking COULD have a
-- resolved dispute followed by a new one in a rare edge case).
CREATE TABLE IF NOT EXISTS disputes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL,
  raised_by TEXT NOT NULL,             -- 'customer' | 'engineer'
  raised_by_user_id INTEGER,           -- nullable: customer may not have an account
  reason TEXT NOT NULL,                -- 'no_show' | 'quality_issue' | 'billing_issue' | 'other'
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', -- 'open' | 'resolved_refunded' | 'resolved_partial_refund' | 'resolved_no_refund' | 'dismissed'
  admin_notes TEXT,
  refund_amount REAL,                  -- dollars, set when a refund is issued
  stripe_refund_id TEXT,
  resolved_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id)
);
CREATE INDEX IF NOT EXISTS idx_disputes_booking ON disputes(booking_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);

-- ---------- Referrals (Growth) ----------
-- Every user gets a stable referral code the moment they sign up (generated in app
-- code, backfilled for pre-existing rows by the ALTER below). Sharing /r/<code> or
-- signing up with ?ref=<code> attributes a new signup to the referrer. Reward is
-- credited once the REFERRED user's first booking is marked completed (not at signup)
-- to prevent trivial signup-farming abuse — a referral only pays out once real revenue
-- has happened.
ALTER TABLE users ADD COLUMN referral_code TEXT;
ALTER TABLE users ADD COLUMN referred_by_user_id INTEGER REFERENCES users(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);

CREATE TABLE IF NOT EXISTS referral_rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer_user_id INTEGER NOT NULL,
  referred_user_id INTEGER NOT NULL,
  triggering_booking_id INTEGER,        -- the referred user's first COMPLETED booking
  reward_type TEXT NOT NULL,            -- 'engineer_free_month' | 'customer_credit'
  reward_value REAL,                    -- dollars for customer_credit; NULL for a free month
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'credited' | 'expired'
  credited_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (referrer_user_id) REFERENCES users(id),
  FOREIGN KEY (referred_user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_referrer ON referral_rewards(referrer_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_rewards_referred ON referral_rewards(referred_user_id);

-- Customer-side account credit ledger (redeemed automatically against the next
-- booking's Stripe Checkout via a coupon/discount at checkout-creation time).
CREATE TABLE IF NOT EXISTS account_credits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount REAL NOT NULL,                 -- positive = credit added, negative = credit spent
  reason TEXT NOT NULL,                 -- 'referral_reward' | 'booking_redemption' | 'admin_adjustment'
  related_booking_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_account_credits_user ON account_credits(user_id);

-- ---------- Review-request infrastructure (Resend-ready, no email sending yet) ----------
-- A secure, single-use-until-reviewed token generated the moment a booking is marked
-- completed (see updateBookingStatus in index.tsx). Once Resend is wired up, sending
-- the "How was your session?" email becomes a single new call — this table already
-- has everything that email needs (token, customer email/name, engineer name).
-- Until then, admin has a manual "Review Requests" queue to see who still needs a
-- nudge and can copy/send the link by hand.
CREATE TABLE IF NOT EXISTS review_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER UNIQUE NOT NULL,
  token TEXT UNIQUE NOT NULL,
  sent_at DATETIME,                     -- NULL until an email actually goes out (Resend phase)
  reminder_sent_at DATETIME,
  reviewed_at DATETIME,                 -- set when the review is actually submitted
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id)
);
CREATE INDEX IF NOT EXISTS idx_review_requests_token ON review_requests(token);

-- ---------- Lightweight self-hosted analytics ----------
-- No third-party analytics service — a single events table is enough to answer the
-- basics (traffic by page, conversion funnel, which cities/engineers get views without
-- bookings). Written fire-and-forget from a tiny inline JS beacon + a couple of
-- server-side event calls (booking created, checkout completed). Old rows can be
-- pruned/aggregated later if volume grows; not a concern at current scale.
CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,             -- 'pageview' | 'booking_started' | 'booking_completed' | 'signup' | 'engineer_view'
  path TEXT,
  referrer TEXT,
  engineer_profile_id INTEGER,
  session_id TEXT,                      -- anonymous per-browser id (random, stored in a non-tracking cookie), NOT tied to login
  metadata TEXT,                        -- JSON blob for event-specific extras
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type_created ON analytics_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_path ON analytics_events(path);
