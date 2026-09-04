-- Remote Recording: lets an engineer flag that they can record/mix a client
-- remotely (e.g. over a live video call, or by exchanging files) in addition
-- to (or instead of) in-person mobile sessions. This is a directory-visible,
-- filterable attribute — not yet gated behind any subscription tier (that
-- decision is still open; see engineer Pro planning). Free-text details field
-- exists because "how remote works" varies a lot per engineer (some do a live
-- Zoom session while recording, some just want files sent over) and a single
-- canned description wouldn't fit everyone.

ALTER TABLE engineer_profiles ADD COLUMN offers_remote INTEGER NOT NULL DEFAULT 0;
ALTER TABLE engineer_profiles ADD COLUMN remote_details TEXT;
