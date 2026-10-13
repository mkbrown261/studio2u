# Carla source milestone — 2026-10-13

Eric's first live review handoff was demonstrated on acbd044 / d2ce20fe.studio2u.pages.dev against production D1/R2, using the explicitly approved isolated synthetic QA account and label. WAV + deficient PNG uploaded through real UI; technical failure recorded; correction saved; corrected PNG passed new review; prior report retained; Inbox unread state persisted after logout/re-login; authenticated browser download matched stored report SHA-256 and size. Original website dashboard/logout still worked. Local API tests prove cross-label and same-label other-user denial. Raw command-line website access returns transport 403, so those requests are not claimed as successful. Login 404 was not reproduced on the current deployment; prior scoped login and static routing were preserved, not replaced with generic redirects.

Next source implementation: official YouTube Data API search.list (music category, video type, query, availability region, publication window, max ten) followed by videos.list snippet/statistics. Key is server-only; no paid LLM. Creator channel identity is shown as unverified artist identity. Unavailable metrics are null, not zero. No Spotify estimates, growth scores, inferred engagement or virality ranking. Source URL, provider IDs, published/observed times, query/region and raw values persist. Repeat requests create measurements; idempotent same request ID does not repeat API work. Global 80 / label 8 daily request caps protect the shared key; provider errors are sanitized.

Policy constraints: public YouTube observations and reports expire after 28 days. Separate private scheduled worker expires only label-world/youtube/ report objects and associated API rows daily, leaving all releases, Reviewer reports, CSVs, users and Blender files intact. API endpoints hide expired records immediately. No advanced derived metrics or extended retention approval assumed. Scheduled worker activation is not verified until deployment receipt exists.

CSV adapter: normalized-v1 with explicit column mapping, 256KiB/1000-row bounds, CSV quoting validation, HTTPS provenance, preview digest, source-authorization confirmation and duplicate fingerprints. Other platform raw exports are unavailable pending separate adapters. Original normalized CSV/mapping is included in the private source report. It is user-imported evidence, not independently verified platform data.

Reuses lw_tasks/events, employee messages and unread notifications. Additive 0023 adds observations and research reports. Carla dashboard, global employee Inbox and conversation use shared reports. Trend Watch shows measured snapshots, Platform Tracking reflects observed sources, Candidate Records show actual creator/track sources; custom heatmaps/virality/opportunity scoring remain unavailable until supported and permitted. Manual watchlist and Notes & Evidence remain working source-linked records.

Tests: node tests/label-world-research.mjs covers official endpoint fixtures, absent metric/identity truthfulness, hidden key, idempotency, persisted source-backed report/message, CSV parse/mapping/authorization/dedup, tenant isolation and expiration preserving CSVs. This is synthetic endpoint evidence; live YouTube connector and CSV browser workflow remain pending until actually exercised.

Official references:
- https://developers.google.com/youtube/v3/docs/search/list
- https://developers.google.com/youtube/v3/docs/videos/list
- https://developers.google.com/youtube/terms/developer-policies
- https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/

Unfinished: scheduled research refresh (manual repeat works), source permission expansion/OAuth, additional source adapters, future platforms, generic worker recovery, complete Executive/Builder aggregation and real artist commercial pilot. No complete product or commercial viability claim.

Activation preparation: production D1 backup completed (/private/tmp/studio2u-before-research.sql, 0600); additive migration 0023 applied successfully. Private retention Worker deployed with no public endpoint, daily scheduled trigger and version 54fa0f73-4952-433c-baa8-c158828c4a0c. Actual future scheduled run not yet observed; expiration code tested locally. Provided YouTube key stored as production Pages secret YOUTUBE_DATA_API_KEY, not printed/committed. Live source UI request still pending.


## Subsequent verified baseline — 2026-10-13
Earlier pending statements above are historical. Live verification on 15ba034/2095f412 collected 10 actual YouTube observations, imported one synthetic normalized CSV row, detected its duplicate and verified the authenticated report-download bytes/hash. See docs/evidence/carla-live-source-verification.json. The deployed 737e860 app preserves these services and actual internal summaries. Retention Worker version 9464cdb3-20bf-4c64-a90a-61a7d428f9cd has daily 03:00 UTC cron; deployment is verified but no scheduled-run execution is claimed here. Context tests now prove expired observations excluded from reasoning as well as source deletion fixtures.
