// Always-on Label World engine.
//
// Runs on Cloudflare (cron) with NO language model. It does the deterministic
// work that must never stop when the user's computer is off:
//   * refresh submission packets from the latest release data
//   * create agent tasks for whatever still needs thinking or a screen
//   * recover stuck tasks (expired leases) and retry with backoff
//   * schedule registration follow-ups and write in-app notifications
//   * optionally wake the user's own Claude Code scheduled task (official fire endpoint)
//
// The "thinking" is done by the user's regular Claude / Codex subscription, which
// connects over MCP, claims tasks from this queue and reports results back.
import { buildPacket, derivedStatus, targets, type Target, type ReleaseRow, type Assets } from './packets'
import type { Intake } from './intake'
import { decryptKey } from '../providers/vault'

export const taskKinds = ['COLLECT_INTAKE', 'PREPARE_SUBMISSION', 'FILL_PROVIDER_FORM', 'VERIFY_SUBMISSION', 'REGISTRATION_FOLLOW_UP', 'CASE_STEP', 'REGISTER_WORK'] as const
export type TaskKind = typeof taskKinds[number]
const LEASE_MINUTES = 15
const now = () => new Date().toISOString()
const later = (ms: number) => new Date(Date.now() + ms).toISOString()

export function readIntake(metadataJson: string | null): Intake {
  try { const m = JSON.parse(metadataJson || '{}'); return (m && typeof m.intake === 'object' && m.intake) || {} } catch { return {} }
}

export async function releaseAssets(db: any, label: string, release: string): Promise<Assets> {
  const rows = (await db.prepare("SELECT kind FROM lw_assets WHERE label_id=? AND release_id=? AND kind IN ('master','artwork')").bind(label, release).all()).results as { kind: string }[]
  let artworkCheck: Assets['artworkCheck'] = 'NOT_TESTED'
  const review = await db.prepare("SELECT findings_json FROM lw_reviews WHERE label_id=? AND release_id=? AND status='COMPLETED' ORDER BY created_at DESC,rowid DESC LIMIT 1").bind(label, release).first()
  if (review) { try { const f = JSON.parse(review.findings_json).find((x: any) => x.check === 'artwork.technical'); if (f) artworkCheck = f.status === 'PASS' ? 'PASS' : f.status === 'FAIL' ? 'FAIL' : 'NOT_TESTED' } catch { /* keep NOT_TESTED */ } }
  return { master: rows.some(r => r.kind === 'master'), artwork: rows.some(r => r.kind === 'artwork'), artworkCheck }
}

/** Which packets apply to a release. UnitedMasters only if it is the chosen distributor. */
export function targetsFor(release: ReleaseRow): Target[] {
  return targets.filter(t => t !== 'UNITEDMASTERS' || /united\s*masters/i.test(release.target_distributor))
}

/** Rebuild every packet for one release from current data. Human-reported/verified state is preserved. */
export async function refreshSubmissions(db: any, label: string, releaseId: string) {
  const release = await db.prepare('SELECT id,title,artist,release_type,version,target_distributor,metadata_json FROM lw_releases WHERE label_id=? AND id=?').bind(label, releaseId).first()
  if (!release) throw new Error('Release not found')
  const intake = readIntake(release.metadata_json), assets = await releaseAssets(db, label, releaseId)
  const out: any[] = []
  for (const target of targetsFor(release)) {
    const packet = buildPacket(target, release, intake, assets), status = derivedStatus(packet)
    // Keep SUBMITTED_REPORTED / VERIFIED / CANCELLED; a data change after submission flags NEEDS_CORRECTION instead of silently resetting.
    await db.prepare(`INSERT INTO lw_submissions(id,label_id,release_id,target,status,release_version,packet_json,missing_count) VALUES (?,?,?,?,?,?,?,?)
      ON CONFLICT(label_id,release_id,target) DO UPDATE SET
        packet_json=excluded.packet_json, missing_count=excluded.missing_count,
        status=CASE WHEN lw_submissions.status IN ('VERIFIED','CANCELLED') THEN lw_submissions.status
                    WHEN lw_submissions.status='SUBMITTED_REPORTED' AND lw_submissions.release_version<>excluded.release_version THEN 'NEEDS_CORRECTION'
                    WHEN lw_submissions.status IN ('SUBMITTED_REPORTED','NEEDS_CORRECTION') THEN lw_submissions.status
                    ELSE excluded.status END,
        release_version=excluded.release_version, revision=lw_submissions.revision+1, updated_at=CURRENT_TIMESTAMP
      WHERE lw_submissions.packet_json<>excluded.packet_json OR lw_submissions.release_version<>excluded.release_version OR lw_submissions.status<>excluded.status AND lw_submissions.status IN ('BLOCKED','READY','NOT_APPLICABLE')`)
      .bind(crypto.randomUUID(), label, releaseId, target, status, release.version, JSON.stringify(packet), packet.missing.length).run()
    out.push({ target, status, missing: packet.missing.length })
  }
  return out
}

