-- Label Office: Monday reports, statements, split sheets + e-signatures,
-- content campaigns, AI budgets, and two more model providers (xAI, Gemini).

-- Per-label schedule for the Monday report.
CREATE TABLE lw_label_settings (
 label_id TEXT PRIMARY KEY REFERENCES lw_labels(id),
 timezone TEXT NOT NULL DEFAULT 'America/New_York',
 report_weekday INTEGER NOT NULL DEFAULT 1 CHECK(report_weekday BETWEEN 0 AND 6),
 report_hour INTEGER NOT NULL DEFAULT 9 CHECK(report_hour BETWEEN 0 AND 23),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE lw_reports (
 id TEXT PRIMARY KEY, label_id TEXT NOT NULL REFERENCES lw_labels(id),
 local_date TEXT NOT NULL, period_start TEXT NOT NULL, period_end TEXT NOT NULL,
 snapshot_json TEXT NOT NULL, trigger TEXT NOT NULL CHECK(trigger IN ('SCHEDULE','MANUAL')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(label_id,local_date)
);

-- Imported royalty statements. Every line is VERIFIED_EARNED (a statement supports it);
-- other classes come from cases. Classes are never summed together.
CREATE TABLE lw_statements (
 id TEXT PRIMARY KEY, label_id TEXT NOT NULL REFERENCES lw_labels(id),
 source TEXT NOT NULL CHECK(source IN ('unitedmasters','ascap','bmi','mlc','soundexchange','distributor','other')),
 filename TEXT NOT NULL, sha256 TEXT NOT NULL, currency TEXT NOT NULL DEFAULT 'USD',
 period_label TEXT, row_count INTEGER NOT NULL, total_micros INTEGER NOT NULL,
 mapping_json TEXT NOT NULL, uploaded_by INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(label_id,sha256)
);
CREATE TABLE lw_royalty_lines (
 id INTEGER PRIMARY KEY AUTOINCREMENT, statement_id TEXT NOT NULL REFERENCES lw_statements(id) ON DELETE CASCADE,
 label_id TEXT NOT NULL, title TEXT, isrc TEXT, platform TEXT, territory TEXT, period TEXT,
 quantity REAL, amount_micros INTEGER NOT NULL,
 classification TEXT NOT NULL DEFAULT 'VERIFIED_EARNED' CHECK(classification IN ('VERIFIED_EARNED','CONFIRMED_PAYABLE','PAID','POTENTIAL','FORECAST','UNKNOWN'))
);
CREATE INDEX lw_royalty_label ON lw_royalty_lines(label_id,isrc);

-- Split sheets with built-in e-signatures. A material change = new version; old
-- signatures stay on the old version and never carry over.
CREATE TABLE lw_agreements (
 id TEXT PRIMARY KEY, label_id TEXT NOT NULL REFERENCES lw_labels(id), release_id TEXT,
 family_id TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
 work_title TEXT NOT NULL CHECK(length(work_title) BETWEEN 1 AND 200),
 status TEXT NOT NULL DEFAULT 'OUT_FOR_SIGNATURE' CHECK(status IN ('OUT_FOR_SIGNATURE','FULLY_SIGNED','DECLINED','SUPERSEDED','VOID')),
 terms_json TEXT NOT NULL, doc_text TEXT NOT NULL, doc_hash TEXT NOT NULL, template_version TEXT NOT NULL,
 created_by INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT,
 UNIQUE(family_id,version)
);
CREATE INDEX lw_agreements_label ON lw_agreements(label_id,status);
CREATE TABLE lw_agreement_parties (
 id TEXT PRIMARY KEY, agreement_id TEXT NOT NULL REFERENCES lw_agreements(id) ON DELETE CASCADE, label_id TEXT NOT NULL,
 legal_name TEXT NOT NULL, stage_name TEXT, email TEXT, roles_json TEXT NOT NULL DEFAULT '[]',
 pro TEXT, ipi TEXT, publisher_name TEXT,
 composition_share REAL NOT NULL DEFAULT 0, master_share REAL NOT NULL DEFAULT 0, producer_points REAL NOT NULL DEFAULT 0,
 token_hash TEXT NOT NULL UNIQUE, viewed_at TEXT, consent_at TEXT, signed_at TEXT, signature_name TEXT,
 sign_ip TEXT, sign_ua TEXT, declined_at TEXT, decline_reason TEXT
);
CREATE INDEX lw_agreement_parties_agreement ON lw_agreement_parties(agreement_id);
CREATE TABLE lw_agreement_events (
 cursor INTEGER PRIMARY KEY AUTOINCREMENT, agreement_id TEXT NOT NULL, label_id TEXT NOT NULL,
 actor TEXT NOT NULL, kind TEXT NOT NULL, body TEXT NOT NULL, ip TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX lw_agreement_events_agreement ON lw_agreement_events(agreement_id,cursor);

-- Content Studio.
CREATE TABLE lw_campaigns (
 id TEXT PRIMARY KEY, label_id TEXT NOT NULL REFERENCES lw_labels(id), release_id TEXT, track_title TEXT NOT NULL,
 objective TEXT NOT NULL, brief_json TEXT NOT NULL DEFAULT '{}',
 status TEXT NOT NULL DEFAULT 'IDEAS' CHECK(status IN ('IDEAS','IN_PRODUCTION','LIVE','DONE')),
 created_by INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE lw_content_concepts (
 id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES lw_campaigns(id) ON DELETE CASCADE, label_id TEXT NOT NULL,
 title TEXT NOT NULL, hook TEXT NOT NULL, treatment TEXT NOT NULL, song_section TEXT, shots_json TEXT NOT NULL DEFAULT '[]',
 duration_sec INTEGER, platform TEXT, caption TEXT, cta TEXT, low_budget TEXT, high_budget TEXT, rights_notes TEXT,
 evidence_json TEXT NOT NULL DEFAULT '[]',
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','APPROVED','REJECTED','SHOT','POSTED')),
 written_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX lw_concepts_campaign ON lw_content_concepts(campaign_id,status);

-- Laptop-closed mode: per-user monthly AI spend cap and usage.
CREATE TABLE lw_ai_budgets (
 user_id INTEGER PRIMARY KEY REFERENCES users(id), monthly_cap_cents INTEGER NOT NULL DEFAULT 500 CHECK(monthly_cap_cents BETWEEN 0 AND 100000),
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE lw_ai_usage (
 user_id INTEGER NOT NULL REFERENCES users(id), month TEXT NOT NULL,
 calls INTEGER NOT NULL DEFAULT 0, input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0,
 cost_micros INTEGER NOT NULL DEFAULT 0, estimated INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(user_id,month)
);

-- Add xAI (Grok) and Google Gemini as bring-your-own-key providers (CHECK change needs a rebuild).
PRAGMA defer_foreign_keys = on;
CREATE TABLE lw_provider_connections_new (
 user_id INTEGER NOT NULL REFERENCES users(id),
 provider TEXT NOT NULL CHECK(provider IN ('openai','anthropic','kimi','qwen','openrouter','xai','gemini')),
 endpoint_config TEXT NOT NULL DEFAULT '{}',
 encrypted_key TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(user_id,provider)
);
INSERT INTO lw_provider_connections_new SELECT user_id,provider,endpoint_config,encrypted_key,revision,updated_at FROM lw_provider_connections;
CREATE TABLE lw_reasoning_preferences_keep AS SELECT * FROM lw_reasoning_preferences;
DROP TABLE lw_provider_connections;
ALTER TABLE lw_provider_connections_new RENAME TO lw_provider_connections;
INSERT OR IGNORE INTO lw_reasoning_preferences SELECT * FROM lw_reasoning_preferences_keep;
DROP TABLE lw_reasoning_preferences_keep;
