-- Agent Reach (github.com/Panniantong/Agent-Reach, MIT): a free, read-only CLI the owner's own
-- agent installs on the owner's computer to read Reddit, X, Instagram, Facebook, YouTube,
-- LinkedIn and the web. It is the FIRST choice for reading social media; screen control is the
-- fallback (and stays the only way to post). Studio2U only stores what the agent's
-- `agent-reach doctor` reported, per channel, so every task knows which route to use.
CREATE TABLE lw_reach_status (
 label_id TEXT PRIMARY KEY REFERENCES lw_labels(id),
 status TEXT NOT NULL CHECK(status IN ('OK','PARTIAL','DOWN','NOT_INSTALLED')),
 version TEXT, channels_json TEXT NOT NULL DEFAULT '{}',
 reported_by TEXT, checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
