// Keep the team running: health (connected / never ran / stalled / working), one-paste unattended shift,
// daily idle notice, cloud wake for any runnable work, checkpoints that park a task instead of looping,
// and no duplicate setup jobs piling up.
import assert from 'node:assert/strict'
import { fixture } from './label-world-api-fixture.mjs'
const team = await import('../src/label-world/autonomy/team.ts')
const cp = await import('../src/label-world/autonomy/checkpoints.ts')
const { claimNext, completeTask, instructionsFor } = await import('../src/label-world/autonomy/service.ts')
const { runEngine, enqueue } = await import('../src/label-world/autonomy/engine.ts')
const { STANDING_RULES } = await import('../src/label-world/autonomy/playbooks.ts')
const { encryptKey } = await import('../src/label-world/providers/vault.ts')

const f = fixture(), { sqlite, db, app } = f
sqlite.exec(`INSERT INTO lw_labels(id,name) VALUES ('lab-a','Aviator'),('lab-b','Other');
INSERT INTO lw_memberships VALUES ('lab-a',1,'owner'),('lab-b',2,'owner'),('lab-a',3,'viewer'),('lab-a',4,'editor');
INSERT INTO lw_label_identity(label_id,artist_name,legal_name,aliases_json,pro) VALUES ('lab-a','Aviator Keyz','Mason Brown','[]','ASCAP');`)
const env = { DB: db, LLM_KEY_ENCRYPTION_SECRET: Buffer.alloc(32, 7).toString('base64') }
const open = kind => sqlite.prepare("SELECT COUNT(*) n FROM lw_tasks WHERE label_id='lab-a' AND kind=? AND status IN ('QUEUED','RUNNING')").get(kind).n
const grant = (id, user, used) => { sqlite.prepare("INSERT OR IGNORE INTO lw_mcp_clients(id,name,redirects_json) VALUES ('c1','Codex','[]')").run(); sqlite.prepare("INSERT INTO lw_mcp_grants(id,client_id,user_id,resource,labels_json,scopes_json,expires_at,last_used_at) VALUES (?,?,?,?,?,?,?,?)").run(id, 'c1', user, 'r', '["lab-a"]', '[]', '2099-01-01', used) }

// ---------- no rule points at a tool that does not exist ----------
assert.ok(!STANDING_RULES.some(r => /log_case_step/.test(r)))

// ---------- health ----------
let h = await team.teamHealth(db, 'lab-a'); assert.equal(h.state, 'NOT_CONNECTED'); assert.match(h.say, /Connect Claude or Codex/)
grant('g1', 1, null); h = await team.teamHealth(db, 'lab-a'); assert.equal(h.state, 'NEVER_RAN')
grant('gv', 3, new Date().toISOString())                       // a viewer's connection does not count as the team working
h = await team.teamHealth(db, 'lab-a'); assert.equal(h.state, 'NEVER_RAN')
await enqueue(db, { label: 'lab-a', kind: 'CASE_STEP', role: 'case_manager', title: 'x', input: {}, dedupe: 'cs1' })
sqlite.exec("UPDATE lw_tasks SET created_at=datetime('now','-30 hours'); UPDATE lw_mcp_grants SET last_used_at=strftime('%Y-%m-%dT%H:%M:%fZ','now','-40 hours') WHERE id='g1'")
h = await team.teamHealth(db, 'lab-a'); assert.equal(h.state, 'STALLED'); assert.ok(h.queued >= 1); assert.match(h.say, /has not worked in 40 hours/)
sqlite.exec("UPDATE lw_mcp_grants SET last_used_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='g1'")
h = await team.teamHealth(db, 'lab-a'); assert.equal(h.state, 'WORKING')

