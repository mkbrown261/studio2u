// Today: one screen instead of six pages. What needs you (one tap each), what your team did,
// what is stuck, whether the team is running, and the money/catalog numbers that matter.
// Read-only; every button on the screen uses the existing decision routes.
import { ServiceError, memberRole } from './service'

const J = (s: any) => { try { return JSON.parse(s || '{}') } catch { return {} } }
const CONF: Record<string, number> = { STRONG: 0, LIKELY: 1, POSSIBLE: 2 }

export async function today(db: any, label: string, actor: number) {
  const role = await memberRole(db, label, actor)
  if (!role) throw new ServiceError('Label not found', 404)
  const all = async (sql: string, ...b: any[]) => ((await db.prepare(sql).bind(label, ...b).all().catch(() => ({ results: [] }))).results ?? []) as any[]

  const checkpoints = (await all(`SELECT id,kind,title,detail,site,preview_url,amount_cents,requested_by,created_at FROM lw_checkpoints WHERE label_id=? AND status='PENDING' ORDER BY created_at LIMIT 20`))
    .map(c => ({ id: c.id, kind: c.kind, title: c.title, detail: c.detail, site: c.site, previewUrl: c.preview_url, amountUsd: c.amount_cents == null ? null : c.amount_cents / 100, askedBy: c.requested_by, at: c.created_at }))
  const profiles = (await all(`SELECT id,platform,url,confidence,evidence FROM lw_artist_links WHERE label_id=? AND status='SUGGESTED' LIMIT 30`))
    .sort((a, b) => (CONF[a.confidence] ?? 3) - (CONF[b.confidence] ?? 3)).slice(0, 6)
    .map(l => ({ id: l.id, platform: l.platform, url: l.url, confidence: l.confidence, evidence: l.evidence, fillsCatalog: ['apple_music', 'deezer'].includes(l.platform) }))
  const plans = (await all(`SELECT p.id,p.week_start,(SELECT COUNT(*) FROM lw_partner_posts x WHERE x.plan_id=p.id) posts FROM lw_partner_plans p WHERE p.label_id=? AND p.status='DRAFT' ORDER BY p.week_start LIMIT 3`))
    .map(p => ({ id: p.id, weekStart: p.week_start, posts: p.posts }))
  const drafts = (await all(`SELECT d.id,d.kind,d.recipient,d.subject,c.title case_title,c.id case_id FROM lw_case_drafts d JOIN lw_cases c ON c.id=d.case_id WHERE d.label_id=? AND d.status='DRAFT' ORDER BY d.created_at LIMIT 10`))
    .map(d => ({ id: d.id, kind: d.kind, to: d.recipient, subject: d.subject, caseId: d.case_id, caseTitle: d.case_title }))
  const designs = (await all(`SELECT id,title FROM lw_merch_designs WHERE label_id=? AND status='DRAFT' AND object_key IS NOT NULL ORDER BY created_at DESC LIMIT 6`))
  const questions = (await all(`SELECT id,title,result_json FROM lw_tasks WHERE label_id=? AND status='QUEUED' AND json_extract(result_json,'$.outcome')='WAITING_FOR_INPUT' ORDER BY updated_at DESC LIMIT 10`))
    .map(t => ({ taskId: t.id, title: t.title, questions: (J(t.result_json).questions ?? []).slice(0, 5) })).filter(q => q.questions.length)

  const done = (await all(`SELECT id,kind,title,result_json,updated_at FROM lw_tasks WHERE label_id=? AND status='COMPLETED' AND kind<>'GENERIC' AND updated_at>datetime('now','-7 days') ORDER BY updated_at DESC LIMIT 12`))
    .map(t => ({ id: t.id, kind: t.kind, title: t.title, summary: String(J(t.result_json).summary ?? '').slice(0, 300), at: t.updated_at }))
  const decided = (await all(`SELECT title,status,decided_at FROM lw_checkpoints WHERE label_id=? AND status IN ('APPROVED','DENIED') AND decided_at>datetime('now','-7 days') ORDER BY decided_at DESC LIMIT 6`))
  const stuck = (await all(`SELECT id,kind,title,status,result_json,updated_at FROM lw_tasks WHERE label_id=? AND status IN ('FAILED','BLOCKED') AND updated_at>datetime('now','-14 days') ORDER BY updated_at DESC LIMIT 8`))
    .map(t => ({ id: t.id, kind: t.kind, title: t.title, status: t.status, why: String(J(t.result_json).summary ?? '').slice(0, 300), at: t.updated_at }))
  const queued = (await all(`SELECT kind,title,created_at FROM lw_tasks WHERE label_id=? AND status IN ('QUEUED','RUNNING') AND kind<>'GENERIC' AND json_extract(result_json,'$.outcome') IS NOT 'WAITING_FOR_INPUT' ORDER BY created_at LIMIT 10`))

  const { teamHealth } = await import('./team')
  const { catalogSummary } = await import('./cases')
  const { moneySummary } = await import('./office')
  const team = await teamHealth(db, label).catch(() => null)
  const catalog = await catalogSummary(db, label).catch(() => ({ songs: 0 }))
  const money = await moneySummary(db, label).catch(() => null)
  const paused = Boolean(((await db.prepare('SELECT paused FROM lw_agent_control WHERE label_id=?').bind(label).first().catch(() => null)) as any)?.paused)

  const needsYou = checkpoints.length + profiles.length + plans.length + drafts.length + designs.length + questions.length
  const headline = paused ? 'Your team is stopped. Tap Resume when you want them back.'
    : needsYou ? `${needsYou} thing${needsYou === 1 ? '' : 's'} need${needsYou === 1 ? 's' : ''} you. Everything else is handled.`
    : team && ['STALLED', 'NEVER_RAN', 'NOT_CONNECTED'].includes(team.state) ? team.say
    : 'Nothing needs you right now.'
  return {
    role, paused, headline, needsYou,
    needs: { checkpoints, profiles, plans, drafts, designs, questions },
    done, decided, stuck, queued, team,
    numbers: { songs: catalog.songs ?? 0, verifiedEarnedUsd: money?.verifiedEarnedUsd ?? 0 }
  }
}
/** The owner looked at Today: those alerts are seen, so they are not pushed to the phone again. */
export async function markSeen(db: any, label: string, actor: number) {
  if (!(await memberRole(db, label, actor))) throw new ServiceError('Label not found', 404)
  const r = await db.prepare('UPDATE lw_notifications SET read_at=CURRENT_TIMESTAMP WHERE label_id=? AND user_id=? AND read_at IS NULL').bind(label, actor).run()
  return { seen: r.meta.changes }
}
