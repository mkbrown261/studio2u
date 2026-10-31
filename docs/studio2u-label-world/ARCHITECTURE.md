# Technical Architecture

## Logical layers
1. Three.js client: React, TypeScript, React Three Fiber, Drei, Zustand, GLB assets, animation controllers, camera, workstations, responsive accessible overlays.
2. App API: authentication, tenants, users, catalog, releases, campaigns, agent config, approvals, file downloads, connected services.
3. Domain services: catalog, audio inspection, metadata, release packaging, rights/publishing preparation, research, marketing, creative production, quality control.
4. Orchestration: persistent workflow/task queue, idempotent workers, retries, event log, approvals, cost limits, model-provider abstraction.
5. MCP server: validated, narrowly scoped tools wrapping the SAME domain services; not the sole business backend.
6. Integrations: approved provider adapters, OAuth/tokens, secrets vault, capability discovery, rate limits, webhooks/polling and receipts.
7. Data: PostgreSQL, object storage for originals/versions/outputs, optional queue/cache, structured audit logs.

## Recommended baseline
Monorepo: `apps/web`, `apps/api`, `apps/worker`, `apps/mcp`, `packages/contracts`, `packages/domain`, `packages/scene`, `assets/blender`, `assets/references`, `docs`. Use existing repository stack when appropriate. A modular monolith backend is preferred to premature microservices.

## Event model
Task states: PENDING, QUEUED, ASSIGNED, RUNNING, WAITING_FOR_INPUT, WAITING_FOR_APPROVAL, BLOCKED, FAILED, COMPLETED, CANCELLED. Events: task.created, task.assigned, task.started, task.progress, task.blocked, task.completed, task.failed, approval.requested, approval.granted, approval.denied, asset.created, release.reviewed, integration.status.changed. Event payloads include tenantId, taskId, agentId, eventId, timestamp, status, activity, evidence refs. Never invent progress percentages.

## 3D state mapping
Agent status controls path to station and animations (idle, walk, sit, type, review, talk, wait, celebrate). Backend events are truth; frontend interpolation is visual only. The browser can close without stopping jobs. Initial room is compact luxury studio with gold record wall, guitar, executive/producer/research/review workstations; expand via separately loaded room modules. Optimize GLBs, UVs, materials, geometry and lights with measured profiling. Preserve GLB/FBX options for later Unreal.

## Security and rights
All APIs enforce tenantId and RBAC server-side; object storage paths and signed URLs are tenant-scoped. Secrets are encrypted and never sent to LLM prompts or frontend. Tool gateway enforces scopes, approval, budget, dry-run and rate limits. Legal submissions, distributor delivery, public posting, spending, contract commitments and deletion require approval. Unverified third-party access is unavailable, not simulated as live. Maintain file provenance and source rights.

## Extensibility
Provider adapters implement capabilities, authentication, cost estimation, submit, status, cancel where supported, download, and error normalization. UI shows VERIFIED_CONNECTED, VERIFIED_NOT_CONNECTED, UNVERIFIED, UNSUPPORTED, DEGRADED. Avoid tying product logic to one AI model, video platform, distributor or social network.

## v2 architecture details
**Release engine:** `ReleaseIntakeService`, `AudioInspectionService`, `LyricsService`, `ContributorService`, `RightsGate`, `DeliveryPackageService`, `DistributionConnector`, `RegistrationFollowUpService`; do not mix recording distribution status with PRO/MLC/SoundExchange status. `FastRelease` and `ManagedRelease` are orchestrated workflows calling shared domain services.
**Creative pipeline:** `ArtistIdentityKit`, `SongHookService`, `CampaignService`, `VideoCreativeBriefService`, `VideoGenerationGateway` (Higgsfield candidate), `VideoEditorGateway` (Genjitsu candidate + local renderer), `CreativeReviewService`, `SocialPublishingService`.
**Role skills:** YAML `skills` are configuration/contracts; real typed services validate invocations and record exact version `skillId@version`; test harness and citations are part of operational quality.
**Browser session:** optional explicit isolated user-controlled connection; no unrestricted remote computer access or raw credential flow through model/frontend; capability registry must enforce provider legality and terms, user pause/revocation, audit, pre-submission approval.
**Event traces:** include `registration.task.created`, `registration.packet.prepared`, `registration.receipt.verified`, `creative.storyboard.approved`, `video.job.submitted`, `video.job.completed`, `social.post.published`, `social.post.failed`, each with verified evidence refs, never synthetic task success.


