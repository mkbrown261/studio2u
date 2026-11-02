# CLI Handoff — Read Before Any Code Changes

You are the lead engineering agent for Studio2U Label World. Treat this folder as the canonical initial specification. READ ALL FILES before writing code. This is a commercial multi-tenant 3D virtual record label, not a mockup. Preserve all P0-P3 requirements even when deferred. Supplied images define visual identity. Do not replace established character appearances or existing working code.

## First execution sequence
1. Inspect current repository, git status, package manifests, running services and Blender/MCP tool availability. Do not destroy existing work.
2. Locate and visually inspect all supplied character/environment reference images; build `docs/ASSET_INVENTORY.md` with actual paths, subjects, missing models, and Blender work needed.
3. Copy/merge these specification files into repo `docs/studio2u-label-world/`, preserving version history. Create a requirements-to-implementation traceability matrix with IDs R001 etc.
4. Write `docs/IMPLEMENTATION_PLAN.md` with concrete modules, migration steps, risks, milestone estimates and verification commands. Update `DECISIONS.md` with discoveries.
5. Establish or adapt monorepo structure, TypeScript contracts, tenant schema, task/event types and auth model without breaking current project.
6. Build Main Studio Hub R3F blockout with real 3D geometry, signature gold record, guitar, four workstation zones, interactive camera and clickable agent placeholders if final Blender assets are unavailable. Clearly mark placeholders.
7. Integrate real Blender GLB characters when available; validate rigs, material, scale, performance and animation.
8. Implement real release creation/upload, original preservation, checksum, metadata extraction, ZIP/manifest and deterministic QA.
9. Connect durable task events to agent state and 3D animations. Demo one actual end-to-end release package workflow.
10. Add campaign/content brief foundation and creative provider adapter contract; do not pretend Higgsfield or social publishing is connected until verified.
11. Keep `BUILD_STATUS.md` updated after EVERY meaningful step: status, changed files, commands, test evidence, blockers and next steps.

## Nonnegotiable behavior
- Never claim success without tests and observable evidence.
- Never silently delete or overwrite originals.
- Never put credentials in prompts or client code.
- Never fabricate music metrics, registrations, submissions, uploads, social posts, or video jobs.
- Never cross tenant boundaries.
- Use least privilege, explicit approvals and receipts for consequential actions.
- Do not remove future requirements because they are not in the MVP.
- Ask for input only when genuinely blocked by missing assets, credentials or consequential design decisions.

## Immediate output expected
An audit of existing repo and reference assets, architecture gaps, updated milestone plan, and the first running verified vertical-slice increment. No giant untested code dump.
