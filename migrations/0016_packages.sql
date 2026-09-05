-- Studio2U Packages: prepaid hours bundles, sold by an engineer, redeemed against future
-- bookings with that same engineer.
--
-- Design (confirmed with the user): a Package is a bundle of TOTAL HOURS at a discounted
-- blended rate (e.g. "10 hours for $400" instead of $450 at the engineer's normal hourly
-- rate) — NOT a fixed count of fixed-length sessions. This matches how every booking is
-- already priced (hourlyRate x durationHours, see lib/pricing.ts) with zero new pricing
-- concepts, and lets a customer freely mix a 2-hour touch-up and a 6-hour deep session
-- against the same balance.
--
-- Payout timing (confirmed with the user, deliberately NOT geofence/check-in gated): the
-- engineer is paid IN FULL at package-purchase time via the exact same Stripe Connect
-- destination-charge mechanics as a normal booking (application_fee_amount + transfer_data
-- .destination — see lib/stripe.ts's createBookingCheckoutSession). No manual
-- stripe.transfers.create() calls, no change to the already-live-tested instant-payout
-- architecture. A package purchase is really just "a booking-shaped Stripe charge whose
-- product is hours instead of one specific session."
--
-- Redemption: booking a session against an active package sets bookings.package_purchase_id
-- and prices that booking at $0 (no second Stripe charge). hours_remaining is decremented
-- when the engineer flips that booking to 'completed' via the EXISTING status-change route
-- (routes/dashboard.tsx POST /dashboard/bookings/:id/status) — the same trust moment used for
-- every other booking, no new UI/mechanism. Known v1 limitation: hours are validated
-- (hours_remaining >= duration_hours) but not reserved at booking-creation time, so two
-- simultaneous package-redeemed booking requests could theoretically overdraw the balance
-- before either completes. Acceptable for a single-engineer marketplace at this stage;
-- revisit with a reservation/hold step if this becomes a real problem.

CREATE TABLE IF NOT EXISTS package_offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  engineer_profile_id INTEGER NOT NULL,
  title TEXT,                          -- optional label, e.g. "10-Hour Session Pack"; UI falls back to "{total_hours}h Package" if blank
  total_hours REAL NOT NULL,
  price_cents INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,   -- engineer can pause an offer without deleting purchase history
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (engineer_profile_id) REFERENCES engineer_profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_package_offers_engineer ON package_offers(engineer_profile_id);

CREATE TABLE IF NOT EXISTS package_purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  package_offer_id INTEGER NOT NULL,
  engineer_profile_id INTEGER NOT NULL,   -- denormalized (mirrors bookings.engineer_profile_id) for quick "purchases for this engineer" queries
  customer_id INTEGER,
  customer_user_id INTEGER,               -- set when the buyer was logged in at purchase time, same pattern as bookings.customer_user_id
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,

  -- Snapshotted from the offer at purchase time so a later edit to the offer never changes
  -- what an existing buyer already paid for/is owed.
  hours_total REAL NOT NULL,
  hours_remaining REAL NOT NULL,
  price_paid_cents INTEGER NOT NULL,

  platform_fee_percent REAL,
  platform_fee_amount REAL,
  engineer_payout_amount REAL,

  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,

  status TEXT NOT NULL DEFAULT 'pending_payment',
  -- pending_payment | active | depleted | cancelled

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (package_offer_id) REFERENCES package_offers(id),
  FOREIGN KEY (engineer_profile_id) REFERENCES engineer_profiles(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE INDEX IF NOT EXISTS idx_package_purchases_engineer ON package_purchases(engineer_profile_id);
CREATE INDEX IF NOT EXISTS idx_package_purchases_email ON package_purchases(customer_email);
CREATE INDEX IF NOT EXISTS idx_package_purchases_offer ON package_purchases(package_offer_id);
CREATE INDEX IF NOT EXISTS idx_package_purchases_checkout_session ON package_purchases(stripe_checkout_session_id);

-- Link a booking back to the package it was redeemed from. NULL = a normal, separately-paid
-- booking (the vast majority). When set, that booking's price_amount is 0 and it skipped
-- Stripe checkout entirely.
ALTER TABLE bookings ADD COLUMN package_purchase_id INTEGER REFERENCES package_purchases(id);
CREATE INDEX IF NOT EXISTS idx_bookings_package_purchase ON bookings(package_purchase_id);
