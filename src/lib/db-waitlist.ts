// Search Waitlist: captures a lead when the /engineers directory search returns zero
// results (no engineer covers the customer's location/date). Turns a dead-end into a
// follow-up opportunity, and gives the platform owner a direct signal of unmet demand
// (which city, which date, what genre/budget) — exactly where to recruit next.

export interface WaitlistEntry {
  id: number
  email: string
  location_label: string | null
  lat: number | null
  lng: number | null
  session_date: string | null
  genre: string | null
  notes: string | null
  contacted: number
  created_at: string
}

export async function addToSearchWaitlist(
  db: D1Database,
  p: {
    email: string
    locationLabel?: string | null
    lat?: number | null
    lng?: number | null
    sessionDate?: string | null
    genre?: string | null
    notes?: string | null
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO engineer_search_waitlist (email, location_label, lat, lng, session_date, genre, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      p.email,
      p.locationLabel || null,
      p.lat ?? null,
      p.lng ?? null,
      p.sessionDate || null,
      p.genre || null,
      p.notes || null
    )
    .run()
}

export async function getWaitlistForAdmin(db: D1Database): Promise<WaitlistEntry[]> {
  const { results } = await db
    .prepare('SELECT * FROM engineer_search_waitlist ORDER BY contacted ASC, created_at DESC')
    .all()
  return (results as unknown as WaitlistEntry[]) || []
}

export async function markWaitlistContacted(db: D1Database, id: number, contacted: boolean): Promise<void> {
  await db.prepare('UPDATE engineer_search_waitlist SET contacted = ? WHERE id = ?').bind(contacted ? 1 : 0, id).run()
}
