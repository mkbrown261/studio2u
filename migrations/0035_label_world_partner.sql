-- Business Partner: the 5th AI employee. Owns everything that makes money (merch, campaigns,
-- Amazon, tickets). Approve-once weekly plans: the owner approves a week of posts in one tap;
-- the partner's agent then posts them daily from the owner's own logged-in browser while
-- autopilot is ON. One Stop button pauses everything. No passwords, card or bank details.

-- 1) Let the partner have his own chat (rebuild to extend the agent_id CHECK; ids preserved).
PRAGMA defer_foreign_keys = on;
CREATE TABLE lw_employee_messages_0035 AS SELECT id,label_id,user_id,agent_id,release_id,role,content,status,reply_to,provider,model,created_at,review_id,research_report_id FROM lw_employee_messages;
DROP TABLE lw_employee_messages;
CREATE TABLE lw_employee_messages (
 id TEXT PRIMARY KEY, label_id TEXT NOT NULL, user_id INTEGER NOT NULL,
 agent_id TEXT NOT NULL CHECK(agent_id IN ('researcher','reviewer','executive','builder','partner')),
 release_id TEXT, role TEXT NOT NULL CHECK(role IN ('user','assistant')),
 content TEXT NOT NULL CHECK(length(content) BETWEEN 1 AND 64000),
 status TEXT NOT NULL CHECK(status IN ('WAITING_FOR_PROVIDER','GENERATING','COMPLETED','FAILED')),
 reply_to TEXT REFERENCES lw_employee_messages(id), provider TEXT, model TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, review_id TEXT REFERENCES lw_reviews(id), research_report_id TEXT REFERENCES lw_research_reports(id) ON DELETE SET NULL,
 FOREIGN KEY(label_id,user_id) REFERENCES lw_memberships(label_id,user_id),
 FOREIGN KEY(label_id,release_id) REFERENCES lw_releases(label_id,id)
);
INSERT INTO lw_employee_messages(id,label_id,user_id,agent_id,release_id,role,content,status,reply_to,provider,model,created_at,review_id,research_report_id)
 SELECT id,label_id,user_id,agent_id,release_id,role,content,status,reply_to,provider,model,created_at,review_id,research_report_id FROM lw_employee_messages_0035 ORDER BY rowid;
DROP TABLE lw_employee_messages_0035;
CREATE INDEX lw_employee_history ON lw_employee_messages(label_id,agent_id,created_at,id);
CREATE UNIQUE INDEX lw_employee_reply ON lw_employee_messages(reply_to) WHERE reply_to IS NOT NULL;
PRAGMA defer_foreign_keys = off;

-- 2) Partner settings: autopilot, money cap, posting pace, daily check-in, revenue streams.
CREATE TABLE lw_partner_settings (
 label_id TEXT PRIMARY KEY REFERENCES lw_labels(id),
 autopilot TEXT NOT NULL DEFAULT 'OFF' CHECK(autopilot IN ('OFF','ON','PAUSED')),
 spend_cap_cents INTEGER NOT NULL DEFAULT 0 CHECK(spend_cap_cents BETWEEN 0 AND 500000),
 posts_per_day INTEGER NOT NULL DEFAULT 1 CHECK(posts_per_day BETWEEN 0 AND 3),
 checkin_hour INTEGER NOT NULL DEFAULT 9 CHECK(checkin_hour BETWEEN 0 AND 23),
 streams_json TEXT NOT NULL DEFAULT '{}',
 last_checkin_date TEXT, updated_by INTEGER,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- 3) Accounts the partner runs. The OWNER creates each account (phone verification); then
--    the partner sets it up and posts. Method: the owner's agent in the owner's browser, or the
--    owner posts the ready-made kit. Official API connections are a future method.
CREATE TABLE lw_partner_channels (
 label_id TEXT NOT NULL REFERENCES lw_labels(id),
 platform TEXT NOT NULL CHECK(platform IN ('instagram','tiktok','x','facebook','threads','youtube')),
 handle TEXT, status TEXT NOT NULL DEFAULT 'NEEDS_ACCOUNT' CHECK(status IN ('NEEDS_ACCOUNT','READY','PAUSED')),
 method TEXT NOT NULL DEFAULT 'OWNER_BROWSER' CHECK(method IN ('OWNER_BROWSER','OWNER_POSTS','OFFICIAL_API')),
 setup_json TEXT NOT NULL DEFAULT '{}', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(label_id,platform)
);
-- 4) Weekly plans (approve once) and their posts.
CREATE TABLE lw_partner_plans (
 id TEXT PRIMARY KEY, label_id TEXT NOT NULL REFERENCES lw_labels(id),
 week_start TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','APPROVED','REJECTED','REPLACED')),
 notes TEXT, created_by TEXT NOT NULL, approved_by INTEGER, approved_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX lw_partner_plans_week ON lw_partner_plans(label_id,week_start,status);
CREATE TABLE lw_partner_posts (
 id TEXT PRIMARY KEY, label_id TEXT NOT NULL REFERENCES lw_labels(id), plan_id TEXT NOT NULL REFERENCES lw_partner_plans(id),
 day TEXT NOT NULL, platform TEXT NOT NULL, kind TEXT NOT NULL,
 caption TEXT NOT NULL CHECK(length(caption) BETWEEN 1 AND 2200), media_json TEXT NOT NULL DEFAULT '{}', link TEXT,
 status TEXT NOT NULL DEFAULT 'PLANNED' CHECK(status IN ('PLANNED','SCHEDULED','POSTED','FAILED','SKIPPED')),
 posted_url TEXT, posted_via TEXT, note TEXT, posted_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX lw_partner_posts_due ON lw_partner_posts(label_id,day,status);
