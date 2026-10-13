# Four-agent dashboard implementation map

Approved source: the four founder screenshots and 2026-10-12 four-agent directive. These are actual React interfaces, with an explicit demo toggle off by default. The original Studio2U stylesheet and booking UI are not changed.

Shared files: `src/client/label-world/App.tsx`, `ui.tsx`, `workspaces.tsx`, `public/label-world-ui.css`. `Headquarters.tsx` is the separate actual Blender scene client supplied by the headquarters implementation. One application shell, one label selector, one provider dialog, one conversation panel, and one registry drive all four routes.

## Shared components and states

| Component | Source / interaction | State and acceptance |
| --- | --- | --- |
| App shell, navigation, agent registry | `/label-world`, `/label-world/agents/{researcher,reviewer,executive,builder}`; history/popstate and direct links | Public headquarters tour; private agent routes use existing server authentication. Agent click opens the same workspace from scene or navigation. |
| Label context | GET/POST `/api/label-world/labels`; selected label drives every request | Empty selector / create label, loading, HTTP error, role badge. Changing labels clears release selection and remounts employee-specific state. |
| Release creation / selection | GET/POST `/labels/:labelId/releases`; existing Fast / Managed intake | Creates actual drafts plus four persistent follow-ups. Viewer controls disabled; server authorization authoritative. No distribution claim. |
| ProviderSettings | Existing `/providers`, `/providers/:id/{connect,disconnect,models}`, `/labels/:labelId/reasoning/{settings,test}` | Encrypted personal BYOK; account catalog refresh; Qwen exact model ID/region/workspace; live test output; missing-key/error states. Does not represent agent skill execution. |
| AgentConversationPanel | GET/POST `/labels/:labelId/inbox/:agentId/messages` with optional selected release and replay-safe message ID | Persistent AI Employees Inbox, not booking messages. WAITING_FOR_PROVIDER and FAILED explicitly displayed. Model replies are reasoning only. Loading, empty, error, compose disabled without label. |
| Chart / table / badges / panels / buttons | Shared UI primitives and scoped CSS | Keyboard focus, disabled capabilities, responsive tablet/mobile stacking. Demo statistics always labeled; no invented financial/research statistics shown by default. |

## Carla — `/label-world/agents/researcher`

| Reference module | React component and source | Interaction / state | Verification scope |
| --- | --- | --- | --- |
| Portrait, identity, focus tabs, search | Avatar / App / ResearcherWorkspace | Actual approved Carla portrait if available; fallback role icon. Search filters real release records; research search ingestion pending. | Route and selected label rendering |
| Six intelligence cards | Metric / typed UI props | Street Heat, Drill / Genre Momentum, TikTok, Instagram, Top 100, Emerging Tracks; empty unconnected default, explicit demo values/sparklines | Demo must never appear as live |
| Trend Watch | Interactive SVG trend chart | Genre toggles, range, platform and region affect illustrative series; native SVG series tooltips; source/freshness legend | Real connector ingestion remains pending |
| Genre Heatmap | Heatmap grid | Region context, visible color legend, observation details; illustrative index explained | Scoring of genuine observations pending |
| Viral Signals | Ranked signal list | Demo candidates can request employee explanation; no fabricated real sources | Source-backed signal records pending |
| Platform Tracking | Per-platform metric cards | TikTok sound usage, Instagram insights, YouTube video observations, Spotify artist metrics; distinct metric labels and unconnected states | Connector framework/provider data pending |
| Suggested Opportunities | Opportunity cards | Demo hypothesis -> employee question; evidence limitations explicit | Sourced opportunity persistence/assessments pending |
| Candidate Records | Shared Table | Complete columns and review action for demo candidates | Genuine candidate normalization pending |
| Artist Watchlist | Persistent record CRUD | GET/POST/PATCH/DELETE `/research/watchlist`; title, reason, HTTPS source URL; optimistic revision; role controls | Server tenant isolation / stale-write tests |
| Notes & Evidence | Persistent notes | GET/POST `/research/notes`; title and content, timestamps; links as source references for watchlist | Attachment upload not implemented |
| Talk to Carla | Shared conversation | Label-specific records supplied by inbox backend; no external research claim | Persistence / missing-provider behavior |

