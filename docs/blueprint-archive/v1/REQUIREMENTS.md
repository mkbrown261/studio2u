# Requirements Register

Priority: P0 foundation, P1 first end-to-end vertical slice, P2 expansion, P3 future. Status for all entries at baseline: PLANNED, not built.

## P0 — foundation
- R001 Multi-tenant accounts, labels, RBAC, strict backend tenant isolation.
- R002 Configurable label branding, gold record plaque, studio theme, agent appearance and roles.
- R003 Three.js/React Three Fiber main 3D studio, camera controls, interaction targets, room architecture.
- R004 Blender asset pipeline: character references, reusable rigs, clean UVs, optimized GLB, validated animations, furniture and modular environment.
- R005 Persistent agent/task/event model independent of frontend; WebSocket live activity.
- R006 Approval gates, audit trail, secret storage, safe file workspace and upload validation.
- R007 Canonical product docs, decision log, backlog and build-status verification.
- R008 Provider-neutral domain services and MCP interface architecture.

## P1 — demonstrable music business
- R101 Create release projects and edit tracklists, credits, dates, artwork and metadata.
- R102 Upload and preserve originals, checksum audio, inspect technical metadata, detect exact duplicates.
- R103 Distinguish compositions, recordings, releases, contributors, rights, identifiers.
- R104 Build versioned downloadable release ZIP, JSON/CSV manifest, readiness report and checklist.
- R105 Deterministic Reviewer checks with PASS/FAIL/WARNING/NEEDS_HUMAN_REVIEW/NOT_TESTED.
- R106 Executive delegates release workflow, Researcher gathers requirements, Builder packages, Reviewer verifies.
- R107 Real backend events drive idle/walk/sit/type/review/talk visual states; demo mode clearly labeled.
- R108 Marketing campaign per release, social content drafts, content calendar and short-form video brief.
- R109 Creative Production Gateway and provider adapter contracts, cost caps and approval.
- R110 Connected Services UI with integration status and safe authentication model.

## P2 — integrations and departments
- R201 A&R music discovery: chart/genre/region/underground/public social signals from authorized sources; sourced reports and watchlists.
- R202 Publishing admin: songwriter splits, composition metadata, ASCAP preparation, status and official confirmations.
- R203 Rights admin: composition/master ownership, samples, contracts, copyright application preparation and receipts.
- R204 Distributor preparation and authorized UnitedMasters/other distributor integration where permitted.
- R205 Higgsfield video generation adapter if officially supported for the intended use; prompt, job, output and provenance.
- R206 Other music/creative provider adapters, including Suno only after verifying authorized API/commercial terms.
- R207 Social account connections, scheduled drafts, approved publishing via supported APIs, permitted analytics.
- R208 Marketing/creative agents: campaign planning, video concepts, short-form assets, platform-specific posts.
- R209 Expanded modular rooms, agent routing/navigation, customization and achievements.
- R210 Usage metering, plans, billing, quotas, BYO model credentials where supported.

## P3 — longer-term opportunities
- R301 More advanced autonomous A&R intelligence and trend monitoring with scheduled jobs.
- R302 Unreal Engine client reusing backend services and appropriate assets.
- R303 Custom avatar builder, agent outfits, office marketplace and multi-label administration.
- R304 Optional digital twin/business operations beyond music; never claim real employee whereabouts without explicit consent and lawful data collection.

## Nonfunctional requirements
- Accessibility: keyboard alternatives to 3D navigation, readable controls, reduced motion, semantic panels.
- Security: scoped tokens, vault storage, encrypted transport, tenant-filtered storage, least privilege, audit logging, rate limiting.
- Reliability: idempotent jobs, retries, resumable uploads, durable queues, explicit failure and cancellation.
- Performance: loadable room assets, sensible poly/material counts, texture compression, animation LOD, measured FPS/draw calls/load time.
- Compliance: rights to source footage and music; approved API access; human review of legal filings, releases, financial and public publishing actions.
- Data portability: customer export of catalog, metadata, files and task history, subject to applicable constraints.
