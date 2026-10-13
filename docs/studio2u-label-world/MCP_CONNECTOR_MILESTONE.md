# Native Studio2U connector — 2026-10-13

## Verified architecture and baseline

Started from local and remote `c693ba3436adc7532af5bfabc9356c769b960ac2`, branch `feature/label-world-foundation`. Active production independently checked through Cloudflare: `068d738e-3918-4006-875c-af7bf969f3df`, source `737e860e95e851a152ef5344d3d06e238a630678`. GitHub HEAD does not imply deployment.

One Hono-mounted Streamable HTTP server uses the official MCP v2 server and Cloudflare-safe JSON schema validator. Modern 2026-07-28 semantics and legacy client handshake are handled by the SDK. There is no local stdio server disguised as a hosted endpoint, arbitrary SQL/HTTP/filesystem tool, or employee orchestration framework. Business services, canonical skills, ICM registry, provider adapters, private R2, Inbox and original booking routes are retained.

## Milestones and evidence

| Milestone | Verified status | Evidence / remaining limits |
|---|---|---|
| A — smallest server | Implemented and tested | `src/label-world/mcp/server.ts`; official SDK initialization, nine read tools, five resources, schemas, cursor/budget tests |
| B — authorization | Implemented and tested | `auth.ts`, migration0025; real Studio2U sign-in, PKCE, selected-label consent, audience, expiry, replay, rotation/revocation and cross-user/tenant tests |
| C — native clients | Codex verified; Claude blocked | Installed Codex0.160.1 completed browser OAuth and read actual SQLite QA records through HTTP. Claude executable not installed, so no successful Claude session is claimed |
| D — connection UI/package | Implemented locally | React AI Connections browser test: verified connection, supported setup instructions, expiration, disconnect. Portable and Claude manifests prepared; marketplace approval and Claude validation pending |
| E — subscription inference | Research completed; implementation not enabled | Separate eligibility report. MCP access does not authorize website inference. No companion or unapproved subscription bridge built |

Native Codex read all nine tools and approved Reviewer/Researcher resources. The isolated release used actual generated PCM WAV/PNG bytes processed by Eric's existing service; stored `artwork.technical=FAIL` (64×64 instead of3000–6000), missing credits/rights and untested package remained failures. Carla's normalized CSV returned exactly `test_count:"17"`, `csv:other`, its timestamp and source URL; no derived analytics. A live-client test caught a CSV provenance mapping error and its corrected output was then verified as `USER_IMPORTED_NOT_INDEPENDENTLY_VERIFIED`.

After the browser's Disconnect action, native Codex initialization failed with `Auth required`; no tool catalog was available. Unit tests separately check HTTP401, expired/invalid access, public revocation, refresh replay family revocation, exact redirects/audience, code/consent replay, role/membership checks, malicious/unknown arguments, pagination, source expiry and secret omission. Prompt-injection strings are returned as `DATA_ONLY`; the server exposes no execution tool that could obey them. This is a boundary test, not a guarantee about every model's interpretation.

Browser verification caught `no-referrer` producing a null Origin on a consent POST; `same-origin` preserves Origin while suppressing cross-site referrers. The consent page permits only its validated callback origin for its form redirect. Explicit submit buttons and CSRF nonces remain enforced.

Raw client credentials were never read or exported. The native CLI managed its own OAuth. Inspector uses a separately created disposable Studio2U QA token, not a copied Codex token. Temporary QA client configuration is removed after verification. No model API key was configured in Studio2U for the native workflow. Temporary native-client logs include synthetic tool results only; sanitized evidence is in `docs/evidence/mcp-test-results.json`.

## Endpoint, tool catalog and knowledge

Hosted path: `/label-world/mcp`. Tools:

- `studio2u_whoami`, `studio2u_list_labels`, `studio2u_list_releases`
- `studio2u_get_release`, `studio2u_get_review`
- `studio2u_list_research_reports`, `studio2u_list_research_observations`
- `studio2u_list_agent_messages`, `studio2u_get_task_status`

