# User-selectable reasoning providers — 2026-10-12

User directive: support current OpenAI, Claude, Kimi, Qwen and OpenRouter models, expandable later. This increment implements personal bring-your-own API keys and a saved model selection per user/label. It does not activate the 23 employee skills.

## Implementation
- `src/label-world/providers/adapters.ts`: OpenAI Responses (`store:false`), Anthropic Messages (version header), Kimi and Qwen OpenAI-compatible Chat Completions, OpenRouter Chat Completions (no provider fallback). Fixed approved hosts; no arbitrary base URL. Qwen workspace/region validated before constructing host. 60s generation and 15s catalog timeouts; no automatic retries that might duplicate billed requests. 2048 output-token cap, 8000 character input cap.
- `vault.ts`: AES-256-GCM with fresh 96-bit nonce, authenticated user/provider/config context. `LLM_KEY_ENCRYPTION_SECRET` must be 32 random bytes base64 in Cloudflare secrets. Missing/bad secret fails closed; no plaintext storage fallback. Do not rotate the master without first migrating/reconnecting existing keys.
- `routes.ts`: authenticated personal key connect/disconnect, live model catalog, membership-scoped personal selection, explicit generation test. Other members cannot use keys or preferences. Viewer cannot change label preference or run generation. Same-origin POST enforcement, no-store responses, six catalog/selection/generation requests per user/minute across providers. D1-backed throttle works across worker instances.
- `0020_label_world_reasoning.sql`: encrypted connections, preferences, rate buckets and run status/usage records. Disconnect cascades preferences. Prompts/answers/keys never enter audit/run records. Run output sent only to requesting user.
- `public/label-world.js`: provider/region/key controls, catalog picker, saved model, test response. Password cleared before network submission, no localStorage. Provider text uses textContent. API usage is billed by the selected account; personal key use is explicit.

## Current model discovery
OpenAI, Anthropic, Kimi and OpenRouter catalogs are queried with the connected account. Text families filtered; Anthropic pagination supported. Catalog visibility is not proof of generation entitlement. Deprecated Anthropic lifecycle entries excluded. OpenAI's list lacks full capability/lifecycle metadata; unsupported returned models can still reject a test. No automatic provider/model substitution. OpenRouter returns text-output models, including providers beyond these four through the user's routing account.

Qwen official docs establish compatible Chat Completions and current region/workspace endpoints, but this audit did not verify an official list-models endpoint. Qwen therefore takes an exact model ID from the user's Model Studio catalog, with explicit generation test as the access gate. No fabricated catalog. Workspace-specific regions: Singapore, Beijing, Hong Kong, Tokyo; Virginia uses the documented dashscope-us host. Region/key entitlement must match.

Kimi docs currently show `kimi-k3`. OpenAI/Claude current model families evolve; picker discovers IDs at request time instead of claiming a hardcoded snapshot is complete.

## Official documentation checked
- https://developers.openai.com/api/docs/guides/text
- https://developers.openai.com/api/docs/models/all
- https://platform.claude.com/docs/en/api/messages/create
- https://platform.claude.com/docs/en/api/models/list
- https://platform.kimi.ai/docs/api/chat
- https://platform.kimi.ai/docs/api/list-models
- https://www.alibabacloud.com/help/en/model-studio/compatibility-of-openai-with-dashscope
- https://openrouter.ai/docs/api/reference/overview
- https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties

## Tests and limits
`tests/label-world-providers.mjs`: mock HTTP adapter request/response contracts for all five providers; current-catalog filtering/pagination; encryption roundtrip and wrong-user rejection; missing master failure; auth, origin/CSRF, membership and viewer denial; no other-user credentials; no secret response/database plaintext; saved preference; generation status; sanitized upstream errors/timeouts; minute rate limit; disconnect cascade. Added to `npm run test:label-world`. Existing release tests still required.

No live LLM generation verified: no provider API keys supplied. GitHub/Cloudflare infrastructure tokens do not supply model access. Generation test is synchronous and has no business tools, employee orchestration, durable continuation, voice, streaming or multimodal input. This adapter must be wired into the later controlled agent executor. Platform-paid shared models, budgets by dollar amount, billing/metering, master-key rotation tooling, per-employee overrides and provider OAuth are later increments. Rate-limit rows require periodic pruning at scale. A crashed request can leave a RUNNING test record; no autonomous job claim is made.