## v2.1 architecture addendum — messages, approvals, voice, deployed-stack fit
1. **Preserve deployed architecture:** Studio2U currently uses Hono/TypeScript, Cloudflare D1 and R2 (from inspected GitHub `main`); adapt existing migrations/routes rather than demanding a PostgreSQL migration solely because early plans recommended one. Evaluate Cloudflare Workers queues/cron/Durable Objects/WebSockets/SSE against actual bindings and cost before choosing transport.
2. **New communications bounded context:** `AgentInboxService` (`AgentThread`, `AgentMessage`, `ThreadMember`, `AgentNotification`), attached to `labelId` and optionally release/task/campaign; isolated from existing `messages(booking_id)` records and `/status/messages` routes. Share visual components/patterns, not customer-email auth nor booking table.
3. **Approval is authoritative workflow state:** `ApprovalService` with subject revision/digest, user/tenant permissions, one-time token or equivalent nonce, idempotent consume, decision and audit. Connect to existing `lw_approvals` if appropriate. Message cards are UI notifications, never authorization by themselves.
4. **External registration handoff:** `RegistrationPacketService` + `ProviderCapabilityRegistry` + `ManualSubmissionHandoff` + optional authorized `SupervisedBrowserSessionService` + `ReceiptVerificationService`; no direct access when provider capability isn't verified.
5. **Voice transport and character renderer decoupled:** `AgentConversationService` uses model/provider adapters and domain-tool permission gateway; low-latency audio session separate from durable D1 text summary. `AvatarRenderer` can be Three.js stylized character, static portrait, or future Unreal MetaHuman. Missing mesh does not disable role or inbox.
6. **Agent hiring/onboarding:** versioned `AgentTemplate`, `AgentInstance`, `SkillBinding`, `ConnectionRequirement`, `ProviderConnection`, `GrantedScope`. Per-tenant, per-skill truthful capability badges and spend/approval policy.
7. **Data ownership and runtime:** release/catalog records remain authoritative in current domain services, messages link by immutable IDs/revisions; Workers, queue events and 3D renderer observe actual state. Do not put rights/royalty declarations in unstructured chat as the system of record.
8. **Technical/source audit:** see `GITHUB_MESSAGING_CODE_REVIEW.md`; inspected `main` may be behind local CLI HEAD/production. Read-only planning update is not a deploy or tested app capability.


## v2.2 — renderer/interaction separation
Use a standalone R3F scene with GLB `SceneAssetRegistry`, camera/movement/collision system, `InteractableRegistry`, animation clip capability registry and React overlay manager. 3D scene emits `openAgent(agentId, labelContext, entityContext)`; shared React workspace/router consumes it, retrieves authoritatively scoped D1/R2 data, and may render over Canvas or as direct route without WebGL. Never put private business data in public glTF or make URL email matching a label auth mechanism. Pointer-lock released on opening overlay and only re-locked on user gesture. Stable configurable GLB material/prop IDs reserved for future cabinet finishes and verified achievement wall.


## ICM-inspired context increment — 2026-10-13
Short file routing + versioned role/skill instructions + authoritative D1/R2 context + deterministic domain tools + provider-neutral reasoning. Root instructions serve developers; only approved compiled manifest resources serve runtime employees. Runtime context is server-only, bounded, tenant/user scoped and has no execution capability. Existing review/research services and internal summary remain authoritative. No generic agent framework introduced.
