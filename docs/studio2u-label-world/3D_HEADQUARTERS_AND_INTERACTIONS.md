# Scene, camera, collisions, UI and agent interactions — product/engineering specification

## 3D user journey
Public visitor opens `/label-world`: see a sanitized interactive studio or clearly labeled demo room with optional sign-in. Authenticated label member opens private version: correct label decor and authorized agent/task panels. Camera enters safe spawn; explicit Play/Explore action starts first-person pointer-lock mouse controls. User walks with WASD, Shift optionally increases speed, E interacts with nearest focusable employee/workstation/prop, Esc unlocks or closes UI. Touch provides virtual joystick + look drag + action button. Keyboard users and WebGL-ineligible visitors can use all business tools via direct dashboard navigation.

## Interaction architecture
`ExperienceShell` contains: `SceneCanvas`, `SceneAssetRegistry`, `ExplorationController`, `CollisionWorld`, `InteractableRegistry`, `InteractionPrompt`, `AgentAnimationController`, `OverlayManager` and `AccessibleDashboardNavigation`. UI overlays render into ordinary HTML/React (portal outside Canvas) and are business-domain authoritative via API, not via 3D scene local state. Avoid baking business state into glTF. One interaction ID maps to `kind`, `objectId`, `requiredRole?`, `targetRoute`, `contextResolver`, `maxDistance`, `displayName`, `optionalAnimationCue`, `accessibilityLabel`, `active/enabled`. Server must recheck roles and data access even if UI/scene is modified.

## Mode state machine
`PREVIEW -> LOADING -> EXPLORE -> TARGET_NEAR -> INTERACT -> UI_OPEN -> EXPLORE` and escape/error branches. First-person pointer lock is requested only from a direct gesture. On opening a panel: save camera location, yaw/pitch and selected label/release context; suspend movement and look; release pointer lock; focus UI panel; do not unmount scene. On UI close: restore scene focus and camera pose; offer user-initiated re-entry to pointer lock, because browsers restrict automatic lock acquisition. Esc closes UI first if open, otherwise exits mouse lock. Support route deep-link open without ever mounting WebGL.

## Camera and movement quality
- Upright perspective camera (initial eye-height parameter), scalable to rooms and world units; mouse look with pitch clamp; move speed scaled by `delta`/elapsed frame time; optional sprint modifier, no unintentional jumping or flying.
- Collision blockers for walls, floor and large furniture. Use simplified collider mesh/capsule and broad-phase or fit-for-purpose physics; avoid expensive per-triangle interaction for all decorative objects. Prevent tunneling, spawn-inside-wall, floor falls and clipping at doors/room seams. Teleports/fast travel only through explicit accessible nav.
- Click/touch picking via raycasting or proximity plus explicit target registry. Outline/hint prompt; only one focused target; interactivity works with keyboard and screen reader equivalents.
- On low-end devices: lower pixel ratio/shadows/texture detail and allow direct dashboard; no forced WebGL for release operations. Add reduced motion + no flashing celebrations by default.

## Agent mapping and target fallback
| Target | Available physical asset | Action | Fallback |
|---|---|---|---|
| Carla — Researcher | Blender mesh+rig reported | A&R dashboard + Talk to Carla | idle-only animation; menu route |
| Eric — Reviewer | Blender mesh+rig reported | tablet-styled Release QA dashboard + Talk to Eric | idle-only animation; menu route |
| Executive workstation | mesh pending | Executive dashboard | workstation/direct route |
| Builder workstation | mesh pending | Builder/Producer workspace | workstation/direct route |

Interactables include room doors/waypoints, cabinet color controls (later), plaque slots (later). Show missing animations/models as pending in data, not as finished props. A successful interaction is *opening the real dashboard for the correct authorized label*, not playing a theatrical gesture.

## Public vs private boundary
Public room holds generic GLBs and sanitized static labels only. No unguarded task/release/agent inbox/financial APIs, hidden text in glTF containing data, or private R2 asset keys. Private app uses session auth and label membership/RBAC for every endpoint. Refuse unauthorized IDs server-side. Public placeholder agents must never send messages or take actions as a customer. Audit public-to-auth transitions and deny leaks through cache, source maps, image previews and presigned URLs.

## Deployment testing
Capture actual first-person route screenshot and recording, WebGL errors, GLB fetch responses and size, camera spawn and in/out overlay position, pointer lock behavior, keyboard focus cycle, mobile input, frame time/p95 FPS, draw calls, texture memory estimates, two-tenant authorization, public browsing privacy and direct dashboard fallback. Label an implementation DONE only after these checks pass in its actual deployment environment.
