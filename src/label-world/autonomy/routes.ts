// Website API for the autonomy features. Mounted inside labelWorldRoutes, so the
// session check and per-label membership/viewer-write middleware already ran.
import { ServiceError, completeTask, getIntake, getPacket, listNotifications, listParties, listSubmissions, queueOverview, reportSubmission, saveParty, updateIntake } from './service'
import { runEngine, ROUTINE_URL } from './engine'
import { encryptKey } from '../providers/vault'
import { SHIFT_PROMPT } from './mcp-tools'

const base = '/api/label-world/labels/:labelId'
const wrap = (fn: (c: any) => Promise<Response>) => async (c: any) => {
  try { return await fn(c) } catch (e) {
    if (e instanceof ServiceError) return c.json({ error: e.message }, e.status)
    return c.json({ error: 'Request failed' }, 500)
  }
}
const body = async (c: any) => { try { return await c.req.json() } catch { throw new ServiceError('JSON body required') } }

export function installAutonomyRoutes(app: any) {
  app.get(base + '/releases/:releaseId/intake', wrap(async c => c.json(await getIntake(c.env.DB, c.req.param('labelId'), c.req.param('releaseId')))))
  app.post(base + '/releases/:releaseId/intake/patch', wrap(async c => {
    const b = await body(c)
    return c.json(await updateIntake(c.env.DB, c.req.param('labelId'), c.req.param('releaseId'), c.get('lwUser').id, b.patch, b.expectedVersion, 'web'))
  }))
  app.get(base + '/releases/:releaseId/submissions', wrap(async c => c.json({ submissions: await listSubmissions(c.env.DB, c.req.param('labelId'), c.req.param('releaseId')) })))
  app.get(base + '/releases/:releaseId/submissions/:target', wrap(async c => c.json(await getPacket(c.env.DB, c.req.param('labelId'), c.req.param('releaseId'), c.req.param('target').toUpperCase()))))
  app.post(base + '/releases/:releaseId/submissions/report', wrap(async c => c.json(await reportSubmission(c.env.DB, c.req.param('labelId'), c.req.param('releaseId'), c.get('lwUser').id, await body(c), 'web'))))
  app.get(base + '/parties', wrap(async c => c.json({ parties: await listParties(c.env.DB, c.req.param('labelId')) })))
  app.post(base + '/parties', wrap(async c => c.json(await saveParty(c.env.DB, c.req.param('labelId'), c.get('lwUser').id, await body(c), 'web'), 201)))
  app.get(base + '/queue', wrap(async c => c.json(await queueOverview(c.env.DB, [c.req.param('labelId')]))))
  app.post(base + '/queue/:taskId/answer', wrap(async c => {
    // A human can close a waiting task from the website (e.g. "I answered in the intake form").
    const label = c.req.param('labelId'), id = c.req.param('taskId'), db = c.env.DB
    const t = await db.prepare("SELECT id FROM lw_tasks WHERE label_id=? AND id=? AND status IN ('QUEUED','BLOCKED','FAILED')").bind(label, id).first()
    if (!t) throw new ServiceError('Task not found or already running', 404)
    await db.prepare("UPDATE lw_tasks SET status='RUNNING',claimed_by='web',lease_until=datetime('now','+1 minute') WHERE id=?").bind(id).run()
    const b = await body(c)
    return c.json(await completeTask(db, c.get('lwUser').id, [label], { taskId: id, outcome: b.outcome ?? 'COMPLETED', summary: b.summary ?? 'Resolved on the website' }, 'web'))
  }))
  app.get(base + '/notifications/feed', wrap(async c => c.json({ notifications: await listNotifications(c.env.DB, c.req.param('labelId'), c.get('lwUser').id, c.req.query('unread') === '1') })))
  app.post(base + '/notifications/:id/read', wrap(async c => {
    await c.env.DB.prepare('UPDATE lw_notifications SET read_at=CURRENT_TIMESTAMP WHERE label_id=? AND id=? AND (user_id=? OR user_id IS NULL)').bind(c.req.param('labelId'), c.req.param('id'), c.get('lwUser').id).run()
    return c.json({ ok: true })
  }))
  // Owner-triggered engine pass for this label only (the cron worker runs all labels).
  app.post(base + '/engine/run', wrap(async c => {
    if (c.get('lwRole') !== 'owner') throw new ServiceError('Owner permission required', 403)
    return c.json({ summary: await runEngine(c.env, { labelIds: [c.req.param('labelId')], maxReleases: 50 }) })
  }))
  // Agent setup: connector URL, ready-made prompts, and optional Claude scheduled-task wake hook.
  app.get(base + '/agents/setup', wrap(async c => {
    const origin = new URL(c.req.url).origin, label = c.req.param('labelId')
    const hook = await c.env.DB.prepare("SELECT updated_at FROM lw_label_secrets WHERE label_id=? AND name='claude_routine'").bind(label).first()
    return c.json({
      mcpUrl: origin + '/label-world/mcp', shiftPrompt: SHIFT_PROMPT,
      claudeRoutineConfigured: Boolean(hook), claudeRoutineUpdatedAt: hook?.updated_at ?? null,
      commands: {
        codex: `codex mcp add studio2u --url ${origin}/label-world/mcp`,
        claudeCode: `claude mcp add --transport http studio2u ${origin}/label-world/mcp`,
        claudeConnector: `Claude (web/desktop): Settings > Connectors > Add custom connector > ${origin}/label-world/mcp`
      }
    })
  }))
  app.post(base + '/agents/claude-routine', wrap(async c => {
    if (c.get('lwRole') !== 'owner') throw new ServiceError('Owner permission required', 403)
    const b = await body(c), label = c.req.param('labelId'), db = c.env.DB
    if (b.remove === true) { await db.prepare("DELETE FROM lw_label_secrets WHERE label_id=? AND name='claude_routine'").bind(label).run(); return c.json({ configured: false }) }
    const url = String(b.url ?? '').trim(), token = String(b.token ?? '').trim()
    if (!ROUTINE_URL.test(url)) throw new ServiceError('Paste the API trigger URL from claude.ai/code/routines (https://api.anthropic.com/v1/claude_code/routines/trig_.../fire)')
    if (!/^sk-ant-oat01-[A-Za-z0-9_-]{10,300}$/.test(token)) throw new ServiceError('Paste the scheduled-task API token (starts with sk-ant-oat01-). It only lets Studio2U start that one task.')
    const value = await encryptKey(c.env.LLM_KEY_ENCRYPTION_SECRET, JSON.stringify({ url, token }), `studio2u:routine:v1:${label}`)
    await db.batch([
      db.prepare("INSERT INTO lw_label_secrets(label_id,name,value,created_by) VALUES (?,?,?,?) ON CONFLICT(label_id,name) DO UPDATE SET value=excluded.value,created_by=excluded.created_by,updated_at=CURRENT_TIMESTAMP").bind(label, 'claude_routine', value, c.get('lwUser').id),
      db.prepare('INSERT INTO lw_audit_events(id,label_id,actor_id,action,payload_json) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(), label, c.get('lwUser').id, 'agents.claude_routine.configured', JSON.stringify({ url }))
    ])
    return c.json({ configured: true })
  }))
}
