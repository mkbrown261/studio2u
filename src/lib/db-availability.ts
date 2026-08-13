// Studio2U Phase 3 M3: per-engineer availability data access.
//
// Two layers stack together to decide "is hour H open for engineer E on date D":
//   1. Weekly recurring template (engineer_availability) — OR the legacy default
//      (Mon-Fri, 11-22) if the engineer has never customized their calendar.
//   2. One-off overrides for that exact date (engineer_availability_overrides) —
//      is_available=1 force-opens, is_available=0 force-closes, and an override
//      always wins over the weekly template for that specific date+hour.
// Then subtract anything already booked (derived live from bookings, not stored).

// Legacy default window carried over from isWithinStandardAvailability(): sessions
// can start 11am through 10pm, Monday-Friday. Applies ONLY to engineers who have
// zero rows in engineer_availability (i.e. have never touched the new calendar).
const DEFAULT_DAYS = [1, 2, 3, 4, 5] // Mon-Fri (JS getDay(): 0=Sun...6=Sat)
const DEFAULT_HOURS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]

export const ALL_HOURS = Array.from({ length: 24 }, (_, i) => i) // 0-23
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export interface WeeklyTemplate {
  // day_of_week (0-6) -> sorted array of open hours
  [dayOfWeek: number]: number[]
}

export async function getWeeklyAvailability(db: D1Database, engineerProfileId: number): Promise<WeeklyTemplate> {
  const { results } = await db
    .prepare('SELECT day_of_week, hour FROM engineer_availability WHERE engineer_profile_id = ? ORDER BY day_of_week, hour')
    .bind(engineerProfileId)
    .all<{ day_of_week: number; hour: number }>()

  const rows = results || []
  const template: WeeklyTemplate = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }

  if (rows.length === 0) {
    // Never customized — fall back to the legacy default window.
    for (const day of DEFAULT_DAYS) {
      template[day] = [...DEFAULT_HOURS]
    }
    return template
  }

  for (const row of rows) {
    template[row.day_of_week].push(row.hour)
  }
  return template
}

// Overwrites the ENTIRE weekly template for this engineer with the given set of
// (day, hour) pairs. Passing an empty array intentionally means "closed every day"
// (not "use the default") since the engineer has now explicitly touched their
// calendar — matches the documented backward-compat rule in the migration.
export async function setWeeklyAvailability(
  db: D1Database,
  engineerProfileId: number,
  slots: Array<{ dayOfWeek: number; hour: number }>
): Promise<void> {
  const statements = [
    db.prepare('DELETE FROM engineer_availability WHERE engineer_profile_id = ?').bind(engineerProfileId)
  ]
  for (const s of slots) {
    statements.push(
      db
        .prepare('INSERT INTO engineer_availability (engineer_profile_id, day_of_week, hour) VALUES (?, ?, ?)')
        .bind(engineerProfileId, s.dayOfWeek, s.hour)
    )
  }
  await db.batch(statements)
}

export interface DateOverride {
  hour: number
  isAvailable: boolean
}

// Overrides for a single specific date.
export async function getOverridesForDate(db: D1Database, engineerProfileId: number, date: string): Promise<DateOverride[]> {
  const { results } = await db
    .prepare('SELECT hour, is_available FROM engineer_availability_overrides WHERE engineer_profile_id = ? AND date = ?')
    .bind(engineerProfileId, date)
    .all<{ hour: number; is_available: number }>()
  return (results || []).map((r) => ({ hour: r.hour, isAvailable: r.is_available === 1 }))
}

// All upcoming overrides (today onward) for the dashboard override-management list.
export async function getUpcomingOverrides(
  db: D1Database,
  engineerProfileId: number,
  fromDate: string
): Promise<Array<{ date: string; hour: number; isAvailable: boolean }>> {
  const { results } = await db
    .prepare(
      'SELECT date, hour, is_available FROM engineer_availability_overrides WHERE engineer_profile_id = ? AND date >= ? ORDER BY date, hour'
    )
    .bind(engineerProfileId, fromDate)
    .all<{ date: string; hour: number; is_available: number }>()
  return (results || []).map((r) => ({ date: r.date, hour: r.hour, isAvailable: r.is_available === 1 }))
}

