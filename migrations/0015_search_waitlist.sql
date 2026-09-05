-- Studio2U: "find an engineer more effectively" pass (2026-09-05).
--
-- Zero-results capture: when a customer's location/date/budget filters on the
-- directory return nothing, instead of a dead-end "no engineers found" message,
-- offer to notify them. This turns a lost visitor into a lead AND tells the
-- platform owner exactly where/when demand isn't being met (which city, which
-- date, what budget) — direct signal for where to recruit engineers next.
CREATE TABLE IF NOT EXISTS engineer_search_waitlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  location_label TEXT,          -- what they typed, e.g. "Wilmington, DE" or "19802"
  lat REAL,
  lng REAL,
  session_date TEXT,             -- YYYY-MM-DD, nullable (customer may not have picked one)
  genre TEXT,
  notes TEXT,
  contacted INTEGER NOT NULL DEFAULT 0,  -- admin marks 1 once followed up
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_search_waitlist_contacted ON engineer_search_waitlist(contacted, created_at);