/** Idempotent task creation keyed by dedupe_key. Returns true if a new task was queued. */
export async function enqueue(db: any, t: { label: string; release?: string | null; kind: TaskKind; role: string; capability?: 'ANY' | 'SCREEN_CONTROL' | 'HUMAN'; title: string; input: Record<string, unknown>; dedupe: string; runAfter?: string | null }) {
  const id = crypto.randomUUID()
  const r = await db.prepare(`INSERT INTO lw_tasks(id,label_id,release_id,agent_role,status,input_json,kind,capability,title,dedupe_key,run_after)
    VALUES (?,?,?,?,'QUEUED',?,?,?,?,?,?) ON CONFLICT DO NOTHING`)
    .bind(id, t.label, t.release ?? null, t.role, JSON.stringify(t.input), t.kind, t.capability ?? 'ANY', t.title.slice(0, 200), t.dedupe, t.runAfter ?? null).run()
  if (r.meta.changes) await db.prepare('INSERT INTO lw_task_events(label_id,task_id,status,payload_json) VALUES (?,?,?,?)').bind(t.label, id, 'QUEUED', JSON.stringify({ kind: t.kind, by: 'engine' })).run()
  return Boolean(r.meta.changes)
}

export async function notify(db: any, n: { label: string; release?: string | null; kind: string; title: string; body: string; link?: string; dedupe?: string }) {
  const owners = (await db.prepare("SELECT user_id FROM lw_memberships WHERE label_id=? AND role='owner'").bind(n.label).all()).results as { user_id: number }[]
  let created = 0
  for (const o of owners) {
    const r = await db.prepare('INSERT INTO lw_notifications(id,label_id,user_id,release_id,kind,title,body,link,dedupe_key) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING')
      .bind(crypto.randomUUID(), n.label, o.user_id, n.release ?? null, n.kind, n.title.slice(0, 200), n.body.slice(0, 2000), n.link ?? null, n.dedupe ? `${n.dedupe}:${o.user_id}` : null).run()
    created += r.meta.changes
  }
  return created
}

/** Decide the next agent step for one release's packet. Pure data; no model call. */
export async function planSubmission(db: any, label: string, release: ReleaseRow, sub: { target: string; status: string; packet_json: string; release_version: number }) {
  const packet = JSON.parse(sub.packet_json), v = release.version, base = { label, release: release.id }
  const name = `${release.artist} – ${release.title}`
  if (sub.status === 'BLOCKED') return false // handled once per release by planRelease (one combined question list)
  if (sub.status === 'READY') {
    const q = await enqueue(db, { ...base, kind: 'FILL_PROVIDER_FORM', role: sub.target === 'UNITEDMASTERS' ? 'release_manager' : sub.target === 'ASCAP' ? 'publishing_administrator' : 'royalty_admin', capability: 'SCREEN_CONTROL',
      title: `Fill ${sub.target} form for ${name} (user presses Submit)`, input: { target: sub.target, releaseVersion: v, officialUrl: packet.officialUrl }, dedupe: `fill:${release.id}:${sub.target}:v${v}` })
    if (q) await notify(db, { ...base, kind: 'SUBMISSION_READY', title: `${sub.target} ready: ${release.title}`, body: `Everything ${sub.target} asks for is filled in. Open Claude or Codex (with screen control) and say "do my Studio2U tasks", or open the packet and copy the fields yourself. You press Submit.`, link: `/label-world/dashboard#release-${release.id}`, dedupe: `ready:${release.id}:${sub.target}:v${v}` })
    return q
  }
  if (sub.status === 'SUBMITTED_REPORTED') {
    return enqueue(db, { ...base, kind: 'VERIFY_SUBMISSION', role: 'royalty_admin', capability: 'SCREEN_CONTROL', title: `Check ${sub.target} shows ${name} as accepted`,
      input: { target: sub.target, releaseVersion: v }, dedupe: `verify:${release.id}:${sub.target}:${new Date().toISOString().slice(0, 10)}`, runAfter: later(2 * 86400000) })
  }
  if (sub.status === 'NEEDS_CORRECTION') {
    await notify(db, { ...base, kind: 'NEEDS_CORRECTION', title: `${sub.target} may need an update: ${release.title}`, body: 'Release details changed after you reported submitting. Review the packet and update the filing on the official site if needed.', dedupe: `correction:${release.id}:${sub.target}:v${v}` })
    return enqueue(db, { ...base, kind: 'FILL_PROVIDER_FORM', role: 'release_manager', capability: 'SCREEN_CONTROL', title: `Update ${sub.target} filing for ${name}`, input: { target: sub.target, releaseVersion: v, correction: true }, dedupe: `fix:${release.id}:${sub.target}:v${v}` })
  }
  return false
}

