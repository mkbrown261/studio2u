# COPY THIS TO THE CODING AGENT — STUDIO2U LABEL WORLD v2.1

**Read first**: This directive adds Agent Inbox, human-approved registration handoff, customizable prebuilt agents, voice roadmap, live 3D roster constraints, and royalty recovery to the v2.0 master plan. It does not cancel or replace the verified Release Engine milestone. The original 23 skills are preserved and four **proposed, not registered/working** skill extensions are included separately.

---

You are continuing the existing commercial Studio2U Label World implementation. DO NOT restart the repository, overwrite a working feature, merge untested changes into production, or assume the old planning files accurately describe the latest code.

## A. First audit the actual deployment and current source

The owner reported an in-progress GitHub push and Cloudflare deployment. Wait for the active operation to finish before making conflicting changes. Identify current branch, full HEAD SHA, uncommitted work, deployment ID, environment (local/preview/production), production route status and migrations. Do not infer deployment success from a local `npm run build`.

Our read-only inspection of the GitHub `main` branch found booking messages implemented through `migrations/0017_messages.sql`, `src/lib/db-messages.ts`, engineer routes in `src/routes/dashboard.tsx`, customer routes in `src/index.tsx`, and `src/pages/messages-thread.tsx`. At that snapshot, `main` was at `e3c0ebf`; the newer locally reported commit `4ed1007` had not yet appeared there. Recheck the current code and report any differences before implementation.

Read the whole v2.0 blueprint including all 23 existing YAML skill contracts, the traceability matrix and this v2.1 addendum. Preserve every previously registered requirement and tests. Document what is IMPLEMENTED, TESTED, VERIFIED, DESIGNED_ONLY, BLOCKED, or NOT_STARTED with evidence, not assertions.

## B. Architecture decision: separate Agent Inbox; preserve legacy messages

The legacy `messages` table is **booking-specific** (`booking_id NOT NULL`, fixed sender `engineer/customer`, read flags per two roles) and cannot properly host agent conversations. **DO NOT** add fake bookings to send agent messages. **DO NOT** alter booking messages in a way that risks breaking existing engineer/customer conversations. Reuse only UI styling, bubble/unread components, session/CSRF/middleware patterns, D1 query conventions and relevant audit utilities.

Implement or plan the new **AI Employees** tab inside the existing Studio2U Messages area, with its own tenant-scoped threads/messages and a linked **Approvals** view. If current code already has such a system, inspect and extend rather than duplicate it. The AI Employees inbox is accessible without loading Three.js.

Required: per-agent conversations, optional per-release/task threads, persistent message history, unread badges, timestamps, task/deliverable links, questions, review cards, notification preferences, approve/reject/request-changes, and accurate status labels. The existing client-to-engineer tab must remain unchanged.

Use additive database migration(s) with tenant-scoped indexes and foreign keys. Prefer extending existing `lw_approvals` if safe; do not create competing approval sources of truth. The detailed target schemas, events and endpoints are in `AGENT_INBOX_SPEC.md`. Tie notifications to persisted task events; never let browser input impersonate an internal AGENT sender. Secure threads using authenticated user sessions, label membership, role-based permissions and per-thread visibility.

**Security finding:** Existing customer booking messages use `?email=` in URL for booking-email matching. That pattern must NEVER grant access to AI Employee messages, royalty claims, rights documents, release masters or credentials. Build normal authenticated session access with server-side label membership checks. Avoid leaking IDs or attachments across tenants.

## C. Registration handoff: AI prepares; artist reviews and submits where necessary

Music service integration matrix: verified authorized API/OAuth > official export/manual-guided workflow > expressly provider-permitted supervised browser assistance. Do not assume ASCAP, BMI, UnitedMasters or SoundExchange have suitable MCP/API access. A password and user consent do not override provider terms. Do not bypass CAPTCHA, MFA, anti-automation rules or website restrictions.

Publishing Administrator must be able to prepare society-specific composition registration packets from validated data; request missing credits/splits via Agent Inbox; link evidence, source and revision; and send a structured owner approval request. For permitted/browser-assisted paths, prefill only within an authorized, scoped, observable session. Otherwise generate mapped fields with official-site link and help the artist copy/enter them. The artist should personally review the official form and press the site's Submit button when required. Store receipt/confirmation details after submission, and keep `REPORTED_SUBMITTED` distinct from `VERIFIED_CONFIRMED`.

Example:
1. “ASCAP packet prepared for [Song]. Missing publisher IPI and 10% split confirmation.”
2. Artist fills/approves missing facts.
3. Reviewer validates and freezes version N of packet.
4. Inbox offers **Review Packet** and **Open Official Site**; official field mapping shown. If permitted, optional supervised form filling with session consent and pause/stop.
5. Artist reviews official form and submits themselves where required.
6. Artist uploads receipt or authorized provider integration verifies outcome.
7. Agent schedules follow-up if only self-reported; no fabricated confirmed filing.

Represent real state transitions in database/notifications/task timeline and Three.js agent status later. Approval card UI cannot itself bypass the provider site; backend must enforce version-bound, idempotent authorization and audit.

## D. Voice in initial stylized 3D; MetaHumans later

Maintain V1 product requirement to converse with chosen agents by **text and voice**, with a voice provider that has verified API access. Static mouths on the initial Blender models are fine; show a speech indicator and optional subtitles. Design provider-neutral streaming STT/audio-generation or a real-time speech API, interruptions, push-to-talk, consent/microphone controls, privacy/retention preferences and text fallback. Do not assume the consumer ChatGPT/Claude apps' voice modes are drop-in developer APIs. Voice is an interface to the same permissioned backend tools and Agent Inbox. Spoken “yes” alone does not approve high-risk filings, posting, purchases or legal declarations.

