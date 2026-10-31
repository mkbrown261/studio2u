# Context routing milestone — 2026-10-13

Baseline audited before changes: local and GitHub feature/label-world-foundation HEAD 737e860e95e851a152ef5344d3d06e238a630678. Cloudflare canonical deployment API returned 068d738e-3918-4006-875c-af7bf969f3df serving that exact SHA, successful. Git tracked files were clean; unrelated untracked Blender scripts/assets remain untouched. Production has NOT received this context increment or migration0024.

## Audit and integration
Previous workspace-services.ts assembled mixed research/registrations/rights/review records into a fixed reasoning prompt and sliced it to 24,000 characters. Current domain services already validate actual media, preserve reports and source provenance, and deliver Inbox messages. The context layer changes assembly and metadata only; inspectors, research collectors, report storage and authorization gates remain authoritative. internalSummary is exported for reuse rather than duplicated. Original app, React/3D assets and original customer/engineer messaging are unchanged.

## Foundation and runtime
Milestone A independently tested and committed as 1ba1303. Codex 0.160.1 local debug prompt inspection confirmed actual AGENTS.md/router discovery without a model request; Claude Code unavailable locally, documented import convention only. See context/development/DISCOVERY.md.

Milestones B–E implemented and tested locally: compiled whitelist/hash registry, deterministic four-employee routes, one canonical contract per call, optional Managed Release selection from actual release mode, scoped live record loading and current/stale review evidence, unexpired authorized research observations, existing task checkpoints, private trace API and persistent trace schema. Only one context subsystem serves five provider formats. No business tools are enabled. Approved instructions use provider instruction/system channels; record text/history remains data. No decrypted key, cookie or raw R2 location is inserted. Default provider connection tests retain their original contract.

Boundaries: 10 instruction/contract files, routing depth3, 30 scoped records, 24,000 total instruction/data characters, recent8 messages (older messages excerpted to2,000 characters; current request preserved), latest12 source observations and12 notes (note excerpt1,000 chars). Mandatory policies/rights/review findings are never sliced; excess causes a saved FAILED message with a request to narrow scope. All partial coverage is stated. Trace metadata includes source/skill hashes, manifest version/hash, evidence IDs, release version, stage, actual provider usage where returned and measured request latency. Failed output validation still records returned usage. Trace does not copy prompts/source metrics, so YouTube expiry is not bypassed. No generic file-reading endpoint exists.

Output schema: summary, evidenceRefs, limitations, nextSteps. Server rejects malformed output and unknown evidence references; nonempty evidence requires citation. Responses are labeled conversational reasoning. This structural validation does NOT prove every prose claim is factually correct; findings and approvals cannot be changed by prose.

## Representative route
```md
# Eric — Reviewer
Read CONTEXT.md and ../../workflows/review_release/ENTRY.md.
Canonical skill: studio2u.reviewer_release_qc@1.0.0.
Reasoning does not authorize execution.
```
Manifest route example:
```json
{
  "id": "reviewer",
  "department": "reviewer",
  "workflowId": "review_release",
  "entry": "reviewer.route",
  "requiredContext": [
    "boundaries",
    "evidence_rules",
    "security",
    "capability_rules"
  ],
  "skillId": "studio2u.reviewer_release_qc",
  "skillVersion": "1.0.0",
  "requiredInputs": [
    "authenticatedUserId",
    "labelId",
    "releaseId"
  ],
  "permittedReasoningModes": [
    "REASONING_ONLY"
  ],
  "requiredCapabilities": [
    "authorized_records_read"
  ],
  "status": "REASONING_ONLY",
  "maxChars": 24000
}
```
Compiler result: manifest version 1.0.0, four routes, 24 resources, 23 canonical skills. Sources/skill IDs and hashes validated; generated registry is imported only by the server Worker. Tests prove compiled instructions absent from public JS. Missing files, path traversal/symlinks escaping root, cycles, duplicate IDs, stale hashes, unsupported capabilities and missing mandatory policies fail. Overdue reference rechecks produce visible trace/compiler warnings. External legal/distributor rules are not newly verified by these internal SOPs.

## Executed example
Short request: “Eric, explain why this release failed and what to correct.” Loader follows reviewer.route → review_release.entry → procedure/output, plus four mandatory shared policies and the unchanged canonical reviewer contract. Existing Reviewer pipeline first inspects actual generated WAV/64px PNG fixture bytes. Context contains the stored artwork FAIL, PCM PASS, missing credits/rights and package NOT_TESTED. A controlled mock provider returns a structured correction explanation referencing the stored review. Tests confirm the original findings string remains byte-identical, follow-up history remains accessible, changed artwork causes a stale snapshot, and no approval/task execution is generated. See docs/evidence/context-reviewer-trace.json. This is local SQLite/R2-interface and mock reasoning evidence, not a live model or production context trace.

Carla tests load actual persisted fixture YouTube public counts and normalized CSV measurements, preserve source/artist limitations, exclude expired observations before deletion, and maintain task/report checkpoint provenance. No custom scores or other-platform metrics inferred.

## Test evidence
Final commands passed: npm run test:label-world; node tests/label-world-context.mjs; node tests/label-world-reviewer.mjs; node tests/label-world-research.mjs; node tests/label-world-context-evaluation.mjs; npm run build; node tests/label-world-worker-security.mjs; node tests/label-world-context-bundle.mjs; git diff --check. See docs/evidence/context-test-results.json. One earlier regression fixture omitted required evidence citations; updated the mock to cite its actual release instead of weakening the validator. A Builder hash-field mismatch was caught and fixed before rollout. All23 canonical YAML contracts remain unchanged.

