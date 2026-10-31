-- Checkpoints: agents do the work (screen control included) and stop to ask the owner only at
-- the big moments: Submit, Publish, Post, Sell, Send, Pay/Spend, Delete. The owner taps
-- Approve or Deny. One STOP switch pauses every agent on the label instantly.
CREATE TABLE lw_checkpoints (
 id TEXT PRIMARY KEY, label_id TEXT NOT NULL REFERENCES lw_labels(id),
 kind TEXT NOT NULL CHECK(kind IN ('SUBMIT','PUBLISH','POST','SELL','SEND','SPEND','DELETE','OTHER')),
 title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
 detail TEXT CHECK(detail IS NULL OR length(detail)<=4000),
 site TEXT, preview_url TEXT, amount_cents INTEGER, task_id TEXT,
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','DENIED','EXPIRED','CANCELLED')),
 requested_by TEXT NOT NULL, decided_by INTEGER, decided_at TEXT, owner_note TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX lw_checkpoints_open ON lw_checkpoints(label_id,status,created_at);
CREATE TABLE lw_agent_control (
 label_id TEXT PRIMARY KEY REFERENCES lw_labels(id),
 paused INTEGER NOT NULL DEFAULT 0 CHECK(paused IN (0,1)),
 paused_by INTEGER, paused_at TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
