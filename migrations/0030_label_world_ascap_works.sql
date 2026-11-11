-- ASCAP work registration for catalog songs (most catalog songs are not Studio2U releases).
-- work_json holds the same validated fields as release intake (writers, splits, publishers,
-- duration, samples...). pro_submitted_at = the owner pressed Submit; pro_status flips to
-- REGISTERED only when the agent sees the work in ASCAP with evidence.
ALTER TABLE lw_catalog_tracks ADD COLUMN work_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE lw_catalog_tracks ADD COLUMN pro_work_id TEXT;
ALTER TABLE lw_catalog_tracks ADD COLUMN pro_submitted_at TEXT;
CREATE INDEX lw_catalog_pro ON lw_catalog_tracks(label_id,pro_status);
