# Architecture Decision Log

- ADR-001 ACCEPTED: Commercial multi-tenant from first implementation, not retrofit.
- ADR-002 ACCEPTED: 3D Three.js/React Three Fiber first, Blender assets, Unreal-capable backend later.
- ADR-003 ACCEPTED: One polished Main Studio Hub first, modular connected departments later.
- ADR-004 ACCEPTED: Full logical workforce planned; four visible primary agents initially.
- ADR-005 ACCEPTED: Backend domain services are authoritative; 3D is a stateful client.
- ADR-006 ACCEPTED: MCP exposes domain tools; MCP alone is not orchestration or authentication.
- ADR-007 ACCEPTED: Higgsfield is an optional creative provider adapter, not a mandatory dependency.
- ADR-008 ACCEPTED: All consequential external actions require enforced authorization and audit.
- ADR-009 ACCEPTED: Original masters preserved; official filing/publishing/distribution claims require receipts.
- ADR-010 ACCEPTED: First real workflow is upload -> release package -> QA -> campaign/video brief.

## Pending decisions
- Existing repository/framework and Blender MCP capabilities after inspection.
- Final character reference filenames and exact designs after image audit.
- Branding and pricing tiers, supported regions and legal entity structure.
- Deployment environment, object storage, job queue, payment processor.
- Specific model API providers, account entitlements and per-job budgets.
- Verified integration eligibility for Higgsfield, Suno, ASCAP, UnitedMasters and social platforms.
- Exact launch scope and first beta-customer acceptance criteria.

Every changed decision requires date, rationale, tradeoffs, affected requirements and migration plan.

## v2 accepted decisions
- ADR-011 ACCEPTED: FAST_RELEASE and MANAGED_RELEASE are separate first-class release modes; founder's observed UnitedMasters-first habit is supported without treating deferred registrations as completed.
- ADR-012 ACCEPTED: Release rights gate cannot be bypassed for known unlicensed beats/samples/covers or inaccurate legal attestations.
- ADR-013 ACCEPTED: Post-release PRO/MLC/SoundExchange/copyright eligibility and follow-up tasks persist independently of streaming performance; no silent task expiry.
- ADR-014 ACCEPTED: Agent expertise modeled as versioned skill SOPs with input/output contracts, validation, evidence and evaluations; founder practice is labeled and official documentation periodically verified.
- ADR-015 ACCEPTED: Videographer, Short-Form Editor and Royalty Administrator are first-class logical jobs with distinct authority from Producer, Reviewer, Marketing and Social.
- ADR-016 ACCEPTED: Timed draft lyrics and Hook Intelligence underpin short-form campaigns; neither transcript nor viral prediction is treated as verified without review/evidence.
- ADR-017 ACCEPTED: Higgsfield video, Suno music, Genjitsu candidate editor and future providers connect through capability-tested interchangeable adapters.
- ADR-018 ACCEPTED: n8n/Tally optional operational integrations; PostgreSQL/Studio2U backend owns business records, security, tasks and audit.
- ADR-019 ACCEPTED: Browser/computer assistance may be investigated only with owner consent, provider permission, isolated session and action approvals; unsupported access falls back to guided manual handoff.
- ADR-020 ACCEPTED: Artist likeness and optional fashion reference kit requires rights/consent, versioning and permitted generation use.

## v2 questions requiring empirical validation (not blockers for schema/UX)
- Latest UnitedMasters required metadata/artwork/audio specifications and whether provider-approved submissions can be automated for paying customers.
- Exact ASCAP/BMI account registration form requirements by writer/publisher role; PRO-specific differences.
- MLC and SoundExchange account workflow availability and covered-revenue eligibility.
- Verified Higgsfield account models/API/video reference support, pricing and commercial terms.
- Genjitsu product identity/API/automation rights; use local editor if unavailable.
- Suno approved programmatic generation paths and ownership/licensing rules.
- Social platform account types, API publish permissions, limitations and content licensing.