## Measured comparison
Same pinned original assembly from 737e860 versus routed loader, local SQLite/R2-interface fixture with12 synthetic research notes, four employees, ten assemblies each. No paid calls.

| Employee | Old chars | Routed chars | Old estimated tokens | Routed estimated tokens |
|---|---:|---:|---:|---:|
| reviewer | 14039 | 4617 | 3510 | 1155 |
| researcher | 14041 | 19232 | 3511 | 4808 |
| executive | 14040 | 5117 | 3510 | 1280 |
| builder | 14038 | 4892 | 3510 | 1223 |

Estimates are ceil(chars/4), not provider tokenizer results. Reviewer/Executive/Builder omit unrelated research. Carla retains relevant notes and adds policy/methodology, increasing context. Local assembly milliseconds are recorded in context-comparison-local.json; not provider latency and not a production performance claim. Mock tests show deterministic routing, evidence inclusion, permission gates, missing-context handling, provenance, continuity and immutable findings. They cannot prove generated accuracy or unsupported-claim rates. Live model accuracy, provider latency and actual price/cost remain NOT_TESTED/NOT_MEASURED. No blanket cost/speed/accuracy benefit claimed.

## Rollout gate and limitations
The isolated QA label has no selected reasoning provider/model (verified by scoped D1 query). A request for the user's live test selection is pending. Controlled live A/B reasoning and production rollout remain unfinished; production remains the verified737e860 deployment. Migration0024 is prepared, not applied. Before rollout repeat appropriate tests, back up D1, apply additive migration, deploy an identified source SHA and verify the actual deployment. No secret changes, model fallback, autonomous executor, new datasource, regenerated Blender assets or finished23 skills claimed. Broad ZIP/distribution/royalty/creative workflows and real artist commercial pilot remain separate requirements.

## Directory tree
```text
AGENTS.md
CLAUDE.md
docs/studio2u-label-world/context/CONTEXT_MANIFEST.json
docs/studio2u-label-world/context/CURRENT_STATE.md
docs/studio2u-label-world/context/README.md
docs/studio2u-label-world/context/ROUTER.md
docs/studio2u-label-world/context/departments/builder/CONTEXT.md
docs/studio2u-label-world/context/departments/builder/REFERENCES.md
docs/studio2u-label-world/context/departments/builder/ROUTE.md
docs/studio2u-label-world/context/departments/executive/CONTEXT.md
docs/studio2u-label-world/context/departments/executive/REFERENCES.md
docs/studio2u-label-world/context/departments/executive/ROUTE.md
docs/studio2u-label-world/context/departments/researcher/CONTEXT.md
docs/studio2u-label-world/context/departments/researcher/REFERENCES.md
docs/studio2u-label-world/context/departments/researcher/ROUTE.md
docs/studio2u-label-world/context/departments/reviewer/CONTEXT.md
docs/studio2u-label-world/context/departments/reviewer/REFERENCES.md
docs/studio2u-label-world/context/departments/reviewer/ROUTE.md
docs/studio2u-label-world/context/development/DISCOVERY.md
docs/studio2u-label-world/context/development/HANDOFF.md
docs/studio2u-label-world/context/development/PICKUP.md
docs/studio2u-label-world/context/development/TESTING.md
docs/studio2u-label-world/context/shared/BOUNDARIES.md
docs/studio2u-label-world/context/shared/CAPABILITY_RULES.md
docs/studio2u-label-world/context/shared/EVIDENCE_RULES.md
docs/studio2u-label-world/context/shared/SECURITY.md
docs/studio2u-label-world/context/workflows/coordinate_label/ENTRY.md
docs/studio2u-label-world/context/workflows/coordinate_label/OUTPUT_CONTRACT.md
docs/studio2u-label-world/context/workflows/coordinate_label/PROCEDURE.md
docs/studio2u-label-world/context/workflows/prepare_release/ENTRY.md
docs/studio2u-label-world/context/workflows/prepare_release/OUTPUT_CONTRACT.md
docs/studio2u-label-world/context/workflows/prepare_release/PROCEDURE.md
docs/studio2u-label-world/context/workflows/research_artist/ENTRY.md
docs/studio2u-label-world/context/workflows/research_artist/OUTPUT_CONTRACT.md
docs/studio2u-label-world/context/workflows/research_artist/PROCEDURE.md
docs/studio2u-label-world/context/workflows/review_release/ENTRY.md
docs/studio2u-label-world/context/workflows/review_release/OUTPUT_CONTRACT.md
docs/studio2u-label-world/context/workflows/review_release/PROCEDURE.md
src/label-world/context/loader.ts
src/label-world/context/registry.ts
```

Changed implementation: package.json; context/loader.ts and registry.ts; tools/compile-label-context.mjs; workspace-services.ts; providers/adapters.ts (optional trusted instructions); internal-summary.ts (reuse export); migration0024; fixture/mock/role/bundle/evaluation tests. Context documentation and canonical architecture/roles/skills/workflows/data/roadmap/acceptance/traceability/decision/build records receive additive updates. No changes to deterministic validators, 3D scene or original Studio2U routes/UI.
