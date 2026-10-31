# STUDIO2U LABEL WORLD — SINGLE CONSOLIDATED IMPLEMENTATION DIRECTIVE (MASTER PLAN v2.2)

You are continuing the existing Studio2U Label World product. This single instruction consolidates the founder's approved design, the active engineering streams, and the next 3D interaction milestones. **Do not restart the application, overwrite Blender originals, abandon partially built work, or change the original Studio2U public/engineer/customer site UI.** Label World is a dedicated application connected to the original site, using appropriate shared authentication and backend infrastructure.

## 0. FIRST: RESPECT THE WORK ALREADY RUNNING

The most recent development-agent report says three parallel workstreams are ACTIVE: (1) preserve/inventory/export the Blender headquarters and Carla/Eric; (2) build the four reference-based agent dashboards in a shared React shell; (3) build an AI Employees Inbox separate from booking messages. The agent also reported that production `/label-world` will have a public room preview while private label features require login. **Do not start duplicate work.** Check the live local working tree, active jobs, complete HEAD SHA, Cloudflare deployed version, and exact tests before proceeding. `02848fc` was the previously observed GitHub checkpoint, **not a guarantee of current HEAD**. Finish/verify those active streams before implementing the next increment, unless clearly independent work can proceed without conflicts. If parallel work is still running, give a non-destructive plan and proceed only on isolated files/worktrees.

Read the provided **complete Master Plan v2.2** and preserved v2/v2.1 documents and all 23 unchanged canonical YAML skills. Treat the four approved dashboard reference images as the **visual UI specifications**. The two currently approved 3D characters are **Carla (Researcher/A&R)** and **Eric (Reviewer)**. The **Executive and Builder** have logical roles and dashboards but **NO approved 3D meshes**; do not invent replacements. Earlier reports say Carla has idle coverage and Eric has some walking/other animation; audit actual animation clips in Blender instead of assuming any clip exists. No need to wait for completed character locomotion, voice facial rigs, or the missing characters to ship interactive UI.

## 1. PRODUCT BOUNDARY AND CORE EXPERIENCE

The original Studio2U website, human-to-human booking messages, engineer/customer dashboards, billing, bookings, and existing visual design **must remain unchanged**. Implement Label World under `/label-world` and its child routes as a separate premium dark/gold application with shared functional services as authorized. The **3D headquarters is the navigable world; agent workspaces are the functional tools; characters and workstations are the entry points.** All critical business functionality must also work from ordinary accessible dashboard routes if WebGL or character assets fail.

Support two separate modes without exposing tenant data:
- **Public preview:** read-only sanitized demo room, non-sensitive decor, explanatory agent descriptions and preview UI; no private tasks, messages, audio, artwork, release data, API keys or label customization. Never make an anonymous request expose private D1/R2 records.
- **Authenticated label room:** the user's selected label, authorized workstations, release data, saved customizations, agent conversations, approvals and earned plaques; enforce membership/RBAC at each API and asset route. Public endpoints are not an authentication bypass.

## 2. PRESERVE, EXPORT AND VALIDATE REAL BLENDER ARTWORK

Inventory the actual `.blend` headquarters (studio/lobby/conference collections), exact local source path, textures, procedural node materials, mesh UVs, armatures, animations, asset references and export scripts. Do not claim an asset is deployed merely because a render exists. Make copies before editing. Produce optimized, independently loadable room/character `.glb` or `.gltf` assets with a deterministic export manifest, asset sizes/hashes, original Blender object mapping, GLB versions, texture formats and bounds. Fix/bake procedural materials as needed, repair UV issues, resize/compress textures sensibly, verify materials/normals/scale/transforms, export skeletal actions as named clips and independently reload exports into a test GLTF viewer or Three.js harness. Bake unsupported constraints/IK motion into suitable exportable action data when necessary; don't destroy the original rigs. Check which clips truly exist and their frame ranges. Preserve artistic appearance. Avoid over-optimizing solely to meet arbitrary poly counts; measure draw calls, FPS, texture/VRAM use, load time and device behavior.

