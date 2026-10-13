-- Additive deterministic review records. Existing drafts, chats and assets retained.
CREATE TABLE lw_reviews (
 id TEXT PRIMARY KEY, label_id TEXT NOT NULL, release_id TEXT NOT NULL, release_version INTEGER NOT NULL,
 task_id TEXT NOT NULL UNIQUE, requested_by INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'QUEUED',
 findings_json TEXT, report_asset_id TEXT, request_key TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(label_id,requested_by,request_key), FOREIGN KEY(label_id,release_id) REFERENCES lw_releases(label_id,id)
);
CREATE TABLE lw_review_corrections (
 id TEXT PRIMARY KEY, label_id TEXT NOT NULL, review_id TEXT NOT NULL REFERENCES lw_reviews(id),
 user_id INTEGER NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE lw_employee_notifications (
 id TEXT PRIMARY KEY, label_id TEXT NOT NULL, user_id INTEGER NOT NULL, message_id TEXT NOT NULL REFERENCES lw_employee_messages(id),
 review_id TEXT REFERENCES lw_reviews(id), read_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(user_id,message_id)
);
ALTER TABLE lw_employee_messages ADD COLUMN review_id TEXT REFERENCES lw_reviews(id);
CREATE INDEX lw_reviews_release ON lw_reviews(label_id,release_id,created_at);
CREATE INDEX lw_notification_user ON lw_employee_notifications(label_id,user_id,read_at);
ALTER TABLE lw_reviews ADD COLUMN release_snapshot_json TEXT NOT NULL DEFAULT '{}';
