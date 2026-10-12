# Requirements Verification and Acceptance Gates

## Documentation integrity tests
- Every requirement `Rxxx` exists in `REQUIREMENTS.md`, mapped to owner, roadmap gate and at least one test.
- Every agent skill file has schema-valid required keys, unique ID/version, at least one failure test and approval rules.
- No change may silently drop v1 requirements, the two release modes, or the founder's registered-vs-distributed distinction.
- Every service has a verified or unverified capability status; no inaccessible connector called connected by default.

## Mandatory product checks (given real code)
T01: Create two tenants; authenticated access to release, agent events, video assets and credential metadata across tenants must be denied at both API and storage layers.
T02: New Fast Release project receives durable registration follow-up queue irrespective of streams; task completion cannot be inferred from upload alone.
T03: User uploads audio; preserve byte-for-byte original with verifiable checksum, accurate measured length and correct audio characteristics.
T04: Auto transcript is marked draft and its corrections survive regeneration; user-confirmed lyrics replace nothing without version record.
T05: Separate composition writers/publisher splits from master revenue and production credits; inconsistent or uncertain shares produce warnings/blocks as applicable.
T06: Distributor-ready asset manifests and ZIP download match stored files and exact hashes; official submitted/accepted/live states require provider evidence.
T07: No rights declaration, published social post, external registration, money spend or legal attestation executed without backend-enforced owner approval.
T08: Browser/session credentials never included in prompts, client payloads or debug logs; tenant actions bounded to allowlist and consent.
T09: Videographer storyboard has approved identity rights, song IDs, shots and costs; generated artifact can only be marked completed upon real provider result.
T10: Editor exports 9:16 deliverable, validates duration and frame properties; missing Genjitsu integration uses explicitly named local alternative/unavailable status.
T11: Reviewer fails a package with deliberately missing required artwork, invalid formats, or unlicensed sample indicator; NOT_TESTED never counted PASS.
T12: Social publishing drafts remain drafts if no permitted connector; POSTED status only after verified provider acknowledgment.
T13: Main Three.js room contains gold record, guitar, four workstations, 4 selectable characters when models supplied; real backend event produces correct status animation; browser shutdown does not cancel durable task.
T14: A&R dossier keeps source URLs, retrieval timestamps and metric sources; simulated numbers never treated as measurements.
T15: Registration statuses (ASCAP/BMI, MLC, SoundExchange, Copyright) separately track prep/approval/submitted/confirmed with official proof links.
T16: Durable worker retries recover from interrupted upload/render, obey cost limits, avoid duplicate provider actions and preserve audit trail.
T17: Settings support at least two distinct customer label brands without code changes, including plaque text and agent settings.
T18: Baseline performance measured on defined hardware; draw calls, memory, frame time, load time recorded before optimization claims.

## Evidence templates
For each test record: commit SHA, build version, test runner and command, environment, fixtures, outcome, output artifact path or screenshot, timestamp, known exclusions, reviewer. Status VERIFIED only after independently observable positive result.
