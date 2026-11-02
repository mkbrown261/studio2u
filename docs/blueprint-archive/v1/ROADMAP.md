# Delivery Roadmap and Gates

## Gate 0 — Baseline and reference audit
Deliverables: inventory existing repo and reference images, architecture decision record, scoped backlog, acceptance tests, working build command. Exit: all references mapped and unknowns recorded.

## Gate 1 — Commercial foundation
Deliverables: tenant/user auth skeleton, database migrations, RBAC tests, secure file store, task/event contracts, brand config. Exit: two tenants cannot access each other's records/assets.

## Gate 2 — Visual headquarters
Deliverables: one polished Main Studio Hub, gold plaque, guitar, furniture, workstations, camera, four reference-accurate characters, initial animations. Exit: real GLBs load, click/select works, scene profiled and assets inventoried.

## Gate 3 — Release workflow
Deliverables: create release, upload song/cover/credits, checksum/metadata, package ZIP, manifest, deterministic Reviewer checks. Exit: real files processed and original preserved; test release downloads.

## Gate 4 — Agent orchestration and visualization
Deliverables: Executive task graph, Researcher/Builder/Reviewer jobs, durable queue, WebSocket events, character state mapping, approvals. Exit: reload/close browser doesn't kill job; audit reflects reality.

## Gate 5 — Marketing foundation
Deliverables: campaign model, captions, short-form brief, content calendar, source rights fields, creative gateway contracts. Exit: release -> campaign draft -> review -> approval works without external publishing.

## Gate 6 — MCP and secure connections
Deliverables: scoped MCP tools, model provider adapters, connected services UI, secrets and authorization tests. Exit: authorized client can call tool; unauthorized cross-tenant access rejected.

## Gate 7 — Provider activation
Deliverables: verify and implement Higgsfield where supported, approved social APIs, optional Suno, distributor/ASCAP preparation and authorized integrations. Exit: each adapter has real integration tests, costs, error paths and receipts; unavailable ones are labeled.

## Gate 8 — A&R, rights, commercial launch
Deliverables: sourced music discovery, watchlists, rights/publishing workflows, billing, quotas, onboarding, privacy/security/accessibility review, customer support and operations. Exit: real multi-customer beta with measured reliability.

## Gate 9 — World expansion
Deliverables: modular connected departments, more character animations, customization, optional Unreal client. Exit: additional rooms do not change core domain services or interrupt jobs.

## First two-week suggested build sequence (adjust to real capacity)
1. Inspect repo/images and record baselines; do not overwrite.
2. Build tenant and project schema + API contracts.
3. Create one-room R3F scene with temporary blockouts where assets are missing.
4. Integrate first four supplied character designs as real models as they become available.
5. Build release upload/manifest/ZIP and Reviewer validation.
6. Connect task event stream to agent animations.
7. Demo complete W1 with actual user files and honest integration states.
