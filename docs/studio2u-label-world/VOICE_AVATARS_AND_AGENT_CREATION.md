# Agent Hiring, Capability Setup, Voice, and Avatar Roadmap

## Customer-configurable AI workforce — commercial from first release

Studio2U ships with role templates for Executive, A&R Researcher, Producer/Builder, Reviewer, Catalog Manager, Rights, Publishing, Royalties, Release Manager, Videographer, Short-Form Editor, Marketing and Social Media. Artist chooses which employees to activate and can add/remove/configure them within plan limits. Hiring an agent creates **configuration + permission-bound role assignment**, not a guarantee that every planned skill/provider is live. Agents show three independent readiness indicators: `ROLE_CONFIGURED`, `SKILLS_VERIFIED`, `TOOLS_CONNECTED`; only usable operations are offered.

### Hire/configure flow

1. Choose role template and desired skills; view exact functions supported and not yet built.
2. Assign agent name, personality/communication style, gender/appearance within supplied assets, label-specific brand style and manager/owner.
3. View required capability checklist: e.g. approved media provider key/OAuth; royalty organization membership data; access to catalog; budget cap; optional browser assistance. Requirements are per **skill and provider**, not a blanket “give agent all API keys.”
4. Connect via centrally managed provider connection; clearly show unsupported services and guided/manual fallback. No raw key should reach model or scene. Consent scopes and durations explicit.
5. Run verification test (optional fixture/dry-run) for each connected tool, record result and expiry.
6. Owner grants scoped permissions; agent appears in inbox immediately and the 3D world only if a compatible avatar asset is ready. Starting an unavailable skill returns helpful reason and possible alternative.
7. Allow disable, revoke, archive agent while keeping task/evidence history retained under policy.

### Role-to-skill matrix principle

Template is made of: `roleId`, `skillIds@versions`, `capabilityRequirements[]`, `permissions[]`, `toolReferences[]`, `approvalPolicy`, `avatarAssetId?`, `voiceProfileId?`, `status`. Multiple agents can share a skill but are individually isolated by tenant, task and permission. Never require 13 simultaneously running LLM sessions.

## Speech is not lip synchronization

**V1:** User can speak to selected agent (when voice subsystem is implemented) despite static mouth, with optional subtitle/talk indicator/avatar emphasis. WebRTC/WebSocket audio transport or provider equivalent, voice activity detection, streaming transcription, interrupt/barge-in, speech synthesis, confirmation before high-risk tools, consent indicators, accessible text fallback. User can begin with text chat if voice API readiness/budget is not met. Persist durable message summaries/task outcomes separately; configurable retention for transcripts and voice data. The standalone ChatGPT/Claude apps having speech does not automatically supply identical embed-able programmatic voice functionality: inspect model/provider API entitlements and implement provider-neutral STT/reasoning/TTS or a suitable real-time audio API.

**V1.5:** Natural audio latency handling, selectable voice, voice-call history, partial transcripts, interruption, noise handling, moderation, multilingual support; optional audio amplitude-driven jaw animation if an avatar rig permits but not a launch blocker.

**Future Unreal/MetaHuman:** Existing agent backend remains headless; client may map `talk` and phoneme/viseme timing to MetaHuman facial controls, lip sync, expressions and body gestures. Do not tie task state, permissions or model session to a specific Three.js GLB. No need to add MetaHumans to initial web bundle.

## Blender assets actually available (per most recent CLI audit)

- Carla — Researcher: existing Blender rig, reportedly 89 bones, idle/scroll actions; still needs verified GLB export, materials and browser animation.
- Eric — Reviewer: same.
- Executive and Builder — reference concepts exist, but no accepted low-poly game-ready character models. **PENDING.** No generically substituted 3D characters without owner approval. These roles may exist as backend workers, inbox identities and UI portraits while no 3D mesh exists. 3D integration proceeds using Carla/Eric; modeling others is parallel work and never blocks release engine.

## Acceptance

- Brand-new tenant chooses an agent template, sees missing capabilities, can complete setup where adapters exist, and cannot invoke unverified skills.
- Agent permissions stored server-side; revoke tool access immediately prevents further calls; separate labels never share provider connections.
- User can chat with agent using text; when voice available, transcript/task-linked actions match spoken dialog; no voice/LLM tool may bypass approval.
- Browser closes during a task, task persists; reconnect resumes thread and known status.
- Renderer switched from portrait to GLB avatar (and later Unreal client) without changing backend IDs or business operations.
