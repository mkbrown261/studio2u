// Lightweight admin session using a signed cookie (no external auth provider needed for V1).
// Cookie stores SHA-256("studio2u-admin::" + ADMIN_PASSWORD) rather than the raw password.

const COOKIE_NAME = 'studio2u_admin_session'

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function expectedSessionToken(adminPassword: string): Promise<string> {
  return sha256Hex(`studio2u-admin::${adminPassword}`)
}

export function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie') || ''
  const match = header.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${name}=`))
  if (!match) return null
  return decodeURIComponent(match.substring(name.length + 1))
}

export function buildSessionCookie(token: string): string {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${60 * 60 * 12}`
}

export function buildClearCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
}

export async function isAdminAuthenticated(request: Request, adminPassword: string): Promise<boolean> {
  if (!adminPassword) return false
  const cookieValue = getCookie(request, COOKIE_NAME)
  if (!cookieValue) return false
  const expected = await expectedSessionToken(adminPassword)
  return cookieValue === expected
}

export { COOKIE_NAME }
