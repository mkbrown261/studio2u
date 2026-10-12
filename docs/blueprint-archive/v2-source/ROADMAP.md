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

## v2 reorder: immediate incremental strategy
**Gate 0A:** Merge v2 master docs into repo; mark all new skills DESIGNED, map requirements R111-R126 and R211-R221, inspect uploaded images and existing code, verify repo baseline.
**Gate 1A:** Multi-tenant core, creator profiles, releaseMode and registration-task schema, source of truth/provenance, secure approvals; test isolation.
**Gate 2A:** Studio Main Hub and 4 real visible agent positions; maintain future roles invisibly as logical workers; clickable UI and real task status.
**Gate 3A:** FAST_RELEASE package creation with **minimum rights gate**, uploaded original/master, duration/technical metadata, lyrics draft confirmation, cover art intake, correct credits/versioned identifiers, ZIP, reviewer.
**Gate 3B:** Durable post-release paperwork follow-up dashboard even before external APIs: PRO, MLC, SoundExchange, copyright eligibility/tasks, manual checklists and receipts.
**Gate 4A:** Executive orchestrated flow and status-to-animation mapping; reviewed music release artifacts.
**Gate 5A:** Campaign, Hook Intelligence, identity kit, videographer concept->shot list->storyboard, editor design/export presets, reviewer checklists.
**Gate 6A:** MCP tools on shared domain services, secure Connected Services UI, n8n/Tally connectors behind explicit tenant scopes.
**Gate 7A:** Activate verified Higgsfield/music/video editor/social/distribution/registration adapters one at a time with real evidence, allowed terms, budgets, receipts, failure tests; no forced API parity.
**Gate 8A:** A&R evidence research, music industry case-study KB, royalties tracking, multi-customer paid beta and support.
**Gate 9:** More rooms/customization, advanced analytics, optional Unreal renderer.
**Do not defer paperwork task visibility to Gate 8:** founder's key pain is admin burden; implement the queue/dashboard in first true release feature gate.
