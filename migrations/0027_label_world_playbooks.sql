-- Playbooks, artist identity, imported catalog and "Money Found" cases.
-- A case = one real-world problem (unpaid TV placement, unregistered songs,
-- SoundExchange money, name dispute, unpaid split) worked step-by-step by agents
-- following a versioned playbook. Outbound letters are DRAFTS until the owner approves.

CREATE TABLE lw_label_identity (
 label_id TEXT PRIMARY KEY REFERENCES lw_labels(id),
 artist_name TEXT NOT NULL CHECK(length(artist_name) BETWEEN 1 AND 120),
 legal_name TEXT CHECK(legal_name IS NULL OR length(legal_name) <= 120),
 aliases_json TEXT NOT NULL DEFAULT '[]',
 pro TEXT CHECK(pro IN ('ASCAP','BMI','SESAC','GMR','SOCAN','PRS','OTHER','NONE') OR pro IS NULL),
 ipi TEXT, first_used_year INTEGER, socials_json TEXT NOT NULL DEFAULT '{}',
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE lw_catalog_tracks (
 id TEXT PRIMARY KEY, label_id TEXT NOT NULL REFERENCES lw_labels(id),
 source TEXT NOT NULL CHECK(source IN ('deezer','itunes','manual','agent')),
 source_id TEXT, title TEXT NOT NULL, artist_credit TEXT NOT NULL, album TEXT,
 isrc TEXT, release_date TEXT, duration_sec INTEGER, explicit INTEGER, link TEXT,
 confirmed INTEGER NOT NULL DEFAULT 1, release_id TEXT,
 pro_status TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK(pro_status IN ('UNKNOWN','REGISTERED','NOT_REGISTERED','NOT_MINE')),
 sx_status TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK(sx_status IN ('UNKNOWN','CLAIMED','NOT_CLAIMED','NOT_MINE')),
 notes TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(label_id,id)
);
CREATE UNIQUE INDEX lw_catalog_source ON lw_catalog_tracks(label_id,source,source_id) WHERE source_id IS NOT NULL;
CREATE INDEX lw_catalog_isrc ON lw_catalog_tracks(label_id,isrc);

CREATE TABLE lw_cases (
 id TEXT PRIMARY KEY, label_id TEXT NOT NULL REFERENCES lw_labels(id),
 playbook TEXT NOT NULL, playbook_version INTEGER NOT NULL DEFAULT 1,
 title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
 status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','WAITING_ON_YOU','WAITING_ON_THEM','RESOLVED','CLOSED')),
 facts_json TEXT NOT NULL DEFAULT '{}', step INTEGER NOT NULL DEFAULT 0,
 deadline TEXT, deadline_note TEXT, money_estimate TEXT,
 next_follow_up_at TEXT, created_by INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(label_id,id)
);
CREATE INDEX lw_cases_label ON lw_cases(label_id,status);
CREATE INDEX lw_cases_follow ON lw_cases(status,next_follow_up_at);

CREATE TABLE lw_case_events (
 cursor INTEGER PRIMARY KEY AUTOINCREMENT, label_id TEXT NOT NULL, case_id TEXT NOT NULL,
 actor TEXT NOT NULL, kind TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX lw_case_events_case ON lw_case_events(case_id,cursor);

CREATE TABLE lw_case_drafts (
 id TEXT PRIMARY KEY, label_id TEXT NOT NULL, case_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('EMAIL','LETTER','FORM_NOTES','CONTRACT','POST')),
 recipient TEXT, recipient_email TEXT, subject TEXT, body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 20000),
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','APPROVED','SENT','REJECTED')),
 written_by TEXT NOT NULL, approved_by INTEGER, approved_at TEXT, sent_at TEXT, sent_note TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX lw_case_drafts_case ON lw_case_drafts(case_id,status);
