// Password hashing using Web Crypto's PBKDF2 — no native bcrypt/argon2 available in
// Cloudflare Workers, and PBKDF2-SHA256 via crypto.subtle is the standard workaround.
// Stored format: "pbkdf2$<iterations>$<saltHex>$<hashHex>"

const ITERATIONS = 100_000
const KEY_LENGTH_BITS = 256

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

async function deriveHash(password: string, salt: Uint8Array, iterations: number): Promise<ArrayBuffer> {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits'
  ])
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    KEY_LENGTH_BITS
  )
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hashBuffer = await deriveHash(password, salt, ITERATIONS)
  return `pbkdf2$${ITERATIONS}$${bufferToHex(salt.buffer as ArrayBuffer)}$${bufferToHex(hashBuffer)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false
  const iterations = parseInt(parts[1], 10)
  const salt = hexToBuffer(parts[2])
  const expectedHex = parts[3]

  const hashBuffer = await deriveHash(password, salt, iterations)
  const actualHex = bufferToHex(hashBuffer)

  // Constant-time-ish comparison
  if (actualHex.length !== expectedHex.length) return false
  let mismatch = 0
  for (let i = 0; i < actualHex.length; i++) {
    mismatch |= actualHex.charCodeAt(i) ^ expectedHex.charCodeAt(i)
  }
  return mismatch === 0
}
