# Four approved dashboard mockups + master shell + 3D interaction handoff

## Source of visual truth
`reference_ui/01_Carla_Researcher_A_and_R.png`, `02_Eric_Reviewer_Tablet.png`, `03_Executive_Command_Center.png`, `04_Builder_Producer_Workspace.png` are the already approved founder-supplied UI examples. Do not generate new images to replace them. Match layout/spacing/contrast/composition/components as closely as practical; inspect with side-by-side screenshot diffs at same viewport; maintain keyboard/mobile accessibility. Demo text and numbers are illustrative only, not verified factual metrics.

## Architecture
`LabelWorldLayout` shared: left nav + top bar + selected label + notifications + agent selection. `AgentWorkspaceSwitcher` selects a component by registry key. `AgentConversationPanel` is one reusable chat experience bound to agent/thread/entity context. `AgentOverlay` can show `ResearcherWorkspace`, `ReviewerWorkspace`, `ExecutiveWorkspace`, or `BuilderWorkspace` over the 3D room; direct routes show the same components without WebGL. Conversation messages, task outputs and approvals are fetched from authenticated tenant-scoped APIs, with proper idempotency, error/loading and unavailable states. UI may be pointer-lock-independent.

## Carla / Researcher
Required visual modules and contract: six trend cards (Street Heat; Drill/genre; TikTok momentum; Instagram buzz; Top 100 movement; emerging tracks), Trend Watch multiple series with range/genre/platform/region, Genre Heatmap, Viral Signals, Platform Tracking, Suggested Opportunities, Candidate Records, Artist Watchlist, Notes & Evidence, Talk to Carla. Each metric displays unit, time window, observed source, freshness and data state. No fabricated analytics or clandestine collection. Use licensed/permissioned APIs, authorized account insights, public permitted data and user-provided exports; note platform coverage differences. Carla's spoken/chat claim must be grounded in actual stored data and linked sources.

## Eric / Reviewer
Visually tablet-centric. Load current authorized release + exact package/artifact/version. QA categories: overview, audio, artwork, lyrics, credits/splits, rights, metadata, package, version history, reviewer notes, distribution prep and final approval. Clear states PASS, FAIL, WARNING, NEEDS_HUMAN_REVIEW, NOT_TESTED, BLOCKED. Clicking a check opens issue details/evidence and fix workflow. A green metric means actual validation ran, not a placeholder badge. `Talk to Eric` references real findings. Approvals bound to immutable revision and invalidated when artifacts change. UI opens from interaction or direct link.

## Executive
Strategic command UI: label overview, measured revenue/streams only with verified data, pipeline, pending approvals, agent activity tied to real persisted tasks, risk/rights followups, marketing readiness, Executive Notes, assignments/decisions, Talk to Executive. Executive role remains available with no 3D model; no invented performance figures or delegated job completions.

## Builder / Producer
Creative release UI: beat brief, song/stem/master assets, cover, lyrics intake, credits/splits, actual package assembly when implemented, catalog tags/relationships, version history, connected services and task queue, Talk to Builder. Show authentic connection status for Suno/Higgsfield/Genjitsu/UnitedMasters and honest fallbacks; source files/versions never overwritten. Builder role accessible via workstation and nav without a mesh.

## 3D interface transitions
Carla world target -> `showAgentWorkspace('researcher', labelId, context)`; Eric target -> `showAgentWorkspace('reviewer',labelId,selectedReleaseId)`; Executive/Builder workstations -> respective workspace. All use same `AgentOverlay` as routed screen. Prevent implicit full-page scene navigation/reload while interacting unless deliberate. Mouse unlock/focus restored via explicit user gesture after closing. For missing asset, click workstation/menu alternative.

## Invariants
Existing Studio2U public/engineer/customer UIs unchanged. AI Employee Inbox is distinct from booking messages. No client-provided agent identity impersonation, high-risk actions through chat text, mock data represented as real, cross-tenant record access, or implicit external submission. UI is the view on authoritative persisted backend state.