Later optional MetaHuman/Unreal client gets lip-synced talking faces and gestures. Keep avatars, speech sessions, agent roles, task state, permissions and business logic decoupled. No Unreal requirement in current web vertical slice.

## E. Configurable prebuilt agents and honest readiness

Customer can hire/configure agents using templates assembled from the versioned skill library. Each template identifies exact skill IDs, tools, connected-service requirements, credential/onboarding needs, permission scopes, cost budgets and human handoff alternatives. Agent capability readiness is per skill, not a fake global “online” badge. Credentials belong in a secure service connection/vault, never in prompt/chat/browser JavaScript.

Current Blender references: Carla/Researcher and Eric/Reviewer exist as Blender rigs but GLB/browser export verification pending. Executive and Builder models are NOT yet approved or imported. Keep those backend roles and inbox threads functional without 3D meshes. Use Carla/Eric to test Blender > GLB > Three.js. Do not auto-create generic replacement meshes without owner approval. 3D avatar addition must be a config-only visual registration, not a backend rewrite.

## F. Royalty recovery and creative handoff stay first-class

Preserve founder's UnitedMasters-first Fast Release workflow and persistent eligibility tasks for ASCAP/BMI/other PRO, The MLC, SoundExchange, copyright and distributor collection. Build `RoyaltyRecoveryService` to identify missing account setup, uncertain catalog matching and potential claim paperwork with verifiable evidence; never promise money owed without official proof or confuse on-demand streams with SoundExchange-covered plays.

Preserve the creative pipeline: artist identity and clothing reference kit > Videographer concept/shot list/storyboard > approved Higgsfield video generation via verified adapter > verified Genjitsu editor OR local editorial fallback > beat/lyric-timecoded short-form cuts and captions > Reviewer QC > authorized Social Media Manager schedule/publish. Every agent-to-agent handoff references typed versioned artifacts and approval state. n8n and Tally may assist with forms and triggers but never become the authoritative release database.

## G. Prioritized implementation (do not interrupt the Release Engine)

**P0 inspect + merge plan**: Source/deployment audit; append R305–R321 new requirements with owners/gates/acceptance; preserve old skill registry, new YAML is proposed only.

**P1 complete current Real Release Engine** if not already done: tenant-safe audio/art uploads, actual probes, canonical metadata, versioned ZIP manifest/reviewer readiness report. Show tests and a user-demonstrable flow; don't overwrite it if complete.

**P1b Agent Inbox foundation**: additive message schema and service, authenticated routes, a separate AI Employees tab, unread counts, internal event-generated notifications for release/registration work. No AI execution claims yet. Run regression tests against legacy booking messages.

**P1c approval handoff**: version-bound registration packets and explicit review/reject/request changes, linked agent messages and official manual submission instruction. Ensure statuses remain truthfully unverified; no prohibited third-party automation.

**P2 agent runtime and voice**: connect verified typed skill tools, task/event stream, selected agent chats; optional real-time speech after entitlements/latency/budget and privacy testing. Three.js avatar responds to backend events, not invented work.

**P2+ provider activation**: verify provider terms/API/scope/cost before enabling Higgsfield, Suno, Genjitsu, social, PRO, distributor, browser assistance. Pilot one provider at a time. Build royalty dashboards and long-running follow-up workers.

Every phase must have source files, migration IDs, schema invariants, tests, exact passing output, screenshots if applicable, git commit, deployment environment, blocked items, and next acceptance gate. Do not push high-risk schema changes to production without explicit human approval.

## H. Acceptance tests for Agent Inbox and Human Handoff

- Cross-tenant threads, messages, unread counts, approval packets, attachments and receipts inaccessible; no user supplied email parameter as Label World auth.
- Existing client/engineer messaging unchanged and tested.
- User sees separate Clients & Engineers, AI Employees and Approvals sections; messages do not mix.
- Agent-sent messages require internal authenticated worker context; client cannot spoof sender kind.
- Agent task completed only when actual output exists; approval status separate from chat text.
- Stale version N approval rejected after release/splits revision N+1.
- Approve, reject and request-changes are auditable and idempotent; double-click cannot trigger double submission.
- Incompatible/unapproved provider returns guided/manual handoff, not browser automation.
- User-reported “submitted” remains pending verification until authoritative receipt/evidence.
- Notifications persist across browser closure; messages accessible in normal web UI without 3D renderer.
- Voice fallback to text, permissions checked through same tool gateway, no unconsented recording.
- Two Blender characters testable even though Executive/Builder meshes are missing.

## I. Documentation/version control

Preserve exact 23 existing skills; four `proposed_skills/*.yaml` are draft extensions until registered, evaluated and mapped. Update `START_HERE.md`, `CHANGELOG.md`, `REQUIREMENTS.md`, `DECISIONS.md`, `ROADMAP.md`, `WORKFLOWS.md`, `ARCHITECTURE.md`, `INTEGRATIONS.md`, `BUILD_STATUS.md`, `TRACEABILITY.md` and test docs as applicable in current repository. Link addendum documents; avoid changing requirements silently.

Please begin with a read-only source/deployment audit and implementation gap report; preserve whatever your current build/deploy agent is already doing. Then implement only the next safe, independently testable increment. End with the actual code paths, commit, full tests and honest status. Do not claim V1 is complete solely because planning documents, schema or models exist.


## IMPORTANT — v2.2 newer consolidated directive
This file is retained for the v2.1 historical audit. **Do not execute it as a separate simultaneous coding order.** For the latest founder-approved coordinated steps, use `ONE_PROMPT_FOR_CODING_AGENT.md` from v2.2. Existing v2.1 requirements are still in effect.
