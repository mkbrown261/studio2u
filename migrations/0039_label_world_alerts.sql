-- Phone/email alerts when the owner is needed (approvals, questions, team stalled).
-- Push goes through ntfy (free, open source): the owner subscribes to a random private topic
-- in the ntfy app. Alerts carry no song, case or account details, only "your team needs you".
CREATE TABLE lw_notify_prefs (
 user_id INTEGER PRIMARY KEY REFERENCES users(id),
 push_topic TEXT, push_on INTEGER NOT NULL DEFAULT 0 CHECK(push_on IN (0,1)),
 email_on INTEGER NOT NULL DEFAULT 0 CHECK(email_on IN (0,1)),
 last_push_at TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
