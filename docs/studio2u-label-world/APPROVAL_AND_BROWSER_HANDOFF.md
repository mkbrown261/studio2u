# Human-Approved Forms and Connected Browser Workflow

## Product purpose

A central promise of Studio2U is eliminating tedious paperwork. Many music services may lack approved direct submission APIs. The best supported experience is **agent prepares everything, user reviews once, user submits where needed, Studio2U follows up on confirmation**. Never convert user willingness to share an account into blanket permission to automate a provider that prohibits that use.

## Provider capability decision tree

1. Verify provider-approved direct API/OAuth/partner integration: choose scoped API tool, explicit approval before submission, request provider status/receipt.
2. Otherwise, use official downloadable/exportable registration metadata or a human-guided handoff where the user copies/uploads prepared entries and submits in their own browser.
3. If the provider permits supervised browser assistance, offer an explicitly opted-in per-session browser workspace (isolated or expressly authorized local access). User logs in directly, solves MFA/CAPTCHA, can observe/pause/stop and reviews a final read-only screenshot/form summary before personally clicking submit.
4. If direct automation is disallowed or unknown, DO NOT autofill, scrape, replay sessions or bypass restrictions; use guided manual workflow. Provider-specific capability registry must be source-verified, dated and reviewed.

## Registration state machine

`NOT_STARTED -> INTAKE_INCOMPLETE -> PREPARING -> PREPARED -> WAITING_ON_USER -> USER_REVIEWED -> USER_SUBMITTED_REPORTED -> AWAITING_VERIFICATION -> VERIFIED_CONFIRMED` with branches `BLOCKED`, `REJECTED`, `NEEDS_CORRECTION`, `CANCELLED`, `NOT_APPLICABLE`.

Only provider-verifiable proof makes `VERIFIED_CONFIRMED`; a user statement alone gives `USER_SUBMITTED_REPORTED` or `AWAITING_VERIFICATION`, not confirmed. Store source, timestamp, exact work/recording, provider, submitted identity, evidence ref, verifier, confidence and next follow-up date. The “press submit” action belongs to the **human on the official site** when manual handoff applies, not a fake button in Studio2U that claims to have submitted externally.

## Detailed handoff example — ASCAP/BMI

1. User chooses PRO (ASCAP, BMI, other), composer/writer and publisher affiliations; gather verified IPI/CAE, work title/alternate titles, writer identities and shares, publishers, performers, durations/identifiers only if applicable to actual form.
2. Publishing Admin checks composition vs recording, split sums, disputed ownership, missing data and rule date/source. Does not assume UPC/ISRC are necessary for every PRO form.
3. Generate versioned `RegistrationPacket`, checklist, human-readable field map, supporting documents and optional CSV/export suitable for provider if supported.
4. Reviewer checks data consistency, source references, restrictions and form readiness. Executive or Publishing Admin sends Agent Inbox message with `ApprovalRequest` linked to the packet revision.
5. User clicks **Review Packet** and validates credits/shares. If service has approved integration, Studio2U can submit only with explicit approval and an approved capability. If manual provider portal, user opens official URL and completes/submits; any supervised prefill happens only if specifically authorized/permitted, otherwise assisted copy-and-paste.
6. User saves or uploads official receipt/confirmation. Status remains awaiting verification until confirmed through appropriate evidence; task/release cannot silently close. Follow-up reminders are scheduled with bounded retries and opt-out/preferences.

## Security: full-context concerns

- No password typed to an AI employee, chat message, screenshot, LLM tool output, or debug log. OAuth/token access where available, server-side encrypted storage and revocable scopes. Agent never receives raw secret; only approved capability lease.
- Browser session grants named domain, specific action(s), scope, expiry, user session control and conspicuous start/end notification. Default read-only; form entry after permitted explicit consent; legal attestation and final submit human-controlled where required.
- Absolutely no unattended local desktop monitoring, screen recording, global clipboard access, extension injection or sharing MFA tokens. Observe only authorized app/tab while consent active; avoid entire-display capture when a tab-specific share is possible.
- Screenshots/recordings may contain sensitive personal and ownership data. Minimize, redact, encrypt, set retention/deletion policies; prefer structured receipts over raw captures. Treat third-party webpage content as untrusted input and defend against prompt injection.
- Enforce permissions, budgets, rate limits, tenant scopes and approvals in backend. A system prompt is not a security boundary.
- No spoofed receipts, synthetic provider acknowledgments, claim of automatic distribution when user merely generated a package, or promise of royalties for every stream.

## Workflow states for inbox and frontend

UI should show exactly: **Packet ready**, **Needs your review**, **Open official site**, **Awaiting your submission**, **You reported submission**, **Pending verification**, **Confirmed with evidence**, **Needs correction**. Show what's left, the last checked date, and whose action is needed. Keep durable queue/reminders independent of user browser/3D scene.

## Tests

- Unconnected/disallowed provider returns `MANUAL_HANDOFF` rather than initiating browser automation.
- No tool call can submit from a mere chat reply; approved action consumes a server-issued nonce bound to subject revision and authenticated identity.
- Changed credits/splits invalidate pending approval and prepared packet.
- Cross-label packet/approval/receipt access rejected.
- Provider dashboard text is not blindly treated as official proof; missing verification remains pending.
- MFA/CAPTCHA/terms blocks are surfaced to human; no bypass.
- User can revoke browser access and credentials promptly; interrupted session leaves recoverable status without false confirmation.
