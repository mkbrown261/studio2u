-- MCP credentials belong to Studio2U, never model-provider sessions.
CREATE TABLE lw_mcp_clients (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, redirects_json TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE lw_mcp_requests (
 id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES lw_mcp_clients(id),
 redirect_uri TEXT NOT NULL, resource TEXT NOT NULL, state TEXT NOT NULL,
 challenge TEXT NOT NULL, scopes_json TEXT NOT NULL, user_id INTEGER REFERENCES users(id),
 consent_hash TEXT, expires_at TEXT NOT NULL, consumed INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE lw_mcp_grants (
 id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES lw_mcp_clients(id),
 user_id INTEGER NOT NULL REFERENCES users(id), resource TEXT NOT NULL,
 labels_json TEXT NOT NULL, scopes_json TEXT NOT NULL, revoked_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, expires_at TEXT NOT NULL,
 last_used_at TEXT
);
CREATE TABLE lw_mcp_codes (
 hash TEXT PRIMARY KEY, grant_id TEXT NOT NULL REFERENCES lw_mcp_grants(id),
 redirect_uri TEXT NOT NULL, challenge TEXT NOT NULL, expires_at TEXT NOT NULL,
 consumed INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE lw_mcp_tokens (
 hash TEXT PRIMARY KEY, grant_id TEXT NOT NULL REFERENCES lw_mcp_grants(id),
 kind TEXT NOT NULL CHECK(kind IN ('access','refresh')), expires_at TEXT NOT NULL,
 consumed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX lw_mcp_grants_user ON lw_mcp_grants(user_id,created_at);
CREATE TABLE lw_mcp_limits (
 key TEXT NOT NULL,window TEXT NOT NULL,requests INTEGER NOT NULL DEFAULT 1,
 PRIMARY KEY(key,window)
);