Important for later personalization: keep stable IDs and separable materials on the cabinet fronts, cabinetry trim, walls/selected finishes and awards/plaque slots instead of baking everything into one unmodifiable mesh. Use reusable materials where appropriate and duplicate material instances at runtime only when independently changed. For collision, create simplified collider meshes or equivalent geometry rather than using every decorative triangle. Assets can be hosted via approved static build/R2 paths with correct cache/cross-origin handling and permission boundaries; source `.blend` need not be publicly distributed. Confirm GLBs and import mappings are tracked/deployed intentionally, not lost outside GitHub.

## 3. SHARED 3D WORLD AND FIRST-PERSON CAMERA

Create/finish one actual React Three Fiber/Three.js headquarters loader with loading progress, recoverable asset errors and fallback to conventional dashboards. **Start with first-person exploration; no player avatar is needed yet.** Add:
- desktop: WASD movement, mouse look through pointer-lock when explicitly engaged, Shift faster walking if appropriate, E or click/tap to interact with nearby target, Esc to release pointer/cancel an overlay;
- mobile/tablet: touch-look and on-screen move/interact controls with input safeguards;
- sensible fixed camera eye height and spawn, consistent world scale, safe bounds, walk-speed and turning configuration, collision/wall/desk blocking, no falling through floor, doorway clearance;
- smooth but efficient frame-time updates, predictable camera controls, reduced-motion support, keyboard/focus support and a non-3D fallback;
- mouse lock obtained only from user gesture and correctly released before showing interactive HTML forms.

Do **not** conflate pointer-lock with movement; implement an explicit movement controller plus collision resolution (a suitable scene-integrated physics or lightweight collision solution chosen after inspecting dependencies). Optimize movement to avoid tunneling, clipping and exiting the scene. Camera position and yaw/pitch should persist in memory as the user enters/exits overlays and return to exploration without remounting/reloading the scene. Avoid camera motion while typing in chat, editing forms or using a screen reader.

## 4. ONE DATA-DRIVEN INTERACTION ENGINE — NOT FOUR HARD-CODED CASES

Implement an `InteractableRegistry` (or equivalent) mapping stable IDs to object reference/collider, interaction distance, kind, target UI/route, availability, required label permission, prompt text, animation cue and contextual entity IDs. Cover:
- `agent.researcher.carla` -> Researcher dashboard;
- `agent.reviewer.eric` -> Reviewer tablet dashboard;
- `station.executive` -> Executive dashboard while mesh absent;
- `station.builder` -> Builder workspace while mesh absent;
- future doors, workstations, cabinet customization, gold record plaques, gallery/achievement wall.

Interaction lifecycle should be a centrally governed state machine, conceptually `EXPLORE -> NEAR_TARGET -> PROMPT -> INTERACT -> OPEN_UI -> CLOSE_UI -> EXPLORE`. Approach/click prompts should only show for valid, accessible interactables; on E/click/touch validate distance and permission where relevant; queue an available visual cue without blocking; open the existing **HTML/React dashboard** as an overlay; unlock and suspend camera input; set focus in the dialog; restore focus/camera movement on close. Show a useful error when role is not allowed; do not reveal private data in denial messages. Do not implement new business logic inside 3D meshes or duplicate complete React dashboards as texture-only tablet screens.

## 5. CHARACTER ANIMATION WITH REALISTIC FALLBACKS

Implement a reusable animation clip registry per agent with semantic states such as `IDLE`, `GREETING`, `INTERACTING`, `WORKING`, `WALKING`, `CELEBRATING` and a `MISSING_CLIP` fallback. These are **capability names**, not assertions that the assets currently contain each animation. Read actual clip names from GLB runtime. Use `AnimationMixer`/Three.js animation actions or the proper R3F integration with well-managed fades/cleanup. Current first-pass behavior: idle plays where available; interaction prompts open the UI even if GREETING/TABLET clips are missing; do not invent movements, cause T-pose, or block an agent dashboard because Carla has only idle. Eric's future tablet raise/point interaction should be wired by cue but enabled **only after valid exported animation and prop attachment**. Walking remains optional for v1. New animations can be added later without modifying UI components or backend agent permission logic. Never fake agent activity from idle animation.

