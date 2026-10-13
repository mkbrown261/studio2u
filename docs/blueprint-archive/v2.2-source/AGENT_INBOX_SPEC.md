# Agent Inbox — Canonical Product Specification v2.1

## Product promise

Every artist/label owner has a dedicated **AI Employees** inbox within Studio2U. It is separate from the existing **Client & Engineer Messages**. Agents send progress, ask questions, request missing songwriter/split data, provide deliverables, and seek explicit approvals. An artist can open the same agent thread from the website, a future 3D character panel, or voice interface. Tasks persist whether the 3D world is open or closed.

## Navigation/IA

Studio2U > Messages:
- **Clients & Engineers**: unchanged pre-existing booking messages.
- **AI Employees**: Label World conversations, including Executive, Producer, Researcher, Reviewer, Publishing, Royalties, Videographer, Editor, Social Manager.
- **Approvals**: cross-agent work requiring human decision; optional badge/count and dedicated inbox filter; approvals are distinct workflow records, not simple chat replies.

For a single label, show threads by agent with optional subthreads per project/release/campaign; for multiple labels, a label switcher isolates all views. UI: agent/avatar, agent role, latest message, unread count, label name, project link, task status, approval indicator. Filters: All/Unread/Needs My Approval/Blocked/Completed; search; pagination. Never cross-surface into booking messages without an explicit, authorized human action.

## Thread and message types

Conversation types: `AGENT_DIRECT`, `TASK_THREAD`, `RELEASE_THREAD`, `CAMPAIGN_THREAD`, `SYSTEM_NOTICE` (latter only if helpful). Sender types: `USER`, `AGENT`, `SYSTEM`; actor ID must resolve to an authorized user, a configured agent assigned to tenant, or a documented automation. Message kinds: `TEXT`, `TASK_UPDATE`, `QUESTION`, `DELIVERABLE`, `APPROVAL_REQUEST`, `APPROVAL_RESULT`, `ACTION_REQUIRED`, `ERROR`, `INTEGRATION_STATUS`.

Messages include created time, traceable sender, optional task/release/campaign IDs, safety-safe preview text, evidence links, visibility/read status, and idempotency key. Rich cards are rendered from **validated structured event data**, not arbitrary HTML/LLM markup. File attachments use existing/expanded R2 tenant-scoped asset IDs. A message can contain a link to a prepared registration packet, but does not contain any password/session cookie/API key.

## Human-in-the-loop approval UX

Examples:
- Publishing Admin: “Composition registration for [song] is prepared. Confirm the title, writer IPI and ownership percentages.”
- Royalties Agent: “Your SoundExchange catalog review found three recordings requiring owner verification. Review the evidence.”
- Videographer: “Higgsfield storyboard and quoted generation cost are ready. Approve the creative and spending cap.”
- Social Manager: “These five clips are ready for scheduled posting. Review captions and schedule.”

Each actionable card has: action title, affected entity and version, exact proposed operation, risk, required fields, evidence, external provider, approved capability, expiration/version, and separate actions `Review`, `Request Changes`, `Reject`, and `Approve` where appropriate. **Message itself is never an approval.** Only the explicit authenticated approval API can authorize an action. On provider website submissions, owner must confirm the current rendered official form and physically submit when the provider flow requires that; Studio2U then waits for evidence of acknowledgment/verification.

## Notifications and live updates

Initial: agent inbox works with standard GET/POST and refresh/polling. Add unread badge on global nav; optional in-app toast and email notification only with user preferences, dedup, rate limits and audit. Future: server-pushed live messages via transport appropriate to Cloudflare deployment. Keep transport replaceable (`poll`/SSE/DO/WebSocket). Voice UI uses separate low-latency audio session rather than D1 chat messages as the live-media transport; completed transcript and actions can be summarized into thread records with explicit privacy and retention controls.

## Suggested additive D1 design (logical, not a migration to run unreviewed)