// ---------- setup panel: one paste, honest about what each option can do ----------
const s = await team.teamSetup(db, 'lab-a', 3, 'https://studio.invalid')
assert.match(s.scheduleAsk, /runs every hour/); assert.match(s.runPrompt, /never wait for me in chat/); assert.match(s.runPrompt, /WAITING_FOR_APPROVAL/); assert.match(s.runPrompt, /Agent Reach first/)
assert.match(s.options.find(o => o.id === 'cloud').how, /cannot use your screen or Agent Reach/)
assert.ok(s.runPrompt.length < 1400)
await assert.rejects(team.teamSetup(db, 'lab-a', 2, 'x'), /Label not found/)
const web = (path, user, body) => app.request('http://localhost/api/label-world' + path, { method: body ? 'POST' : 'GET', headers: { Cookie: 'studio2u_session=test-session-' + user, Origin: 'http://localhost', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }, env)
let res = await web('/labels/lab-a/team', 1); assert.equal(res.status, 200); assert.equal((await res.json()).mcpUrl, 'http://localhost/label-world/mcp')
res = await web('/labels/lab-a/team', 2); assert.equal(res.status, 404)
res = await web('/labels/lab-a/control', 1); assert.equal((await res.json()).team.state, 'WORKING')     // shown on every page

// ---------- idle notice once a day; cloud wake for any runnable work ----------
sqlite.exec("UPDATE lw_mcp_grants SET last_used_at=strftime('%Y-%m-%dT%H:%M:%fZ','now','-40 hours') WHERE id='g1'")
let sum = await runEngine(env, { labelIds: ['lab-a'] }); assert.equal(sum.idleNotices, 1)
assert.ok(sqlite.prepare("SELECT 1 FROM lw_notifications WHERE label_id='lab-a' AND kind='TEAM_IDLE'").get())
sum = await runEngine(env, { labelIds: ['lab-a'] }); assert.equal(sum.idleNotices, 0)                  // once a day
const url = 'https://api.anthropic.com/v1/claude_code/routines/trig_abcd1234/fire'
sqlite.prepare("INSERT INTO lw_label_secrets(label_id,name,value,created_by) VALUES ('lab-a','claude_routine',?,1)").run(await encryptKey(env.LLM_KEY_ENCRYPTION_SECRET, JSON.stringify({ url, token: 'sk-ant-oat01-testtoken' }), 'studio2u:routine:v1:lab-a'))
let fired = 0; const fetcher = async (u, o) => { if (u === url) { fired++; assert.equal(o.headers.Authorization, 'Bearer sk-ant-oat01-testtoken') } return new Response('{}', { status: 200 }) }
sum = await runEngine(env, { labelIds: ['lab-a'], fetcher }); assert.equal(fired, 1); assert.equal(sum.woken, 1)  // old queued work still wakes it

// ---------- checkpoints park the task (no waiting in a loop), answer brings it back ----------
assert.match(instructionsFor('CREATIVE_TOOL'), /complete_task WAITING_FOR_APPROVAL with that checkpointId and move on/)
sqlite.exec("DELETE FROM lw_task_events; DELETE FROM lw_tasks")
await enqueue(db, { label: 'lab-a', kind: 'CREATIVE_TOOL', role: 'producer', capability: 'ANY', title: 'Suno beat', input: { tool: 'suno' }, dedupe: 'c1' })
let t = await claimNext(db, 1, ['lab-a'], 'Codex', true, ['CREATIVE_TOOL'])
const ask = await cp.askCheckpoint(db, 'lab-a', 1, { kind: 'SPEND', title: 'Use 50 Suno credits', taskId: t.task.id }, 'Codex')
await assert.rejects(completeTask(db, 1, ['lab-a'], { taskId: t.task.id, outcome: 'WAITING_FOR_APPROVAL', summary: 'x' }, 'Codex'), /needs the checkpointId/)
let done = await completeTask(db, 1, ['lab-a'], { taskId: t.task.id, outcome: 'WAITING_FOR_APPROVAL', summary: 'Asked to spend credits', checkpointId: ask.id }, 'Codex')
assert.equal(done.status, 'QUEUED'); assert.match(done.say, /end your run now/)
assert.equal(await claimNext(db, 1, ['lab-a'], 'Codex', true, ['CREATIVE_TOOL']), null)                 // parked while the owner thinks
await cp.decideCheckpoint(db, 'lab-a', 1, ask.id, { decision: 'APPROVED' })
t = await claimNext(db, 1, ['lab-a'], 'Codex', true, ['CREATIVE_TOOL'])                                  // back immediately
assert.ok(t); assert.equal(t.context.checkpoint.go, true); assert.equal(t.task.attempt, 1)              // parking does not burn attempts
// denied -> comes back with go=false
done = await completeTask(db, 1, ['lab-a'], { taskId: t.task.id, outcome: 'COMPLETED', summary: 'made it' }, 'Codex')
await enqueue(db, { label: 'lab-a', kind: 'CREATIVE_TOOL', role: 'producer', capability: 'ANY', title: 'Post reel', input: {}, dedupe: 'c2' })
t = await claimNext(db, 1, ['lab-a'], 'Codex', true, ['CREATIVE_TOOL'])
const ask2 = await cp.askCheckpoint(db, 'lab-a', 1, { kind: 'PUBLISH', title: 'Publish the reel' }, 'Codex')
await completeTask(db, 1, ['lab-a'], { taskId: t.task.id, outcome: 'WAITING_FOR_APPROVAL', summary: 'asked', checkpointId: ask2.id }, 'Codex')
await cp.decideCheckpoint(db, 'lab-a', 1, ask2.id, { decision: 'DENIED', note: 'not this one' })
t = await claimNext(db, 1, ['lab-a'], 'Codex', true, ['CREATIVE_TOOL']); assert.equal(t.context.checkpoint.go, false); assert.match(t.context.checkpoint.say, /not this one/)

// ---------- one open setup job per label, ever ----------
sqlite.exec("DELETE FROM lw_task_events; DELETE FROM lw_tasks")
for (const d of ['shop:a:2026-10', 'shop:a:2026-11', 'shop:a:x']) await enqueue(db, { label: 'lab-a', kind: 'SETUP_SHOP', role: 'business_partner', capability: 'SCREEN_CONTROL', title: 'shop', input: {}, dedupe: d })
assert.equal(open('SETUP_SHOP'), 1)
for (const d of ['know:a:1', 'know:a:2']) await enqueue(db, { label: 'lab-a', kind: 'KNOW_ARTIST', role: 'researcher', title: 'know', input: {}, dedupe: d })
assert.equal(open('KNOW_ARTIST'), 1)
const pt = await import('../src/label-world/autonomy/partner.ts')
const again = await pt.requestShopSetup(db, 'lab-a', 1, x => enqueue(db, x)); assert.match(again.say, /Already on it/)   // not a false "STOP is on"
const { brandKickoff } = await import('../src/label-world/autonomy/creative.ts')
assert.equal(await brandKickoff(db, 'lab-a', 1, x => enqueue(db, x), true), true); assert.equal(await brandKickoff(db, 'lab-a', 1, x => enqueue(db, x), true), true); assert.equal(open('BRAND_KICKOFF'), 1)
// other kinds still queue normally
await enqueue(db, { label: 'lab-a', kind: 'CASE_STEP', role: 'case_manager', title: 'a', input: {}, dedupe: 'cs-a' }); await enqueue(db, { label: 'lab-a', kind: 'CASE_STEP', role: 'case_manager', title: 'b', input: {}, dedupe: 'cs-b' })
assert.equal(open('CASE_STEP'), 2)
console.log('PASS team: health (not connected / never ran / stalled / working; viewers do not count), one-paste unattended shift for Claude Desktop or Codex (cloud option honest: no screen or Agent Reach), status on every page, daily idle notice, cloud wake for any runnable work, checkpoints park the task instead of looping and bring it back the moment the owner answers (approved or denied, no attempt burned), one open setup job per label (no pile-up), no rules pointing at missing tools')
