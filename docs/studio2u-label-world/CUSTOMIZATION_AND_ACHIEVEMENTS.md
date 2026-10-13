# Later-stage label customization and verified achievement plaques

## Not the immediate milestone
These are customer-delighting options and should not displace current GLB, dashboards, Inbox, 3D interactions and release-engine verification. Prepare asset IDs and schema hooks now; implement UI and entitlement later.

## Cabinet and room customization
Configurable `label_room_appearance` data scoped to label ID, versioned and access-controlled. Stable fields: `cabinet_front_color`, `cabinet_trim_color`, `wall_finish_id`, `selected_lighting_preset`, `accent_color`, `updated_by`, `revision`, `updated_at`. Palette uses supported accessible color/material presets. UI: select a cabinet/finish hotspot, see approved palettes, live shader preview, Apply, Cancel, Reset; persist only with authorized user confirmation and optimistic version checking. Scene loads saved appearance on login; default for public visitors; provider-agnostic backend. Separate material instances only where customization warrants; preserve render batching where possible. Ensure screenshots reflect saved setting after refresh and another authorized session.

## Gold record / streaming milestones
A persistent, per-label `AchievementDefinition` and `VerifiedMilestone` records separate career/marketing milestone from official RIAA/industry certification. User-suggested examples: 100,000 verified plays, 1,000,000 verified plays (by specified platforms and eligible metric), first release, first verified licensing deal, or campaign milestone. Do not claim gold/platinum/RIAA certified based on a raw stream count. Each award record references artist/release, source, exact metric semantics, observed interval, verified time, evidence and validator. On true, non-duplicated event: record achievement, display plaque in stable physical wall slot, send message/congratulations to AI Employee Inbox, optionally fire reduced-motion-compatible celebration. Revocation/correction path must remove unsubstantiated achievements.

## Object pipeline and tests
Named GLB object groups/plaque anchors reserved now; do not pre-generate dozens of unique textures. Scene renderer receives a sanitized, authorized appearance/achievements DTO, no hidden keys. Tests: role/access, two-label isolation, user preferences persist after refresh, public never sees private milestones, awards cannot be triggered by browser input or demo analytics, event dedupe, source evidence version mismatch and revocation.
