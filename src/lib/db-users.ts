export interface User {
  id: number
  email: string
  password_hash: string
  name: string
  phone: string | null
  is_engineer: number
  is_artist: number
  is_platform_admin: number
  created_at: string
}

export async function findUserByEmail(db: D1Database, email: string): Promise<User | null> {
  const row = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email.trim().toLowerCase()).first()
  return (row as unknown as User) || null
}

export async function findUserById(db: D1Database, id: number): Promise<User | null> {
  const row = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first()
  return (row as unknown as User) || null
}

export async function createUser(
  db: D1Database,
  params: { email: string; passwordHash: string; name: string; phone: string; isEngineer: boolean; isArtist: boolean }
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO users (email, password_hash, name, phone, is_engineer, is_artist) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(
      params.email.trim().toLowerCase(),
      params.passwordHash,
      params.name,
      params.phone,
      params.isEngineer ? 1 : 0,
      params.isArtist ? 1 : 0
    )
    .run()
  return result.meta.last_row_id as number
}

export async function setUserRoles(db: D1Database, userId: number, isEngineer: boolean, isArtist: boolean) {
  await db
    .prepare('UPDATE users SET is_engineer = ?, is_artist = ? WHERE id = ?')
    .bind(isEngineer ? 1 : 0, isArtist ? 1 : 0, userId)
    .run()
}
