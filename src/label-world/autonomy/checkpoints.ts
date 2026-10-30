// Checkpoints + STOP. Agents do the work end to end (screen control included). Before any big
// move they ask the owner: Submit, Publish, Post, Sell, Send, Spend, Delete. The owner taps
// Approve or Deny. One STOP switch pauses every agent on the label; only the owner resumes.
import { ServiceError, memberRole } from './service'
import { notify } from './engine'

export const CHECKPOINT_KINDS = ['SUBMIT', 'PUBLISH', 'POST', 'SELL', 'SEND', 'SPEND', 'DELETE', 'OTHER'] as const
const VERB: Record<string, string> = { SUBMIT: 'submit', PUBLISH: 'publish', POST: 'post', SELL: 'put up for sale', SEND: 'send', SPEND: 'spend money on', DELETE: 'delete', OTHER: 'do' }
const EXPIRE_HOURS = 72
const str = (v: unknown, f: string, max: number, req = false) => {
  if (v == null || v === '') { if (req) throw new ServiceError(`${f} is required`); return null }
  if (typeof v !== 'string' || v.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v)) throw new ServiceError(`Invalid ${f}`)
  return v.trim() || null
}
const httpsUrl = (v: unknown) => { const s = str(v, 'link', 2000); if (!s) return null; try { const u = new URL(s); if (u.protocol !== 'https:' || u.username || u.password) throw 0; return u.href } catch { throw new ServiceError('Link must be https') } }
const row = (c: any) => c && ({ id: c.id, kind: c.kind, title: c.title, detail: c.detail, site: c.site, previewUrl: c.preview_url, amountUsd: c.amount_cents == null ? null : c.amount_cents / 100, taskId: c.task_id, status: c.status, requestedBy: c.requested_by, decidedAt: c.decided_at, ownerNote: c.owner_note, createdAt: c.created_at })

