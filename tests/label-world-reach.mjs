// Agent Reach first (free, read-only social reading), screen control as the automatic fallback.
import assert from 'node:assert/strict'
import { fixture } from './label-world-api-fixture.mjs'
const reach = await import('../src/label-world/autonomy/reach.ts')
const { instructionsFor, claimNext } = await import('../src/label-world/autonomy/service.ts')
const { runEngine, enqueue, taskKinds } = await import('../src/label-world/autonomy/engine.ts')
const { SCREEN_POLICY } = await import('../src/label-world/autonomy/playbooks.ts')
const { ownerCommand } = await import('../src/label-world/autonomy/commands.ts')
const { createStudioMcp } = await import('../src/label-world/mcp/server.ts')
const { Client, StreamableHTTPClientTransport } = await import('@modelcontextprotocol/client')

const f = fixture(), { sqlite, db, app } = f
sqlite.exec(`INSERT INTO lw_labels(id,name) VALUES ('lab-a','Aviator'),('lab-b','Other');
INSERT INTO lw_memberships VALUES ('lab-a',1,'owner'),('lab-b',2,'owner'),('lab-a',3,'viewer'),('lab-a',4,'editor');
INSERT INTO lw_label_identity(label_id,artist_name,legal_name,aliases_json,pro) VALUES ('lab-a','Aviator Keyz','Mason Brown','[]','ASCAP');`)
const env = { DB: db, LLM_KEY_ENCRYPTION_SECRET: Buffer.alloc(32, 7).toString('base64') }
const use = (ctx, p) => ctx.routes.find(r => r.platform === p).use
const tasks = kind => sqlite.prepare('SELECT * FROM lw_tasks WHERE label_id=? AND kind=?').all('lab-a', kind)

