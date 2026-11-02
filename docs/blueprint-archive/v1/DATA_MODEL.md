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
