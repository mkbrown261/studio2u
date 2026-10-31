> **v2.0 updated blueprint available.** Start with `START_HERE.md`, `CHANGELOG.md`, `RELEASE_OPERATIONS.md`, `SKILL_CATALOG.md`, `CREATIVE_VIDEO_PIPELINE.md`, `ACCEPTANCE_TESTS.md`, then the preserved/expanded v1 documents below. Some original files still say "initial" for their historic sections; additions labeled v2 supersede conflicts. No product code was developed by this documentation update.

# Studio2U Label World — Project Control Center

**Status:** Planning baseline, 2026-10-12. This is a product specification, not evidence of implemented software.

## Product mission
A commercial, multi-tenant, customizable 3D virtual record label. Customers own branded Three.js headquarters populated by Blender-created stylized AI employees whose actions represent verifiable backend work. A reusable MCP server exposes authorized label services to compatible AI clients.

## Canonical documents
- `PRODUCT_VISION.md`: goals, users, positioning, principles, experience.
- `REQUIREMENTS.md`: complete functional and nonfunctional scope, prioritized.
- `AGENT_ROLES.md`: roles, responsibilities, tools, outputs, safeguards, metrics.
- `ARCHITECTURE.md`: 3D, backend, orchestration, MCP, integrations, storage, security.
- `DATA_MODEL.md`: core entities and relationships.
- `WORKFLOWS.md`: end-to-end music release, marketing, research and rights workflows.
- `INTEGRATIONS.md`: provider adapters, authorization, verified vs unverified.
- `ROADMAP.md`: phases, deliverables, acceptance gates.
- `DECISIONS.md`: architectural decisions and unresolved questions.
- `BUILD_STATUS.md`: verified implementation status, tests, blockers, next steps.
- `CLI_HANDOFF.md`: exact execution instructions for the development CLI.

## Rules
1. No scope disappears because it is deferred. Deferred items stay in REQUIREMENTS and ROADMAP.
2. Every implementation change updates BUILD_STATUS and relevant design documents.
3. Every agent action must be auditable and tied to real task execution.
4. The 3D world is a client, not the authority for business state.
5. No credentials in prompts or client code; consequential actions require enforced permissions and approval.
6. External service availability, terms, and pricing require verification before activation.
7. Preserve original music files; never fabricate registration, distribution, or publishing confirmations.
8. Customer workspaces are isolated from the first database migration.


## v2.1 supplement
This package preserves all 46 v2.0 files and adds code-reviewed Agent Inbox, versioned approval packets and human handoff, voice/MetaHuman evolution, selectable agent capability setup, royalty recovery, creative collaboration and a copy-paste CLI directive. Start at `START_HERE.md`, then `GITHUB_MESSAGING_CODE_REVIEW.md` and `NEXT_CLI_DIRECTIVE.md`. The older 23 skills remain canonical and unmodified; proposed skills are intentionally staged. No production code has been changed by this documentation update.


## v2.2 — consolidated first-person headquarters + dashboard handoff
See `START_HERE_v2_2.md` and `ONE_PROMPT_FOR_CODING_AGENT.md`. Add new requirements R322–R339, 3D interaction/camera and Blender export specifications, approved four dashboard screenshots, accessibility/security and optional later cabinet/gold-plaque personalization. The original 23 skills and v2.1 Inbox/registration/voice/royalty requirements remain intact. No app code or production changes were made by this package.
