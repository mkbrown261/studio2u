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


## v2.1 priority overlay (preserves existing gates)
- **Immediate, no interference:** Wait for active GitHub push/Cloudflare preview/deploy; confirm actual HEAD, branch, migrations, route and release upload/ZIP status. R319.
- **Current milestone first:** Complete/verify Real Release Engine (tenant-scoped audio/art upload, technical inspection, release metadata, ZIP/manifest, real Reviewer report) if still missing. Do not duplicate implemented code.
- **Gate 3C (new, P1b):** Agent Inbox schema/API/UI separated from booking messages; event-generated task/registration updates; unread counts; `R305/R306/R308/R320`. Existing messaging regression tests mandatory.
- **Gate 3D (new, P1c):** Typed approval cards and service-specific registration packets/manual/eligible supervised browser handoffs; accurate pending/receipt status; `R307/R309/R311`. Browser automation itself remains gated separately by R310.
- **Gate 4B:** Activate first real agent skill runners and text conversations, independent of avatars; user-configurable agent templates and capability onboarding `R313/R314`; preserve 23 canonical skills until evaluated.
- **Gate 4C:** V1 opt-in voice to selected agent, consent, interrupt/stream/text fallback, no mouth animation required; `R312/R321`.
- **Gate 4D:** Existing Carla and Eric in Three.js after optimized GLB verification; Executive/Builder mesh pending, not fake implemented; `R316`. Other visual work may proceed in parallel to avoid blocking releases.
- **Gate 7B:** Approved/verified provider pilots for Higgsfield, optional Suno, social, Genjitsu/local editor; typed asset handoff `R318`; supervised browser only if provider permits `R310`.
- **Gate 8B:** Royalty Recovery eligibility and official evidence-driven claims dashboard `R317`; repeated registration reminders.
- **Gate 9+:** Future lip-synced MetaHumans/Unreal renderer `R315`.

For each gate require tests, source paths, current SHA, actual deployment environment, human approval on production migration and BUILD_STATUS update.


## v2.2 overlay — current export/dashboard/inbox streams then interactive headquarters
This **implementation sequencing overlay** supersedes older numeric gate order when it conflicts; it removes no release, Inbox, A&R, royalty, integration, voice, or 3D requirement.

**Phase CURRENT (reported three parallel streams; don't restart):** independently finish and verify GLB source preservation/export + browser room loader, the four approved dashboard React routes/shell and separate AI Employees Inbox. Before merging or deploying, audit branch HEAD, worktrees, active tasks, screenshots and tests. Release packaging may progress in parallel only with no conflicting modifications.

**Phase NEXT (P1 interaction gate):** first-person WASD/pointer-lock/touch camera, simple collisions, interaction registry and proximity prompts; selecting Carla/Eric displays existing Researcher/Reviewer React overlay and pauses scene controls. Executive/Builder workstation interaction without physical meshes. Esc close/resume exact position; dedicated routes continue accessible.

**Phase BUSINESS:** connect the four dashboards and Agent Inbox with actual persistent releases, QA results, jobs, employee skills, human approvals and audit; verify audio/artwork preservation and real package ZIP. Expand evidence-based music trend connectors and royalty follow-ups by capability.

**Phase LATER EXPERIENCE:** approved additional character meshes, valid greeting/tablet/walk clips, true per-label cabinet and finish customization, verified streaming milestone plaque wall with opt-in celebration, richer voice and optional MetaHumans/Unreal.

Gate exit requires GLB/animation source evidence, browser walkthrough, privacy and two-label checks, screenshots versus approved references, UI regression tests and real commit/deployment evidence. `V2_2_ACCEPTANCE_TESTS.md` is the test checklist.
