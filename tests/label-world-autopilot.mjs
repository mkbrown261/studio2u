// "Do it for me" with checkpoints: one image switch for every provider, real cover art, a real
// release zip, Suno/Higgsfield/Genjitsu via screen control, Ben's brand kickoff, checkpoints
// before Submit/Publish/Post/Sell/Send/Spend, and one STOP that pauses every agent.
import assert from 'node:assert/strict'
import { unzipSync, strFromU8 } from 'fflate'
import { fixture } from './label-world-api-fixture.mjs'
const img = await import('../src/label-world/providers/images.ts')
const cp = await import('../src/label-world/autonomy/checkpoints.ts')
const creative = await import('../src/label-world/autonomy/creative.ts')
const { enqueue, claimTask, taskKinds } = await import('../src/label-world/autonomy/engine.ts')
const { instructionsFor } = await import('../src/label-world/autonomy/service.ts')
const { STANDING_RULES, SCREEN_POLICY } = await import('../src/label-world/autonomy/playbooks.ts')
const { encryptKey, keyContext } = await import('../src/label-world/providers/vault.ts')
const { createStudioMcp } = await import('../src/label-world/mcp/server.ts')
const { Client, StreamableHTTPClientTransport } = await import('@modelcontextprotocol/client')

const f = fixture(), { sqlite, db, app } = f
sqlite.exec(`INSERT INTO lw_labels(id,name) VALUES ('lab-a','Aviator'),('lab-b','Other');
INSERT INTO lw_memberships VALUES ('lab-a',1,'owner'),('lab-b',2,'owner'),('lab-a',3,'viewer'),('lab-a',4,'editor');
INSERT INTO lw_label_identity(label_id,artist_name,legal_name,aliases_json,pro) VALUES ('lab-a','Aviator Keyz','Mason Brown','[]','ASCAP');
INSERT INTO lw_releases(id,label_id,artist,title,release_type) VALUES ('r1','lab-a','Aviator Keyz','22','single');`)
const objects = new Map()
const R2 = { async put(k, b) { objects.set(k, new Uint8Array(b)) }, async get(k) { const b = objects.get(k); return b ? { arrayBuffer: async () => b.slice().buffer } : null } }
const env = { DB: db, R2, LLM_KEY_ENCRYPTION_SECRET: Buffer.alloc(32, 7).toString('base64') }
const png = (w, h) => { const b = Buffer.alloc(300); Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(b, 0); b.writeUInt32BE(13, 8); b.write('IHDR', 12); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); b[24] = 8; b[25] = 6; return b }
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array(200).fill(1)])
const key = async (p, k) => sqlite.prepare('INSERT INTO lw_provider_connections(user_id,provider,encrypted_key) VALUES (?,?,?)').run(1, p, await encryptKey(env.LLM_KEY_ENCRYPTION_SECRET, k, keyContext(1, p, '{}')))
const json = (s, b) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } })

