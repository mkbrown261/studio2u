# v2.2 acceptance matrix (interactive HQ + dashboards)

## Test evidence, not promises
Every test needs environment (localhost/preview/production), full git SHA, actor/label, actual input, output/assertion, pass/fail and screenshot/video/log where relevant. Build-only checks are not equivalent to browser acceptance. The last agent update describes running workstreams, not completed tests.

| ID | Area | Required observation |
|---|---|---|
| HQ-01 | Source preservation | Original `.blend` unchanged; export-copy path and full asset inventory recorded |
| HQ-02 | GLB | Each room and Carla/Eric asset loads independently; materials/textures/rig normals scale correct |
| HQ-03 | Animation | Real named clips enumerated and play; missing greet/tablet handled via idle fallback |
| HQ-04 | Scene | Public `/label-world` loads accessible non-sensitive room; error/skip path usable |
| HQ-05 | Camera | WASD and mouse look only after intentional Explore; Shift allowed; camera remains in bounds |
| HQ-06 | Collisions | User cannot pass through walls, floor, desk, or closed doors; valid paths remain usable |
| HQ-07 | Inputs | E/click/tap select nearest target; Esc and mobile escape work; focus restored |
| HQ-08 | Carla | In room E opens matching Researcher dashboard; all modules accessible; no fake live stats |
| HQ-09 | Eric | In room E opens matching tablet Reviewer and correct release context; no fake PASS |
| HQ-10 | Executive/Builder | Missing meshes do not block workstation or direct-route dashboards |
| HQ-11 | Resume | Close overlay and return to same camera pose, movement working without scene reload |
| HQ-12 | Direct UI | All four dashboards and Inbox work when WebGL disabled/unavailable |
| HQ-13 | Public/private | Anonymous room cannot access release/royalty/messages/keys/customizations; member roles checked server-side |
| HQ-14 | Tenant isolation | Two labels' records, agent chats, achievements, and provider keys never cross |
| HQ-15 | Legacy | Booking messages, engine/customer dashboards and site layout unchanged |
| HQ-16 | Visual | Four actual-browser screenshots compared at matched size to approved reference PNGs |
| HQ-17 | Performance | Device/browser specified; measured loading, draw calls, GLB sizes, FPS and frame time |
| HQ-18 | Input accessibility | Keyboard focus, screen reader UI alternative, reduced motion and touch fallback validated |
| HQ-19 | Separate Inbox | Messages/approvals persistent, agent sender verified server-side, zero booking-message regression |
| HQ-20 | Achievements | Placeholder objects only until verified sources; no mocked 100k/1M plaques awarded |
| HQ-21 | Customization prep | Named export objects/material regions exist for cabinets and plaque anchors |
| HQ-22 | Deployment | Branch HEAD, deployment ID, production-migration approvals and release comparison recorded |

## Required recorded walkthrough
1. Open `/label-world` as public visitor; room loads without private data.
2. Sign in as allowed label member; start Explore; walk with WASD and mouse look; observe collisions.
3. Approach Carla; E; her available idle remains stable; actual A&R UI opens, mouse unlocked, chat scoped to tenant.
4. Close; return to prior room pose. Approach Eric; E; Review tablet UI opens with correct label/release; test version-aware reviewer states.
5. Close; return; approach Executive/Builder workstations; both workspaces open even with missing avatars.
6. Disable WebGL; navigate all four workspaces and AI Employee Inbox directly.
7. Repeat access checks from a different label and anonymous browser; no leakage.
8. Confirm original Studio2U human messaging, booking and provider setting smoke tests.
