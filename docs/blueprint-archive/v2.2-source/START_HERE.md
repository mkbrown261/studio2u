# STUDIO2U LABEL WORLD — CANONICAL MASTER PLAN v2.0
**Date:** 2026-10-12  
**State:** Product blueprint updated; software implementation is **not verified** by this package.  
**Project mission:** A commercial, customizable, multi-tenant 3D AI-operated record-label headquarters built with Three.js + Blender, whose specialist employees perform verified work and provide artist-approved releases, registrations, creative assets, campaigns, and royalty follow-through.

## IMPORTANT: read this first
This version **includes and supersedes the prior v1 planning bundle**, keeping all 12 original documents and extending them. Preserve this directory under version control. Read `CHANGELOG.md`, `DECISIONS.md`, `WORKFLOWS.md`, `RELEASE_DATA_SPEC.md`, `AGENT_SKILL_SYSTEM.md`, `SKILL_CATALOG.md`, `INTEGRATIONS.md`, `ROADMAP.md`, then `CLI_HANDOFF.md` before implementing.

## Nonnegotiable product decisions
1. **Commercial from inception:** strict tenant separation, personalized 3D studios, configurable label agents and branding. Customer #1 may be the founder; never design a hard-coded single-customer app.
2. **3D, not fake illustrations:** Blender GLBs and an interactive R3F main studio with gold-record plaque, guitar, workstations, blocky luxury-dressed agents. Shared modular headquarters; build one polished room first.
3. **Artist can choose FAST RELEASE:** UnitedMasters-first distribution is the founder's proven personal habit. The system makes distribution convenient and creates automatic, persistent follow-up tasks for PRO, mechanical and SoundExchange pathways, **without ignoring required licenses, samples, credits or ownership**. Never equate upload to UnitedMasters with copyright/PRO registration.
4. **Also offer MANAGED RELEASE:** Complete verified credits/rights intake and registration preparations in parallel with distributor package; make progress visible.
5. **Real employees, real skills:** Executive, A&R, Producer, Catalog, Publishing, Rights, Release, Reviewer, Videographer, Short-Form Editor, Marketing, Social Media, Royalties. Each uses versioned operational skill procedures, not persona prompts alone.
6. **End-to-end campaign:** upload song -> inspect/transcribe/confirm -> release record -> package + rights checks -> campaign -> storyboard -> Higgsfield (when authorized) -> editor (Genjitsu pending capability verification / local editor fallback) -> QC -> approve -> supported social publishing -> analytics -> royalty follow-up.
7. **Provider-neutral:** Higgsfield, Suno, UnitedMasters, ASCAP/BMI, n8n, Tally and others have independent adapters and capability gates. No password-in-prompt. Browser assistance only in a permitted, isolated, explicitly authorized mode; otherwise manual handoff.
8. **Everything observable:** durable jobs, receipts, provenance, retries, human approvals, auditable actions, event-driven 3D agent animation. A simulated task may never masquerade as real.
9. **Never forget:** Every accepted feature must have requirement IDs, skill IDs, roadmap stage, owner, acceptance tests and BUILD_STATUS entry. Never silently remove scope.

## First playable AND useful product
1 customizable tenant's studio plus second tenant used for isolation tests; 4 visible primary agents; release project and upload; audio metadata + draft lyrics awaiting human confirmation; credits and rights gate; actual ZIP/manifest package; reviewer evidence; executive task progress in 3D; draft promotional campaign/storyboard/short-form hook candidates. Other specialist roles can initially operate invisibly while remaining logically separate. External distribution/video/social actions are only called when verified and authorized.

## Current artifact status
Planning documents only. A reference image is not a 3D model. This bundle does not claim working code, real provider integrations, approved browser automation, completed registrations, or verified royalty collections.

## Key files
- `CHANGELOG.md` — exactly what changed and why
- `RELEASE_OPERATIONS.md` — founder's real UnitedMasters-first experience, Fast vs Managed Release, follow-up accountability
- `RELEASE_DATA_SPEC.md` — canonical data, validations, identifier definitions and legal-risk checks
- `AGENT_SKILL_SYSTEM.md` + `SKILL_CATALOG.md` + `skills/*.yaml` — executable-format job specifications
- `CREATIVE_VIDEO_PIPELINE.md` — artist likeness, shot list, Higgsfield, Genjitsu verification, hooks, editor, QC
- `SOCIAL_A_AND_R_INTELLIGENCE.md` — social campaign, n8n/Tally, A&R trend research and evidence standards
- `BROWSER_ACCESS_SECURITY.md` — safe integration/access patterns and restrictions
- `ACCEPTANCE_TESTS.md` — evidence of completion rather than checkbox optimism
- `CLI_HANDOFF.md` — immediately actionable code-agent instructions
- Earlier v1 docs are retained and expanded.


---
## v2.1 addendum — 2026-10-12 — read immediately after v2.0
**The original 23 skill contracts and complete v2.0 scope are preserved.** This v2.1 update adds: (a) source-inspected existing Studio2U messaging design; (b) a separate secure AI Employee Inbox and explicit human approval messages; (c) provider-permitted, human-submitted ASCAP/BMI/other forms and honest receipt tracking; (d) founder-priority royalty recovery; (e) selectable prebuilt agents with per-skill Connected Services requirements; (f) speech to stylized agents without mouth animation, later MetaHuman/Unreal capability; (g) current Blender roster Carla+Eric only, Executive/Builder 3D meshes pending; (h) preservation of release-engine-first and on-going deployment branch truth.

**Read these new documents before changing code:** `GITHUB_MESSAGING_CODE_REVIEW.md`, `AGENT_INBOX_SPEC.md`, `APPROVAL_AND_BROWSER_HANDOFF.md`, `VOICE_AVATARS_AND_AGENT_CREATION.md`, `ROYALTY_RECOVERY_AND_CREATIVE_HANDOFF.md`, `ADOPTION_AND_TEST_MATRIX.md`, `NEXT_CLI_DIRECTIVE.md`. Four `proposed_skills/*.yaml` are NOT part of the original 23 verified contract count; they are design proposals requiring future registration and evaluation. New requirement IDs R305-R321 are appended below.

**Verified source boundary:** GitHub review inspected the accessible `main` branch at `e3c0ebf`; the CLI reported a later local `4ed1007` and an in-progress deployment. Do not claim to have inspected the latest local branch or production. Re-audit before implementation. No code or production was modified by this planning update.


## v2.2 superseding navigation note
Read `START_HERE_v2_2.md` before older master instructions. For the next coding-agent handoff, paste **only** `ONE_PROMPT_FOR_CODING_AGENT.md`; older `NEXT_CLI_DIRECTIVE.md` is preserved for history, not a concurrent competing assignment. The four approved UI images are included in `reference_ui/`. All prior requirements and skill contracts remain valid. Current asset exports/dashboard/Inbox progress must be re-audited before declaring DONE.