## 6. EXACT APPROVED DASHBOARDS, ONE MASTER REACT SHELL

Finish the in-progress design implementation **as close to the attached four mockups as practicable**. Shared Label World header, side navigation, label selector, reusable cards/charts/tables, agent header, and right-side contextual conversations. Route map (or equivalent deep links):
- `/label-world/agents/researcher` — Carla: Street Heat, Drill, TikTok Momentum, Instagram Buzz, Top 100 Movement, Emerging Tracks, Trend Watch, Genre Heatmap, Viral Signals, Platform Tracking, Suggested Opportunities, Candidate Records, Artist Watchlist, Notes/Evidence, Talk to Carla.
- `/label-world/agents/reviewer` — Eric: realistic expanded tablet UI with Release QA, current project and version, audio/art/lyrics/credits/splits/rights/metadata/package checks, PASS/FAIL/WARNING/NOT_TESTED/NEEDS_HUMAN_REVIEW, issues, evidence, corrective actions, approval, Talk to Eric. Clicking Eric in scene opens the same component as direct route.
- `/label-world/agents/executive` — Label Overview, Release Pipeline, performance/revenue where verifiable, pending approvals, agent activity, risks, rights follow-ups, executive assignments/notes, contextual agent chat. Enter from Executive workstation until model exists.
- `/label-world/agents/builder` — Beat Brief, actual Song Assets, Cover Art, Lyrics Intake, Credits/Splits, Release Package Builder, Catalog, Versions, Connected Tools, Task Queue, Talk to Builder. Enter from Builder workstation until model exists.

The images' example chart numbers, fictional releases, portraits, 'online' dots and completed provider badges are **DEMO CONTENT ONLY**. When live sources are missing, render `DEMO`, `NOT CONNECTED`, `NOT TESTED`, or accurate zero/empty states; never falsely display real TikTok/Instagram analytics, fake royalties, verified distributor status, invented external connections or agent activity. Model availability is separate from actual agent skill execution. All dashboards, release forms and inbox should remain accessible directly with no 3D asset dependency. Preserve Release Engine and the existing personal encrypted OpenAI/Claude/Kimi/Qwen/OpenRouter connections.

## 7. CONTEXTUAL AGENT INBOX AND HUMAN APPROVAL

Integrate the separate AI Employees Inbox being built concurrently, **never reuse the booking-specific customer/engineer `messages` table or query-email access**. Agent panel should show the current label, agent, selected release/project, messages, deliverables, unread notifications and status events. Agents may message only when real executor/capability exists; otherwise show availability honestly. Agent-produced progress must match persisted tasks and evidence. Separate authenticated structured approval actions from ordinary chat messages.

For ASCAP/BMI, MLC, SoundExchange, copyright and distributor workflows, agents prepare validated packets and send a task/review request; the person sees source information, verifies, requests changes, and personally submits through the official website when required. Use only approved APIs or provider-permitted, supervised browser assistance, otherwise guided manual entry. An approval or draft is not an official registration receipt. No unauthorized scraping, CAPTCHA/MFA bypass, false claims, or silent external submissions.

## 8. FUTURE PERSONALIZATION AND ACHIEVEMENTS — DESIGN HOOKS NOW, IMPLEMENT LATER

Prepare stable configuration contracts for `cabinet_color`, `trim_finish`, `wall_material`, approved palette/version, and label-specific saved material settings; include default/revert, tenant-scoped persistence and simple material application hooks. **Do not fully implement a decorating marketplace now.** Keep key meshes/materials separable through export.

