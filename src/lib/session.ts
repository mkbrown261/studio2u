// Real user session management (separate from the platform-admin cookie in auth.ts —
// that one stays untouched to avoid risking the already-live /admin flow).

const SESSION_COOKIE = 'studio2u_session'
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30 // 30 days

export interface SessionUser {
  id: number
  email: string
  name: string
  phone: string | null
  is_engineer: number
  is_artist: number
  is_platform_admin: number
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function createSession(db: D1Database, userId: number): Promise<string> {
  const token = randomToken()
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString()
  await db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').bind(token, userId, expiresAt).run()
  return token
}

export async function destroySession(db: D1Database, token: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run()
}

export function getCookieValue(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie') || ''
  const match = header
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`))
  if (!match) return null
  return decodeURIComponent(match.substring(name.length + 1))
}

export function buildSessionCookieHeader(token: string): string {
  const maxAge = Math.floor(SESSION_DURATION_MS / 1000)
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`
}

export function buildClearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
}

export async function getSessionUser(db: D1Database, request: Request): Promise<SessionUser | null> {
  const token = getCookieValue(request, SESSION_COOKIE)
  if (!token) return null

  const row = await db
    .prepare(
      `SELECT u.id, u.email, u.name, u.phone, u.is_engineer, u.is_artist, u.is_platform_admin
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > CURRENT_TIMESTAMP`
    )
    .bind(token)
    .first()

  return (row as unknown as SessionUser) || null
}

export { SESSION_COOKIE }
