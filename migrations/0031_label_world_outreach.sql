-- Relentless (but polite) outreach: who to contact on a case, and follow-up sequences the
-- owner approves ONCE together with the first message. The agent then sends each approved
-- follow-up from the owner's own email on schedule, stops the moment anyone replies, and
-- moves to the next contact when a sequence runs out.
CREATE TABLE lw_case_contacts (
 id TEXT PRIMARY KEY, label_id TEXT NOT NULL REFERENCES lw_labels(id), case_id TEXT NOT NULL,
 name TEXT, role TEXT NOT NULL CHECK(length(role) BETWEEN 1 AND 120), company TEXT NOT NULL CHECK(length(company) BETWEEN 1 AND 160),
 email TEXT, phone TEXT, source_url TEXT,
 confidence TEXT NOT NULL DEFAULT 'LIKELY' CHECK(confidence IN ('VERIFIED','LIKELY','GUESS')),
 status TEXT NOT NULL DEFAULT 'NOT_CONTACTED' CHECK(status IN ('NOT_CONTACTED','CONTACTED','REPLIED','BOUNCED','WRONG_PERSON','DO_NOT_CONTACT')),
 priority INTEGER NOT NULL DEFAULT 5 CHECK(priority BETWEEN 1 AND 9), notes TEXT,
 created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX lw_case_contacts_case ON lw_case_contacts(case_id,priority);
CREATE UNIQUE INDEX lw_case_contacts_email ON lw_case_contacts(case_id,email) WHERE email IS NOT NULL;
ALTER TABLE lw_case_drafts ADD COLUMN contact_id TEXT;
ALTER TABLE lw_case_drafts ADD COLUMN sequence_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE lw_case_drafts ADD COLUMN sequence_approved_at TEXT;
ALTER TABLE lw_case_drafts ADD COLUMN followups_sent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE lw_case_drafts ADD COLUMN last_sent_at TEXT;
ALTER TABLE lw_case_drafts ADD COLUMN replied_at TEXT;
ALTER TABLE lw_case_drafts ADD COLUMN reply_summary TEXT;
