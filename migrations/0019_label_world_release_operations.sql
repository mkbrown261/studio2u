-- Additive v2 milestone. Distribution and registrations are independent.
ALTER TABLE lw_releases ADD COLUMN release_mode TEXT NOT NULL DEFAULT 'FAST_RELEASE' CHECK(release_mode IN ('FAST_RELEASE','MANAGED_RELEASE'));
ALTER TABLE lw_releases ADD COLUMN target_distributor TEXT NOT NULL DEFAULT 'UnitedMasters';
ALTER TABLE lw_releases ADD COLUMN workflow_state TEXT NOT NULL DEFAULT 'INTAKE_PENDING';
CREATE TABLE lw_artist_profiles (
 id TEXT PRIMARY KEY, label_id TEXT NOT NULL REFERENCES lw_labels(id),
 display_name TEXT NOT NULL, profile_json TEXT NOT NULL DEFAULT '{}',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(label_id,id)
);
CREATE TABLE lw_rights_reviews (
 id TEXT PRIMARY KEY, label_id TEXT NOT NULL, release_id TEXT NOT NULL,
 release_version INTEGER NOT NULL, assertions_json TEXT NOT NULL,
 attested_by INTEGER NOT NULL REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(label_id,release_id) REFERENCES lw_releases(label_id,id),
 UNIQUE(label_id,release_id,release_version)
);
CREATE TABLE lw_registration_tasks (
 id TEXT PRIMARY KEY, label_id TEXT NOT NULL, release_id TEXT NOT NULL,
 organization TEXT NOT NULL CHECK(organization IN ('PRO','MLC','SOUNDEXCHANGE','COPYRIGHT')),
 owner_role TEXT NOT NULL DEFAULT 'royalty_admin',
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PREPARED','AWAITING_APPROVAL','AWAITING_VERIFICATION','BLOCKED','NOT_APPLICABLE')),
 applicability TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK(applicability IN ('UNKNOWN','APPLICABLE','NOT_APPLICABLE')),
 reason TEXT, next_review_at TEXT, receipt_url TEXT,
 reported_status TEXT CHECK(reported_status IN ('SUBMITTED','CONFIRMED') OR reported_status IS NULL),
 evidence_status TEXT NOT NULL DEFAULT 'UNVERIFIED' CHECK(evidence_status IN ('UNVERIFIED','USER_CONFIRMED')),
 revision INTEGER NOT NULL DEFAULT 1, last_mutation TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(label_id,release_id) REFERENCES lw_releases(label_id,id),
 UNIQUE(label_id,release_id,organization), UNIQUE(label_id,id)
);
CREATE INDEX lw_registration_backlog ON lw_registration_tasks(label_id,status,next_review_at);
CREATE TABLE lw_audit_events (
 id TEXT PRIMARY KEY, label_id TEXT NOT NULL REFERENCES lw_labels(id),
 release_id TEXT, actor_id INTEGER NOT NULL REFERENCES users(id),
 action TEXT NOT NULL, payload_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(label_id,release_id) REFERENCES lw_releases(label_id,id)
);
CREATE TRIGGER lw_audit_no_update BEFORE UPDATE ON lw_audit_events BEGIN SELECT RAISE(ABORT,'Audit records are immutable'); END;
CREATE TRIGGER lw_audit_no_delete BEFORE DELETE ON lw_audit_events BEGIN SELECT RAISE(ABORT,'Audit records are immutable'); END;
CREATE TRIGGER lw_rights_no_update BEFORE UPDATE ON lw_rights_reviews BEGIN SELECT RAISE(ABORT,'Rights snapshots are immutable'); END;
CREATE TRIGGER lw_rights_no_delete BEFORE DELETE ON lw_rights_reviews BEGIN SELECT RAISE(ABORT,'Rights snapshots are immutable'); END;
-- Preserve earlier release drafts and establish independent, non-expiring queues.
INSERT INTO lw_registration_tasks(id,label_id,release_id,organization,owner_role)
 SELECT lower(hex(randomblob(16))),r.label_id,r.id,o.organization,
 CASE o.organization WHEN 'PRO' THEN 'publishing_admin' WHEN 'COPYRIGHT' THEN 'rights_admin' ELSE 'royalty_admin' END FROM lw_releases r
 CROSS JOIN (SELECT 'PRO' organization UNION ALL SELECT 'MLC' UNION ALL SELECT 'SOUNDEXCHANGE' UNION ALL SELECT 'COPYRIGHT') o;