## v2.1 accepted decisions and source boundaries
- ADR-021 ACCEPTED: AI Employee Inbox is **separate** from booking-specific client/engineer messages; reuse presentation and patterns but not the booking-linked table or query-email customer authorization.
- ADR-022 ACCEPTED: Human action cards link to versioned approval records; free-form messages and AI system prompts cannot authorize filings, legal declarations, spending or external publishing.
- ADR-023 ACCEPTED: ASCAP/BMI and similar services follow approved integration or provider-permitted supervised browser/human manual handoff; user reviews official form and presses Submit when required; no verified receipt => not officially confirmed.
- ADR-024 ACCEPTED: V1 business vision includes direct speaking with agents without animated mouths; voice service uses documented developer capabilities and text fallback; future Unreal MetaHumans with facial speech animation are renderer-only expansion.
- ADR-025 ACCEPTED: Customers select/hire prebuilt agent templates, with per-skill credentials/capability requirements, granular permissions, revocation and truthful status.
- ADR-026 ACCEPTED: Founder-priority Royalty Recovery helps artists pursue potential missed payments with evidence; no speculative owed balance, no claim every Spotify stream pays SoundExchange.
- ADR-027 ACCEPTED: Carla/Researcher and Eric/Reviewer are presently the only reported completed Blender rigs; Executive/Builder meshes pending owner-approved quality. Missing meshes never block backend roles or their inbox.
- ADR-028 ACCEPTED: Existing Studio2U Hono/D1/R2/Cloudflare stack should be extended, not casually replaced based on prior abstract PostgreSQL suggestions.
- ADR-029 ACCEPTED: Higgsfield video/Genjitsu editor/social handoffs remain typed and approval-bound; verified adapters only, provider-independent pipelines and creative evidence.
- ADR-030 ACCEPTED: Development status is sourced from current commit/environment. GitHub `main` reviewed here was `e3c0ebf`, while CLI reported local `4ed1007`; nothing about newer code/deployment is verified by this audit.

### v2.1 pending decisions (not blockers to design)
- User-visible navigation labels and roles for team collaborator inbox visibility.
- Whether existing `lw_approvals` is reusable or needs additive fields; evaluate current local branch first.
- Notifications/email channel, sound/mic privacy defaults, voice provider/cost limits, data retention/region.
- Which external providers approve browser assistance; no service is presumed authorized.
- MetaHuman animation/Unreal licensing, cost and deployment approach when planned.


## v2.2 decisions — approved founder UX/3D integration
- ADR-031 ACCEPTED: Original Studio2U site appearance and human booking messaging are untouched; Label World has a separate premium visual design and domain route.
- ADR-032 ACCEPTED: Four attached founder-approved agent dashboard screenshots are visual specifications; one reusable React shell with specialized Carla/Eric/Executive/Builder workspaces.
- ADR-033 ACCEPTED: First-person headquarters exploration comes before optional personalized player/avatar; exact initial controls WASD + mouse look + E interact + Esc close/release, with touch and accessibility alternatives.
- ADR-034 ACCEPTED: One configurable interaction registry links agent/workstation mesh interactions to the same authenticated dashboards accessible outside WebGL. No independent 3D business logic.
- ADR-035 ACCEPTED: Carla and Eric can interact with idle-only fallbacks. Missing clip/tablet-raise/walk, Executive mesh and Builder mesh must not delay a meaningful interaction demo.
- ADR-036 ACCEPTED: Separate public read-only/sanitized 3D preview from private authenticated label headquarters; private data never embedded into publicly served scene assets.
- ADR-037 ACCEPTED: Preserve source Blender scenes and optimize/re-export non-destructively; make customizable cabinet/trim/wall surfaces and plaque anchors addressable before optimization bakes.
- ADR-038 ACCEPTED: Decorations/cabinet color changes and 100k/1M verified streaming milestone plaques are future personalized features, not blockers for interaction or business utility. No fake numbers or confusion with RIAA gold/platinum certification.
- ADR-039 ACCEPTED: Agent's in-flight three parallel streams (3D exports, dashboards, separate AI Employee Inbox) are audited and completed before duplicative work; current SHA/deployment and browser tests govern progress.