## Eric — `/label-world/agents/reviewer`

`ReviewerWorkspace` provides the rounded black tablet treatment, release overview, review coverage ring, left tablet navigation, checklist, evidence expansion, and final-approval footer. The same component opens from Eric's character selection.

| Reference module | Actual source / behavior | Remaining work |
| --- | --- | --- |
| Release Overview | Real selected release id/title/artist/type/version, existing GET workflow | Final delivered release fields pending |
| QA checklist and coverage | Nine explicit evidence rows. Basic recorded intake PASS; rights are PENDING/BLOCKED/NEEDS HUMAN REVIEW according to current-version workflow; unavailable checks NOT TESTED. Coverage is recorded-check count, never arbitrary delivery readiness. | Independent media / metadata validators pending |
| Audio, art, lyrics, credits, metadata, packaging | Distinct complete rows with requirement, source limitation, correction and owner description | Real asset inspection, confirmed lyrics, normalized credits, distributor rules, manifest validation |
| Release Files | Dedicated tab and honest empty state | Release upload service |
| Version History | Real current intake version; legacy intake/revision control link | Historical file/package records |
| Team Comments | Dedicated tab and shared inbox handoff | Team collaboration records |
| Distribution Preparation | PREPARATION ONLY with target distributor and no fake submit | Verified adapter/manual package handoff |
| Final Approval | Dedicated tab and disabled action; no package version available | Exact package-bound owner approval and invalidation |

## Executive — `/label-world/agents/executive`

| Reference module | Actual source / interaction | Remaining work |
| --- | --- | --- |
| Gold identity/globe banner | Executive role and icon, no invented employee mesh | Future approved portrait / mesh |
| Revenue / streams | Unconnected default; explicitly labeled financial demo possible | Verified financial/streaming ingestion |
| Active releases / artists | Actual release count / distinct artists in release drafts | Full artist catalog |
| Label Overview / Revenue Snapshot | Donut / period-filtered stacked chart in demo; default evidence-aware empty | Real imported accounting categories/history |
| Release Pipeline | Actual current intake drafts in Planning, no invented task progression; Review/Production/Preparation sections retained | Durable release workers / verified completion stages |
| Pending Approvals | Existing registration tasks AWAITING_APPROVAL; inspect via legacy rights controls | Campaign / package approval services |
| Agent Activity | Existing tenant-scoped task events, no invented autonomous actions | Running workers |
| Priority Alerts | Current incomplete release intake records | Fine-grained validator-backed alerts |
| Rights Follow-ups | Real persistent PRO/MLC/SoundExchange/Copyright tasks and reason/status | Scheduled processing and receipt verification |
| Marketing Readiness | Missing/not-tested campaign assets shown per actual release | Campaign service |
| Executive Notes / label goals | Persistent user-recorded research notes with Executive prefix; discuss goals with real inbox | Dedicated goals/strategy schema |
| Assignment / delegation | Discuss task requirements; assignment action disabled | Authorized executor / tasks mutation |

## Builder — `/label-world/agents/builder`

| Reference module | Actual source / interaction | Remaining work |
| --- | --- | --- |
| Header / full tab strip | Release Builder, Beat Lab, Song Assets, Lyrics & Vocals, Credits & Splits, Catalog, Versions, Tools; focused module highlight | Further focused views |
| Beat Brief | Editable and persistent via GET/PUT `/releases/:releaseId/workspace`; real provider conversation refinement | Audio feature inspection / approved generation |
| Song Assets | All category tabs and empty states; upload disabled | Secure release media storage/inspection |
| Cover Art | Art preview slot, revision thumbnails, generate/import capability state | Actual uploads, inspection, generated asset service |
| Lyrics Intake | Editable persistent draft; From Vocals unavailable; AI Assist uses real inbox | Transcription/alignment and human confirmation |
| Credits & Splits | Local draft fields distinguish composition/master/distributor revenue; legal inference prohibited; explicitly not persisted | Canonical normalized credit storage / agreements / ownership confirmation |
| Release Package Builder | Actual read-only release intake; complete package-files list with missing states; no fake successful package | ZIP, checksums, report, package approval |
| Catalog Organization | Persistent catalog string and tags combined in draft record | Normalized folders/tags/asset associations |
| Version History | Real release version, workspace revision, legacy intake link | File/package version history |
| Connected Tools | Suno / Higgsfield / Genjitsu / distributor sections with accurate Not connected / Unverified labels | Working current-user creative adapters |
| Task Queue | Real GET `/tasks`, no fake progress or renders | Worker execution/retry outputs |
| Talk to Builder | Shared inbox, actual selected release context | Scoped business tools |

