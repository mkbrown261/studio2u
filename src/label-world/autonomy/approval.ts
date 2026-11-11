// Final approval (Eric's page): version-bound. Anyone who can edit requests it; only the owner
// approves or rejects. It can only be requested when this exact release version has a current
// technical review with no failures and a recorded rights statement. Any later intake change
// bumps the version and invalidates it (service.updateIntake already does this).
import { ServiceError, memberRole } from './service'
import { notify } from './engine'
import { matchesSnapshot } from '../reviewer/current'
import { rightsGate } from '../release-operations'

async function load(db: any, label: string, releaseId: string, user: number) {
  const release: any = await db.prepare('SELECT * FROM lw_releases WHERE label_id=? AND id=?').bind(label, releaseId).first()
  if (!release) throw new ServiceError('Release not found', 404)
  // Latest completed review of this release by ANYONE on the label (the owner approves what an editor reviewed).
  const rep: any = await db.prepare("SELECT id,release_version,findings_json FROM lw_reviews WHERE label_id=? AND release_id=? AND status='COMPLETED' ORDER BY created_at DESC,rowid DESC LIMIT 1").bind(label, releaseId).first()
  const assets = (await db.prepare("SELECT id,kind FROM lw_assets WHERE label_id=? AND release_id=? AND kind IN ('master','artwork') ORDER BY created_at DESC,rowid DESC").bind(label, releaseId).all()).results
  const findings = rep ? JSON.parse(rep.findings_json) : []
  const tech = { review: rep, findings, current: rep ? matchesSnapshot(findings, rep.release_version, release.version, assets) : false }
  const rr: any = await db.prepare('SELECT assertions_json FROM lw_rights_reviews WHERE label_id=? AND release_id=? AND release_version=?').bind(label, releaseId, release.version).first()
  const rights = rightsGate(rr ? JSON.parse(rr.assertions_json) : null)
  const blockers: string[] = []
  if (!tech.review) blockers.push('Run a review first: upload the master WAV and artwork, then tap "Request Review".')
  else if (!tech.current) blockers.push(`The last review was for an older version or older files. Tap "Request Re-review" for version ${release.version}.`)
  else for (const f of tech.findings.filter((x: any) => x.status === 'FAIL')) blockers.push(`Fix: ${f.check} - ${f.detail}`)
  if (rights.status !== 'OWNER_ATTESTED') blockers.push('Record your rights statement for this version (Intake & rights controls).')
  const approvals = (await db.prepare('SELECT id,release_version,action,status,requested_by,decided_by,created_at FROM lw_approvals WHERE label_id=? AND release_id=? ORDER BY created_at DESC LIMIT 10').bind(label, releaseId).all()).results as any[]
  return { release, blockers, approvals, current: approvals.find(a => a.release_version === release.version && ['PENDING', 'APPROVED'].includes(a.status)) ?? null }
}
export async function approvalStatus(db: any, label: string, releaseId: string, user: number) {
  if (!await memberRole(db, label, user)) throw new ServiceError('Label not found', 404)
  const s = await load(db, label, releaseId, user)
  return { version: s.release.version, state: s.release.state, blockers: s.blockers, current: s.current, history: s.approvals }
}
export async function approvalAction(db: any, label: string, releaseId: string, user: number, b: any) {
  const role = await memberRole(db, label, user)
  if (!role) throw new ServiceError('Label not found', 404)
  if (role === 'viewer') throw new ServiceError('Editing permission required', 403)
  const action = String(b?.action ?? '')
  if (!['REQUEST', 'APPROVE', 'REJECT'].includes(action)) throw new ServiceError('action must be REQUEST, APPROVE or REJECT')
  const s = await load(db, label, releaseId, user), v = s.release.version
  const audit = (what: string, extra: unknown) => db.prepare('INSERT INTO lw_audit_events(id,label_id,release_id,actor_id,action,payload_json) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(), label, releaseId, user, what, JSON.stringify(extra))
  if (action === 'REQUEST') {
    if (s.blockers.length) throw new ServiceError('Not ready for final approval yet:\n' + s.blockers.map((x, i) => `${i + 1}. ${x}`).join('\n'), 409)
    if (s.current) return { status: s.current.status, approvalId: s.current.id, version: v, say: s.current.status === 'APPROVED' ? `Version ${v} is already approved.` : 'Already waiting for the owner.' }
    const id = crypto.randomUUID()
    await db.batch([db.prepare("INSERT INTO lw_approvals(id,label_id,release_id,release_version,action,requested_by,status) VALUES (?,?,?,?,'FINAL_RELEASE',?,'PENDING')").bind(id, label, releaseId, v, user), audit('approval.requested', { version: v })])
    await notify(db, { label, release: releaseId, kind: 'APPROVAL', title: `Final approval requested: ${s.release.title} v${v}`, body: 'The review passed and rights are recorded. Open Eric > Final Approval to approve or reject this exact version.', link: '/label-world/agents/reviewer', dedupe: `approval:${releaseId}:v${v}` })
    if (role === 'owner') return { status: 'PENDING', approvalId: id, version: v, say: 'Requested. You are the owner, so you can approve it right below.' }
    return { status: 'PENDING', approvalId: id, version: v, say: 'Requested. The owner has been notified.' }
  }
  if (role !== 'owner') throw new ServiceError('Only the label owner can approve or reject', 403)
  const pending = s.approvals.find(a => a.release_version === v && a.status === 'PENDING')
  if (!pending) throw new ServiceError('Nothing is waiting for approval on this version. Tap "Request Final Approval" first.', 409)
  if (action === 'APPROVE' && s.blockers.length) throw new ServiceError('Something changed since it was requested:\n' + s.blockers.join('\n'), 409)
  const status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED'
  await db.batch([
    db.prepare("UPDATE lw_approvals SET status=?,decided_by=? WHERE id=? AND status='PENDING'").bind(status, user, pending.id),
    ...(status === 'APPROVED' ? [db.prepare("UPDATE lw_releases SET state='APPROVED',updated_at=CURRENT_TIMESTAMP WHERE label_id=? AND id=? AND version=?").bind(label, releaseId, v)] : []),
    audit('approval.' + status.toLowerCase(), { version: v, approvalId: pending.id, note: typeof b?.note === 'string' ? b.note.slice(0, 500) : null })
  ])
  return { status, approvalId: pending.id, version: v, say: status === 'APPROVED' ? `Version ${v} approved. Any later change to the release will need a new approval.` : 'Rejected. Make the changes and request again.' }
}
