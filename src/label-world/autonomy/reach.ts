// Agent Reach first, screen control second.
// Agent Reach (github.com/Panniantong/Agent-Reach, MIT, free) is a CLI the owner's own agent
// installs on the owner's computer. It READS Reddit, X, Instagram, Facebook, YouTube, LinkedIn,
// GitHub and the web through one command. It never posts. So:
//   * reading socials (learn the brand, analytics, trends, research) -> Agent Reach first
//   * a channel is down / not covered (TikTok, Threads) / not installed -> screen control
//   * posting, profile setup, forms -> screen control (with checkpoints), always
// Facts checked 2026-11-02 on the project's README/install.md: install with uv from the GitHub
// release (the PyPI package with the same name is NOT this project); `agent-reach doctor`
// reports which channels work; login channels reuse the browser login (use a secondary account,
// platforms may restrict automated accounts); X/Facebook/Instagram are marked experimental.
import { ServiceError, requireEditor, memberRole } from './service'

export const REACH_FACTS_VERSION = '2026-11-02'
export const REACH = {
  name: 'Agent Reach', repo: 'https://github.com/Panniantong/Agent-Reach',
  install: 'https://raw.githubusercontent.com/Panniantong/Agent-Reach/main/docs/install.md',
  installCmd: 'uv tool install https://github.com/Panniantong/Agent-Reach/releases/latest/download/agent-reach.zip && agent-reach setup',
  never: 'Never `pip install agent-reach` (the PyPI package is a different project).'
}
/** Studio2U platform -> Agent Reach channel (null = not covered: screen control). */
export const CHANNEL: Record<string, string | null> = {
  reddit: 'reddit', x: 'twitter', twitter: 'twitter', instagram: 'instagram', facebook: 'facebook', youtube: 'youtube',
  linkedin: 'linkedin', github: 'github', web: 'web', tiktok: null, threads: null, spotify: null
}
const CHANNELS = ['web', 'github', 'youtube', 'reddit', 'twitter', 'instagram', 'facebook', 'linkedin', 'bilibili', 'v2ex', 'xiaohongshu', 'xueqiu', 'boss', 'xiaoyuzhou']
const STALE_DAYS = 7
export type Route = { platform: string; use: 'AGENT_REACH' | 'TRY_AGENT_REACH' | 'SCREEN'; channel: string | null; why: string }

const norm = (v: unknown) => { const s = String(v ?? '').toLowerCase(); return /^(ok|on|ready|working|live|true|pass(ed)?)$/.test(s) ? 'ok' : /^(off|not_added|missing|disabled|removed)$/.test(s) ? 'not_added' : 'broken' }

/** The owner's agent reports what `agent-reach doctor` printed (or that it could not install / run it). */
export async function reportReach(db: any, label: string, actor: number, b: any, by: string) {
  await requireEditor(db, label, actor)
  const installed = b?.installed !== false
  const raw = b?.channels && typeof b.channels === 'object' && !Array.isArray(b.channels) ? b.channels : {}
  const channels: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw)) { const c = String(k).toLowerCase(); if (CHANNELS.includes(c)) channels[c] = norm(typeof v === 'object' && v ? (v as any).status ?? (v as any).ok : v) }
  if (installed && !Object.keys(channels).length) throw new ServiceError('Send the channels from `agent-reach doctor` (e.g. {"reddit":"ok","instagram":"broken"}), or installed=false.')
  const ok = Object.values(channels).filter(v => v === 'ok').length
  const status = !installed ? 'NOT_INSTALLED' : !ok ? 'DOWN' : Object.values(channels).some(v => v !== 'ok') ? 'PARTIAL' : 'OK'
  const version = typeof b?.version === 'string' ? b.version.slice(0, 40) : null
  await db.batch([
    db.prepare(`INSERT INTO lw_reach_status(label_id,status,version,channels_json,reported_by,checked_at) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(label_id) DO UPDATE SET status=excluded.status,version=excluded.version,channels_json=excluded.channels_json,reported_by=excluded.reported_by,checked_at=CURRENT_TIMESTAMP`).bind(label, status, version, JSON.stringify(channels), by.slice(0, 80)),
    db.prepare('INSERT INTO lw_audit_events(id,label_id,actor_id,action,payload_json) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(), label, actor, 'reach.reported', JSON.stringify({ status, channels, by }))
  ])
  return { ...(await reachContext(db, label)), say: status === 'OK' ? 'Agent Reach is working on every channel. Your agent reads socials through it first.' : status === 'PARTIAL' ? 'Agent Reach works on some channels; the rest fall back to screen control.' : 'Agent Reach is not working right now; your agent uses screen control instead.' }
}

