-- SoundExchange: account facts (never tax IDs, bank details or passwords), per-song
-- submit/claim tracking, and attachments on drafts (files stay on the owner's computer;
-- the record says what gets attached so the owner approves it with the email).
ALTER TABLE lw_label_identity ADD COLUMN sx_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE lw_catalog_tracks ADD COLUMN sx_submitted_at TEXT;
ALTER TABLE lw_catalog_tracks ADD COLUMN sx_ref TEXT;
ALTER TABLE lw_case_drafts ADD COLUMN attachments_json TEXT NOT NULL DEFAULT '[]';
