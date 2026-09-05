-- Studio2U Messaging v1: a simple per-booking message thread between an engineer and
-- their client. One thread per booking — no separate "conversation" object needed since
-- a booking already ties exactly one engineer to exactly one customer, same reasoning
-- already used for Projects (0012) attaching directly to booking_id.
--
-- Cloudflare Workers has no WebSockets and no `triggers`/cron, so this is deliberately
-- NOT real-time: messages are read on page load / manual refresh, matching how the rest
-- of this app already surfaces async state changes (e.g. a customer has to reload
-- /status to see an engineer's approval — there is no live-push anywhere in this app).
--
-- Gated to bookings that are 'confirmed' or 'completed' (enforced in route code, not
-- here) — no messaging on a booking that hasn't been paid/approved yet.
--
-- NOT in v1 (explicit non-goals, same scoping discipline as Projects/Packages):
--   - push notifications or email-on-new-message (that's Resend's job, parked)
--   - file attachments in messages (Projects already covers file sharing separately)
--   - read receipts beyond a simple unread count/badge

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('engineer', 'customer')),
  sender_name TEXT,
  body TEXT NOT NULL,
  read_by_engineer INTEGER NOT NULL DEFAULT 0,  -- 1 once the engineer has viewed the thread past this message
  read_by_customer INTEGER NOT NULL DEFAULT 0,  -- 1 once the customer has viewed the thread past this message
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id)
);

CREATE INDEX IF NOT EXISTS idx_messages_booking ON messages(booking_id);
CREATE INDEX IF NOT EXISTS idx_messages_booking_unread_engineer ON messages(booking_id, read_by_engineer);
CREATE INDEX IF NOT EXISTS idx_messages_booking_unread_customer ON messages(booking_id, read_by_customer);
