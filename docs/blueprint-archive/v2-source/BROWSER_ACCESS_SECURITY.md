# Browser / Computer Assistance — Explicitly Controlled Capability

## Problem
Some distribution, PRO and creative services may lack suitable public APIs for all account operations. The founder wants agents to reduce frustrating repetitive forms and, if feasible, help operate authorized web workflows in a browser.

## Safe priority order
1. Official API/OAuth and approved partner integration.
2. Approved export / guided user submission with form-ready information.
3. **User-supervised computer/browser assistance** only where legal, contractual, security and provider rules allow. Prefer isolated per-tenant cloud browser or expressly authorized computer-control environment; explicit session consent, scoping and audit are mandatory.
4. If automation is forbidden/unsupported, stop and offer manual continuation. A password or user permission is **not** permission to violate platform terms.

## Architecture if approved
- Tenant-isolated sessions. The user establishes login directly into the intended service; agent never reads or stores raw password in model context.
- Secrets in vaulted token systems as applicable; cookies/session controls encrypted and scoped with short lifetime where permitted.
- Domain/action allowlist; blocked unknown downloads/uploads/third-party endpoints; no hidden tabs or unfettered desktop filesystem access.
- Present action previews and confirmations before legally binding declarations, registration submissions, publishing, payments, and distributor delivery.
- User can pause/terminate access immediately; session recordings/logs must respect sensitive content and retention policies; redact secrets.
- Provider captcha, MFA and anti-bot restrictions are not to be bypassed. User resolves interactive authentication.
- Post-action state stored only after explicit verifiable receipt/confirmation. Screen text interpreted by AI can be wrong; cross-check status.

## Access model
`NOT_CONNECTED`, `CONNECTING`, `CONNECTED_READ_ONLY`, `CONNECTED_DRAFT`, `CONNECTED_SUBMISSION_ELIGIBLE`, `NEEDS_USER_ATTENTION`, `DISCONNECTED`, `UNSUPPORTED`. Permissions set in backend per tenant and provider, not prompts alone.

## Explicit non-goals
No covert remote monitoring; no unrestricted background desktop control; no credential sharing through chat/prompts; no attempts to evade third-party anti-automation controls; no fabricated submission statuses. This is a capability to evaluate per service, not a guaranteed first-version feature.
