# Studio2U Label World — Master Plan v2.2 / Read first
**Document update date:** 2026-10-12. **Type:** versioned blueprint expansion and consolidated implementation handoff. **No project code or production changes were made by this document update.**

## Immediate single-source handoff
**Copy one file to your coding agent:** `ONE_PROMPT_FOR_CODING_AGENT.md`. That is the consolidated instruction covering all the latest user decisions. Older `NEXT_CLI_DIRECTIVE.md` / `CLI_HANDOFF.md` remain historical planning records; where implementation sequence differs, the newer single prompt governs **ordering only**, never deletes existing requirements. The complete previous v2.1 content and original 23 skill contracts remain in this package.

## User-confirmed direction
- The original Studio2U website UI is **not to be restyled**. Label World is a separately themed application at `/label-world` connected to existing authentication/backend services.
- The **four approved user-provided visual dashboard mockups** are source of visual design truth (images embedded in `reference_ui/`). One shared React dashboard shell and four routed workspaces: Carla/Researcher; Eric/Reviewer tablet; Executive; Builder/Producer.
- The **Blender headquarters is a real existing art-work project**, but as of the last verified GitHub branch commit `02848fc`, no exported GLBs or a Three.js scene loader existed on that branch. The user subsequently reported the engineering agent has begun GLB export/room loading, dashboards and AI Employee Inbox in parallel. Their completion **must be verified; this plan does not claim they finished**.
- Only **Carla and Eric** have reported source meshes/rigs; their exact available clips must be audited. Executive and Builder meshes remain **pending**; their roles and dashboards cannot depend on character models.
- First-person **game-like exploration** is the first interaction mode; no custom player avatar required. WASD, pointer-lock mouse, E to interact, Esc to close/unlock, sensible collisions, mobile/touch controls and keyboard dashboard fallback.
- Agent selection invokes **one reusable interaction registry** and the same normal React dashboards. When a dashboard opens, mouse/camera controls pause and pointer lock releases; closing returns user to their original room location.
- Do not wait on missing locomotion/tablet animations. Existing idle is valid fallback; only play a clip if exported and verified.
- Public demo room must be sanitized; authenticated labels load private tasks, messages, assets, personal decor and achievements only through authorized endpoints.
- Future personalization: cabinet colors/wall materials/trim, with stable export IDs and tenant-scoped settings; future evidence-backed awards for streaming milestones and celebration notifications. Implement interfaces and asset hooks now; the full feature later.
- Separate AI Employees Inbox, ASCAP/BMI human submission handoff, royalty recovery, advanced A&R data connectors, voice and MetaHumans remain part of vision. No fabricated source analytics, external submissions or achievements.

## Suggested reading order
1. `ONE_PROMPT_FOR_CODING_AGENT.md` (the only instruction to paste).
2. `3D_HEADQUARTERS_AND_INTERACTIONS.md` (camera, collisions, modes, state machine, public/private).
3. `BLENDER_EXPORT_AND_ANIMATIONS.md` (non-destructive GLB and idle/fallback clip plan).
4. `DASHBOARD_OVERLAY_CONTRACT.md` (four UIs and 3D vs normal route).
5. `CUSTOMIZATION_AND_ACHIEVEMENTS.md` (future-proofing for cabinets and gold records).
6. `V2_2_ACCEPTANCE_TESTS.md`, `V2_2_TRACEABILITY.csv`.
7. Existing `START_HERE.md`, `CHANGELOG.md`, `REQUIREMENTS.md`, `DECISIONS.md`, `AGENT_INBOX_SPEC.md`, `APPROVAL_AND_BROWSER_HANDOFF.md`, `ROADMAP.md`, all 23 `skills/*.yaml` and 4 proposal contracts.

## Historical status vs current reported status
The coding agent previously reported that 3D export/room loader, dashboard UI, and Inbox services were *starting* in parallel, with a public visitor room planned. Do not convert `STARTED` to `DONE` without live browser evidence. The previous commit `02848fc` and deployed login/form-based Foundation Preview were independently inspected in the past discussion; recheck the active remote branch and production deployment. The blueprint never substitutes for a real build/test audit.