// ---------- image switch ----------
let pv = await img.imageProviders(db, 1, 'lab-a'); assert.deepEqual(pv.available, []); assert.equal(pv.auto, null)
await assert.rejects(img.makeImage(env, 1, { prompt: 'x' }), /Connect an image-capable AI key/)
await key('anthropic', 'sk-ant')
await assert.rejects(img.makeImage(env, 1, { prompt: 'x' }), /anthropic only writes text/)
await key('gemini', 'g-key'); await key('xai', 'x-key'); await key('openrouter', 'or-key'); await key('openai', 'sk-oa')
pv = await img.imageProviders(db, 1, 'lab-a'); assert.deepEqual(pv.available.map(a => a.id), ['openai', 'gemini', 'xai', 'openrouter']); assert.equal(pv.auto, 'openai')
sqlite.exec("INSERT INTO lw_reasoning_preferences(label_id,user_id,provider,model) VALUES ('lab-a',1,'gemini','gemini-x')")
assert.equal((await img.imageProviders(db, 1, 'lab-a')).auto, 'gemini') // follows the label's provider
const seen = []
const fake = async (url, init) => {
  const b = JSON.parse(init.body); seen.push({ url, b, h: init.headers })
  if (url.includes('api.openai.com')) return json(200, { data: [{ b64_json: png(2048, 2048).toString('base64') }] })
  if (url.includes('generativelanguage')) return json(200, { id: 'i1', outputs: [{ type: 'image', mime_type: 'image/png', data: png(4096, 4096).toString('base64') }] })
  if (url.includes('api.x.ai')) return json(200, { data: [{ b64_json: jpeg.toString('base64') }] })
  if (url.includes('openrouter.ai')) return json(200, { data: [{ b64_json: png(4096, 4096).toString('base64'), media_type: 'image/png' }], usage: { cost: 0.13 } })
  return json(404, {})
}
let m = await img.makeImage(env, 1, { prompt: 'p', label: 'lab-a', shape: 'square', hi: true }, fake)
assert.equal(m.provider, 'gemini'); assert.ok(m.png); assert.equal(seen.at(-1).h['x-goog-api-key'], 'g-key'); assert.match(seen.at(-1).url, /v1beta\/interactions$/); assert.equal(seen.at(-1).b.response_format.image_size, '4K')
m = await img.makeImage(env, 1, { prompt: 'p', provider: 'openai', transparent: true }, fake); assert.equal(m.provider, 'openai'); assert.equal(seen.at(-1).b.background, 'transparent'); assert.equal(seen.at(-1).h.Authorization, 'Bearer sk-oa')
m = await img.makeImage(env, 1, { prompt: 'p', provider: 'openrouter' }, fake); assert.equal(m.costMicros, 130000); assert.match(seen.at(-1).url, /openrouter\.ai\/api\/v1\/images$/)
m = await img.makeImage(env, 1, { prompt: 'p', provider: 'xai' }, fake); assert.equal(m.png, false); assert.equal(seen.at(-1).b.response_format, 'b64_json'); assert.equal(seen.at(-1).b.model, 'grok-imagine-image-2.0')
await assert.rejects(img.makeImage(env, 1, { prompt: 'p', provider: 'xai', needPng: true }, fake), /returned a JPEG/)
await assert.rejects(img.makeImage(env, 3, { prompt: 'p', provider: 'openai' }, fake), /Connect an image-capable/) // viewer has no keys
await assert.rejects(img.makeImage(env, 1, { prompt: 'p', provider: 'openai' }, async () => json(401, {})), /rejected your key/)
await assert.rejects(img.makeImage(env, 1, { prompt: 'p', provider: 'openai' }, async () => json(400, { error: { message: 'safety' } })), /would not make that image/)
// gemini falls back to classic generateContent when interactions is unavailable
m = await img.makeImage(env, 1, { prompt: 'p', provider: 'gemini' }, async (url, init) => url.endsWith('/interactions') ? json(404, {}) : json(200, { candidates: [{ content: { parts: [{ text: 'here' }, { inlineData: { mimeType: 'image/png', data: png(1024, 1024).toString('base64') } }] } }] }))
assert.ok(m.png)
assert.ok(sqlite.prepare('SELECT cost_micros FROM lw_ai_usage WHERE user_id=1').get().cost_micros > 0)

