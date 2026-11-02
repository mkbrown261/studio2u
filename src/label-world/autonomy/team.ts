// Keep the team running. Nothing happens until the owner's own agent (Claude/Codex) connects
// and works the queue. This module answers "is my team actually working?", gives the owner a
// one-paste unattended shift prompt (for a scheduled task on their computer, or a cloud wake-up),
// and lets the engine nudge the owner once a day when work is piling up with nobody running it.
// Facts checked 2026-11-02 (code.claude.com/docs/en/desktop-scheduled-tasks and /routines):
//   * Claude Desktop local scheduled tasks run on the owner's computer (files, browser, local
//     tools such as Agent Reach) while the app is open and the computer is awake; hourly in the form.
//   * Claude cloud scheduled tasks run with the computer off and can be fired by an API trigger
//     (per-task sk-ant-oat01 token), but they run in a cloud sandbox: no screen control, no local tools.
//   * Codex app automations also run a saved prompt on a schedule.
import { ServiceError, memberRole } from './service'
import { notify } from './engine'

export const STALL_HOURS = 6
export const IDLE_HOURS = 24
export const RUN_PROMPT = `Studio2U unattended shift. I am not watching, so never wait for me in chat.
1. Call studio2u_start. If any label shows paused/STOP, end now.
2. studio2u_guide {topic:"queue"}, then repeat studio2u_run {tool:"claim_next_task", args:{canControlScreen:true if you can use my browser}} until task is null or you finished 8 tasks. Follow each task's instructions exactly.
3. Read social media with Agent Reach first (context.reach); use my screen only where it says SCREEN.
4. Before any Submit/Post/Sell/Send/Spend/Delete: ask_checkpoint, then complete_task WAITING_FOR_APPROVAL with that checkpointId and move on. If you need an answer from me: complete_task WAITING_FOR_INPUT with questions.
5. Answer my waiting messages (guide inbox).
6. Never handle passwords, card or bank details. End with 3 lines: done, waiting on me, problems.`

const hoursSince = (t: string | null) => t ? (Date.now() - Date.parse(String(t).replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(String(t)) ? '' : 'Z'))) / 3600000 : null

