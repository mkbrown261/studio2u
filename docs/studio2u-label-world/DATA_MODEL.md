# Canonical Data Model (Initial)

- Tenant/Label: id, name, brand, settings, plan, quotas.
- User/Membership: userId, tenantId, role, permissions.
- AgentDefinition/AgentInstance: role, visualAsset, SOP version, tools, provider, status, tenantId.
- Composition: title, writers, publishers, splits, IPI/ISWC when known, rights docs.
- Recording: master file, composition associations, contributors, technical metadata, ISRC when known, provenance.
- Release/ReleaseTrack: title, type, artist, ordering, cover art, date, distributor, statuses, identifiers.
- FileAsset/AssetVersion: owner, tenant, kind, checksum, original flag, storage key, lineage, rights status.
- RightsDocument/Registration: subject, type, application status, official confirmation, receipts, authority.
- Campaign/ContentItem/CreativeJob: release, platform, briefs, assets, approval, schedule, provider, metrics.
- ConnectedService: tenant, provider, capabilities, credential reference, token scopes, status.
- Task/TaskDependency/TaskEvent/AgentExecution: job graph, actor, state, input/output refs, timestamps, cost, errors.
- Approval/AuditEvent: requested action, actor, scope, decision, immutable evidence and timestamp.
- DiscoveryFinding/Watchlist: sourced artist/track, genre, region, date, metrics, assessment, confidence.

Relationships: a composition can have many recordings; a recording can appear on many releases; a release has many ordered tracks; all records and tool calls are tenant-scoped. Never manufacture identifiers, legal claims or metrics. Migrations must include tenant isolation tests.

## v2 entities and crucial fields
- `release_mode`: FAST_RELEASE | MANAGED_RELEASE; immutable selection event with optional explicit change log.
- `registration_task`: org type PRO | MLC | SOUNDEXCHANGE | COPYRIGHT | OTHER; readiness, status, official account/entity, due/next-review (if grounded), receipt, verification date, blocked reason.
- `contribution_split`: recordingId/compositionId, party, splitKind (writer, publisher, composition ownership, master ownership, master revenue, producer royalty), numerator/denominator, signed document reference, verification state.
- `lyric_version` + `lyric_segment` + `lyric_word`: transcript source, model/version, startMs/endMs, confidence, human approval and corrections.
- `identity_kit`: approved artist/likeness images, wardrobe/shoe references, rights/consent status, visual style and revocation.
- `creative_brief`, `storyboard_shot`, `video_job`, `edit_project`, `video_export`, `hook_candidate`, `social_account`, `social_post`, `platform_receipt`, `campaign_metric`.
- `agent_skill`, `skill_version`, `skill_execution`, `knowledge_source`, `evidence_artifact` for auditable work and updates.
- `browser_session` **only if allowed and supported**: scoped tenant, provider/domain, explicit consent, redacted audit, session expiry, revocation; no password text available to agents.
Detailed per-field contract: `RELEASE_DATA_SPEC.md`.


## ICM-inspired context increment — 2026-10-13
Additive migration 0024_label_world_context.sql adds lw_context_traces linked to existing employee messages and label/user membership. Stores instruction/skill hashes, entity revisions and evidence IDs, stage, actual provider usage when supplied, and request latency. No prompts, raw YouTube observations, credentials or object keys copied into traces. Task checkpoints are reconstructed from existing scoped lw_tasks/lw_reviews; no competing task database.
