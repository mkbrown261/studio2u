// "Just tell the AI": plain-words settings, agent-made images (no Studio2U image key), shop setup by the agent.
import assert from 'node:assert/strict'
import { fixture } from './label-world-api-fixture.mjs'
const { ownerCommand } = await import('../src/label-world/autonomy/commands.ts')
const pt = await import('../src/label-world/autonomy/partner.ts')
const creative = await import('../src/label-world/autonomy/creative.ts')
const merch = await import('../src/label-world/autonomy/merch.ts')
const up = await import('../src/label-world/autonomy/agent-upload.ts')
const { instructionsFor } = await import('../src/label-world/autonomy/service.ts')
const { runEngine, taskKinds } = await import('../src/label-world/autonomy/engine.ts')
const { talk } = await import('../src/label-world/autonomy/talk.ts')

const f = fixture(), { sqlite, db, app } = f
sqlite.exec(`INSERT INTO lw_labels(id,name) VALUES ('lab-a','Aviator'),('lab-b','Other');
INSERT INTO lw_memberships VALUES ('lab-a',1,'owner'),('lab-b',2,'owner'),('lab-a',3,'viewer'),('lab-a',4,'editor');
INSERT INTO lw_label_identity(label_id,artist_name,legal_name,aliases_json,pro) VALUES ('lab-a','Aviator Keyz','Mason Brown','[]','ASCAP');
INSERT INTO lw_releases(id,label_id,artist,title,release_type) VALUES ('r1','lab-a','Aviator Keyz','22','single');`)
const objects = new Map()
const R2 = { async put(k, b) { objects.set(k, new Uint8Array(b)) }, async get(k) { const b = objects.get(k); return b ? { arrayBuffer: async () => b.slice().buffer } : null } }
const env = { DB: db, R2, LLM_KEY_ENCRYPTION_SECRET: Buffer.alloc(32, 7).toString('base64') }
const png = (w, h) => { const b = Buffer.alloc(300); Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(b, 0); b.writeUInt32BE(13, 8); b.write('IHDR', 12); b.writeUInt32BE(w, 16); b.writeUInt32BE(h, 20); b[24] = 8; b[25] = 6; return b }
const tasks = kind => sqlite.prepare('SELECT * FROM lw_tasks WHERE label_id=? AND kind=?').all('lab-a', kind)

// ---------- say it, it's done ----------
let r = await ownerCommand(db, 'lab-a', 1, 'yo I want to sell my merch on fourth wall')
assert.match(r.reply, /now sells on Fourthwall \(Amazon is off\)/); assert.match(r.reply, /sets up your free Fourthwall shop/)
let s = (await pt.getPartnerSettings(db, 'lab-a')).streams
assert.equal(s.merch, 'FOURTHWALL'); assert.equal(s.amazon, 'NONE')
assert.equal(tasks('SETUP_SHOP').length, 1)                                   // agent sets up the shop
await ownerCommand(db, 'lab-a', 1, 'sell shirts on Fourthwall')               // no duplicate shop task this month
assert.equal(tasks('SETUP_SHOP').length, 1)
r = await ownerCommand(db, 'lab-a', 1, 'sell merch on fourthwall and amazon too'); assert.equal((await pt.getPartnerSettings(db, 'lab-a')).streams.merch, 'BOTH'); assert.equal((await pt.getPartnerSettings(db, 'lab-a')).streams.amazon, 'MERCH_ON_DEMAND')
r = await ownerCommand(db, 'lab-a', 1, 'put tickets on eventbrite'); assert.equal((await pt.getPartnerSettings(db, 'lab-a')).streams.tickets, 'EVENTBRITE')
r = await ownerCommand(db, 'lab-a', 1, 'my instagram is @aviatorkeyz and tiktok @aviatorkeyz.'); assert.match(r.reply, /Instagram @aviatorkeyz/); assert.match(r.reply, /TikTok @aviatorkeyz/)
const ch = await pt.listChannels(db, 'lab-a'); assert.equal(ch.find(c => c.platform === 'instagram').status, 'READY'); assert.equal(ch.find(c => c.platform === 'tiktok').handle, 'aviatorkeyz')
assert.equal(tasks('PARTNER_SETUP').length, 0)                                // existing accounts: no profile rewrite
r = await ownerCommand(db, 'lab-a', 1, '2 posts a day'); assert.equal((await pt.getPartnerSettings(db, 'lab-a')).postsPerDay, 2)
r = await ownerCommand(db, 'lab-a', 1, 'move my check in to 10am'); assert.equal((await pt.getPartnerSettings(db, 'lab-a')).checkinHour, 10)
r = await ownerCommand(db, 'lab-a', 1, 'I already got social accounts'); assert.match(r.reply, /logged in to/); assert.equal(tasks('BRAND_KICKOFF').length, 1)
assert.equal(await ownerCommand(db, 'lab-a', 1, 'my song 22 was on Baddies and I never got paid'), null)  // a money story, not a setting
r = await ownerCommand(db, 'lab-a', 4, 'sell on fourthwall'); assert.match(r.reply, /Only the label owner/)  // owner decides money settings
r = await ownerCommand(db, 'lab-a', 4, 'stop'); assert.match(r.reply, /Stopped/)  // anyone can STOP
r = await ownerCommand(db, 'lab-a', 4, 'resume'); assert.match(r.reply, /Only the label owner/)
r = await ownerCommand(db, 'lab-a', 1, 'resume'); assert.match(r.reply, /Resumed/)
// in any chat box, with the reply saved in that employee's chat
const said = await talk(db, 'lab-a', 1, { text: 'autopilot on', agent: 'partner' })
assert.equal(said.command, true); assert.equal((await pt.getPartnerSettings(db, 'lab-a')).autopilot, 'ON')
assert.ok(sqlite.prepare("SELECT 1 FROM lw_employee_messages WHERE agent_id='partner' AND model='command'").get())