/**
 * Plan all agent work for one release:
 *  - cancel queued tasks that newer data has superseded (older version / no longer applicable)
 *  - ONE combined COLLECT_INTAKE task per release version, so the artist is asked each question once
 *  - per-provider form/verify/correction tasks
 */
export async function planRelease(db: any, label: string, release: ReleaseRow) {
  const subs = (await db.prepare('SELECT target,status,packet_json,release_version FROM lw_submissions WHERE label_id=? AND release_id=?').bind(label, release.id).all()).results as any[]
  const v = release.version
  const status = Object.fromEntries(subs.map(s => [s.target, s.status]))
  // Supersede stale queued work (never touches RUNNING tasks an agent is holding).
  await db.prepare(`UPDATE lw_tasks SET status='CANCELLED',result_json=json_object('outcome','SUPERSEDED'),updated_at=CURRENT_TIMESTAMP
    WHERE label_id=? AND release_id=? AND status='QUEUED' AND kind IN ('COLLECT_INTAKE','FILL_PROVIDER_FORM')
      AND (COALESCE(json_extract(input_json,'$.releaseVersion'),0)<?
        OR (kind='FILL_PROVIDER_FORM' AND json_extract(input_json,'$.correction') IS NULL AND COALESCE(json_extract(?, '$.' || json_extract(input_json,'$.target')),'')<>'READY'))`)
    .bind(label, release.id, v, JSON.stringify(status)).run()
  let queued = 0
  const blocked = subs.filter(s => s.status === 'BLOCKED')
  if (blocked.length) {
    const seen = new Map<string, { field: string; question: string; providerFields: string[]; neededFor: string[] }>()
    for (const s of blocked) for (const m of JSON.parse(s.packet_json).missing) {
      const field = m.field ?? m.key, e = seen.get(field)
      if (e) { if (!e.neededFor.includes(s.target)) e.neededFor.push(s.target); e.providerFields.push(`${s.target}.${m.key}`); if (!e.question.includes(m.question)) e.question += ' ' + m.question }
      else seen.set(field, { field, question: m.question, providerFields: [`${s.target}.${m.key}`], neededFor: [s.target] })
    }
    const questions = [...seen.values()]
    if (await enqueue(db, { label, release: release.id, kind: 'COLLECT_INTAKE', role: 'catalog_manager', title: `Get ${questions.length} missing detail(s) for ${release.artist} – ${release.title}`,
      input: { releaseVersion: v, questions, targets: blocked.map(s => s.target) }, dedupe: `intake:${release.id}:v${v}` })) queued++
  }
  for (const s of subs) if (await planSubmission(db, label, release, s)) queued++
  return queued
}

/** Return expired leases to the queue (or fail after max attempts). */
export async function recoverLeases(db: any) {
  const t = now()
  const failed = await db.prepare("UPDATE lw_tasks SET status='FAILED',claimed_by=NULL,lease_until=NULL,updated_at=CURRENT_TIMESTAMP WHERE status='RUNNING' AND lease_until<? AND attempts>=max_attempts").bind(t).run()
  const requeued = await db.prepare("UPDATE lw_tasks SET status='QUEUED',claimed_by=NULL,lease_until=NULL,run_after=?,updated_at=CURRENT_TIMESTAMP WHERE status='RUNNING' AND lease_until<? AND attempts<max_attempts").bind(later(5 * 60000), t).run()
  return { requeued: requeued.meta.changes, failed: failed.meta.changes }
}

