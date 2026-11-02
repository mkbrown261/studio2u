# MCP requirement mapping — 2026-10-13

This supplements existing master-plan traceability; it does not replace any earlier requirement or canonical skill.

| Requirement | Implementation | Verification / unfinished boundary |
|---|---|---|
| MCP01 baseline/pickup/current official docs | MCP_CONNECTOR_MILESTONE.md; existing AGENTS/router/pickup | c693ba3 local/remote confirmed, production independently checked |
| MCP02 one extensible existing-service interface | mcp/server.ts `createStudioMcp`; mcp/auth.ts route | SDK discovery9tools/5resources; no unrestricted execution |
| MCP03 Cloudflare HTTP transport | index.ts mounted `mcpRoutes`; SDK `createMcpHandler` / CfWorkerJsonSchemaValidator | Build and built-worker security; Inspector legacy tools/modern resources; native Codex |
| MCP04 OAuth2.1-compatible selected-label auth | mcp/auth.ts authorize/consent/token/revoke/authenticateMcp; migration0025; existing session/login | PKCE, exact URI/resource/issuer, nonce, replay, expiry, refresh rotation, private hashed tokens, disconnect/cross-user tests |
| MCP05 smallest safe catalog | server.ts nine registered tools, `authorized`, `paginate`, output schemas | Scope/membership every call, requester privacy, collected metrics, expiry, cursor20/32KiB bounds |
| MCP06 approved ICM knowledge | registry routes/resources and canonical skill IDs/statuses | Five authenticated resources; no developer notes/full master-plan or raw storage keys |
| MCP07 easy connection/setup/package | AIConnections.tsx; App.tsx modal; plugins/studio2u | Browser connected/expired/disconnected/setup proof; local install states user-reported. Claude/marketplace test pending |
| MCP08 subscription eligibility separately researched | SUBSCRIPTION_INFERENCE_OPTIONS.md | Eligibility/API billing/local/experimental/unsupported classifications; no unapproved companion |
| MCP09 actual clients/adversarial testing | tests/label-world-mcp*.mjs; tools/label-world-mcp-native-fixture.mjs | Native Codex OAuth/actual generated-file review + CSV research + revoke; official Inspector; Claude absent |
| MCP10 deployment/preservation/truthful delivery | MCP milestone/evidence/build status/decisions | Production rollout gate recorded independently of Git. Existing skills, Blender, original app/domain services preserved |
| MCP11 second action-stage evaluation | MCP milestone next-action section | Proposed later review-request scope must reuse roles, quota, idempotency/version checks; no action tool shipped |
