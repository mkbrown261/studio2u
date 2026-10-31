# Implementation plan — v2 operational reconciliation

Authoritative blueprint: START_HERE.md and the full v2 documents plus all 23 YAML contracts. Immutable received copies are in ../blueprint-archive/v2-source; earlier project documents/status remain in ../blueprint-archive/v1. TRACEABILITY.json/md maps every registered requirement and skill to an accountable task, gate and acceptance scenario. No scope is removed.

## Current increment
Retain the existing Hono/Vite/Cloudflare Pages app, session auth, D1/R2 bindings, booking/billing functionality and Blender assets. Add migration 0019 on top of 0018; do not rename earlier tables or reset user data. Add Fast/Managed intake, version-bound owner rights statements, conservative readiness checks, immutable audit and persistent per-release registration records/dashboard. Queues are created with release intake and backfilled for existing drafts; they do not depend on streams or a running browser. Follow-up task ownership is logically Publishing, Rights or Royalties; no agent executor is implied.

Registration organization and distributor state are independent. Uploaded links and reported submitted/confirmed states are unverified and remain AWAITING_VERIFICATION. No endpoint upgrades them to official CONFIRMED. UNKNOWN applicability stays explicit. User-scheduled review dates are follow-up dates, not legal deadlines. No automated notifier or scheduler exists yet.

## Next increments
1. Tenant-safe R2 originals/upload/download and quotas; WAV/other actual file inspection with hashes/duration; tests against two tenant assets. Model recordings/compositions/parties/typed splits separately; artist/profile affiliation reuse and provenance.
2. Versioned package builder with actual ZIP/manifest/checksum verification, current official distributor rule snapshots, independent Reviewer report and owner approval bound to immutable artifacts. UnitedMasters export/handoff first; no live submission adapter presumed.
3. Durable workers with leases/checkpoints/idempotency/cost caps; explicit capability registry and versioned skill execution/evidence. Exercise the failure scenarios for each of the 23 skill designs before enabling autonomy.
4. Bake custom Blender materials, export studio/lobby/conference as separate GLBs and two approved characters; verify scales/materials/animations/browser interaction/accessible panels and measured performance. Remaining two visible agents stay planned until assets are supplied/built.
5. Campaigns, approved lyrics/timecoded hooks, artist identity/consent kit, storyboards and local editing; activate external providers independently after capability, permission, cost and receipt tests.
6. Scoped MCP, optional n8n/Tally, authorized social/distribution/registration providers, A&R provenance, billing/quotas and beta operations. Preserve the full future world/customization/Unreal scope.

## Verification
`npm run test:label-world` covers blueprint completeness, v1 scope preservation, all YAML contract fields, domain validation, migrations/backfill, two-tenant authenticated API behavior, RBAC, rights blockers, version invalidation, unverified receipts, immutable audit and transaction rollback. It uses real SQLite behind a small D1-compatible fixture; it is not a remote/provider or R2 integration test. Full migrations are also applied to isolated local D1 via Wrangler. UI is exercised with synthetic fixtures on the local preview server. Production is unchanged until migrations and deployment are deliberately run.

No deadlines or complete-product delivery estimate is promised by this increment. Milestones exit only on actual evidence.
