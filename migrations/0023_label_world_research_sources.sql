CREATE TABLE lw_research_reports (
 id TEXT PRIMARY KEY, label_id TEXT NOT NULL REFERENCES lw_labels(id), user_id INTEGER NOT NULL,
 task_id TEXT NOT NULL UNIQUE REFERENCES lw_tasks(id), source TEXT NOT NULL,
 object_key TEXT NOT NULL, sha256 TEXT NOT NULL, byte_size INTEGER NOT NULL, query_json TEXT NOT NULL,
 observed_at TEXT NOT NULL, expires_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE lw_source_observations (
 id TEXT PRIMARY KEY, label_id TEXT NOT NULL REFERENCES lw_labels(id), report_id TEXT NOT NULL REFERENCES lw_research_reports(id) ON DELETE CASCADE,
 source TEXT NOT NULL, source_id TEXT, channel_id TEXT, creator TEXT, artist TEXT, track TEXT NOT NULL,
 source_url TEXT NOT NULL, published_at TEXT, observed_at TEXT NOT NULL, period TEXT,
 metrics_json TEXT NOT NULL, fingerprint TEXT, status TEXT NOT NULL DEFAULT 'COLLECTED',
 UNIQUE(label_id,fingerprint)
);
CREATE INDEX lw_observations_label ON lw_source_observations(label_id,observed_at);
CREATE TABLE lw_source_limits (scope TEXT NOT NULL,day TEXT NOT NULL,requests INTEGER NOT NULL,PRIMARY KEY(scope,day));
ALTER TABLE lw_employee_messages ADD COLUMN research_report_id TEXT REFERENCES lw_research_reports(id) ON DELETE SET NULL;