/** Is the owner's agent actually working this label? */
export async function teamHealth(db: any, label: string) {
  const g: any = await db.prepare(`SELECT MAX(g.last_used_at) at, COUNT(*) n FROM lw_mcp_grants g JOIN lw_memberships m ON m.user_id=g.user_id AND m.label_id=? AND m.role IN ('owner','editor')
    WHERE g.revoked_at IS NULL AND EXISTS (SELECT 1 FROM json_each(g.labels_json) WHERE value=?)`).bind(label, label).first().catch(() => null)
  const ev: any = await db.prepare(`SELECT MAX(created_at) at FROM lw_task_events WHERE label_id=? AND status IN ('RUNNING','COMPLETED','WAITING_FOR_INPUT','WAITING_FOR_APPROVAL','BLOCKED','FAILED') AND json_extract(payload_json,'$.agent') IS NOT NULL`).bind(label).first().catch(() => null)
  const q: any = await db.prepare(`SELECT COUNT(*) n, MIN(created_at) oldest FROM lw_tasks WHERE label_id=? AND status='QUEUED' AND kind<>'GENERIC' AND (run_after IS NULL OR run_after<=strftime('%Y-%m-%dT%H:%M:%fZ','now'))`).bind(label).first()
  const cp: any = await db.prepare("SELECT COUNT(*) n FROM lw_checkpoints WHERE label_id=? AND status='PENDING'").bind(label).first().catch(() => null)
  const hook = await db.prepare("SELECT updated_at FROM lw_label_secrets WHERE label_id=? AND name='claude_routine'").bind(label).first().catch(() => null)
  const times = [g?.at, ev?.at].filter(Boolean).map(String)
  const lastActive = times.length ? times.sort((a, b) => (hoursSince(a)! - hoursSince(b)!))[0] : null
  const idleH = hoursSince(lastActive), oldestH = hoursSince(q?.oldest ?? null)
  const connected = (g?.n ?? 0) > 0
  const state = !connected ? 'NOT_CONNECTED' : lastActive == null ? 'NEVER_RAN' : (q?.n && oldestH! > STALL_HOURS && idleH! > IDLE_HOURS) ? 'STALLED' : idleH! < 2 ? 'WORKING' : 'IDLE'
  const say = state === 'NOT_CONNECTED' ? 'Connect Claude or Codex to Studio2U so your team can work.'
    : state === 'NEVER_RAN' ? 'Your agent is connected but has never worked a shift. Run one now, then set it to run on its own.'
    : state === 'STALLED' ? `Your team has not worked in ${Math.round(idleH!)} hours and ${q.n} job(s) are waiting. Set it to run on its own so this never piles up.`
    : state === 'WORKING' ? 'Your team is working right now.' : q?.n ? `${q.n} job(s) waiting for the next shift.` : 'All caught up.'
  return { state, say, connected, lastActive, idleHours: idleH == null ? null : Math.round(idleH), queued: q?.n ?? 0, oldestQueuedAt: q?.oldest ?? null, waitingOnYou: cp?.n ?? 0, cloudWakeConfigured: Boolean(hook) }
}
/** Everything the "Keep my team running" panel needs. */
export async function teamSetup(db: any, label: string, actor: number, origin: string) {
  if (!(await memberRole(db, label, actor))) throw new ServiceError('Label not found', 404)
  const health = await teamHealth(db, label)
  return {
    ...health, runPrompt: RUN_PROMPT, mcpUrl: `${origin}/label-world/mcp`,
    scheduleAsk: `Create a scheduled task on this computer that runs every hour, named "Studio2U shift", with these instructions:\n\n${RUN_PROMPT}`,
    options: [
      { id: 'claude-desktop', name: 'Claude Desktop (recommended)', how: 'Paste the request into Claude Desktop. It creates an hourly task on your computer: it can use your browser and Agent Reach. Runs while the app is open and the computer is awake (turn on Keep computer awake in Settings).' },
      { id: 'codex', name: 'Codex app', how: 'Automations > New automation > every hour > paste the shift instructions.' },
      { id: 'cloud', name: 'Claude cloud wake-up (computer off)', how: 'At claude.ai/code/routines create a task with the shift instructions and the Studio2U connector, add an API trigger, and paste its URL and token below. Studio2U wakes it when work is queued. Cloud runs cannot use your screen or Agent Reach, so they do the desk work only.' }
    ]
  }
}
/** Engine: once a day, tell the owner their team is not running while work piles up. */
export async function idleNotices(db: any, labelIds?: string[], at = new Date()) {
  const labels = (await db.prepare(`SELECT DISTINCT label_id FROM lw_tasks WHERE status='QUEUED' AND kind<>'GENERIC' AND (? IS NULL OR label_id IN (SELECT value FROM json_each(?))) LIMIT 200`).bind(labelIds ? 1 : null, JSON.stringify(labelIds ?? [])).all()).results as any[]
  let sent = 0
  for (const l of labels) {
    const h = await teamHealth(db, l.label_id)
    if (h.state !== 'STALLED' && h.state !== 'NEVER_RAN' && h.state !== 'NOT_CONNECTED') continue
    if (h.state !== 'STALLED' && !(h.oldestQueuedAt && hoursSince(h.oldestQueuedAt)! > STALL_HOURS)) continue
    sent += await notify(db, { label: l.label_id, kind: 'TEAM_IDLE', title: `Your team is waiting: ${h.queued} job(s) not started`, body: `${h.say}\nOne paste fixes it: Label World > Executive > Keep my team running.`, link: '/label-world/agents/executive#team', dedupe: `idle:${l.label_id}:${at.toISOString().slice(0, 10)}` }).catch(() => 0)
  }
  return sent
}