## Acceptance and evidence boundaries

Frontend bundle syntax checked with esbuild. API/storage tests are owned by the workspace service test suite; the root implementation records exact results and browser screenshots. Milestone A visuals require screenshots at reference-comparable desktop dimensions plus mobile layouts before declaring visual verification. A rendered card does not establish its underlying business integration.

Blueprint scope is retained: all 23 skill YAMLs remain DESIGNED_NOT_IMPLEMENTED until their actual tool execution, permissions, evidence and evaluations are implemented. Watchlist/note CRUD and reasoning conversations are helper services, not promotion of full employee skills to implemented status. Human approval / ASCAP browser handoff remains a separate controlled service.

## Browser verification — local synthetic fixture, 2026-10-12

Actual IAB browser checks at `http://127.0.0.1:8791/preview-login`, not production customer data:
- All four deep routes loaded their corresponding complete modules. Desktop screenshots at a 1586×992 viewport: `docs/evidence/ui-researcher.png`, `ui-reviewer.png`, `ui-executive.png`, `ui-builder.png`. Carla and Eric use the approved Blender portrait renders.
- New Fast Release through the React modal succeeded; actual selected draft appeared in Builder/Reviewer/Executive and four separate persistent follow-ups appeared in Executive.
- Beat brief, lyric draft, and catalog PUT saved revision 1; reload visibly restored them. Credit entries explicitly remain local and are not included in the save request.
- Builder inbox POST saved a user message and visibly showed WAITING_FOR_PROVIDER. No assistant reply or completed external action was manufactured. History survived subsequent route navigation.
- Research watchlist creation and optimistic revision edit succeeded. Research note saved and was visible after navigation.
- Demo mode enabled only by explicit checkbox; changing range to 7 days/platform TikTok updated chart accessible label and candidate filtering, and disabling Drill reduced rendered chart series to four.
- All four mobile routes checked at 390×844. Document width equalled viewport width (390px); no outer horizontal overflow. Screenshots `docs/evidence/ui-mobile-{researcher,reviewer,executive,builder}.png`. Wide record tables retain their own horizontal scroller. Viewport override was reset afterward.

Visual comparison: shared midnight/gold shell, Carla six-card/chart/heatmap/list/table hierarchy, Eric rounded tablet/checklist, Executive gold strategic banner/pipeline/donut/bar panels, and Builder numbered creative cards/metadata/package/tool hierarchy follow the supplied references. Corrections made after comparison: remove default white body margin, compact research/chart/table rows and reviewer checklist, place Builder package files beside metadata, use actual Blender portraits, and stack responsive panels.

Remaining visual differences are explicit: dashboards scroll vertically beyond the one-frame reference height; source-dependent imagery and album art remain empty rather than fabricated, employee inbox is empty until real messages exist, Executive/Builder portraits are role icons until approved identities exist, and simulated research artwork uses labeled monograms. This is a working visual implementation, not a pixel-identical recreation or a claim of completed external analytics.

No live paid provider generation was tested in this UI session because no provider key was connected. The initial public Three.js entry in IAB reported WebGL unavailable and an earlier scene-unmount error; headquarters verification belongs to the separate native Safari scene check. Fresh direct employee routes produced no additional React UI error in the observed log.
