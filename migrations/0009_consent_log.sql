-- Consent log for legal/compliance evidence trail (pre-Stripe-go-live).
-- Records every acceptance of a versioned legal document so Studio2U can
-- prove who accepted what, when, and (for recording consent) in connection
-- with which specific booking.
--
-- Two checkpoints write into this table:
--   1) Signup: Master Terms of Service (+ Privacy Policy once it exists) —
--      user_id set, booking_id NULL.
--   2) Booking step 3 "Confirm Booking": Recording Consent Agreement —
--      booking_id set, user_id NULL for guest/customer bookings (customers
--      book by email/phone, not a Studio2U login).
CREATE TABLE IF NOT EXISTS consent_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,                 -- FK-ish to users(id); NULL for guest booking-time consent
  booking_id INTEGER,              -- FK-ish to bookings(id); NULL for signup-time consent
  document_type TEXT NOT NULL,     -- 'terms' | 'privacy' | 'recording_consent'
  document_version TEXT NOT NULL,  -- e.g. '1.0'
  email TEXT,                      -- snapshot of the accepting email, in case the user/booking is later deleted
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_consent_log_user ON consent_log(user_id);
CREATE INDEX IF NOT EXISTS idx_consent_log_booking ON consent_log(booking_id);
CREATE INDEX IF NOT EXISTS idx_consent_log_doc ON consent_log(document_type, document_version);
