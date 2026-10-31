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

## v2 requirements — append to existing R001–R304; original scope remains
### P1 release experience
- R111 Founder-validated FAST_RELEASE option with UnitedMasters-targeted preparation and mandatory lightweight distribution rights gate.
- R112 MANAGED_RELEASE mode with parallel administrative preparation, clear status per rights/royalty organization.
- R113 Durable post-release follow-up queues for PRO, MLC, SoundExchange, copyright and related eligibility; queues are created even with zero streams and never silently closed.
- R114 Canonical verified field provenance; song duration, word-aligned draft lyrics and artist-approved transcript/version history.
- R115 Rights gate covering beats, third-party samples, covers/interpolations, master ownership and consent to distribution; material gaps block external actions.
- R116 Distinguish composition splits, master splits, producer points and revenue splits; collect proof and flag disputes.
- R117 Agent skill library with versioned contracts, required inputs/outputs, tools, escalation, tests and evidence.
- R118 Registration-ready status and confirmed filing status are separate across societies and agencies.
- R119 Client-facing registration/royalty dashboard indicating PREPARED, PENDING, SUBMITTED, CONFIRMED, BLOCKED, NOT_APPLICABLE and UNKNOWN.
- R120 Marketing includes artist identity kit, consent, wardrobe/shoes and reference rights metadata.
- R121 Videographer concept, shotlist and storyboard generation with per-shot duration/continuity and approval.
- R122 Short-form editor supports timecoded hooks, beat alignment, captions, aspect presets and actual file inspection.
- R123 Social publishing lifecycle, content calendar and approved account management; manual handoff when API unavailable.
- R124 Optional n8n and Tally bounded integration connectors; backend remains canonical.
- R125 Browser/computer assistance evaluated per provider with explicit consent, tenant isolation, domain/action allowlists, provider permission, credentials separation and auditable receipts.
- R126 Brand/marketing KPI learning and source-linked hypothesis testing, without promises of viral success.
### P2 agent/provider intelligence
- R211 Artist/producer conversational beat briefing with original musical characteristics and rights-respecting reference analysis.
- R212 Pluggable AI music generation with verified provider rights, provenance, budget caps and track/version handling (Suno candidate).
- R213 Videographer provider gateway with real asynchronous jobs/receipts and Higgsfield adapter where verified.
- R214 VideoEditorProvider contract with Genjitsu **capability verification required** and first-party/local editor option.
- R215 Source-attributed A&R discovery; comparative viral/nonviral music case studies with time-stamped signals and confounders.
- R216 Approved chart/social underground research; no unapproved scraping or fabricated hashtag access.
- R217 Optional PRO affiliation and publisher intake from shared artist profile; avoid requiring unnecessary reentry per release.
- R218 Royalty readiness for MLC and SoundExchange with applicability checks; never promise royalties from all streams.
- R219 Platform-specific social exports using versioned presets, not assumptions that all platform limits match.
- R220 Multi-provider connection settings with exact capabilities, costs, feature flags, revocation and token isolation.
- R221 Agent evaluations against sample releases, invalid files, missing ownership, provider outages and simulated-but-clearly-marked demo mode.


## v2.1 ADDENDUM — AI Employee communication, approved form handoff, roster and voice
This section adds new requirements without rewriting/reassigning R001–R304 or v2 R111–R221. Priority is listed explicitly; all new entries begin `DESIGNED_NOT_IMPLEMENTED` unless the **current actual repository** demonstrates otherwise.

