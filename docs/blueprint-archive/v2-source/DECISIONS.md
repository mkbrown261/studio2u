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