/** Atomically claim the next eligible task for an agent. */
export async function claimTask(db: any, o: { labels: string[]; agent: string; screen: boolean; kinds?: string[] }) {
  const t = now(), caps = o.screen ? ['ANY', 'SCREEN_CONTROL'] : ['ANY']
  const kinds = o.kinds?.length ? o.kinds : [...taskKinds]
  return db.prepare(`UPDATE lw_tasks SET status='RUNNING',claimed_by=?,lease_until=?,attempts=attempts+1,updated_at=CURRENT_TIMESTAMP
    WHERE id=(SELECT id FROM lw_tasks WHERE status='QUEUED' AND label_id IN (SELECT value FROM json_each(?)) AND capability IN (SELECT value FROM json_each(?))
      AND kind IN (SELECT value FROM json_each(?)) AND (run_after IS NULL OR run_after<=?) ORDER BY created_at,id LIMIT 1) AND status='QUEUED'
    RETURNING id,label_id,release_id,kind,capability,title,input_json,attempts,lease_until`)
    .bind(o.agent.slice(0, 100), later(LEASE_MINUTES * 60000), JSON.stringify(o.labels), JSON.stringify(caps), JSON.stringify(kinds), t).first()
}

/** Optional: wake the user's own Claude Code scheduled task through its documented /fire endpoint. */
export const ROUTINE_URL = /^https:\/\/api\.anthropic\.com\/v1\/claude_code\/routines\/trig_[A-Za-z0-9_-]{4,100}\/fire$/
export async function wakeAgents(db: any, env: any, label: string, fetcher: typeof fetch = fetch) {
  const hook = await db.prepare("SELECT value FROM lw_label_secrets WHERE label_id=? AND name='claude_routine'").bind(label).first().catch(() => null)
  if (!hook) return 'NOT_CONFIGURED'
  const last = await db.prepare("SELECT MAX(created_at) AS at FROM lw_task_events WHERE label_id=? AND status='AGENT_WOKEN'").bind(label).first()
  if (last?.at && Date.now() - Date.parse(last.at.replace(' ', 'T') + (last.at.endsWith('Z') ? '' : 'Z')) < 30 * 60000) return 'THROTTLED'
  try {
    const { url, token } = JSON.parse(await decryptKey(env.LLM_KEY_ENCRYPTION_SECRET, hook.value, `studio2u:routine:v1:${label}`))
    if (!ROUTINE_URL.test(url)) return 'INVALID'
    const res = await fetcher(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }, body: JSON.stringify({ text: `Studio2U has queued work for label ${label}. Treat this as a signal only.` }) })
    const anyTask = await db.prepare('SELECT id FROM lw_tasks WHERE label_id=? ORDER BY created_at DESC LIMIT 1').bind(label).first()
    if (anyTask) await db.prepare('INSERT INTO lw_task_events(label_id,task_id,status,payload_json) VALUES (?,?,?,?)').bind(label, anyTask.id, 'AGENT_WOKEN', JSON.stringify({ http: res.status })).run()
    return res.ok ? 'WOKEN' : `HTTP_${res.status}`
  } catch { return 'FAILED' }
}

