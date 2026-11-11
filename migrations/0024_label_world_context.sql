-- Metadata only: never store prompts, credentials or copied source data.
CREATE TABLE lw_context_traces (
 message_id TEXT PRIMARY KEY REFERENCES lw_employee_messages(id),
 label_id TEXT NOT NULL, user_id INTEGER NOT NULL,
 trace_json TEXT NOT NULL, stage TEXT NOT NULL CHECK(stage IN ('LOADED','COMPLETED','FAILED')),
 usage_json TEXT NOT NULL DEFAULT '{}', latency_ms INTEGER,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(label_id,user_id) REFERENCES lw_memberships(label_id,user_id)
);
CREATE INDEX lw_context_trace_scope ON lw_context_traces(label_id,user_id,created_at);
