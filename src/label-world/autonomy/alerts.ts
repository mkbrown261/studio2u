// Tell the owner when they are needed, without opening the site.
//  * Phone push via ntfy (ntfy.sh, free and open source): the owner installs the ntfy app and
//    subscribes to their own random topic. Checked 2026-11-02: POST https://ntfy.sh/ with JSON
//    {topic,title,message,click,tags,priority} delivers instantly.
//  * Email via Resend only when the deployment has RESEND_API_KEY + ALERT_EMAIL_FROM set.
// Privacy: alerts say only how many things need you ("2 approvals, 1 question"), never song
// names, case details or account names, because a push topic is a public channel by design.
// The Pages app runs delivery (it holds the secrets); the cron engine pings it every 5 minutes.
import { ServiceError } from './service'
import { PUBLIC_ORIGIN } from './shows'

export const NEEDS_YOU: Record<string, 'approval' | 'question' | 'team' | 'problem'> = {
  CHECKPOINT: 'approval', APPROVAL: 'approval', PARTNER_PLAN: 'approval', AGREEMENT: 'approval',
  QUESTIONS: 'question', NEEDS_CORRECTION: 'question', TEAM_IDLE: 'team', PARTNER_POST_FAILED: 'problem'
}
export type Fetch = (url: string, init?: RequestInit) => Promise<Response>
const hex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => b.toString(16).padStart(2, '0')).join('')
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`
const emailReady = (env: any) => Boolean(env?.RESEND_API_KEY && env?.ALERT_EMAIL_FROM)

export async function getAlerts(db: any, user: number, env: any = {}) {
  const p: any = await db.prepare('SELECT * FROM lw_notify_prefs WHERE user_id=?').bind(user).first().catch(() => null)
  return {
    push: Boolean(p?.push_on), topic: p?.push_on ? p.push_topic : null, subscribeUrl: p?.push_on ? `https://ntfy.sh/${p.push_topic}` : null,
    email: Boolean(p?.email_on), emailAvailable: emailReady(env), lastPushAt: p?.last_push_at ?? null
  }
}
export async function setAlerts(db: any, user: number, b: any, env: any = {}) {
  const cur: any = await db.prepare('SELECT * FROM lw_notify_prefs WHERE user_id=?').bind(user).first()
  const push = b?.push == null ? Boolean(cur?.push_on) : Boolean(b.push)
  const email = b?.email == null ? Boolean(cur?.email_on) : Boolean(b.email)
  if (email && !emailReady(env)) throw new ServiceError('Email alerts are not set up on this deployment yet. Use phone alerts.', 409)
  // Turning push back on makes a NEW topic, so an old subscription stops receiving.
  const topic = push ? (cur?.push_on && cur?.push_topic ? cur.push_topic : `s2u-${hex(16)}`) : cur?.push_topic ?? null
  await db.prepare(`INSERT INTO lw_notify_prefs(user_id,push_topic,push_on,email_on) VALUES (?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET push_topic=excluded.push_topic,push_on=excluded.push_on,email_on=excluded.email_on,updated_at=CURRENT_TIMESTAMP`).bind(user, topic, push ? 1 : 0, email ? 1 : 0).run()
  return getAlerts(db, user, env)
}