- R305 (P1b) Separate AI Employees Inbox with per-agent/task/release threads and dedicated navigation, completely isolated from client/engineer booking messages.
- R306 (P1b) Session-authenticated, label-member authorized messaging, server-authorized agent sender, tenant-scoped attachments and participant/read states; no `?email` as Label World identity.
- R307 (P1c) Structured version-bound agent approval cards, review/reject/request-changes, audit, idempotency, and no chat-text-as-approval bypass.
- R308 (P1b/P2) Persistent agent inbox notification queues, unread counts and preferences; realtime transport optional, replaceable and accurately labeled.
- R309 (P1c) PRO/rights/distribution registration packet and human official-site review/submit handoff, with versioned evidence and official source links.
- R310 (P2+) Provider-specific browser assistance only if officially permitted and user-supervised, with scoped session, secrets isolation, pause/stop and no automated legal declarations; otherwise manual handoff.
- R311 (P1c) Separate prepared, reported-submitted, pending verification, official confirmed and rejected statuses for filings/royalty claims.
- R312 (P2 V1 voice) Conversation with chosen agents using text and speech with streaming/turn interruption, text fallback, no lip-sync dependency and verified provider entitlement.
- R313 (P1b/P2) Select, hire, name and configure prebuilt agents from versioned skill templates per tenant; show configured vs executable status truthfully.
- R314 (P1b/P2) Per-skill connection onboarding/capability matrix with approved API keys/OAuth/scoped authorizations, provider costs, revocation and manual fallback.
- R315 (P3) Headless renderer-independent agents allow future Unreal MetaHuman lip-synced avatars without backend rewrite.
- R316 (P1 visual) Preserve existing Carla Researcher and Eric Reviewer Blender rigs as only presently reported 3D character implementations; Executive and Builder mesh/rig pending, backend roles available independent of mesh.
- R317 (P2) Royalty Recovery Dashboard for evidence-backed PRO, MLC, SoundExchange and distributor eligibility, missing claims, receipts, reminders and no speculative owed balances.
- R318 (P2) Typed creative handoff among Marketing, Videographer, Higgsfield adapter, Genjitsu/other editor, Reviewer and Social with likeness rights, timecodes, approvals and actual media evidence.
- R319 (P0 continuous) Source/deployment reconciliation records current branch/SHA, remote versus local state, actual tests, Cloudflare environment and whether production changed; no unverified deployment claims.
- R320 (P1b) Regression tests guarantee pre-existing booking messages, unread badges and engineer/customer permissions remain intact.
- R321 (P2) Voice/microphone consent, session indicators, privacy/retention, accessibility controls, text alternative and no high-risk action approved by speech alone.

**Test references:** `ADOPTION_AND_TEST_MATRIX.md`, `AGENT_INBOX_SPEC.md`, `APPROVAL_AND_BROWSER_HANDOFF.md`. **Proposed skills** in `proposed_skills/` do not change the original 23 registered contract count until explicitly merged and tested by CLI.


## v2.2 ADDENDUM — approved dashboards and interactive headquarters (R322–R339)

These 18 new requirements supplement, never replace, existing R001–R321. All are DESIGN REQUIREMENTS until verified in real code. See `START_HERE_v2_2.md` and `V2_2_ACCEPTANCE_TESTS.md`.

- **R322** (P1 visual): One shared accessible React dashboard shell with four approved role-based routes; strict Studio2U main-site styling boundary.
- **R323** (P1 visual): Four high-fidelity dashboard layouts match supplied images; analytics examples and status figures clearly distinguished from live data.
- **R324** (P1 visual): Real Blender headquarters inventories/exports with validated GLB, texture/UV/material fixing, preserved source and deployed room loader.
- **R325** (P1 interaction): Explicit first-person movement and camera control (WASD, pointer lock, Shift, safe spawn, bounds) with collision and touch alternatives.
- **R326** (P1 interaction): Central object/agent/station interaction registry, E/click/tap proximity prompts and permission-aware routing.
- **R327** (P1 interaction): Shared HTML/React overlay opens from 3D, suspends camera, unlocks pointer, restores focus and camera position on close.
- **R328** (P1 interaction): Carla selects Researcher and Eric opens Reviewer tablet; Executive/Builder station fallback when meshes absent.
- **R329** (P1 interaction): Per-character verified animation state registry with idle-only fallback; missing greeting/tablet/walk clips nonblocking.
- **R330** (P1 security): Public sanitized room separate from authenticated private label world; strict per-tenant records/asset authorization.
- **R331** (P1 reliability): WebGL-disabled or broken assets never prevent direct agent dashboards, Inbox, release and provider settings.
- **R332** (P2 personalization): Stable GLB object/material IDs and backend-scoped settings for cabinets, wall finish, trim with save/revert.
- **R333** (P2 personalization): Evidence-driven per-label achievement/plaque registry with verified metric definition, deduplication and correction.
- **R334** (P2 personalization): Optional congratulation in Agent Inbox and accessible/reduced-motion celebration from verified milestone only.
- **R335** (P1 quality): Browser walkthrough for 3D/movement/overlays/permissions and visual screenshot comparisons for all four dashboards.
- **R336** (P1 quality): Independent GLB reimport/test-viewer + animation tests, device-recorded performance and asset provenance manifest.
- **R337** (P1 workflow): 3D contexts and direct-route dashboards share single authoritative label/release/task/approval/Inbox data services.
- **R338** (P1 workflow): Integrate three active coding streams without duplicated work; status reconciled against current branch SHA and live deployment.
- **R339** (P2 A&R): Carla metrics/trends provenance, date windows, data connection states, lawful authorized collection, no mock data marked live.

**Status discipline:** active coding-agent reports of GLB export, dashboard work or Inbox startup remain `IN_PROGRESS_REPORTED` until inspected and browser-tested.
