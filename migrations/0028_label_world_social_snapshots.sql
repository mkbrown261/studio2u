-- Read-only social / trend snapshots captured by the user's own agent from the user's
-- own logged-in screen (Instagram/TikTok/YouTube analytics, YouTube Charts, Explore).
-- One row per post or chart entry per capture. Agents never post or interact.
CREATE TABLE lw_social_snapshots (
 id TEXT PRIMARY KEY, label_id TEXT NOT NULL REFERENCES lw_labels(id),
 platform TEXT NOT NULL CHECK(platform IN ('instagram','tiktok','youtube','youtube_charts','spotify','apple_music','other')),
 kind TEXT NOT NULL CHECK(kind IN ('MY_POST','MY_ACCOUNT','TREND','CHART')),
 title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 300), url TEXT, posted_at TEXT,
 metrics_json TEXT NOT NULL DEFAULT '{}', notes TEXT,
 captured_by TEXT NOT NULL, captured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX lw_social_label ON lw_social_snapshots(label_id,platform,captured_at);
ALTER TABLE lw_label_identity ADD COLUMN spotify_artist_id TEXT;
ALTER TABLE lw_label_identity ADD COLUMN apple_artist_id TEXT;
