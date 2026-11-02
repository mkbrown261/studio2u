# Technical Architecture

## Logical layers
1. Three.js client: React, TypeScript, React Three Fiber, Drei, Zustand, GLB assets, animation controllers, camera, workstations, responsive accessible overlays.
2. App API: authentication, tenants, users, catalog, releases, campaigns, agent config, approvals, file downloads, connected services.
3. Domain services: catalog, audio inspection, metadata, release packaging, rights/publishing preparation, research, marketing, creative production, quality control.
4. Orchestration: persistent workflow/task queue, idempotent workers, retries, event log, approvals, cost limits, model-provider abstraction.
5. MCP server: validated, narrowly scoped tools wrapping the SAME domain services; not the sole business backend.
6. Integrations: approved provider adapters, OAuth/tokens, secrets vault, capability discovery, rate limits, webhooks/polling and receipts.
7. Data: PostgreSQL, object storage for originals/versions/outputs, optional queue/cache, structured audit logs.

## Recommended baseline
Monorepo: `apps/web`, `apps/api`, `apps/worker`, `apps/mcp`, `packages/contracts`, `packages/domain`, `packages/scene`, `assets/blender`, `assets/references`, `docs`. Use existing repository stack when appropriate. A modular monolith backend is preferred to premature microservices.

## Event model
Task states: PENDING, QUEUED, ASSIGNED, RUNNING, WAITING_FOR_INPUT, WAITING_FOR_APPROVAL, BLOCKED, FAILED, COMPLETED, CANCELLED. Events: task.created, task.assigned, task.started, task.progress, task.blocked, task.completed, task.failed, approval.requested, approval.granted, approval.denied, asset.created, release.reviewed, integration.status.changed. Event payloads include tenantId, taskId, agentId, eventId, timestamp, status, activity, evidence refs. Never invent progress percentages.

## 3D state mapping
Agent status controls path to station and animations (idle, walk, sit, type, review, talk, wait, celebrate). Backend events are truth; frontend interpolation is visual only. The browser can close without stopping jobs. Initial room is compact luxury studio with gold record wall, guitar, executive/producer/research/review workstations; expand via separately loaded room modules. Optimize GLBs, UVs, materials, geometry and lights with measured profiling. Preserve GLB/FBX options for later Unreal.

## Security and rights
All APIs enforce tenantId and RBAC server-side; object storage paths and signed URLs are tenant-scoped. Secrets are encrypted and never sent to LLM prompts or frontend. Tool gateway enforces scopes, approval, budget, dry-run and rate limits. Legal submissions, distributor delivery, public posting, spending, contract commitments and deletion require approval. Unverified third-party access is unavailable, not simulated as live. Maintain file provenance and source rights.

## Extensibility
Provider adapters implement capabilities, authentication, cost estimation, submit, status, cancel where supported, download, and error normalization. UI shows VERIFIED_CONNECTED, VERIFIED_NOT_CONNECTED, UNVERIFIED, UNSUPPORTED, DEGRADED. Avoid tying product logic to one AI model, video platform, distributor or social network.
