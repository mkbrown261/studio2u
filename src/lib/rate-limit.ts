// Simple D1-backed rate limiter for auth endpoints (login / signup / admin-login).
// Cloudflare Workers has no built-in in-process rate limiter and this project has no
// KV binding, so we log one row per attempt to rate_limit_attempts (migration 0008)
// and count rows within a sliding window. Good enough to stop naive password-guessing
// scripts without adding new Cloudflare infrastructure; a dashboard-level Cloudflare
// Rate Limiting Rule can be layered on top later for network-level protection.

const WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const MAX_ATTEMPTS = 10

export function getClientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown'
}

const WINDOW_MINUTES = WINDOW_MS / 60000

// Returns true if the request should be BLOCKED (too many attempts already).
// Does not itself record an attempt — call recordAttempt() separately once you know
// whether to count this specific request (e.g. only count failed logins, not every
// page view of the login form).
//
// Cutoff is computed with SQLite's own datetime('now', ...) rather than a
// JS-generated ISO string — created_at is stored via D1's CURRENT_TIMESTAMP, which
// uses SQLite's "YYYY-MM-DD HH:MM:SS" format (space separator, no 'T'/'Z'/millis).
// Comparing that against a JS toISOString() string breaks lexicographic ordering
// (the 'T' character sorts above a space), so mixing the two formats is a bug —
// always compare using SQLite-generated timestamps on both sides.
export async function isRateLimited(db: D1Database, key: string): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) as count FROM rate_limit_attempts
       WHERE key = ? AND created_at > datetime('now', ?)`
    )
    .bind(key, `-${WINDOW_MINUTES} minutes`)
    .first<{ count: number }>()
  return (row?.count || 0) >= MAX_ATTEMPTS
}

export async function recordAttempt(db: D1Database, key: string): Promise<void> {
  await db.prepare('INSERT INTO rate_limit_attempts (key) VALUES (?)').bind(key).run()
  // Lazily prune old rows for this key so the table doesn't grow unbounded — cheap
  // since it's scoped to a single key, not a full-table scan.
  await db
    .prepare(`DELETE FROM rate_limit_attempts WHERE key = ? AND created_at <= datetime('now', ?)`)
    .bind(key, `-${WINDOW_MINUTES} minutes`)
    .run()
}

export function rateLimitKey(route: string, request: Request): string {
  return `${route}:${getClientIp(request)}`
}
