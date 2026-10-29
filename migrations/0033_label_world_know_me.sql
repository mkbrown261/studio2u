-- "Know me": what the team found about the artist (public sources only, each with a link
-- and the date it was read), plus a link from chat replies to the case they belong to,
-- so the owner can keep answering in the same conversation box.
ALTER TABLE lw_label_identity ADD COLUMN discovery_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE lw_label_identity ADD COLUMN discovered_at TEXT;
ALTER TABLE lw_employee_messages ADD COLUMN case_id TEXT;
