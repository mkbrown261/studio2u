-- Studio2U initial schema
-- Designed so Phase 2 (multiple engineers) and Phase 3 (Stripe Connect marketplace)
-- are additive: engineer_id / service_id relations exist from day 1 even though
-- Phase 1 only ever has a single engineer row (Mason Brown).

-- Engineers (Phase 1: single row = Mason Brown; Phase 2+: many rows)
CREATE TABLE IF NOT EXISTS engineers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  bio TEXT,
  photo_url TEXT,
  genres TEXT,               -- comma-separated for V1 (e.g. "Hip Hop,R&B,Pop")
  travel_radius_miles INTEGER,
  cashapp_handle TEXT,       -- Phase 1 payout method
  stripe_account_id TEXT,    -- Phase 3 (nullable until marketplace)
  rating REAL DEFAULT 0,     -- Phase 2 (ratings/reviews)
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Services offered (Recording is bookable in V1; others listed as "contact for pricing")
CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_bookable INTEGER DEFAULT 0,  -- 1 = has calendar booking flow (Recording only in V1)
  base_rate_note TEXT,            -- display text e.g. "$40/hour" or "Contact for pricing"
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Customers (looked up by email, no auth/password needed for V1)
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  is_first_booking_used INTEGER DEFAULT 0,  -- flips to 1 once they've used the intro rate
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  engineer_id INTEGER NOT NULL DEFAULT 1,   -- Phase 1: always engineer #1 (Mason)
  service_id INTEGER NOT NULL,

  session_date TEXT NOT NULL,       -- YYYY-MM-DD
  session_time TEXT NOT NULL,       -- HH:MM (24h)
  duration_hours REAL NOT NULL,
  is_custom_time_request INTEGER DEFAULT 0, -- 1 if outside M-F 11am-11pm window

  location_type TEXT NOT NULL,      -- apartment | house | hotel | studio | other
  location_address TEXT,
  special_notes TEXT,
  song_count INTEGER,
  genre TEXT,

  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,

  is_first_time_rate INTEGER DEFAULT 0,
  price_amount REAL NOT NULL,
  price_breakdown TEXT,              -- human readable e.g. "First session flat rate: $100"

  payment_method TEXT DEFAULT 'cashapp',
  payment_proof_url TEXT,             -- R2 object key for screenshot
  payment_transaction_id TEXT,

  status TEXT NOT NULL DEFAULT 'pending_payment',
  -- pending_payment | pending_approval | confirmed | completed | cancelled | rejected

  admin_notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (engineer_id) REFERENCES engineers(id),
  FOREIGN KEY (service_id) REFERENCES services(id)
);

CREATE INDEX IF NOT EXISTS idx_bookings_customer_email ON bookings(customer_email);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_session_date ON bookings(session_date);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);

-- Seed: Mason Brown as engineer #1
INSERT OR IGNORE INTO engineers (id, name, bio, genres, travel_radius_miles, cashapp_handle, is_active)
VALUES (
  1,
  'Mason Brown',
  'Mobile recording engineer bringing studio-quality sound directly to you. I set up, record, and break down at your location — no need to book a studio, drive across town, or work around someone else''s schedule.',
  'Hip Hop,R&B,Pop',
  30,
  '$KEYZGMG',
  1
);

-- Seed: services
INSERT OR IGNORE INTO services (id, slug, name, description, is_bookable, base_rate_note, sort_order) VALUES
  (1, 'recording', 'Mobile Recording', 'Professional vocal recording session at your location — apartment, house, hotel, or studio.', 1, '$40/hour · First session $100 for 3 hours', 1),
  (2, 'mixing', 'Mixing', 'Full mix of your recorded tracks, balanced and polished for release.', 0, 'Contact for pricing', 2),
  (3, 'mastering', 'Mastering', 'Final polish and loudness/EQ mastering so your track is ready for streaming platforms.', 0, 'Contact for pricing', 3),
  (4, 'songwriting', 'Songwriting', 'Collaborative songwriting and topline help for your next record.', 0, 'Contact for pricing', 4),
  (5, 'podcast', 'Podcast Recording', 'Mobile podcast recording setup, multi-mic, at your location.', 0, 'Contact for pricing', 5),
  (6, 'voiceover', 'Voice Over', 'Clean voice-over recording for ads, content, and narration.', 0, 'Contact for pricing', 6);