// ---------------- STOP ----------------
export async function isPaused(db: any, label: string) {
  const r: any = await db.prepare('SELECT paused FROM lw_agent_control WHERE label_id=?').bind(label).first().catch(() => null)
  return Boolean(r?.paused)
}
export async function pausedLabels(db: any, labels: string[]) {
  if (!labels.length) return new Set<string>()
  const rows = (await db.prepare('SELECT label_id FROM lw_agent_control WHERE paused=1 AND label_id IN (SELECT value FROM json_each(?))').bind(JSON.stringify(labels)).all().catch(() => ({ results: [] }))).results as any[]
  return new Set(rows.map(r => r.label_id as string))
}
/** STOP: any editor can press it. Cancels queued agent work, pauses Ben, expires open checkpoints' tasks. */
export async function stopAll(db: any, label: string, actor: number) {
  const role = await memberRole(db, label, actor)
  if (!role) throw new ServiceError('Label not found', 404)
  if (role === 'viewer') throw new ServiceError('Editing permission required', 403)
  const res = await db.batch([
    db.prepare('INSERT INTO lw_agent_control(label_id,paused,paused_by,paused_at) VALUES (?,1,?,CURRENT_TIMESTAMP) ON CONFLICT(label_id) DO UPDATE SET paused=1,paused_by=excluded.paused_by,paused_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP').bind(label, actor),
    db.prepare("UPDATE lw_tasks SET status='CANCELLED',result_json=json_object('outcome','STOPPED_BY_OWNER'),updated_at=CURRENT_TIMESTAMP WHERE label_id=? AND status='QUEUED' AND kind<>'GENERIC'").bind(label),
    db.prepare("UPDATE lw_partner_settings SET autopilot='PAUSED',updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE label_id=? AND autopilot='ON'").bind(actor, label),
    db.prepare('INSERT INTO lw_audit_events(id,label_id,actor_id,action,payload_json) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(), label, actor, 'agents.stopped', '{}')
  ])
  return { paused: true, cancelledTasks: res[1].meta.changes, say: 'Stopped. Every agent on this label is paused and queued work was cancelled. Nothing else happens until you tap Resume.' }
}
export async function resumeAll(db: any, label: string, actor: number) {
  if ((await memberRole(db, label, actor)) !== 'owner') throw new ServiceError('Only the label owner can resume the agents', 403)
  await db.batch([
    db.prepare('INSERT INTO lw_agent_control(label_id,paused) VALUES (?,0) ON CONFLICT(label_id) DO UPDATE SET paused=0,updated_at=CURRENT_TIMESTAMP').bind(label),
    db.prepare('INSERT INTO lw_audit_events(id,label_id,actor_id,action,payload_json) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(), label, actor, 'agents.resumed', '{}')
  ])
  return { paused: false, say: 'Resumed. Your team picks work back up on its next run. (Ben\'s autopilot stays off until you turn it on.)' }
}

// ---------------- checkpoints ----------------
export async function askCheckpoint(db: any, label: string, actor: number, b: any, by: string) {
  const role = await memberRole(db, label, actor)
  if (!role || role === 'viewer') throw new ServiceError('Editing permission required', 403)
  if (await isPaused(db, label)) throw new ServiceError('The owner pressed STOP. Do nothing until they resume.', 423)
  const kind = String(b?.kind ?? '')
  if (!(CHECKPOINT_KINDS as readonly string[]).includes(kind)) throw new ServiceError(`kind must be one of ${CHECKPOINT_KINDS.join(', ')}`)
  const title = str(b?.title, 'title', 200, true)!, detail = str(b?.detail, 'detail', 4000), site = str(b?.site, 'site', 200)
  const amount = b?.amountUsd == null ? null : Math.round(Number(b.amountUsd) * 100)
  if (amount != null && (!Number.isFinite(amount) || amount < 0 || amount > 10_000_000)) throw new ServiceError('amountUsd must be a positive number')
  const taskId = str(b?.taskId, 'taskId', 100)
  // Same question twice = same checkpoint (agents retry).
  const dup: any = await db.prepare("SELECT * FROM lw_checkpoints WHERE label_id=? AND status='PENDING' AND kind=? AND title=? LIMIT 1").bind(label, kind, title).first()
  if (dup) return { ...row(dup), reused: true, say: 'Already waiting for the owner. Check back with check_checkpoint.' }
  const id = crypto.randomUUID()
  await db.prepare('INSERT INTO lw_checkpoints(id,label_id,kind,title,detail,site,preview_url,amount_cents,task_id,requested_by) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .bind(id, label, kind, title, detail, site, httpsUrl(b?.previewUrl), amount, taskId, by.slice(0, 100)).run()
  await notify(db, { label, kind: 'CHECKPOINT', title: `Can I ${VERB[kind]} this? ${title}`.slice(0, 200), body: `${detail ?? ''}${site ? `\nWhere: ${site}` : ''}${amount != null ? `\nCost: $${(amount / 100).toFixed(2)}` : ''}\n\nTap Approve or Deny at the top of Label World.`.trim(), link: '/label-world#checkpoints', dedupe: `checkpoint:${id}` })
  return { ...row(await db.prepare('SELECT * FROM lw_checkpoints WHERE id=?').bind(id).first()), say: 'Asked the owner. Wait: call check_checkpoint until it says APPROVED or DENIED. Do not do it before APPROVED.' }
}
export async function checkCheckpoint(db: any, label: string, id: string) {
  const c: any = await db.prepare('SELECT * FROM lw_checkpoints WHERE label_id=? AND id=?').bind(label, id).first()
  if (!c) throw new ServiceError('Checkpoint not found', 404)
  if (c.status === 'PENDING' && Date.now() - Date.parse(c.created_at.replace(' ', 'T') + 'Z') > EXPIRE_HOURS * 3600000) {
    await db.prepare("UPDATE lw_checkpoints SET status='EXPIRED' WHERE id=? AND status='PENDING'").bind(id).run(); c.status = 'EXPIRED'
  }
  const paused = await isPaused(db, label)
  const go = c.status === 'APPROVED' && !paused
  return { ...row(c), paused, go, say: paused ? 'STOP is on. Do nothing.' : go ? 'Approved. Go ahead, then report what happened.' : c.status === 'PENDING' ? 'Still waiting for the owner. Do not do it yet.' : c.status === 'DENIED' ? `Denied${c.owner_note ? `: ${c.owner_note}` : ''}. Do not do it.` : 'Expired without an answer. Do not do it; ask again later if still needed.' }
}
export async function decideCheckpoint(db: any, label: string, actor: number, id: string, b: any) {
  if ((await memberRole(db, label, actor)) !== 'owner') throw new ServiceError('Only the label owner can approve or deny', 403)
  const decision = String(b?.decision ?? '')
  if (!['APPROVED', 'DENIED'].includes(decision)) throw new ServiceError('decision must be APPROVED or DENIED')
  const r = await db.prepare("UPDATE lw_checkpoints SET status=?,decided_by=?,decided_at=CURRENT_TIMESTAMP,owner_note=? WHERE id=? AND label_id=? AND status='PENDING'").bind(decision, actor, str(b?.note, 'note', 500), id, label).run()
  if (!r.meta.changes) throw new ServiceError('That checkpoint was already answered or expired', 409)
  await db.prepare('INSERT INTO lw_audit_events(id,label_id,actor_id,action,payload_json) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(), label, actor, 'checkpoint.' + decision.toLowerCase(), JSON.stringify({ id })).run()
  return { ...row(await db.prepare('SELECT * FROM lw_checkpoints WHERE id=?').bind(id).first()), say: decision === 'APPROVED' ? 'Approved. Your agent goes ahead on its next step.' : 'Denied. Your agent will not do it.' }
}
export async function controlStatus(db: any, label: string, actor: number) {
  const role = await memberRole(db, label, actor); if (!role) throw new ServiceError('Label not found', 404)
  await db.prepare(`UPDATE lw_checkpoints SET status='EXPIRED' WHERE label_id=? AND status='PENDING' AND created_at<datetime('now','-${EXPIRE_HOURS} hours')`).bind(label).run()
  const pending = ((await db.prepare("SELECT * FROM lw_checkpoints WHERE label_id=? AND status='PENDING' ORDER BY created_at LIMIT 30").bind(label).all()).results as any[]).map(row)
  const recent = ((await db.prepare("SELECT * FROM lw_checkpoints WHERE label_id=? AND status<>'PENDING' ORDER BY COALESCE(decided_at,created_at) DESC LIMIT 10").bind(label).all()).results as any[]).map(row)
  const working: any = await db.prepare("SELECT COUNT(*) n FROM lw_tasks WHERE label_id=? AND status='RUNNING'").bind(label).first()
  return { role, paused: await isPaused(db, label), pending, recent, running: working?.n ?? 0 }
}