export async function setOverridesForDate(
  db: D1Database,
  engineerProfileId: number,
  date: string,
  overrides: DateOverride[]
): Promise<void> {
  const statements = [
    db
      .prepare('DELETE FROM engineer_availability_overrides WHERE engineer_profile_id = ? AND date = ?')
      .bind(engineerProfileId, date)
  ]
  for (const o of overrides) {
    statements.push(
      db
        .prepare('INSERT INTO engineer_availability_overrides (engineer_profile_id, date, hour, is_available) VALUES (?, ?, ?, ?)')
        .bind(engineerProfileId, date, o.hour, o.isAvailable ? 1 : 0)
    )
  }
  await db.batch(statements)
}

export async function deleteOverrideDate(db: D1Database, engineerProfileId: number, date: string): Promise<void> {
  await db
    .prepare('DELETE FROM engineer_availability_overrides WHERE engineer_profile_id = ? AND date = ?')
    .bind(engineerProfileId, date)
    .run()
}

// Hours already occupied by a live booking (anything not cancelled/rejected) for
// this engineer on this date. A booking with duration_hours=2 starting at hour H
// occupies hours [H, H+1] (rounded to whole hours for slot-blocking purposes).
export async function getBookedHoursForDate(db: D1Database, engineerProfileId: number, date: string): Promise<number[]> {
  const { results } = await db
    .prepare(
      `SELECT session_time, duration_hours FROM bookings
       WHERE engineer_profile_id = ? AND session_date = ? AND status NOT IN ('cancelled', 'rejected')`
    )
    .bind(engineerProfileId, date)
    .all<{ session_time: string; duration_hours: number }>()

  const booked = new Set<number>()
  for (const row of results || []) {
    const startHour = parseInt(row.session_time.split(':')[0], 10)
    if (Number.isNaN(startHour)) continue
    const span = Math.max(1, Math.ceil(row.duration_hours))
    for (let i = 0; i < span; i++) {
      booked.add(startHour + i)
    }
  }
  return Array.from(booked)
}

// The single source of truth for "which hours can a customer pick for this
// engineer on this date" — combines weekly template + overrides + already-booked
// exclusion. Used by both the public availability API and server-side booking
// validation (never trust the client's slot selection alone).
export async function getAvailableHoursForDate(db: D1Database, engineerProfileId: number, date: string): Promise<number[]> {
  const dayOfWeek = new Date(`${date}T00:00:00`).getDay()
  const weekly = await getWeeklyAvailability(db, engineerProfileId)
  const baseOpen = new Set(weekly[dayOfWeek] || [])

  const overrides = await getOverridesForDate(db, engineerProfileId, date)
  for (const o of overrides) {
    if (o.isAvailable) baseOpen.add(o.hour)
    else baseOpen.delete(o.hour)
  }

  const booked = new Set(await getBookedHoursForDate(db, engineerProfileId, date))
  const open = Array.from(baseOpen).filter((h) => !booked.has(h))
  open.sort((a, b) => a - b)
  return open
}

// Is this exact date+hour open for booking right now? (server-side re-check before
// accepting a booking — never trust the client's earlier availability-check call)
export async function isHourAvailable(db: D1Database, engineerProfileId: number, date: string, hour: number): Promise<boolean> {
  const open = await getAvailableHoursForDate(db, engineerProfileId, date)
  return open.includes(hour)
}

// Is the FULL requested duration open, starting at this hour? (a 3-hour session
// starting at hour H needs H, H+1, H+2 all open)
export async function isRangeAvailable(
  db: D1Database,
  engineerProfileId: number,
  date: string,
  startHour: number,
  durationHours: number
): Promise<boolean> {
  const open = new Set(await getAvailableHoursForDate(db, engineerProfileId, date))
  const span = Math.max(1, Math.ceil(durationHours))
  for (let i = 0; i < span; i++) {
    if (!open.has(startHour + i)) return false
  }
  return true
}
