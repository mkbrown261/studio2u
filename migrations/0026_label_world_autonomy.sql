-- Label World autonomy: agent work queue, provider submission packets,
-- reusable party (writer/publisher) profiles and a notification outbox.
-- Additive only. Existing releases, tasks and registration records are untouched.

-- Agent work queue extensions on the existing durable task table.
ALTER TABLE lw_tasks ADD COLUMN kind TEXT NOT NULL DEFAULT 'GENERIC';
ALTER TABLE lw_tasks ADD COLUMN capability TEXT NOT NULL DEFAULT 'ANY' CHECK(capability IN ('ANY','SCREEN_CONTROL','HUMAN'));
ALTER TABLE lw_tasks ADD COLUMN claimed_by TEXT;
ALTER TABLE lw_tasks ADD COLUMN run_after TEXT;
ALTER TABLE lw_tasks ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 5;
ALTER TABLE lw_tasks ADD COLUMN dedupe_key TEXT;
ALTER TABLE lw_tasks ADD COLUMN title TEXT;
CREATE UNIQUE INDEX lw_tasks_dedupe ON lw_tasks(label_id,dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX lw_tasks_claim ON lw_tasks(label_id,status,capability,run_after);

-- Reusable identities so agents never re-ask for a writer's legal name, PRO or IPI.
CREATE TABLE lw_parties (
 id TEXT PRIMARY KEY, label_id TEXT NOT NULL REFERENCES lw_labels(id),
 legal_name TEXT NOT NULL, display_name TEXT,
 kind TEXT NOT NULL DEFAULT 'PERSON' CHECK(kind IN ('PERSON','PUBLISHER','COMPANY')),
 pro TEXT CHECK(pro IN ('ASCAP','BMI','SESAC','GMR','SOCAN','PRS','OTHER','NONE') OR pro IS NULL),
 ipi TEXT, publisher_name TEXT, publisher_ipi TEXT, email TEXT,
 provenance TEXT NOT NULL DEFAULT 'USER_CONFIRMED' CHECK(provenance IN ('USER_CONFIRMED','DOCUMENT_VERIFIED','AGENT_PROVIDED','MACHINE_INFERRED')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(label_id,id)
);
CREATE INDEX lw_parties_label ON lw_parties(label_id,legal_name);

-- One provider submission packet per release/target. Studio2U prepares; the human
-- (optionally assisted by their own screen-controlling agent) presses Submit on the
-- official site. Only provider evidence moves a packet to VERIFIED.
CREATE TABLE lw_submissions (
 id TEXT PRIMARY KEY, label_id TEXT NOT NULL, release_id TEXT NOT NULL,
 target TEXT NOT NULL CHECK(target IN ('UNITEDMASTERS','ASCAP','SOUNDEXCHANGE')),
 status TEXT NOT NULL DEFAULT 'BLOCKED' CHECK(status IN ('NOT_APPLICABLE','BLOCKED','READY','SUBMITTED_REPORTED','VERIFIED','NEEDS_CORRECTION','CANCELLED')),
 release_version INTEGER NOT NULL, packet_json TEXT NOT NULL DEFAULT '{}',
 missing_count INTEGER NOT NULL DEFAULT 0,
 confirmation_ref TEXT, receipt_url TEXT, submitted_by TEXT, submitted_at TEXT,
 verified_evidence TEXT, verified_at TEXT,
 revision INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(label_id,release_id) REFERENCES lw_releases(label_id,id),
 UNIQUE(label_id,release_id,target), UNIQUE(label_id,id)
);
CREATE INDEX lw_submissions_status ON lw_submissions(label_id,status,updated_at);

-- Notification outbox. Rows are always visible in-app; delivery channels
-- (email/SMS/push) can be attached later without changing producers.
CREATE TABLE lw_notifications (
 id TEXT PRIMARY KEY, label_id TEXT NOT NULL REFERENCES lw_labels(id),
 user_id INTEGER REFERENCES users(id), release_id TEXT,
 kind TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, link TEXT,
 dedupe_key TEXT, read_at TEXT, delivered_at TEXT, channel TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX lw_notifications_dedupe ON lw_notifications(label_id,dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX lw_notifications_inbox ON lw_notifications(label_id,read_at,created_at);

-- Encrypted per-label secrets (e.g. the owner's own Claude Code scheduled-task
-- API trigger URL+token, used only to wake their agent when work is queued).
CREATE TABLE lw_label_secrets (
 label_id TEXT NOT NULL REFERENCES lw_labels(id), name TEXT NOT NULL,
 value TEXT NOT NULL, created_by INTEGER NOT NULL REFERENCES users(id),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(label_id,name)
);

-- Engine heartbeat so the UI and agents can see the always-on worker is alive.
CREATE TABLE lw_engine_runs (
 id INTEGER PRIMARY KEY AUTOINCREMENT, started_at TEXT NOT NULL, finished_at TEXT,
 summary_json TEXT NOT NULL DEFAULT '{}'
);
