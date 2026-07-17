-- Studio2U Phase 2: real accounts, multi-engineer marketplace, portfolios, reviews.
-- Payment routing model = Option A: each engineer uses their own Cash App handle and
-- approves their own bookings from their own dashboard. Platform admin (/admin) keeps
-- a cross-engineer oversight view + suspend/reactivate kill switch, but is no longer
-- the payment bottleneck.

-- Real user accounts. One account can be an engineer, an artist, or both.
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,        -- PBKDF2 (Web Crypto) — "algo$iterations$saltHex$hashHex"
  name TEXT NOT NULL,
  phone TEXT,
  is_engineer INTEGER DEFAULT 0,
  is_artist INTEGER DEFAULT 0,
  is_platform_admin INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Session tokens (random, stored as a cookie value; not JWT — simplest thing that works
-- in Workers without extra deps).
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- Engineer-facing profile. Replaces the old single-row `engineers` seed table as the
-- source of truth going forward; `engineers` stays for backward-compat FK references
-- from bookings created before this migration but new engineers live here.
CREATE TABLE IF NOT EXISTS engineer_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL,

  display_name TEXT NOT NULL,
  bio TEXT,
  photo_url TEXT,                     -- R2 key

  hourly_rate REAL NOT NULL DEFAULT 40,

  -- First-time discount is per-engineer, per-customer (not platform-wide). NULL amount
  -- means the engineer has no intro offer and charges straight hourly.
  first_time_discount_amount REAL,       -- e.g. 100 (flat price)
  first_time_discount_hours REAL,        -- e.g. 3 (hours covered by that flat price)

  genres TEXT,                        -- comma-separated
  travel_radius_miles INTEGER DEFAULT 30,

  equipment_text TEXT,
  equipment_photo_url TEXT,           -- R2 key

  cashapp_handle TEXT,

  -- Rough location: engineer enters a city/zip, we geocode it (Nominatim) once and
  -- jitter it 1-2mi so the pin is never their exact address.
  location_label TEXT,                -- what the engineer typed, e.g. "Atlanta, GA"
  lat REAL,
  lng REAL,

  is_published INTEGER DEFAULT 0,     -- publishes instantly on save; this just tracks draft vs live
  is_new INTEGER DEFAULT 1,           -- true until first review lands
  is_suspended INTEGER DEFAULT 0,     -- platform admin kill switch

  rating_avg REAL DEFAULT 0,
  rating_count INTEGER DEFAULT 0,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_engineer_profiles_published ON engineer_profiles(is_published, is_suspended);

-- Portfolio items — embed links primary (SoundCloud/YouTube/Spotify), so no heavy file
-- storage/bandwidth cost and better native playback than self-hosted audio.
CREATE TABLE IF NOT EXISTS portfolio_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  engineer_profile_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  embed_url TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (engineer_profile_id) REFERENCES engineer_profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_engineer ON portfolio_items(engineer_profile_id);

-- Reviews — mic-icon rating (1-5) instead of stars. Gated to one review per completed
-- booking.
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER UNIQUE NOT NULL,
  engineer_profile_id INTEGER NOT NULL,
  customer_user_id INTEGER,           -- nullable: reviewer may predate real accounts
  customer_name TEXT NOT NULL,
  mic_rating INTEGER NOT NULL CHECK (mic_rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id),
  FOREIGN KEY (engineer_profile_id) REFERENCES engineer_profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_engineer ON reviews(engineer_profile_id);

-- ---- Extend bookings for the new per-engineer marketplace flow ----
-- (engineer_id already existed from Phase 1's future-proofed schema; we're adding the
-- link to the new engineer_profiles table plus per-booking snapshot of what was quoted.)
ALTER TABLE bookings ADD COLUMN engineer_profile_id INTEGER REFERENCES engineer_profiles(id);
ALTER TABLE bookings ADD COLUMN customer_user_id INTEGER REFERENCES users(id);
ALTER TABLE bookings ADD COLUMN reviewed INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_bookings_engineer_profile ON bookings(engineer_profile_id);