- `lw_agent_threads(id, label_id, kind, agent_id, release_id?, task_id?, campaign_id?, title, last_message_at, created_by_user_id, created_at, archived_at, revision)`.
- `lw_agent_thread_members(thread_id, label_id, user_id, access_role, joined_at, muted_at, last_read_message_id)` with verified label membership. Alternative per-user read state is fine if atomic updates are tested.
- `lw_agent_messages(id, label_id, thread_id, sender_kind, sender_user_id?, sender_agent_id?, message_kind, body_text, payload_json?, task_id?, approval_id?, asset_id?, idempotency_key?, created_at, redacted_at)`.
- `lw_agent_approvals(id, label_id, thread_id, task_id, action_type, subject_id, subject_revision, request_payload_digest, preview_ref, requested_by_agent_id, requested_at, expires_at?, state, decided_by_user_id?, decided_at?, decision_reason?, execution_id?, provider_receipt_ref?)` OR extend and reuse the existing `lw_approvals` table if it already meets these semantics.
- `lw_agent_notifications(id, label_id, recipient_user_id, event_id, type, status, delivered_at?, read_at?, dedupe_key)`.

Every table needs tenant-aware composite foreign keys/indexes where supported, stable UUID/ulid IDs where appropriate, and indexes on `(label_id, thread_id, created_at, id)` plus `(label_id, user_id)` for unread/approval queries. Avoid storing unrestricted provider HTML, browser captures or credentials in message text.

## Suggested REST/API surface (illustrative)

- `GET /api/label-world/labels/:labelId/agent-inbox/threads?cursor=...` (tenant verified)
- `POST /api/label-world/labels/:labelId/agent-inbox/threads` (authorized owner/member)
- `GET /api/label-world/labels/:labelId/agent-inbox/threads/:threadId/messages?cursor=...`
- `POST /api/label-world/labels/:labelId/agent-inbox/threads/:threadId/messages` (human authenticated, idempotency)
- `POST /api/label-world/labels/:labelId/agent-inbox/threads/:threadId/read`
- `GET /api/label-world/labels/:labelId/agent-inbox/unread-counts`
- `GET /api/label-world/labels/:labelId/approvals?state=PENDING`
- `POST /api/label-world/labels/:labelId/approvals/:approvalId/decision` with expected version, CSRF, role permission, payload digest, and separate approve/reject/request-changes.

Worker-generated agent messages are emitted only by an authenticated internal service context after verifying tenant ownership and original task reference. Never accept a browser-provided `sender_kind='AGENT'` without server-side authorization. On high-risk operations, approval must be consumed atomically once, with idempotency key and audit log.

## Required acceptance tests

1. Tenant A cannot list/read/write/mark-read Tenant B threads, message attachments or approvals (return nonrevealing 404/403 as policy).
2. A booking customer with `?email=` cannot reach Agent Inbox or private Label World assets.
3. Existing booking messaging works unchanged, including unread badges, engineer auth, booking status gates and customer flow.
4. Two owners/team members have independent unread/read states and scoped permissions.
5. Unauthorized browser clients cannot impersonate agents or inject fake approval messages.
6. Approval created from task revision N becomes stale/invalidated when underlying release or form data change to N+1.
7. Reject/request-changes/approve all produce logged state transitions; double-click/retry cannot double-submit external work.
8. Only approved content/attachments are rendered; no unsanitized HTML, private secrets or untrusted document instructions treated as commands.
9. Agent inbox opens and shows persisted history without a running 3D renderer, and resumes after reload.
10. Notifications have deduplication, user preference controls and no duplicate high-risk alerts.

## Delivery sequencing

**Milestone A:** additive schema + secure API + independent Messages tabs, agent messages sent from deterministic task/registration events, unread counts; keep agents as `DESIGNED_NOT_IMPLEMENTED` until executed. **Milestone B:** task-bound approval cards, registration packets, secure deep links, manual user handoff. **Milestone C:** true conversation/model responses, streaming and voice. **Milestone D:** permitted supervised browser session previews, more providers, unified 3D/human communication. Never block upload/package completion on full inbox/voice implementation.