export async function getReach(db: any, label: string) {
  const r: any = await db.prepare('SELECT * FROM lw_reach_status WHERE label_id=?').bind(label).first().catch(() => null)
  if (!r) return null
  const age = (Date.now() - Date.parse(String(r.checked_at).replace(' ', 'T') + (String(r.checked_at).endsWith('Z') ? '' : 'Z'))) / 86400000
  return { status: r.status as string, version: r.version, channels: JSON.parse(r.channels_json || '{}') as Record<string, string>, checkedAt: r.checked_at, stale: !(age < STALE_DAYS) }
}
/** Which route to use for reading one platform. */
export function routeFor(st: Awaited<ReturnType<typeof getReach>>, platform: string): Route {
  const p = String(platform).toLowerCase(), channel = p in CHANNEL ? CHANNEL[p] : 'web'
  if (!channel) return { platform: p, use: 'SCREEN', channel: null, why: 'Agent Reach does not cover this platform.' }
  if (!st || st.stale) return { platform: p, use: 'TRY_AGENT_REACH', channel, why: st ? 'Last check is over a week old: run `agent-reach doctor`, then report_reach.' : 'Not checked yet: install/run Agent Reach first; if it fails, use the screen.' }
  if (st.status === 'NOT_INSTALLED' || st.status === 'DOWN') return { platform: p, use: 'SCREEN', channel, why: st.status === 'DOWN' ? 'Agent Reach is down.' : 'Agent Reach is not installed.' }
  const c = st.channels[channel]
  if (c === 'ok') return { platform: p, use: 'AGENT_REACH', channel, why: 'Working at the last check.' }
  return { platform: p, use: 'SCREEN', channel, why: c === 'not_added' ? `Channel not added (\`agent-reach add ${channel}\`).` : 'This channel was broken at the last check.' }
}
const PLATFORMS = ['instagram', 'tiktok', 'x', 'youtube', 'facebook', 'reddit', 'threads', 'linkedin', 'web']
/** What every task sees: the status and one route per platform. */
export async function reachContext(db: any, label: string) {
  const st = await getReach(db, label)
  return { tool: REACH.name, status: st?.status ?? 'UNKNOWN', checkedAt: st?.checkedAt ?? null, stale: st?.stale ?? true, routes: PLATFORMS.map(p => routeFor(st, p)), rule: 'READ social media with Agent Reach first (agent-reach <channel> <action>, or agent-reach read <url>). If a command fails, call report_reach with the failure and use screen control for that platform. Agent Reach is read-only: posting and profile changes are always screen control with a checkpoint.' }
}
export async function reachOverview(db: any, label: string, actor: number) {
  if (!(await memberRole(db, label, actor))) throw new ServiceError('Label not found', 404)
  return { ...(await reachContext(db, label)), install: REACH.install, repo: REACH.repo, factsVersion: REACH_FACTS_VERSION }
}
/** Queue the one-time install/check for the owner's agent (re-check weekly when it is stale or down). */
export async function queueReachSetup(db: any, label: string, enqueueFn: (t: any) => Promise<boolean>, at = new Date(), force = false) {
  const st = await getReach(db, label)
  if (!force && st && !st.stale && st.status !== 'DOWN') return false
  const week = Math.floor(at.getTime() / (7 * 86400000))
  return enqueueFn({ label, kind: 'SETUP_REACH', role: 'researcher', capability: 'ANY', title: st ? 'Check Agent Reach (social reading) is still working' : 'Install Agent Reach so your agents can read every social platform', input: { install: REACH.install, installCmd: REACH.installCmd }, dedupe: force ? `reach:${label}:${at.getTime()}` : `reach:${label}:${week}` })
}
export async function requestReachSetup(db: any, label: string, actor: number, enqueueFn: (t: any) => Promise<boolean>) {
  await requireEditor(db, label, actor)
  { const { isPaused } = await import('./checkpoints'); if (await isPaused(db, label)) throw new ServiceError('Your agents are stopped (STOP is on). Tap Resume first.', 423) }
  if (await db.prepare("SELECT 1 FROM lw_tasks WHERE label_id=? AND kind='SETUP_REACH' AND status IN ('QUEUED','RUNNING')").bind(label).first()) return { queued: true, say: 'Already on it: your agent installs/checks Agent Reach on its next run.' }
  if (!(await queueReachSetup(db, label, enqueueFn, new Date(), true))) throw new ServiceError('Your agents are stopped (STOP is on). Tap Resume first.', 423)
  return { queued: true, say: 'Your agent installs Agent Reach on your computer (free, read-only) and checks every channel. From then on it reads Instagram, X, Reddit, YouTube and the rest through it, and uses screen control only when a channel is down.' }
}
