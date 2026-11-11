# Version Log

## v2.0 — 2026-10-12 — Founder workflow and specialist skill expansion
**Source of changes:** direct founder discussion and retained v1 scope.

### Added / refined
- Captured founder's actual practice: distribute to UnitedMasters quickly, defer time-consuming ASCAP/royalty registrations until later when capacity or traction permits; automate **follow-through** so releases never silently become unclaimed royalty opportunities.
- Established two explicit product paths: **Fast Release** and **Fully Managed Release** with rights gates, approval and accountable registration queues.
- Clarified ASCAP/BMI work registration is distinct from ISRC/UPC/ISWC, federal copyright registration, MLC mechanicals, SoundExchange master-side statutory royalties and distributor delivery.
- Added verified/unknown/missing status for every registration and legal assertion; track receipts and next actions, avoid filing guarantees.
- Added canonical intake fields for composition, master, release, lyrics + timestamps, contributors/roles, splits, sample/cover clearances, PRO affiliations, IPI, ownership, ISRC, UPC, art, provenance, clearances, distribution and accounting.
- Added detailed versioned skill procedures and contracts for Executive, A&R, Producer, Catalog, Release, Publishing, Rights, Royalties, Videographer, Short-Form Editor, Marketing, Social Manager, Reviewer.
- Formalized videographer concept->shot list->storyboard->Higgsfield job->editor->aspect exports->quality gates->approved post lifecycle.
- Added rights-respecting artist identity pack with opt-in portrait, clothing/shoes, brand-kit, authorized consent, brand safety and provenance.
- Added provider-neutral Genjitsu video editing candidate, with capability verification gate and first-party/local FFmpeg pipeline fallback.
- Added hook intelligence (word-aligned lyrics, chorus/drop sections, confidence, original recordings only) and hypothesis-driven viral testing; added A&R chart/underground discovery research procedures.
- Added n8n as bounded automation/integration helper; Tally for intake and creator questionnaires, neither is source-of-truth.
- Clarified secure computer/browser use: *possible as an explicit controlled mode if permitted*, not blanket remote access or unrestricted account automation.
- Added concrete requirement IDs R111-R126 and R211-R221; testing matrix, agent skill ownership and CLI updating policy.
- Expanded roadmap to implement royalty accountability early, without waiting for all remote integrations.

### Preserved from v1
3D-first design, one-room-first modular architecture, 4 primary visible agents then full roster, multi-tenant isolation, Blender GLB assets, MCP domain-tools model, durable task orchestration, security/approval gates, release package first vertical slice, A&R research, Higgsfield and Suno as optional authorized adapters, social and publishing, extended departments, possible Unreal client.

### Interpretation and constraints
The founder's current habit is **descriptive**, not a universal compliance rule. Fast Release still checks ownership, permissions, samples/covers and delivery terms, and tracks missing rights before making a delivery-ready claim. Artist/user owns final legal declarations. This plan is not legal advice. Official form fields, platform APIs, terms, fees and content rules must be rechecked before launch or automated submission.


## v2.1 — 2026-10-12 — Agent Inbox, human-assisted filing and voice/agent onboarding
**Documentation-only expansion. No repository code written or production deployment performed here.** GitHub source inspection on accessible `main`: `messages` booking FK, engineer/customer sender enums/read flags, authenticated engineer route, customer `?email` route, reusable bubble UI/unread badge. Architecture choice: new authenticated/tenant-scoped Agent Inbox with separate tables, preserve existing booking messages and tests. Add explicit approval/human official-site submission handoff and receipt verification for ASCAP/BMI and other providers, only permitted supervised browser assistance. Add configurable prebuilt agents and per-skill connection/onboarding, user-agent voice without lip-sync dependency, future MetaHuman client, reported current Blender asset reality Carla+Eric present/Executive+Builder pending, royalty recovery dashboard and creative typed handoff.

Files added: `GITHUB_MESSAGING_CODE_REVIEW.md`, `AGENT_INBOX_SPEC.md`, `APPROVAL_AND_BROWSER_HANDOFF.md`, `VOICE_AVATARS_AND_AGENT_CREATION.md`, `ROYALTY_RECOVERY_AND_CREATIVE_HANDOFF.md`, `ADOPTION_AND_TEST_MATRIX.md`, `NEXT_CLI_DIRECTIVE.md`, `proposed_skills/*.yaml`, `VERSION_MANIFEST.json`. All original 23 canonical skill YAML retained. New requirement IDs R305–R321, acceptance gates and decision records added. Note current GitHub main vs CLI local commit/deploy discrepancy; do not assume live functionality.


## v2.2 — 2026-10-12 — one handoff, interactive headquarters and four reference-driven UIs
Documentation-only update to preserved v2.1 package. Adds one unified paste-ready engineering instruction; first-person 3D movement/camera/collisions; agent-workstation interaction registry; React overlay and pointer/focus management; non-blocking actual-clip animation fallbacks; public/private showroom separation; Blender GLB/UV/material pipeline and room asset customization hooks; verified streaming-milestone plaques and future cosmetic options. Formalizes four approved UI mockups as reference assets and adds R322–R339 with acceptance coverage. Keeps 23 original skills unchanged and four proposed extensions staged; no repository code, Cloudflare deploy or database was altered by this document package. Reports of three current coding streams are IN PROGRESS until independently verified.