Prepare a data-driven gold/platinum plaque wall with slots and a future `AchievementDefinition` / `VerifiedMilestone` registry: verified 100,000 plays, 1,000,000 plays, or other configurable achievements; clear source/platform/metric/date/ownership validation; awarding only from authorized verified evidence; associated congratulations in Agent Inbox and an optional celebration animation/effect. **Do not unlock awards from mocked analytics.** Gold record plaque art is part of the existing approved studio identity. Users may personalize decor in a later milestone without changing release-agent backend logic.

## 9. REQUIRED VALIDATION AND EVIDENCE

Do actual independent GLB load/texture/animation checks and browser walkthroughs, not only build passes. Provide tests for: loading/spawn; WASD+pointer lock; Shift/E/Esc; collision through walls/desks; click/keyboard/mobile selection; Carla overlay and idle fallback; Eric tablet overlay and animation fallback; Executive/Builder direct workstation access; close UI/resume exact position; session refresh handling; public demo privacy and private label membership; 2-label isolation; no private R2 downloads anonymously; browser error/reduced-motion/accessibility; screenshot comparisons of **all four approved dashboards**; customer/engineer message regression; provider settings and release draft regression. Profile load times, FPS/frame budget, draw calls, GLB dimensions/texture sizes; record measurement device and browser. Save screenshots, source paths, output asset hashes, tests, current SHA, deployment URL/environment, migrations and known unfinished items. No fake screenshots or false DONE statuses.

## 10. PRIORITY / SEQUENCE — ONE COORDINATED PLAN

**Current parallel increment (already started):** verify Blender export + actual 3D room loader, four approved dashboard routes/shared shell, and separate Agent Inbox. Do not duplicate active work.

**Next interaction milestone (immediately after current work is testable):** implement camera controls, collisions, interaction registry, correct overlay/focus/pointer lifecycle, Carla/Eric selection and Executive/Builder station access. **This is the next targeted work, not cabinet decorating or locomotion expansion.**

**Next business-utility milestone:** connect dashboard panels and employee chats to real persistent tasks, release evidence, approval cards, packaged assets, and working controlled skill executors, without claiming actions unsupported by the current backend. Complete/verify the actual Release Engine where still unfinished.

**Later experience milestones:** expanded action/gesture/tablet/walk animations, additional approved Executive/Builder meshes, studio materials customization, verified stream milestone plaques and celebratory interactions, richer voice sessions and eventual Unreal MetaHumans. Retain A&R data intelligence from approved/permissioned sources and royalty-recovery roadmap; do not defer business utility indefinitely for cosmetics.

For every milestone record what is **DONE/TESTED, IN PROGRESS, BLOCKED, DESIGNED ONLY, or DEFERRED**. Update `BUILD_STATUS.md`, `TRACEABILITY.md/json`, decisions, and v2.2 docs as actual work changes. Use additive migrations; backup before any approved production migration; no conflicting deployments or destructive merges. Approval is required before unnecessary production migrations, major access changes or irreversible external actions.

## 11. WHAT I EXPECT FROM YOU NEXT

First, tell me in one concise status table what actually finished from the three parallel workstreams, which `.blend` files and GLBs exist, which animations were verified, whether the four dashboards/Agent Inbox work, and which commit/deployment contains each. Do not imply public `/label-world` is complete if it still renders a foundation preview.

Then give me an ordered, file-level plan and implement the **first missing, independently testable increment**. Do not pause for the missing Executive/Builder meshes or extra Carla animations. Provide the direct browser demo: enter real headquarters, walk with WASD, approach Carla, press E, open approved Researcher UI, close it and continue walking; approach Eric, press E, open approved Reviewer tablet, close it and continue. Executive and Builder dashboards must open through workstations or direct navigation. Existing Studio2U stays unchanged. Demonstrate with actual browser recordings/screenshots, test evidence, Git SHA and deployment link.

**This is a real interactive virtual label operating system—not a mock 3D room and not an unconnected HTML dashboard. Complete both halves and connect them.**
