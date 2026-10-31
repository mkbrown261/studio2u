-- Personal BYOK connections; membership never grants access to another user's key.
CREATE TABLE lw_provider_connections (
 user_id INTEGER NOT NULL REFERENCES users(id),
 provider TEXT NOT NULL CHECK(provider IN ('openai','anthropic','kimi','qwen','openrouter')),
 endpoint_config TEXT NOT NULL DEFAULT '{}',
 encrypted_key TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(user_id,provider)
);
CREATE TABLE lw_reasoning_preferences (
 label_id TEXT NOT NULL, user_id INTEGER NOT NULL,
 provider TEXT NOT NULL, model TEXT NOT NULL,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(label_id,user_id),
 FOREIGN KEY(label_id,user_id) REFERENCES lw_memberships(label_id,user_id),
 FOREIGN KEY(user_id,provider) REFERENCES lw_provider_connections(user_id,provider) ON DELETE CASCADE
);
CREATE TABLE lw_provider_rate_limits (
 user_id INTEGER NOT NULL REFERENCES users(id), window TEXT NOT NULL,
 requests INTEGER NOT NULL DEFAULT 1,
 PRIMARY KEY(user_id,window)
);
CREATE TABLE lw_reasoning_runs (
 id TEXT PRIMARY KEY, label_id TEXT NOT NULL, user_id INTEGER NOT NULL,
 provider TEXT NOT NULL, model TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('RUNNING','COMPLETED','FAILED')),
 usage_json TEXT NOT NULL DEFAULT '{}',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(label_id,user_id) REFERENCES lw_memberships(label_id,user_id)
);
