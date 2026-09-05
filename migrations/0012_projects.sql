-- Studio2U Projects: file storage + sharing between an engineer and their client.
-- This is the concrete product behind the "we hold and transport your files" pitch
-- baked into the Pro/Elite subscription tiers (see 0011_subscriptions.sql).
--
-- v1 scope (deliberately simple): an engineer drags a whole session folder onto their
-- Project page in the browser; every file uploads straight to R2 (bucket already bound
-- as `R2` in wrangler.jsonc, previously only used for profile/equipment photos). A
-- Project optionally attaches to a specific booking, which is what lets the artist see
-- their files under "My Bookings" using the customer account/session infra that
-- already exists — no separate share-link/invite system needed for v1.
--
-- NOT in v1 (documented as an explicit non-goal for now): OS-level folder sync (Dropbox-
-- style background agent). Cloudflare Workers has no persistent local process, so that
-- would require a native desktop app — a genuinely different product, revisit later.

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  engineer_profile_id INTEGER NOT NULL,
  booking_id INTEGER,                 -- optional link to the session this project came from; NULL = engineer's own working project, not yet tied to a specific client session
  customer_id INTEGER,                -- optional link to customers(id) so the artist can find it under "My Bookings" even if booking_id is NULL (e.g. engineer shares files ahead of the session)
  name TEXT NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (engineer_profile_id) REFERENCES engineer_profiles(id),
  FOREIGN KEY (booking_id) REFERENCES bookings(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE INDEX IF NOT EXISTS idx_projects_engineer ON projects(engineer_profile_id);
CREATE INDEX IF NOT EXISTS idx_projects_booking ON projects(booking_id);
CREATE INDEX IF NOT EXISTS idx_projects_customer ON projects(customer_id);

CREATE TABLE IF NOT EXISTS project_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  r2_key TEXT NOT NULL,                -- storage key in the `R2` bucket, e.g. projects/{project_id}/{uuid}-{filename}
  file_name TEXT NOT NULL,             -- original filename as uploaded, shown in the UI (r2_key is not human-friendly)
  relative_path TEXT,                  -- subfolder path preserved from a dragged folder upload, e.g. "Stems/Vocals/lead.wav"; NULL for flat single-file uploads
  content_type TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  uploaded_by_user_id INTEGER,         -- who uploaded it (engineer or, later, artist upload support) — NULL for legacy/unknown
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE INDEX IF NOT EXISTS idx_project_files_project ON project_files(project_id);

-- Storage overage billing: recorded when an engineer's storage_used_bytes (engineer_profiles,
-- see 0011) exceeds their tier's included limit. One row per calendar month per engineer so
-- admin can review/export it; actual charging mechanism (Stripe invoice item) is added when
-- this is wired up, not required to ship Projects v1.
CREATE TABLE IF NOT EXISTS storage_overage_charges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  engineer_profile_id INTEGER NOT NULL,
  billing_month TEXT NOT NULL,         -- 'YYYY-MM'
  overage_gb REAL NOT NULL,
  rate_per_gb REAL NOT NULL,
  amount_charged REAL NOT NULL,
  stripe_invoice_item_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (engineer_profile_id) REFERENCES engineer_profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_storage_overage_engineer ON storage_overage_charges(engineer_profile_id);
