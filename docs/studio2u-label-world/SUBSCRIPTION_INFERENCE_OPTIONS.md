# Model subscriptions and MCP — checked 2026-10-13

MCP lets an AI client use authorized Studio2U tools. The client supplies its own model execution under its own plan. It does not let Studio2U's website use that subscription automatically.

| Option | Classification | Practical requirement / verified boundary |
|---|---|---|
| Existing signed-in Codex using Studio2U MCP | VERIFIED_SUPPORTED | Native Codex0.160.1 read authorized synthetic release/research records; no additional Studio2U LLM key |
| Existing Claude Code using HTTP MCP | UNVERIFIED locally; officially documented | Same connector and OAuth; Claude Code not installed here, live session still required |
| Sign in with ChatGPT for commercial Studio2U website inference | ELIGIBILITY_REQUIRED | Selected commercial partner trial, approved client/scopes and user consent; Studio2U approval is not established |
| Eligible open-source ChatGPT plan application | ELIGIBILITY_REQUIRED | Official open-source registration and inference-scoped authorization exist; this is not evidence commercial Studio2U qualifies |
| Codex app-server with officially issued inference OAuth | ELIGIBILITY_REQUIRED | Documented app-server provider can use authorized Responses access; model catalog alone is not entitlement proof. No local subscription token copying |
| Own computer running Codex CLI/app-server | LOCAL_ONLY | Native client test works locally. A browser companion would need a separately verified commercial permission/security model; not built. Computer and companion must stay running |
| Claude Agent SDK/API or Claude Console CLI | REQUIRES_API_BILLING | API/Console credentials and appropriate workspace billing are separate from claude.ai subscription. Existing Studio2U providers remain available |
| Third-party website borrowing claude.ai login/rate limits | UNSUPPORTED without prior approval | Anthropic requires approval for third-party products offering claude.ai authentication/quota; no approval demonstrated |
| Claude Code local companion using a subscriber CLI | UNVERIFIED for this commercial product | Local CLI authentication exists; this does not prove permission to offer subscription inference to Studio2U customers. Do not build until approved |
| Claude Code hosted routine fire endpoint | EXPERIMENTAL | Documented routine-specific bearer token and subscription usage; creates a routine run, returns session ID/URL, no output streaming/read access. Not a general employee chat API; not integrated |
| Hosted provider-managed agent execution | REQUIRES_API_BILLING / ELIGIBILITY_REQUIRED | API-hosted execution requires appropriate provider account/usage; subscriber routine option is separately experimental. No generic free cloud execution claim |
| Extracting cookies/local OAuth tokens or private endpoints | UNSUPPORTED | Never request, inspect, export or copy Codex/Claude credentials; no such bridge implemented |

No subscription-powered website conversation has been demonstrated. No token-sharing companion, routine trigger or SIWC prototype was built because the commercial authorization is not established. Existing provider-neutral API reasoning remains optional and separately metered.

Official sources:

- [SIWC quickstart and eligibility](https://developers.openai.com/siwc/quickstart), [commercial client-ID request](https://developers.openai.com/siwc/request-client-id), [open-source plan usage](https://developers.openai.com/siwc/token-sharing-open-source), [app-server configuration](https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server).
- [Claude authentication](https://code.claude.com/docs/en/authentication), [Agent SDK permission boundary](https://code.claude.com/docs/en/agent-sdk/overview), [Console CLI authentication](https://platform.claude.com/docs/en/cli-sdks-libraries/cli/authentication), [experimental hosted routines](https://platform.claude.com/docs/en/api/claude-code/routines-fire).

Owner decisions still needed: commercial SIWC application/eligibility; Anthropic approval if pursuing subscription inference; separately verified companion permission model; live Claude Code test and marketplace submission. These are not prerequisites for using the verified Codex read-only MCP connector.
