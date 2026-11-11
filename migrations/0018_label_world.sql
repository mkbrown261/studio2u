-- Additive Label World foundation; apply locally before production review.
CREATE TABLE lw_labels (
 id TEXT PRIMARY KEY, name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
 logo_key TEXT, headquarters_json TEXT NOT NULL DEFAULT '{}',
 storage_quota_bytes INTEGER NOT NULL DEFAULT 5368709120,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE lw_memberships (
 label_id TEXT NOT NULL REFERENCES lw_labels(id), user_id INTEGER NOT NULL REFERENCES users(id),
 role TEXT NOT NULL CHECK(role IN ('owner','editor','viewer')), PRIMARY KEY(label_id,user_id)
);
CREATE INDEX lw_memberships_user ON lw_memberships(user_id);
CREATE TABLE lw_releases (
 id TEXT PRIMARY KEY, label_id TEXT NOT NULL REFERENCES lw_labels(id),
 artist TEXT NOT NULL, title TEXT NOT NULL, release_type TEXT NOT NULL CHECK(release_type IN ('single','ep','album')),
 metadata_json TEXT NOT NULL DEFAULT '{}', version INTEGER NOT NULL DEFAULT 1,
 state TEXT NOT NULL DEFAULT 'DRAFT' CHECK(state IN ('DRAFT','NEEDS_REVIEW','READY','APPROVED')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(label_id,id)
);
CREATE TABLE lw_assets (
 id TEXT PRIMARY KEY, label_id TEXT NOT NULL, release_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('master','artwork','document','package')),
 original_name TEXT NOT NULL, object_key TEXT NOT NULL UNIQUE,
 byte_size INTEGER NOT NULL CHECK(byte_size > 0), sha256 TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1, provenance_json TEXT NOT NULL DEFAULT '{}',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(label_id,release_id) REFERENCES lw_releases(label_id,id), UNIQUE(label_id,id)
);
CREATE TABLE lw_tasks (
 id TEXT PRIMARY KEY, label_id TEXT NOT NULL REFERENCES lw_labels(id), release_id TEXT,
 agent_role TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'QUEUED'
 CHECK(status IN ('QUEUED','RUNNING','WAITING_FOR_INPUT','WAITING_FOR_APPROVAL','BLOCKED','FAILED','COMPLETED','CANCELLED')),
 input_json TEXT NOT NULL DEFAULT '{}', result_json TEXT, lease_until TEXT, attempts INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(label_id,release_id) REFERENCES lw_releases(label_id,id), UNIQUE(label_id,id)
);
CREATE INDEX lw_tasks_queue ON lw_tasks(status,lease_until);
CREATE TABLE lw_task_events (
 cursor INTEGER PRIMARY KEY AUTOINCREMENT, label_id TEXT NOT NULL, task_id TEXT NOT NULL,
 status TEXT NOT NULL, payload_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(label_id,task_id) REFERENCES lw_tasks(label_id,id)
);
CREATE INDEX lw_events_label_cursor ON lw_task_events(label_id,cursor);
CREATE TABLE lw_approvals (
 id TEXT PRIMARY KEY, label_id TEXT NOT NULL, release_id TEXT NOT NULL, release_version INTEGER NOT NULL,
 action TEXT NOT NULL, requested_by INTEGER NOT NULL REFERENCES users(id), decided_by INTEGER REFERENCES users(id),
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED','INVALIDATED')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(label_id,release_id) REFERENCES lw_releases(label_id,id)
);
