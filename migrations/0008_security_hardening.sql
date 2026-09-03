-- Studio2U security hardening pass (pre-Stripe-go-live audit fixes).
-- Adds: (1) DB-backed revocable admin sessions replacing the old stateless signed
-- cookie, (2) a generic rate-limit-attempts table for login/signup/admin-login
-- throttling, (3) an audit_log table for sensitive admin/engineer actions.

-- Revocable admin sessions — random token stored server-side, so leaking a cookie
-- no longer means a forever-valid credential, and a session can be individually
-- killed without rotating ADMIN_PASSWORD.
CREATE TABLE IF NOT EXISTS admin_sessions (
  token TEXT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);

-- Generic rate-limit attempt log — one row per attempt, keyed by
-- "<route>:<ip>". Old rows are pruned lazily on each check.
CREATE TABLE IF NOT EXISTS rate_limit_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_attempts_key ON rate_limit_attempts(key, created_at);

-- Audit trail for sensitive actions (admin overrides, engineer booking status
-- changes, commission changes, account suspensions). Not user-facing.
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_type TEXT NOT NULL,      -- 'admin' | 'user'
  actor_id TEXT,                 -- admin has no numeric id, so TEXT ('admin') or user.id as string
  action TEXT NOT NULL,          -- e.g. 'engineer.suspend', 'booking.status_change', 'commission.update'
  target_type TEXT,              -- e.g. 'engineer_profile', 'booking'
  target_id TEXT,
  metadata TEXT,                 -- JSON blob with any extra context
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
