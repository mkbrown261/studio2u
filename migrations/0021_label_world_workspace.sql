-- Separate AI employee history. No booking messages or external execution.
CREATE TABLE lw_employee_messages (
 id TEXT PRIMARY KEY, label_id TEXT NOT NULL, user_id INTEGER NOT NULL,
 agent_id TEXT NOT NULL CHECK(agent_id IN ('researcher','reviewer','executive','builder')),
 release_id TEXT, role TEXT NOT NULL CHECK(role IN ('user','assistant')),
 content TEXT NOT NULL CHECK(length(content) BETWEEN 1 AND 64000),
 status TEXT NOT NULL CHECK(status IN ('WAITING_FOR_PROVIDER','GENERATING','COMPLETED','FAILED')),
 reply_to TEXT REFERENCES lw_employee_messages(id), provider TEXT, model TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(label_id,user_id) REFERENCES lw_memberships(label_id,user_id),
 FOREIGN KEY(label_id,release_id) REFERENCES lw_releases(label_id,id)
);
CREATE INDEX lw_employee_history ON lw_employee_messages(label_id,agent_id,created_at,id);
CREATE UNIQUE INDEX lw_employee_reply ON lw_employee_messages(reply_to) WHERE reply_to IS NOT NULL;
CREATE TABLE lw_research_records (
 id TEXT PRIMARY KEY, label_id TEXT NOT NULL REFERENCES lw_labels(id),
 kind TEXT NOT NULL CHECK(kind IN ('watchlist','notes')), title TEXT NOT NULL,
 content TEXT NOT NULL DEFAULT '', source_url TEXT, status TEXT NOT NULL DEFAULT 'SAVED',
 created_by INTEGER NOT NULL REFERENCES users(id), revision INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(label_id,id)
);
CREATE TABLE lw_release_workspace (
 label_id TEXT NOT NULL, release_id TEXT NOT NULL, brief TEXT NOT NULL DEFAULT '', lyrics TEXT NOT NULL DEFAULT '',
 catalog TEXT NOT NULL DEFAULT '', revision INTEGER NOT NULL DEFAULT 1,
 updated_by INTEGER NOT NULL REFERENCES users(id), updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(label_id,release_id), FOREIGN KEY(label_id,release_id) REFERENCES lw_releases(label_id,id)
);
