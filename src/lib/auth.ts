// Admin session management — DB-backed, revocable random tokens (security hardening
// pass, pre-Stripe-go-live). Replaces the old stateless
// SHA-256("studio2u-admin::" + ADMIN_PASSWORD) cookie scheme, which had two problems:
// (1) anyone who ever learned ADMIN_PASSWORD could compute a valid "forever" cookie
// offline without ever hitting /admin/login, and (2) there was no way to revoke a
// single leaked session without rotating the password itself. Sessions here are
// random 256-bit tokens stored in the admin_sessions table (migration 0008), checked
// against an expiry on every request, exactly like the real-user session system in
// session.ts.

const COOKIE_NAME = 'studio2u_admin_session'
const SESSION_DURATION_MS = 1000 * 60 * 60 * 12 // 12 hours, same as the old cookie's Max-Age

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function createAdminSession(db: D1Database): Promise<string> {
  const token = randomToken()
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString()
  await db.prepare('INSERT INTO admin_sessions (token, expires_at) VALUES (?, ?)').bind(token, expiresAt).run()
  return token
}

export async function destroyAdminSession(db: D1Database, token: string): Promise<void> {
  await db.prepare('DELETE FROM admin_sessions WHERE token = ?').bind(token).run()
}

export function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie') || ''
  const match = header.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${name}=`))
  if (!match) return null
  return decodeURIComponent(match.substring(name.length + 1))
}

export function buildSessionCookie(token: string): string {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_DURATION_MS / 1000}`
}

export function buildClearCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
}

export async function isAdminAuthenticated(db: D1Database, request: Request): Promise<boolean> {
  const token = getCookie(request, COOKIE_NAME)
  if (!token) return false
  const row = await db
    .prepare('SELECT token FROM admin_sessions WHERE token = ? AND expires_at > CURRENT_TIMESTAMP')
    .bind(token)
    .first()
  return !!row
}

export { COOKIE_NAME }
