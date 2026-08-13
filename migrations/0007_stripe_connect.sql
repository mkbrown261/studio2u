-- Studio2U Phase 3 M5: Stripe Connect (Express) onboarding + automatic payment splitting.
-- Replaces the Cash App deposit/screenshot flow — payments now go through Stripe
-- Checkout, with the platform's commission taken automatically via
-- application_fee_amount and the remainder transferred straight to the engineer's own
-- connected Stripe account. "NO MORE CASHAPP" per platform owner — cashapp_handle
-- column stays for historical display on pre-M5 bookings/profiles only.

ALTER TABLE engineer_profiles ADD COLUMN stripe_account_id TEXT;
ALTER TABLE engineer_profiles ADD COLUMN stripe_onboarding_complete INTEGER DEFAULT 0;
ALTER TABLE engineer_profiles ADD COLUMN stripe_charges_enabled INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_engineer_profiles_stripe_account ON engineer_profiles(stripe_account_id);

-- Track the Stripe PaymentIntent behind a booking so the webhook handler and any
-- future refund/lookup code has a stable reference distinct from the legacy
-- payment_transaction_id (which historically held a Cash App transaction id typed in
-- by the customer, not a verified Stripe id).
ALTER TABLE bookings ADD COLUMN stripe_payment_intent_id TEXT;
ALTER TABLE bookings ADD COLUMN stripe_checkout_session_id TEXT;
ALTER TABLE bookings ADD COLUMN platform_fee_amount REAL;
ALTER TABLE bookings ADD COLUMN engineer_payout_amount REAL;
