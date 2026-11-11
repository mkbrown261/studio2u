# Adoption Gates, Test Matrix and Non-Disruptive Integration

## Current state must be established from current repo, not blueprint date

At the moment of this specification update, the source read in GitHub `main` was older than the CLI's reported local commit `4ed1007`, and source code for live Label World was not accessible on `main`. The user reported that the CLI was preparing a GitHub push and Cloudflare deployment. Treat build/deploy status as **unknown until checked**. The earlier agent audit reported foundation tests passing but actual song upload, ZIP, true agents, 3D client and provider adapters not completed. These are historical reported findings; the CLI must re-audit the pushed branch and current deployed site before editing code or claiming readiness.

## Mandatory adoption steps

1. Identify current repo, branch, HEAD SHA, working-tree changes, remote default branch, deployment target and rollout status; distinguish local test fixtures from real D1/R2 and production.
2. Read canonical v2.0 documents and this v2.1 addendum. Merge additively; preserve all R001-R304 and existing v2 R111-R221, 23 YAML contracts and historical status logs.
3. Inspect current `migrations/0017_messages.sql`, `src/lib/db-messages.ts`, engineer/customer routes, message page, current Label World migrations, approval tables and tasks; note changes since audited `main`. Keep legacy messages intact.
4. Reconcile v2.1 requirement additions with traceability. Map IDs, owners, dependency gates, tests. New proposed YAML contracts must not be flagged VERIFIED or silently inserted into executable registry.
5. Design tenant-scoped schema/routes and preview UI; perform threat model for cross-label leakage, agent impersonation, high-risk approvals and URL email disclosure.
6. Implement via additive migration and separate feature flag; no production migration/deployment until approved and tested. Do not mix CLI changes with an in-progress deployment.
7. Demonstrate two tenants and all accept/reject/stale/retry cases in local fixtures. Regression tests existing engineer/customer messages.

## Gate I — Agent Inbox foundation (after or alongside Release Engine when no conflict)

Tests: create thread for tenant A, list by correct user, exact unread count, per-participant read state, no cross-tenant results; persistence across browser reload; agent-generated notice created only through internal authorized service; existing messages unaffected; secure asset links; pagination and input validation; visual separation of message tabs.

## Gate II — Approval/packet handoff

Tests: registration packet contains verified fields and accurate readiness state; version/digest binding; user can review/reject/request changes; stale packet cannot submit; no status escalated from chat alone; manual outbound link + user-owned submit; reported submission stays unverified until official receipt; notification on correction; no doubles on retry.

## Gate III — Agent dialogue/voice

Tests: input/output transcript redaction and consent; simulated and live skill capability clearly separated; voice interruption; text fallback; model/tool permissions; no raw provider keys in model/frontend; persisted task event; no avatar requirement; job survives browser close.

## Gate IV — Blender/Three.js

Tests: Carla/Eric GLB export and idle/walk/scroll clip quality if present; basic agent selection opens same thread; roles missing meshes remain accessible through inbox and generic *UI avatar/portrait* (not fabricated accepted mesh); measured load/FPS; no backend changes to add future Executive/Builder meshes.

## Gate V — Provider pilots/royalty/creative

Tests per approved provider: login consent, capability/terms source, sandbox/dry run, provider receipts, failure/retry, revocation, spent-cost approval, no unauthorized scraping; no claims or financial values without evidence. Data-source metrics have provenance and age.

## Product-wide nonfunctional tests

Tenant isolation, RBAC, CSRF, clickjacking/session security, idempotency, stale-write protection, audit immutability, never delete originals, encrypted secrets, human approval, data retention/portability, accessibility/keyboard/no-voice path, policy-compliant provider use, browser opt-out. Include changelog and status proof at every gate.
