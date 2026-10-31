# End-to-End Workflows

## W1 — First vertical slice: song to release package and campaign brief
1. Customer creates label, configures branding and selects artist.
2. Upload song, cover art, credits, lyrics/owned footage if available; preserve originals and checksums.
3. Executive creates durable release project and task graph.
4. Researcher obtains verified, source-linked release requirements; unknown external specs marked pending verification.
5. Catalog Manager maps recordings, compositions, contributors and identifiers; flags missing fields.
6. Producer/Builder organizes files, validates formats and assembles release package.
7. Release Manager produces tracklist, manifest, readiness report, ZIP.
8. Marketing Manager creates content calendar, captions and short-form video brief.
9. Creative Production Gateway optionally queues Higgsfield/other approved video job after cost/rights approval; if not integrated, leave as draft/unavailable.
10. Reviewer runs deterministic checks; flags legal and ownership uncertainties.
11. Executive presents deliverables, unresolved issues and approvals.
12. User downloads artifacts and optionally authorizes supported publishing/distribution actions.

Acceptance: files genuinely processed; all actions logged; downloadable artifacts match manifests; tenant isolation; no fabricated completions; task states visibly animate in Three.js.

## W2 — A&R discovery
Customer sets genres (e.g. drill), markets, sources, frequency. Agent queries approved feeds, deduplicates findings, retains source/date/metric provenance, scores trends with explicit uncertainty, updates watchlist, requests follow-up approval. Never assume social hashtag access or scraping permission.

## W3 — Publishing and copyright
Collect songwriter/publisher/ownership data, validate splits and documentation, distinguish composition vs sound recording, prepare ASCAP and US Copyright Office submission packets, obtain owner review, submit only via verified authorized method, store receipts and confirmed statuses. No universal free federal copyright filing.

## W4 — Creative and social
Campaign brief -> rights/source-footage check -> creative storyboard -> cost estimate -> owner approval -> approved video-generation provider -> retrieve video -> technical/brand QC -> post drafts -> owner approval -> authorized social API publish/schedule -> receipt -> permitted analytics. Third-party video reuse requires rights.

## W5 — Future connected rooms
Each agent has room/workstation assignments and a task-to-animation map. Navigation between modular rooms must not restart jobs. Additional departments are content modules, not new backend instances.

## W6 — Founder FAST_RELEASE -> royalty follow-through (v2 priority)
Artist uploads record -> automatic duration/technical inspect -> tentative lyrics/hook transcription -> minimum distribution rights attestation/clearance -> distributor-specific package -> reviewer evidence -> artist approval -> authorized delivery or manual UnitedMasters handoff -> actual confirmation receipt -> immediately queued PRO/MLC/SoundExchange/copyright readiness & follow-up jobs -> ongoing registration status until confirmed, not silently discarded. This reproduces the founder's preferred low-friction release sequence while fixing paperwork deferral risk.

## W7 — Managed publication
Release metadata plus writer/publisher affiliation and splits intake -> separate composition/master rights validation -> PRO/MLC/SoundExchange eligibility and official preparation packets -> approved release package -> separate authorized submission/receipt tracking per service. Form prepared does not mean registered.

## W8 — Producer beat collaboration
Artist requests beat using mood/tempo/genre/original inspiration -> Producer writes original beat brief -> selects authorized music generation provider (e.g. Suno only when permitted) -> obtains spend approval -> async generation -> stores audio, prompt/license/provenance -> artist reviews versions -> catalog registers approved master with contributor/rights review. Manual creative brief if no supported provider.

## W9 — Videographer -> Short-Form Editor -> Social Manager
Artist uploads authorized portrait and optional clothing/shoe references -> confirms likeness consent -> Marketing selects song hooks/campaign goals -> Videographer creates concepts/shot list/storyboard -> artist selects -> authorized Higgsfield or alternate adapter renders real footage -> Editor uses verified Genjitsu provider **if available**, otherwise a supported local video editing pipeline -> versions in 9:16 + applicable platform presets -> Reviewer checks technical, brand, rights and source assets -> artist approves -> Social Manager schedules/posts through authorized accounts or guided manual handoff -> stores provider receipts/analytics.

## W10 — A&R research and campaign feedback
Sourced chart/scene/trend research -> research dossiers with dates/verified metrics -> emerging artist watchlists and hype hypotheses -> market-tailored marketing briefs -> test different original hooks/content formats on authorized pages -> retrieve actual platform metrics -> update hypotheses, not fabricated causal laws.


## W11 — Agent Inbox messages and action approvals (v2.1)
Authenticated label owner visits Studio2U Messages -> AI Employees -> chooses an agent/thread -> sees messages for their label only. A real task emits an internal event -> authorized worker creates factual agent message/unread notification -> owner reviews linked artifact and may reply -> agent uses reply as new input but NOT as legal approval -> structured approval is created/bound to source revision -> owner explicitly approves/rejects/requests changes -> action and result are audited. Browser/3D not required; booking messages remain isolated.

## W12 — PRO registration guided human submission (v2.1)
Publishing Admin gathers composition, writer, publisher and splits -> verifies source/provenance -> checks current ASCAP/BMI/other provider requirements -> generates revisioned packet/form field map -> sends Agent Inbox approval request -> owner verifies fields/splits -> chooses approved integration or manual official-site handoff -> owner submits official form where applicable -> uploads receipt or approved provider status check -> reported status stays pending until evidence verified -> durable royalty follow-up continues. No unapproved automated browser submissions.

## W13 — Artist hires an agent and optionally talks to them (v2.1)
Choose role -> list skills and capability requirements -> connect permissible API/OAuth or select guided handoff -> set name/voice/appearance/budget permissions -> perform capability dry-run -> agent appears in Inbox regardless of mesh -> text conversation supported when runtime exists -> optional real-time speech with consent, interrupt and text fallback -> agent delegates only through authorized tools/approval. Future MetaHuman lip sync is a separate renderer milestone.

## W14 — Royalty recovery request (v2.1)
Artist asks “Help me find uncollected royalties” -> Royalty Agent gathers authorized catalog/ownership records -> checks collection mechanisms and eligibility without guaranteed money -> prepares evidence-linked per-organization checklist (PRO, MLC, SoundExchange, distributor) -> asks questions in Agent Inbox -> owner reviews, submits permitted claims or manual official forms -> receipts tracked and scheduled follow-ups continue until verified or legitimately closed.


## ICM-inspired context increment — 2026-10-13
Context workflow IDs: review_release, research_artist, coordinate_label, prepare_release. The loader selects from server-known employee and stored release mode. Existing lw_tasks provide status/retry/artifact checkpoints; context reload revalidates membership/current versions. A model explanation does not complete or approve business work. Unknown routes/operations fail controlled; mandatory context over budget requires a narrower request.