// facts + safety
assert.equal(reach.REACH.repo, 'https://github.com/Panniantong/Agent-Reach')
assert.match(reach.REACH.installCmd, /^uv tool install https:\/\/github\.com\/Panniantong\/Agent-Reach\/releases\/latest\/download\/agent-reach\.zip/)
assert.match(instructionsFor('SETUP_REACH'), /NEVER \\?`?pip install agent-reach/); assert.match(instructionsFor('SETUP_REACH'), /never ask for passwords/); assert.match(instructionsFor('SETUP_REACH'), /secondary account/)
assert.match(instructionsFor('SETUP_REACH'), /installed=false: the team falls back to screen control/)
assert.ok(taskKinds.includes('SETUP_REACH'))
assert.ok(SCREEN_POLICY.some(r => /Agent Reach first/.test(r) && /never posts/.test(r)))
assert.match(instructionsFor('KNOW_ARTIST'), /context\.reach\.routes/); assert.match(instructionsFor('BRAND_KICKOFF'), /Agent Reach first/)

// unknown -> try Agent Reach; TikTok/Threads are never covered
let ctx = await reach.reachContext(db, 'lab-a')
assert.equal(ctx.status, 'UNKNOWN'); assert.equal(use(ctx, 'instagram'), 'TRY_AGENT_REACH'); assert.equal(use(ctx, 'tiktok'), 'SCREEN'); assert.equal(use(ctx, 'threads'), 'SCREEN')
assert.match(ctx.rule, /read-only/)

// doctor report: per-channel routing, X maps to the twitter channel
let r = await reach.reportReach(db, 'lab-a', 1, { version: '1.6.2', channels: { web: 'ok', youtube: 'ok', reddit: 'ok', twitter: 'ok', instagram: 'broken', facebook: 'not_added', bogus: 'ok' } }, 'Codex')
assert.equal(r.status, 'PARTIAL'); assert.match(r.say, /some channels/)
ctx = await reach.reachContext(db, 'lab-a')
assert.equal(use(ctx, 'reddit'), 'AGENT_REACH'); assert.equal(use(ctx, 'x'), 'AGENT_REACH'); assert.equal(use(ctx, 'youtube'), 'AGENT_REACH')
assert.equal(use(ctx, 'instagram'), 'SCREEN'); assert.equal(use(ctx, 'facebook'), 'SCREEN')
assert.match(ctx.routes.find(x => x.platform === 'facebook').why, /agent-reach add facebook/)
assert.ok(!('bogus' in (await reach.getReach(db, 'lab-a')).channels))
// all ok / down / not installed
r = await reach.reportReach(db, 'lab-a', 4, { channels: { reddit: 'ok', twitter: 'ok', instagram: 'ok', facebook: 'ok', youtube: 'ok', web: 'ok', linkedin: 'ok' } }, 'Claude'); assert.equal(r.status, 'OK')
assert.equal(use(await reach.reachContext(db, 'lab-a'), 'instagram'), 'AGENT_REACH')
r = await reach.reportReach(db, 'lab-a', 1, { channels: { reddit: 'broken', instagram: 'error' } }, 'Codex'); assert.equal(r.status, 'DOWN')
ctx = await reach.reachContext(db, 'lab-a'); assert.ok(ctx.routes.every(x => x.use === 'SCREEN'))      // down -> everything falls back
r = await reach.reportReach(db, 'lab-a', 1, { installed: false }, 'Codex'); assert.equal(r.status, 'NOT_INSTALLED')
await assert.rejects(reach.reportReach(db, 'lab-a', 1, {}, 'x'), /agent-reach doctor/)
await assert.rejects(reach.reportReach(db, 'lab-a', 3, { installed: false }, 'x'), /permission/i)       // viewer
await assert.rejects(reach.reachOverview(db, 'lab-a', 2), /Label not found/)                           // other tenant
// stale after a week -> re-check
r = await reach.reportReach(db, 'lab-a', 1, { channels: { reddit: 'ok' } }, 'Codex')
sqlite.exec("UPDATE lw_reach_status SET checked_at=datetime('now','-8 days') WHERE label_id='lab-a'")
ctx = await reach.reachContext(db, 'lab-a'); assert.equal(ctx.stale, true); assert.equal(use(ctx, 'reddit'), 'TRY_AGENT_REACH')

// engine: install/check task once a week when unknown, stale or down; not when fresh and OK
sqlite.exec("DELETE FROM lw_reach_status")
let s1 = await runEngine(env, { labelIds: ['lab-a'] }); assert.equal(s1.reachChecks, 1); assert.equal(tasks('SETUP_REACH').length, 1)
await runEngine(env, { labelIds: ['lab-a'] }); assert.equal(tasks('SETUP_REACH').length, 1)          // dedupe
assert.match(tasks('SETUP_REACH')[0].title, /Install Agent Reach/)
// every claimed task carries the routes
const claimed = await claimNext(db, 1, ['lab-a'], 'Codex', false, ['SETUP_REACH'])
assert.ok(claimed.context.reach && Array.isArray(claimed.context.reach.routes))
await reach.reportReach(db, 'lab-a', 1, { channels: { reddit: 'ok', twitter: 'ok' } }, 'Codex')
sqlite.exec("DELETE FROM lw_task_events; DELETE FROM lw_tasks WHERE kind='SETUP_REACH'")
await runEngine(env, { labelIds: ['lab-a'] }); assert.equal(tasks('SETUP_REACH').length, 0)          // fresh + working: nothing to do

// "use Agent Reach" in any chat; STOP blocks it
r = await ownerCommand(db, 'lab-a', 1, 'I want you to use Agent Reach for my socials'); assert.match(r.reply, /installs Agent Reach/); assert.equal(tasks('SETUP_REACH').length, 1)
sqlite.exec("INSERT INTO lw_agent_control(label_id,paused) VALUES ('lab-a',1)")
await assert.rejects(reach.requestReachSetup(db, 'lab-a', 1, t => enqueue(db, t)), /STOP is on/)
sqlite.exec("DELETE FROM lw_agent_control")

// website routes
const web = (path, user, body) => app.request('http://localhost/api/label-world' + path, { method: body ? 'POST' : 'GET', headers: { Cookie: 'studio2u_session=test-session-' + user, Origin: 'http://localhost', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }, env)
let res = await web('/labels/lab-a/reach', 3); assert.equal(res.status, 200); const ov = await res.json(); assert.equal(ov.repo, reach.REACH.repo); assert.ok(ov.routes.length >= 8)
res = await web('/labels/lab-a/reach/setup', 3, {}); assert.equal(res.status, 403)
res = await web('/labels/lab-a/reach/setup', 1, {}); assert.equal(res.status, 201)
res = await web('/labels/lab-a/reach', 2); assert.equal(res.status, 404)

// MCP: reach topic, report from doctor
const handler = createStudioMcp(db, { userId: 1, grantId: 'g', labelIds: ['lab-a'], scopes: ['labels:read', 'releases:read', 'releases:write', 'tasks:read', 'tasks:write'], clientName: 'Codex', toolMode: 'core' }, async () => true)
const client = new Client({ name: 't', version: '1' })
await client.connect(new StreamableHTTPClientTransport(new URL('https://studio.invalid/label-world/mcp'), { fetch: (u, o) => handler.fetch(new Request(u, o)) }))
const g = await client.callTool({ name: 'studio2u_guide', arguments: { topic: 'reach' } }); assert.match(g.content[0].text, /report_reach\(labelId/)
const run = async (tool, args) => { const x = await client.callTool({ name: 'studio2u_run', arguments: { tool, args } }); return x.isError ? { error: x.content[0].text } : JSON.parse(x.content[0].text) }
const rep = await run('report_reach', { labelId: 'lab-a', version: '1.6.2', channels: { reddit: 'ok', instagram: 'ok', twitter: 'broken' } })
assert.equal((rep.data ?? rep).status, 'PARTIAL')
const st = await run('reach_status', { labelId: 'lab-a' }); assert.equal(use(st.data ?? st, 'instagram'), 'AGENT_REACH'); assert.equal(use(st.data ?? st, 'x'), 'SCREEN')
assert.ok((await run('reach_status', { labelId: 'lab-b' })).error)
await client.close(); await handler.close()
console.log('PASS reach: Agent Reach first for reading socials (free, MIT, read-only; uv install from the GitHub release, never the PyPI package), per-platform routing from agent-reach doctor (X -> twitter channel, TikTok/Threads always screen), automatic screen-control fallback when a channel breaks, Agent Reach is down or not installed, weekly re-check when stale, engine install/check task once a week, routes in every task context, agents never post through it, "use Agent Reach" in any chat, STOP blocks it, viewer/tenant isolation, website + MCP reach topic')