Knowledge URIs: `studio2u://knowledge/{capabilities,reviewer,researcher,builder,executive}`. Only compiled approved instructions and skill identities/statuses are exposed. Developer notes, raw storage keys, private tokens and entire master plans are excluded. All23 full skill contracts remain designed; this connector does not implement them.

Lists use keyset cursors, default10/max20, strict input validation and a32KiB result budget. Private reports/messages/tasks are requester-scoped. YouTube reports/observations expire according to stored retention timestamps; CSV remains user-imported. Findings come from `currentReview`, including freshness, and never trigger or override a review.

## OAuth design

Protected-resource metadata: `/.well-known/oauth-protected-resource/label-world/mcp`; AS metadata: `/.well-known/oauth-authorization-server`. Public DCR clients have exact registered HTTPS or literal-loopback callbacks. Client display names are self-declared, not proof of verified publisher identity. Authorization Code + S256 PKCE, issuer binding and exact resource audience are required. DCR does not fetch arbitrary client metadata URLs.

Users sign in with their existing Studio2U identity, explicitly choose labels (none preselected), then scopes. Every tool revalidates the active grant, required scope and current label membership. Access lasts10minutes. Optional `offline_access` issues a7day rotating refresh token within a30day absolute grant; reused refresh tokens revoke the family. Tokens/codes/consent verifiers are stored as SHA256 hashes. Same-origin CSRF/consent checks, no-store headers, bounded bodies and rate limits are enforced. Disconnect revokes the grant immediately. Reconnect creates fresh consent; revoked credentials cannot silently restore access.

## User installation

Open Label World → **AI Connections** → **Connect Codex** or **Connect Claude Code**. Follow the client instructions and Studio2U consent page. The website cannot detect whether a local application is installed; installation/configuration/unsupported-client states are explicitly user-reported. Connected means a server-confirmed authenticated request, not verified model entitlement or public marketplace approval.

Codex:

```sh
codex mcp add studio2u --url https://studio2u.pages.dev/label-world/mcp
```

Adding normally starts OAuth. For an already configured server, use `codex mcp login studio2u`. Select only intended labels/scopes. Ask the client to list Studio2U labels, then read a release/review.

Claude Code (documented, live test pending):

```sh
claude mcp add --transport http studio2u https://studio2u.pages.dev/label-world/mcp
```

Then `/mcp` → authenticate Studio2U. Both clients use the same service. From a preview build, use that build's displayed endpoint rather than the production URL until promoted.

The package is `plugins/studio2u`: root portable `plugin.json` / `mcp.json` with DCR, and Claude `.claude-plugin/plugin.json` / `.mcp.json`. No secrets, hooks, executable installation script or invented browser deep link. Public OpenAI distribution requires remote HTTPS submission/review; Claude marketplace publication and `claude plugin validate` require that client. These packaging steps are not claimed as approved or live-verified. Direct MCP setup is the tested fallback.

## Next action stage

Read-only tools passed. A later action scope could request an existing Eric review, using existing reviewer routes/services, role permission, quotas, idempotency and the exact release version. It is deliberately not in the initial catalog; uploading, approval, filing, distribution or an arbitrary agent loop remains unavailable. Carla collection would likewise need its existing quota, retention, authorization and idempotency checks. No untested action is advertised.

## Official references checked 2026-10-13

- [Codex setup](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
- [MCP server](https://developers.openai.com/plugins/build/mcp-server), [OAuth](https://developers.openai.com/plugins/build/auth), [plugin packaging](https://developers.openai.com/plugins/build/plugins)
- [Claude MCP](https://code.claude.com/docs/en/mcp), [plugin manifests](https://code.claude.com/docs/en/plugins-reference)
- [MCP authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization), [HTTP transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports)
- [Official TypeScript SDK HTTP integration](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/serving/http.md)