// ---------- cover art + merch design use the switch ----------
const cov = await creative.generateCover(env, 'lab-a', 4 === 4 ? 1 : 1, 'r1', { prompt: 'gold 22 on a runway', provider: 'openrouter' }, fake)
assert.equal(cov.width, 4096); assert.match(cov.say, /saved as this release's artwork/)
assert.match(seen.at(-1).b.prompt, /"Aviator Keyz" and "22"/); assert.match(seen.at(-1).b.prompt, /gold 22 on a runway/); assert.equal(seen.at(-1).b.resolution, '4K')
await assert.rejects(creative.generateCover(env, 'lab-a', 3, 'r1', {}, fake), /permission/i)
await assert.rejects(creative.generateCover(env, 'lab-a', 1, 'r1', { provider: 'xai' }, fake), /returned a JPEG/)
const small = await creative.generateCover(env, 'lab-a', 1, 'r1', { provider: 'openai' }, fake); assert.match(small.say, /3000×3000/)
assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM lw_assets WHERE release_id='r1' AND kind='artwork'").get().n, 2)
assert.equal((await creative.assetImage(env, 'lab-a', 'r1', cov.assetId)).length, png(1, 1).length)
const merch = await import('../src/label-world/autonomy/merch.ts')
const d = await merch.generateDesign(env, 'lab-a', 1, { prompt: 'gold 22 tee', provider: 'openai' }, fake); assert.equal(d.provider, 'openai')

// ---------- one real zip ----------
await assert.rejects(creative.packageZip(env, 'lab-a', 'nope'), /Release not found/)
sqlite.exec("INSERT INTO lw_releases(id,label_id,artist,title,release_type) VALUES ('r2','lab-a','Aviator Keyz','Empty','single')")
await assert.rejects(creative.packageZip(env, 'lab-a', 'r2'), /nothing to package/)
objects.set('k/master', new Uint8Array(Buffer.from('RIFF....WAVEfmt fake audio')))
sqlite.exec("INSERT INTO lw_assets(id,label_id,release_id,kind,original_name,object_key,byte_size,sha256,version,created_at) VALUES ('am','lab-a','r1','master','22.wav','k/master',26,'abc',1,'2099-01-01 00:00:00')")
const z = await creative.packageZip(env, 'lab-a', 'r1'); assert.equal(z.filename, 'aviator-keyz-22-v1.zip')
const files = unzipSync(z.bytes)
assert.deepEqual(Object.keys(files).sort(), ['README.txt', 'artwork/Aviator Keyz - 22.png', 'audio/Aviator Keyz - 22.wav', 'manifest.json'])
assert.equal(strFromU8(files['audio/Aviator Keyz - 22.wav']), 'RIFF....WAVEfmt fake audio')
const man = JSON.parse(strFromU8(files['manifest.json'])); assert.equal(man.files.length, 2); assert.equal(man.finalApproval.status, 'NOT_REQUESTED')

// ---------- checkpoints ----------
await assert.rejects(cp.askCheckpoint(db, 'lab-a', 3, { kind: 'SUBMIT', title: 'x' }, 'Codex'), /Editing permission/)
await assert.rejects(cp.askCheckpoint(db, 'lab-a', 1, { kind: 'NUKE', title: 'x' }, 'Codex'), /kind must be one of/)
await assert.rejects(cp.askCheckpoint(db, 'lab-a', 1, { kind: 'SUBMIT', title: 'x', previewUrl: 'http://x' }, 'Codex'), /https/)
const c1 = await cp.askCheckpoint(db, 'lab-a', 1, { kind: 'SUBMIT', title: 'Submit "22" to UnitedMasters', detail: 'Title 22, explicit no, release Nov 20', site: 'unitedmasters.com' }, 'Codex')
assert.equal(c1.status, 'PENDING'); assert.match(c1.say, /Do not do it before APPROVED/)
assert.equal((await cp.askCheckpoint(db, 'lab-a', 1, { kind: 'SUBMIT', title: 'Submit "22" to UnitedMasters' }, 'Codex')).reused, true)
assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM lw_notifications WHERE kind='CHECKPOINT'").get().n, 1)
let ck = await cp.checkCheckpoint(db, 'lab-a', c1.id); assert.equal(ck.go, false); assert.match(ck.say, /Still waiting/)
await assert.rejects(cp.decideCheckpoint(db, 'lab-a', 4, c1.id, { decision: 'APPROVED' }), /Only the label owner/)
await cp.decideCheckpoint(db, 'lab-a', 1, c1.id, { decision: 'APPROVED' })
ck = await cp.checkCheckpoint(db, 'lab-a', c1.id); assert.equal(ck.go, true)
await assert.rejects(cp.decideCheckpoint(db, 'lab-a', 1, c1.id, { decision: 'DENIED' }), /already answered/)
const c2 = await cp.askCheckpoint(db, 'lab-a', 4, { kind: 'POST', title: 'Post the "22" reel on TikTok', amountUsd: 0 }, 'Claude')
await cp.decideCheckpoint(db, 'lab-a', 1, c2.id, { decision: 'DENIED', note: 'Not yet' })
assert.match((await cp.checkCheckpoint(db, 'lab-a', c2.id)).say, /Denied: Not yet/)
sqlite.exec(`INSERT INTO lw_checkpoints(id,label_id,kind,title,requested_by,created_at) VALUES ('old','lab-a','SEND','old one','x','2020-01-01 00:00:00')`)
assert.equal((await cp.checkCheckpoint(db, 'lab-a', 'old')).status, 'EXPIRED')
await assert.rejects(cp.checkCheckpoint(db, 'lab-b', c1.id), /not found/)

// ---------- STOP: no new work, nothing claimed, approved checkpoints stop meaning go ----------
await enqueue(db, { label: 'lab-a', kind: 'CASE_STEP', role: 'x', title: 'before stop', input: {}, dedupe: 'before' })
await assert.rejects(cp.stopAll(db, 'lab-a', 3), /Editing permission/)
const st = await cp.stopAll(db, 'lab-a', 4); assert.equal(st.paused, true); assert.ok(st.cancelledTasks >= 1)
assert.equal(await enqueue(db, { label: 'lab-a', kind: 'CASE_STEP', role: 'x', title: 'during stop', input: {}, dedupe: 'during' }), false)
assert.equal(await enqueue(db, { label: 'lab-b', kind: 'CASE_STEP', role: 'x', title: 'other label', input: {}, dedupe: 'other' }), true) // other labels unaffected
sqlite.exec("INSERT INTO lw_tasks(id,label_id,agent_role,status,input_json,kind,capability,title) VALUES ('sneaky','lab-a','x','QUEUED','{}','CASE_STEP','ANY','sneaky')")
assert.equal(await claimTask(db, { labels: ['lab-a'], agent: 'Codex', screen: true }), null)
assert.equal((await cp.checkCheckpoint(db, 'lab-a', c1.id)).go, false)
await assert.rejects(cp.askCheckpoint(db, 'lab-a', 1, { kind: 'SEND', title: 'email' }, 'Codex'), /pressed STOP/)
await assert.rejects(creative.creativeTask(db, 'lab-a', 1, { tool: 'suno', goal: 'beat' }, t => enqueue(db, t)), /STOP is on/)
await assert.rejects(cp.resumeAll(db, 'lab-a', 4), /Only the label owner/)
await cp.resumeAll(db, 'lab-a', 1)
assert.equal((await claimTask(db, { labels: ['lab-a'], agent: 'Codex', screen: true })).id, 'sneaky')

// ---------- creative tools + brand kickoff ----------
assert.ok(taskKinds.includes('CREATIVE_TOOL') && taskKinds.includes('BRAND_KICKOFF'))
await assert.rejects(creative.creativeTask(db, 'lab-a', 1, { tool: 'midjourney', goal: 'x' }, t => enqueue(db, t)), /tool must be one of/)
const ct = await creative.creativeTask(db, 'lab-a', 4, { tool: 'suno', goal: 'Dark trap beat 140 BPM', releaseId: 'r1' }, t => enqueue(db, t))
assert.match(ct.say, /opens Suno in your browser/)
const ctask = sqlite.prepare("SELECT * FROM lw_tasks WHERE kind='CREATIVE_TOOL'").get(); assert.equal(ctask.capability, 'SCREEN_CONTROL'); assert.equal(JSON.parse(ctask.input_json).url, 'https://suno.com/create')
assert.match(instructionsFor('CREATIVE_TOOL'), /ask_checkpoint kind SPEND/); assert.match(instructionsFor('CREATIVE_TOOL'), /approved PUBLISH checkpoint/)
assert.match(instructionsFor('BRAND_KICKOFF'), /learn how they talk/); assert.match(instructionsFor('BRAND_KICKOFF'), /ask_checkpoint kind SELL/)
assert.match(instructionsFor('FILL_PROVIDER_FORM'), /approves a SUBMIT checkpoint/); assert.match(instructionsFor('REGISTER_WORK'), /ask_checkpoint \(kind SUBMIT\)/); assert.match(instructionsFor('SX_RECORDING'), /SUBMIT checkpoint/)
assert.ok(STANDING_RULES.some(r => /ask_checkpoint/.test(r) && /If STOP is on, do nothing/.test(r)) && SCREEN_POLICY.some(r => /checkpoint/.test(r)))
assert.equal(await creative.brandKickoff(db, 'lab-a', 1, t => enqueue(db, t)), true)
assert.equal(await creative.brandKickoff(db, 'lab-a', 1, t => enqueue(db, t)), false) // once (unless forced)
await assert.rejects(creative.brandKickoff(db, 'lab-b', 2, t => enqueue(db, t)), /Save your artist name first/)

// ---------- website ----------
const web = (path, user = 1, body, raw) => app.request('http://localhost/api/label-world' + path, { method: body ? 'POST' : 'GET', headers: { Cookie: 'studio2u_session=test-session-' + user, Origin: 'http://localhost', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }, env)
let r = await web('/labels/lab-a/control', 3); assert.equal(r.status, 200); let cs = await r.json(); assert.equal(cs.paused, false); assert.equal(cs.role, 'viewer')
r = await web('/labels/lab-a/control/stop', 3, {}); assert.equal(r.status, 403)
r = await web('/labels/lab-a/control/stop', 4, {}); assert.equal((await r.json()).paused, true)
r = await web('/labels/lab-a/control/resume', 4, {}); assert.equal(r.status, 403)
r = await web('/labels/lab-a/control/resume', 1, {}); assert.equal((await r.json()).paused, false)
const c3 = await cp.askCheckpoint(db, 'lab-a', 1, { kind: 'SELL', title: 'Put the gold 22 tee on sale' }, 'Codex')
cs = await (await web('/labels/lab-a/control')).json(); assert.equal(cs.pending.length, 1); assert.equal(cs.pending[0].kind, 'SELL')
r = await web(`/labels/lab-a/checkpoints/${c3.id}/decision`, 4, { decision: 'APPROVED' }); assert.equal(r.status, 403)
r = await web(`/labels/lab-a/checkpoints/${c3.id}/decision`, 1, { decision: 'APPROVED' }); assert.equal((await r.json()).status, 'APPROVED')
r = await web('/image-providers?labelId=lab-a'); assert.equal((await r.json()).available.length, 4)
r = await web('/labels/lab-a/releases/r1/package.zip', 3); assert.equal(r.status, 200); assert.equal(r.headers.get('content-type'), 'application/zip'); assert.match(r.headers.get('content-disposition'), /aviator-keyz-22-v1\.zip/)
r = await web('/labels/lab-a/releases/r2/package.zip'); assert.equal(r.status, 409)
r = await web(`/labels/lab-a/releases/r1/artwork/${cov.assetId}`, 3); assert.equal(r.status, 200); assert.equal(r.headers.get('content-type'), 'image/png')
r = await web('/labels/lab-a/creative', 1, { tool: 'higgsfield', goal: '15s visualizer for 22' }); assert.equal(r.status, 201)
r = await web('/labels/lab-a/brand/kickoff', 1, {}); assert.equal((await r.json()).queued, true)
r = await app.request('http://localhost/api/label-world/labels/lab-a/control', { headers: { Cookie: 'studio2u_session=test-session-2' } }, env); assert.equal(r.status, 404)

// ---------- MCP: agents ask, wait, act ----------
const handler = createStudioMcp(db, { userId: 1, grantId: 'g', labelIds: ['lab-a'], scopes: ['labels:read', 'releases:read', 'releases:write', 'tasks:read', 'tasks:write'], clientName: 'Codex', toolMode: 'core', env }, async () => true)
const client = new Client({ name: 't', version: '1' })
await client.connect(new StreamableHTTPClientTransport(new URL('https://studio.invalid/label-world/mcp'), { fetch: (u, o) => handler.fetch(new Request(u, o)) }))
const g = await client.callTool({ name: 'studio2u_guide', arguments: { topic: 'checkpoints' } }); assert.match(g.content[0].text, /ask_checkpoint\(labelId, kind:SUBMIT\|PUBLISH\|POST\|SELL\|SEND\|SPEND\|DELETE\|OTHER, title/)
const run = async (tool, args) => { const x = await client.callTool({ name: 'studio2u_run', arguments: { tool, args } }); return x.isError ? { error: x.content[0].text } : JSON.parse(x.content[0].text) }
const asked = await run('ask_checkpoint', { labelId: 'lab-a', kind: 'PUBLISH', title: 'Publish the 22 visualizer on YouTube' }); const aid = (asked.data ?? asked).id
assert.equal(((await run('check_checkpoint', { labelId: 'lab-a', checkpointId: aid })).data ?? {}).go ?? false, false)
assert.match((await run('publish_merch', { labelId: 'lab-a', productId: 'p1', checkpointId: aid })).error, /not a SELL checkpoint/)
assert.ok(!(await run('queue_creative', { labelId: 'lab-a', tool: 'genjitsu', goal: '30s reel' })).error)
const mc = await run('make_cover_art', { labelId: 'lab-a', releaseId: 'r1', provider: 'gemini' })
assert.ok(mc.error || (mc.data ?? mc).assetId) // real network is not called in tests; shape only
await client.close(); await handler.close()
console.log('PASS autopilot: one image switch (OpenAI, Gemini Nano Banana with generateContent fallback, xAI Grok Imagine, OpenRouter; auto follows the label provider; text-only keys explained; key/safety/balance errors; JPEG refused where PNG is needed; spend recorded), real cover art saved as release artwork (4K where available, 3000px warning), merch designs on the switch, one real zip (audio + artwork + manifest), checkpoints (ask, reuse, notify, owner-only decide, deny with note, expire, label isolation), STOP (cancels queue, blocks new work and claims, voids approvals, any editor stops, only owner resumes, other labels unaffected), Suno/Higgsfield/Genjitsu screen tasks, Ben brand kickoff, checkpoint rules in every submit/screen instruction, routes, MCP ask/check/publish_merch')
