-- Studio2U Phase 3 M3: per-engineer weekly recurring availability + one-off date
-- overrides. Replaces the old platform-wide hardcoded Mon-Fri 11am-11pm window
-- (isWithinStandardAvailability in pricing.ts) with a real per-engineer calendar.
--
-- engineer_availability = the weekly recurring template. Each row means "this
-- engineer is open to START a session at this hour, on this day of week".
-- day_of_week matches JS Date.getDay(): 0=Sun, 1=Mon, ... 6=Sat. hour is 0-23.
--
-- IMPORTANT backward-compat rule (enforced in application code, not SQL, because
-- D1's SQLite build rejects large UNION/CROSS JOIN backfills): an engineer with
-- ZERO rows in this table has never customized their calendar, and the app falls
-- back to the old default window (Mon-Fri, hours 11-22) automatically. Once an
-- engineer saves ANY row here, that default no longer applies and only their
-- explicit rows count. See src/lib/db-availability.ts DEFAULT_AVAILABLE_HOURS.
--
-- engineer_availability_overrides = one-off exceptions for a specific calendar
-- date (vacation days, holiday closures, or extra hours beyond the weekly
-- template). is_available=0 force-closes an hour that would otherwise be open;
-- is_available=1 force-opens an hour that isn't otherwise open.
--
-- Actual "booked" blocking is NOT a separate table -- it's derived live from the
-- bookings table (any booking that isn't cancelled/rejected occupies its hour
-- range for that engineer+date). This keeps blocking always in sync: a slot
-- blocks the instant a booking is created and frees up automatically if the
-- booking is later cancelled/rejected.

CREATE TABLE IF NOT EXISTS engineer_availability (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  engineer_profile_id INTEGER NOT NULL,
  day_of_week INTEGER NOT NULL,
  hour INTEGER NOT NULL,
  FOREIGN KEY (engineer_profile_id) REFERENCES engineer_profiles(id),
  UNIQUE(engineer_profile_id, day_of_week, hour)
);

CREATE TABLE IF NOT EXISTS engineer_availability_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  engineer_profile_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  hour INTEGER NOT NULL,
  is_available INTEGER NOT NULL,
  FOREIGN KEY (engineer_profile_id) REFERENCES engineer_profiles(id),
  UNIQUE(engineer_profile_id, date, hour)
);

CREATE INDEX IF NOT EXISTS idx_availability_engineer ON engineer_availability(engineer_profile_id);
CREATE INDEX IF NOT EXISTS idx_overrides_engineer_date ON engineer_availability_overrides(engineer_profile_id, date);