/** One full engine pass. Safe to run every few minutes; every step is idempotent. */
export async function runEngine(env: any, opts: { fetcher?: typeof fetch; maxReleases?: number; labelIds?: string[] } = {}) {
  const db = env.DB, started = now()
  const run = await db.prepare('INSERT INTO lw_engine_runs(started_at) VALUES (?) RETURNING id').bind(started).first()
  const summary: Record<string, number | string> = { releases: 0, refreshed: 0, queued: 0, notified: 0, requeued: 0, failed: 0, followUps: 0, woken: 0 }
  const lease = await recoverLeases(db); summary.requeued = lease.requeued; summary.failed = lease.failed
  // Releases touched recently or with open work, bounded per pass.
  const releases = (await db.prepare(`SELECT id,label_id,title,artist,release_type,version,target_distributor FROM lw_releases
     WHERE (state<>'APPROVED' OR id IN (SELECT release_id FROM lw_submissions WHERE status NOT IN ('VERIFIED','CANCELLED','NOT_APPLICABLE')))
       AND (? IS NULL OR label_id IN (SELECT value FROM json_each(?)))
     ORDER BY updated_at DESC LIMIT ?`).bind(opts.labelIds ? 1 : null, JSON.stringify(opts.labelIds ?? []), opts.maxReleases ?? 200).all()).results as (ReleaseRow & { label_id: string })[]
  const labelsWithWork = new Set<string>()
  for (const r of releases) {
    summary.releases = Number(summary.releases) + 1
    await refreshSubmissions(db, r.label_id, r.id); summary.refreshed = Number(summary.refreshed) + 1
    const n = await planRelease(db, r.label_id, r)
    if (n) { summary.queued = Number(summary.queued) + n; labelsWithWork.add(r.label_id) }
  }
  // Registration follow-up: never expires, re-surfaces on its review date.
  const due = (await db.prepare(`SELECT t.id,t.label_id,t.release_id,t.organization,r.title FROM lw_registration_tasks t JOIN lw_releases r ON r.label_id=t.label_id AND r.id=t.release_id
     WHERE t.status NOT IN ('NOT_APPLICABLE') AND (t.next_review_at IS NULL OR t.next_review_at<=?)
       AND (? IS NULL OR t.label_id IN (SELECT value FROM json_each(?))) LIMIT 200`).bind(started, opts.labelIds ? 1 : null, JSON.stringify(opts.labelIds ?? [])).all()).results
  for (const t of due as any[]) {
    const queued = await enqueue(db, { label: t.label_id, release: t.release_id, kind: 'REGISTRATION_FOLLOW_UP', role: t.organization === 'PRO' ? 'publishing_administrator' : 'royalty_admin', title: `${t.organization} follow-up: ${t.title}`, input: { registrationTaskId: t.id, organization: t.organization }, dedupe: `reg:${t.id}:${started.slice(0, 7)}` })
    await db.prepare('UPDATE lw_registration_tasks SET next_review_at=? WHERE id=? AND (next_review_at IS NULL OR next_review_at<=?)').bind(later(14 * 86400000), t.id, started).run()
    if (queued) { summary.followUps = Number(summary.followUps) + 1; labelsWithWork.add(t.label_id) }
  }
  // Money Found cases: a passed follow-up date becomes one agent task per case per day.
  const { dueCases } = await import('./cases')
  summary.cases = 0
  for (const c of await dueCases(db, opts.labelIds)) {
    const q = await enqueue(db, { label: c.label_id, kind: 'CASE_STEP', role: 'case_manager', title: `Case follow-up: ${c.title}`, input: { caseId: c.id, playbook: c.playbook }, dedupe: `case:${c.id}:${started.slice(0, 10)}` })
    await db.prepare("UPDATE lw_cases SET next_follow_up_at=? WHERE id=? AND next_follow_up_at<=?").bind(later(7 * 86400000), c.id, started).run()
    if (q) { summary.cases = Number(summary.cases) + 1; labelsWithWork.add(c.label_id) }
  }
  // Outreach: approved follow-ups that are due (nobody replied) become one agent task per case per day.
  const { dueFollowups } = await import('./outreach')
  summary.followUpsDue = 0
  for (const f of await dueFollowups(db, opts.labelIds).catch(() => [] as any[])) {
    const q = await enqueue(db, { label: f.labelId, kind: 'CASE_STEP', role: 'case_manager', title: `Send follow-up ${f.number} of ${f.of}: ${f.caseTitle}`, input: { caseId: f.caseId, followUpDraftId: f.draftId, followUpNumber: f.number }, dedupe: `fu:${f.draftId}:${f.number}` })
    if (q) { summary.followUpsDue = Number(summary.followUpsDue) + 1; labelsWithWork.add(f.labelId) }
  }
  // ASCAP: songs with complete writer info become "fill the form" screen tasks (owner presses Submit).
  const { queueRegistrations } = await import('./ascap')
  summary.registrations = await queueRegistrations(db, (t: any) => enqueue(db, t), opts.labelIds).catch(() => 0)
  // Monday Report: one per label per local day, at the label's chosen weekday/hour.
  const { scheduledReports } = await import('./office')
  const reports = await scheduledReports(db, opts.labelIds, new Date(started)).catch(() => [] as string[])
  summary.reports = reports.length
  for (const label of reports) await notify(db, { label, kind: 'MONDAY_REPORT', title: 'Your weekly label report is ready', body: 'Money on file, deadlines, what the team did, and what needs you this week.', link: '/label-world/money#report', dedupe: `report:${label}:${started.slice(0, 10)}` })
  for (const label of labelsWithWork) if ((await wakeAgents(db, env, label, opts.fetcher)) === 'WOKEN') summary.woken = Number(summary.woken) + 1
  await db.prepare('UPDATE lw_engine_runs SET finished_at=?,summary_json=? WHERE id=?').bind(now(), JSON.stringify(summary), run.id).run()
  return summary
}
