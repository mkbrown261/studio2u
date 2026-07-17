-- Studio2U Phase 3 M1: platform-wide settings, starting with the marketplace commission
-- percentage. Single-row key/value table so admin can change it from /admin without a
-- redeploy. Commission is NOT hardcoded anywhere in app code — always read from here.

CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Default commission = 10% (confirmed with platform owner). Editable in /admin.
INSERT OR IGNORE INTO platform_settings (key, value) VALUES ('commission_percent', '10');
