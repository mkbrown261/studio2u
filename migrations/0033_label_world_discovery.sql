-- "Know me": the artist dossier every agent reads before helping.
-- Facts carry provenance (OWNER said it / AGENT found it / PUBLIC music database) and
-- agent/public facts stay unconfirmed until the owner confirms. Links to the artist's
-- profiles are suggestions until the owner says "That's me" (similar names are common).
CREATE TABLE lw_artist_facts (
 label_id TEXT NOT NULL REFERENCES lw_labels(id),
 key TEXT NOT NULL CHECK(length(key) BETWEEN 1 AND 40),
 value_json TEXT NOT NULL,
 source TEXT NOT NULL CHECK(source IN ('OWNER','AGENT','PUBLIC')),
 evidence TEXT, confirmed INTEGER NOT NULL DEFAULT 0, updated_by TEXT,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(label_id,key)
);
CREATE TABLE lw_artist_links (
 id TEXT PRIMARY KEY, label_id TEXT NOT NULL REFERENCES lw_labels(id),
 platform TEXT NOT NULL, url TEXT NOT NULL CHECK(length(url) BETWEEN 8 AND 500), handle TEXT,
 source TEXT NOT NULL CHECK(source IN ('MUSICBRAINZ','DEEZER','ITUNES','AGENT','OWNER')),
 confidence TEXT NOT NULL DEFAULT 'POSSIBLE' CHECK(confidence IN ('STRONG','LIKELY','POSSIBLE')),
 status TEXT NOT NULL DEFAULT 'SUGGESTED' CHECK(status IN ('SUGGESTED','CONFIRMED','NOT_ME')),
 evidence TEXT, found_by TEXT, metrics_json TEXT NOT NULL DEFAULT '{}',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(label_id,url)
);
CREATE INDEX lw_artist_links_label ON lw_artist_links(label_id,status);
ALTER TABLE lw_label_identity ADD COLUMN discovered_at TEXT;
