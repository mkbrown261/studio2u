# Agent Skills — Operational Architecture
## Purpose
A skill is a **versioned, independently testable standard operating procedure** (SOP) for one bounded task. It is not merely a decorative system prompt. The user/founder's lived experience is captured as draft procedure, corroborated against provider/official sources, tested and adjusted before autonomous use.

## Skill minimum contract
Required: `id`, `version`, `owner_role`, `goal`, `trigger`, `inputs`, `tools`, `steps`, `outputs`, `validations`, `approval_gates`, `failure_and_escalation`, `permissions`, `metrics`, `test_scenarios`, `knowledge_sources`, `status`. YAML under `skills/` is **a design contract**, not a promise that those tools are implemented. Each skill can be `PROPOSED`, `DESIGNED`, `IMPLEMENTED`, `TESTED`, `VERIFIED`, `DEPRECATED`; only VERIFIED skills can act autonomously within explicitly approved scope.

## Execution pattern
1. Executive chooses a well-scoped skill and assigns stable taskId, tenantId, agentId, required inputs, budget and permissions.
2. Validate tenant access, required file rights, source provenance, quotas, provider capability, and any mandatory human decisions.
3. Produce `plan` artifact only if it adds value; invoke deterministic code and authorized provider tools. Persist tool calls, output hashes and recoverable checkpoints.
4. Await explicit user input/approval if required. No model prompt may bypass a backend authorization gate.
5. Store outputs in tenant-scoped database/object storage; emit fact-based task events for Three.js.
6. Reviewer executes its own checks against immutable source/output snapshots; deliver evidence and confidence.
7. Executive reports completed, blocked, failed and pending work separately with references to actual artifacts and receipts.

## Knowledge base
Create role playbooks and source documents with source URL/file, publisher, last verified date, jurisdiction/territory, applicability, revision and expiry/recheck schedule. User experience is tagged `FOUNDER_PRACTICE`; official platform rules `OFFICIAL_GUIDANCE` with validated source; industry examples `CASE_STUDY`; hypotheses `UNVERIFIED_HYPOTHESIS`. Do not turn a founder habit into a universal legal obligation.

## Long-running research
A&R and Marketing should not pretend to have real-time access to charts, Instagram/TikTok hashtag feeds or metrics. Connect only approved data sources, log timestamps and missing data. Research can be scheduled via durable jobs independent of whether the 3D world is open.

## QA and performance
Each skill defines sample successful, missing-data, invalid-input, unauthorized, quota-exceeded, API-unavailable and partial-failure tests. Performance includes accuracy and evidence quality, not just speed or generation count. Enforce max cost and idempotency; retry only safe actions; provide recovery checkpoints for long video jobs.

## Inter-agent handoffs
Inputs/outputs must be schemas, not vague chat messages. Example: catalog.transcribe_lyrics outputs an unapproved timed transcript; videographer.storyboard consumes approved hook candidates, campaign creative brief and rights-cleared identity pack; editor.shortform_cut consumes approved footage + licensed track, produces deterministic timestamps and format report; reviewer.creative_qc approves only verifiable aspects; social.schedule_post consumes approved final media and brand/copy metadata.

## Frontend behavior
3D work animation is driven by task status events. An agent can appear busy on one real job while another task is queued; no fake completed status. If user asks agent to perform unimplemented skill, UI must say DESIGNED / UNAVAILABLE, not pretend success.


## ICM-inspired context increment — 2026-10-13
Context routing discovers the unchanged 23 YAML contracts. Only the selected role contract is sent per call (Builder chooses Fast/Managed from stored release mode). Canonical complete-skill status stays DESIGNED_NOT_IMPLEMENTED; specific implemented deterministic subsets remain separate. Loading a contract never grants tools. Manifest hashes bind instructions/contracts to conversational traces.
