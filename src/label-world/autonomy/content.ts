// Content Studio: campaigns and content concepts (Carla researches, Builder writes).
// Agents draft concepts; only a human approves them. Evidence must point at saved
// social snapshots so ideas are grounded in what actually worked, not made up.
import { ServiceError, memberRole, requireEditor } from './service'

const PLATFORMS = ['tiktok', 'instagram', 'youtube_shorts', 'youtube', 'snapchat', 'other']
const CTRL = /[\x00-\x08\x0b\x0c\x0e-\x1f]/
const s = (v: unknown, f: string, max: number, req = false) => {
  if (v == null || v === '') { if (req) throw new ServiceError(`${f} required`); return null }
  if (typeof v !== 'string' || v.length > max || CTRL.test(v)) throw new ServiceError(`Invalid ${f}`)
  return v.trim() || null
}
const j = (x: string) => { try { return JSON.parse(x) } catch { return null } }

export async function createCampaign(db: any, label: string, actor: number, b: any) {
  await requireEditor(db, label, actor)
  const id = crypto.randomUUID()
  if (b?.releaseId && !await db.prepare('SELECT 1 FROM lw_releases WHERE label_id=? AND id=?').bind(label, b.releaseId).first()) throw new ServiceError('Release not found', 404)
  const brief = { audience: s(b?.audience, 'audience', 500), vibe: s(b?.vibe, 'vibe', 500), budget: s(b?.budget, 'budget', 200), deadline: s(b?.deadline, 'deadline', 40), references: s(b?.references, 'references', 2000) }
  await db.prepare('INSERT INTO lw_campaigns(id,label_id,release_id,track_title,objective,brief_json,created_by) VALUES (?,?,?,?,?,?,?)')
    .bind(id, label, b?.releaseId ?? null, s(b?.trackTitle, 'Song title', 200, true), s(b?.objective, 'Goal', 500, true), JSON.stringify(brief), actor).run()
  return getCampaign(db, label, actor, id)
}
export async function listCampaigns(db: any, label: string, actor: number) {
  if (!await memberRole(db, label, actor)) throw new ServiceError('Label not found', 404)
  return (await db.prepare(`SELECT c.id,c.track_title,c.objective,c.status,c.created_at,
     (SELECT COUNT(*) FROM lw_content_concepts k WHERE k.campaign_id=c.id) AS concepts,
     (SELECT COUNT(*) FROM lw_content_concepts k WHERE k.campaign_id=c.id AND k.status='DRAFT') AS waiting
    FROM lw_campaigns c WHERE c.label_id=? ORDER BY c.created_at DESC LIMIT 50`).bind(label).all()).results
}
const conceptView = (k: any) => ({ id: k.id, title: k.title, hook: k.hook, treatment: k.treatment, songSection: k.song_section, shots: j(k.shots_json) ?? [], durationSec: k.duration_sec, platform: k.platform, caption: k.caption, cta: k.cta,
  lowBudget: k.low_budget, highBudget: k.high_budget, rightsNotes: k.rights_notes, evidence: j(k.evidence_json) ?? [], status: k.status, writtenBy: k.written_by, updatedAt: k.updated_at })
export async function getCampaign(db: any, label: string, actor: number, id: string) {
  if (!await memberRole(db, label, actor)) throw new ServiceError('Label not found', 404)
  const c: any = await db.prepare('SELECT * FROM lw_campaigns WHERE label_id=? AND id=?').bind(label, id).first()
  if (!c) throw new ServiceError('Campaign not found', 404)
  const concepts = (await db.prepare('SELECT * FROM lw_content_concepts WHERE campaign_id=? ORDER BY created_at').bind(id).all()).results.map(conceptView)
  return { id: c.id, trackTitle: c.track_title, objective: c.objective, releaseId: c.release_id, status: c.status, brief: j(c.brief_json) ?? {}, createdAt: c.created_at, concepts }
}
/** Agents (or the user) add a concept. Always lands as DRAFT. */
export async function addConcept(db: any, label: string, actor: number, campaignId: string, b: any, by: string) {
  await requireEditor(db, label, actor)
  if (!await db.prepare('SELECT 1 FROM lw_campaigns WHERE label_id=? AND id=?').bind(label, campaignId).first()) throw new ServiceError('Campaign not found', 404)
  const n = await db.prepare('SELECT COUNT(*) AS n FROM lw_content_concepts WHERE campaign_id=?').bind(campaignId).first()
  if ((n as any).n >= 40) throw new ServiceError('A campaign holds up to 40 concepts; reject some first')
  const platform = b?.platform ? String(b.platform).toLowerCase() : null
  if (platform && !PLATFORMS.includes(platform)) throw new ServiceError(`platform must be one of ${PLATFORMS.join(', ')}`)
  const shots = Array.isArray(b?.shots) ? b.shots.slice(0, 20).map((x: any, i: number) => s(typeof x === 'string' ? x : JSON.stringify(x), `shot ${i + 1}`, 400)).filter(Boolean) : []
  const evidence = Array.isArray(b?.evidence) ? b.evidence.slice(0, 10).map((x: any) => ({ snapshotId: x?.snapshotId ? String(x.snapshotId).slice(0, 60) : null, url: x?.url ? String(x.url).slice(0, 500) : null, why: s(x?.why, 'evidence why', 400) })) : []
  const dur = b?.durationSec == null ? null : Number(b.durationSec)
  if (dur != null && (!Number.isInteger(dur) || dur < 3 || dur > 600)) throw new ServiceError('durationSec must be 3-600')
  const id = crypto.randomUUID()
  await db.prepare(`INSERT INTO lw_content_concepts(id,campaign_id,label_id,title,hook,treatment,song_section,shots_json,duration_sec,platform,caption,cta,low_budget,high_budget,rights_notes,evidence_json,written_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id, campaignId, label, s(b?.title, 'title', 160, true), s(b?.hook, 'hook (first 2 seconds)', 400, true), s(b?.treatment, 'treatment', 3000, true), s(b?.songSection, 'song section', 120), JSON.stringify(shots), dur, platform,
      s(b?.caption, 'caption', 2200), s(b?.cta, 'call to action', 300), s(b?.lowBudget, 'phone-only version', 1500), s(b?.highBudget, 'bigger-budget version', 1500), s(b?.rightsNotes, 'rights notes', 1000), JSON.stringify(evidence), by.slice(0, 100)).run()
  return { id, status: 'DRAFT', note: 'Saved as a draft. The owner approves it on the website.' }
}
const NEXT: Record<string, string[]> = { DRAFT: ['APPROVED', 'REJECTED'], APPROVED: ['SHOT', 'REJECTED'], SHOT: ['POSTED'], REJECTED: ['DRAFT'], POSTED: [] }
/** Status changes. Approve/reject are owner/editor decisions on the website; agents may only mark SHOT/POSTED facts. */
export async function setConceptStatus(db: any, label: string, actor: number, id: string, status: string, by: 'owner' | 'agent') {
  await requireEditor(db, label, actor)
  const k: any = await db.prepare('SELECT status FROM lw_content_concepts WHERE label_id=? AND id=?').bind(label, id).first()
  if (!k) throw new ServiceError('Concept not found', 404)
  if (!NEXT[k.status]?.includes(status)) throw new ServiceError(`Can't go from ${k.status} to ${status}`, 409)
  if (by === 'agent' && ['APPROVED', 'REJECTED'].includes(status)) throw new ServiceError('Only you can approve or reject content ideas, on the website.', 403)
  await db.prepare('UPDATE lw_content_concepts SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(status, id).run()
  return { id, status }
}