// ---------- images without a Studio2U key: the owner's own agent makes them ----------
const cov = await creative.generateCover(env, 'lab-a', 1, 'r1', {})
assert.equal(cov.queued, true); assert.match(cov.say, /own image tool/)
const img = tasks('MAKE_IMAGE')[0]; assert.ok(img && JSON.parse(img.input_json).kind === 'cover' && /Album cover art/.test(JSON.parse(img.input_json).prompt))
assert.ok(taskKinds.includes('MAKE_IMAGE') && taskKinds.includes('SETUP_SHOP'))
assert.match(instructionsFor('MAKE_IMAGE'), /own image tool/); assert.match(instructionsFor('SETUP_SHOP'), /Never type passwords, card, bank or tax/); assert.match(instructionsFor('SETUP_SHOP'), /SELL checkpoint/)
assert.match(instructionsFor('BRAND_KICKOFF'), /already logged in to/)
const link = await up.uploadLink(env, 'lab-a', 1, img.id, 'https://studio.invalid')
assert.match(link.url, /^https:\/\/studio\.invalid\/label-world\/agent-upload\//); assert.match(link.curl, /--data-binary @image\.png/)
await assert.rejects(up.uploadLink(env, 'lab-a', 3, img.id, 'https://x'), /permission/i)          // viewer
await assert.rejects(up.uploadLink(env, 'lab-b', 2, img.id, 'https://x'), /No image task/)          // other label
await assert.rejects(up.acceptUpload(env, link.url.split('/').pop().replace(/.$/, 'x'), png(3000, 3000)), /Invalid link/)   // tampered
await assert.rejects(up.acceptUpload(env, link.url.split('/').pop(), png(3000, 3000), Date.now() + 31 * 60000), /expired/)
let res = await app.request(link.url.replace('https://studio.invalid', 'http://localhost'), { method: 'POST', headers: { 'Content-Type': 'image/png', Origin: 'http://localhost' }, body: png(3000, 3000) }, env)
assert.equal(res.status, 201); const saved = await res.json(); assert.equal(saved.kind, 'cover'); assert.equal(saved.width, 3000)
assert.ok(sqlite.prepare("SELECT 1 FROM lw_assets WHERE id=? AND kind='artwork' AND release_id='r1'").get(saved.assetId))
assert.equal(sqlite.prepare('SELECT status FROM lw_tasks WHERE id=?').get(img.id).status, 'COMPLETED')
res = await app.request(link.url.replace('https://studio.invalid', 'http://localhost'), { method: 'POST', headers: { 'Content-Type': 'image/png', Origin: 'http://localhost' }, body: png(3000, 3000) }, env)
assert.equal(res.status, 409)                                                  // one use
// merch design the same way
const md = await merch.generateDesign(env, 'lab-a', 1, { prompt: 'Gold 22 with wings', title: 'Wings 22' })
assert.equal(md.queued, true); const mt = tasks('MAKE_IMAGE').find(t => JSON.parse(t.input_json).kind === 'merch')
const ml = await up.uploadLink(env, 'lab-a', 1, mt.id, 'http://localhost')
const ms = await up.acceptUpload(env, ml.url.split('/').pop(), png(2250, 2700))
assert.equal(ms.id, md.id); assert.equal(sqlite.prepare('SELECT status FROM lw_merch_designs WHERE id=?').get(md.id).status, 'DRAFT')  // owner still approves
// a rejected key falls back to the agent too
sqlite.prepare("INSERT INTO lw_provider_connections(user_id,provider,encrypted_key) VALUES (1,'openai',?)").run(await (await import('../src/label-world/providers/vault.ts')).encryptKey(env.LLM_KEY_ENCRYPTION_SECRET, 'sk-x', (await import('../src/label-world/providers/vault.ts')).keyContext(1, 'openai', '{}')))
const denied = await creative.generateCover(env, 'lab-a', 1, 'r1', {}, async () => new Response('{}', { status: 403 }))
assert.equal(denied.queued, true); assert.match(denied.say, /rejected your key for images/)

// ---------- engine: brand kickoff for every known artist, shop setup kept alive ----------
sqlite.exec("DELETE FROM lw_task_events WHERE task_id IN (SELECT id FROM lw_tasks WHERE kind IN ('BRAND_KICKOFF','SETUP_SHOP')); DELETE FROM lw_tasks WHERE kind IN ('BRAND_KICKOFF','SETUP_SHOP')")
const sum = await runEngine(env, { labelIds: ['lab-a'] })
assert.equal(sum.brandKickoffs, 1); assert.equal(tasks('BRAND_KICKOFF').length, 1); assert.equal(tasks('SETUP_SHOP').length, 1)
await runEngine(env, { labelIds: ['lab-a'] }); assert.equal(tasks('BRAND_KICKOFF').length, 1)   // once
// website button
res = await app.request('http://localhost/api/label-world/labels/lab-a/merch/shop/setup', { method: 'POST', headers: { Cookie: 'studio2u_session=test-session-1', Origin: 'http://localhost', 'Content-Type': 'application/json' }, body: '{}' }, env)
assert.equal(res.status, 201)
console.log('PASS commands: say it and it is done (Fourthwall/Amazon/both, tickets, existing social handles with no profile rewrite, pace, check-in, autopilot, brand, stop/resume; owner-only money settings, anyone can STOP; money stories still go to cases; reply in the employee chat), images made by the owner\'s own agent when there is no key or the key is rejected (signed one-use 30-min upload link, saved as cover or merch draft, task completed, tamper/expiry/tenant/viewer checks), agent sets up and connects the Fourthwall shop, engine starts Ben\'s brand kickoff for every known artist once')