async function push(fetcher: Fetch, topic: string, title: string, message: string) {
  const r = await fetcher('https://ntfy.sh/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic, title, message, click: `${PUBLIC_ORIGIN}/label-world/today`, tags: ['bell'], priority: 4 }) })
  if (!r.ok) throw new Error('push ' + r.status)
}
async function email(env: any, fetcher: Fetch, to: string, subject: string, text: string) {
  const r = await fetcher('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: env.ALERT_EMAIL_FROM, to: [to], subject, text: `${text}\n\nOpen Today: ${PUBLIC_ORIGIN}/label-world/today` }) })
  if (!r.ok) throw new Error('email ' + r.status)
}

export async function testAlert(env: any, user: number, fetcher: Fetch = fetch) {
  const a = await getAlerts(env.DB, user, env)
  if (!a.push && !a.email) throw new ServiceError('Turn on phone alerts first.', 409)
  if (a.push) {
    try { await push(fetcher, a.topic!, 'Studio2U test', 'Phone alerts work. You will hear from your team only when they need you.') }
    catch { throw new ServiceError('The push service did not answer. Try again in a minute.', 502) }
  }
  return { sent: true, say: 'Test sent. If it did not arrive, open the ntfy app and subscribe to your topic.' }
}

/** One batched alert per person per pass, only for things that need them. Marks them delivered. */
export async function deliverAlerts(env: any, fetcher: Fetch = fetch) {
  const db = env.DB
  const rows = (await db.prepare(`SELECT n.id,n.user_id,n.kind,p.push_on,p.push_topic,p.email_on,u.email FROM lw_notifications n
      JOIN lw_notify_prefs p ON p.user_id=n.user_id JOIN users u ON u.id=n.user_id
    WHERE n.delivered_at IS NULL AND n.read_at IS NULL AND n.kind IN (SELECT value FROM json_each(?))
      AND n.created_at>datetime('now','-2 days') AND (p.push_on=1 OR p.email_on=1) LIMIT 500`).bind(JSON.stringify(Object.keys(NEEDS_YOU))).all()).results as any[]
  const byUser = new Map<number, any[]>()
  for (const r of rows) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r])
  let pushed = 0, emailed = 0, failed = 0
  for (const [user, list] of byUser) {
    const c = { approval: 0, question: 0, team: 0, problem: 0 }
    for (const r of list) c[NEEDS_YOU[r.kind]]++
    const parts = [c.approval && plural(c.approval, 'approval'), c.question && plural(c.question, 'question'), c.problem && plural(c.problem, 'problem'), c.team && 'your team is waiting to run'].filter(Boolean)
    const title = 'Studio2U: your team needs you', message = `${parts.join(', ')}. Tap to open Today.`
    const p = list[0], channels: string[] = []
    try { if (p.push_on && p.push_topic) { await push(fetcher, p.push_topic, title, message); pushed++; channels.push('push') } } catch { failed++ }
    try { if (p.email_on && p.email && emailReady(env)) { await email(env, fetcher, p.email, title, message); emailed++; channels.push('email') } } catch { failed++ }
    if (!channels.length) continue
    await db.batch([
      db.prepare('UPDATE lw_notifications SET delivered_at=CURRENT_TIMESTAMP,channel=? WHERE id IN (SELECT value FROM json_each(?))').bind(channels.join('+'), JSON.stringify(list.map(r => r.id))),
      db.prepare('UPDATE lw_notify_prefs SET last_push_at=CURRENT_TIMESTAMP WHERE user_id=?').bind(user)
    ])
  }
  return { pushed, emailed, failed }
}

/** Runs on the Pages side (it holds the secrets): alerts, then wake the owner's cloud task if work is waiting. */
export async function deliveryPass(env: any, fetcher: Fetch = fetch) {
  const alerts = await deliverAlerts(env, fetcher).catch(() => ({ pushed: 0, emailed: 0, failed: 1 }))
  const { wakeAgents } = await import('./engine')
  const due = (await env.DB.prepare(`SELECT DISTINCT label_id FROM lw_tasks WHERE status='QUEUED' AND kind<>'GENERIC' AND (run_after IS NULL OR run_after<=strftime('%Y-%m-%dT%H:%M:%fZ','now')) LIMIT 200`).all()).results as any[]
  let woken = 0
  for (const d of due) if ((await wakeAgents(env.DB, env, d.label_id, fetcher as any).catch(() => 'FAILED')) === 'WOKEN') woken++
  return { ...alerts, woken }
}

/** Constant-time check of the engine's shared secret (must be 32+ chars). */
export function engineAuthorized(env: any, given: string | undefined | null) {
  const want = String(env?.ENGINE_SHARED_SECRET ?? ''), got = String(given ?? '')
  if (want.length < 32 || got.length !== want.length) return false
  let d = 0
  for (let i = 0; i < want.length; i++) d |= want.charCodeAt(i) ^ got.charCodeAt(i)
  return d === 0
}
