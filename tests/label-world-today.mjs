// Today screen, phone alerts (ntfy), instant catalog fill on "That's me", answering an agent's
// questions from Today, stale-job cleanup, and the engine -> Pages delivery endpoint.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture } from './label-world-api-fixture.mjs'
const today = await import('../src/label-world/autonomy/today.ts')
const alerts = await import('../src/label-world/autonomy/alerts.ts')
const quick = await import('../src/label-world/autonomy/quickfill.ts')
const cp = await import('../src/label-world/autonomy/checkpoints.ts')
const { claimNext, completeTask, instructionsFor } = await import('../src/label-world/autonomy/service.ts')
const { enqueue, notify, runEngine } = await import('../src/label-world/autonomy/engine.ts')

const f = fixture(), { sqlite, db, app } = f
sqlite.exec(`INSERT INTO lw_labels(id,name) VALUES ('lab-a','Aviator'),('lab-b','Other');
INSERT INTO lw_memberships VALUES ('lab-a',1,'owner'),('lab-b',2,'owner'),('lab-a',3,'viewer'),('lab-a',4,'editor');
INSERT INTO lw_label_identity(label_id,artist_name,legal_name,aliases_json,pro) VALUES ('lab-a','Aviator Keyz','Mason Brown','[]','ASCAP');`)
const env = { DB: db, LLM_KEY_ENCRYPTION_SECRET: Buffer.alloc(32, 7).toString('base64'), ENGINE_SHARED_SECRET: 'x'.repeat(40) }
const web = (path, user, body) => app.request('http://localhost/api/label-world' + path, { method: body ? 'POST' : 'GET', headers: { Cookie: 'studio2u_session=test-session-' + user, Origin: 'http://localhost', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }, env)

// ---------- Today: empty label ----------
let t = await today.today(db, 'lab-a', 3)
assert.equal(t.needsYou, 0); assert.equal(t.numbers.songs, 0); assert.ok(t.team)
await assert.rejects(today.today(db, 'lab-a', 2), /Label not found/)

// ---------- fill everything that needs you ----------
const ask = await cp.askCheckpoint(db, 'lab-a', 1, { kind: 'POST', title: 'Post the 22 reel on Instagram' }, 'Codex')
sqlite.exec(`INSERT INTO lw_artist_links(id,label_id,platform,url,source,confidence,status,evidence) VALUES
 ('l1','lab-a','apple_music','https://music.apple.com/us/artist/aviator-keyz/953548295','ITUNES','STRONG','SUGGESTED','Apple Music artist'),
 ('l2','lab-a','deezer','https://www.deezer.com/artist/7257086','DEEZER','LIKELY','SUGGESTED','Deezer artist'),
 ('l3','lab-a','apple_music','https://music.apple.com/us/artist/aviator-keyz/1475920847','ITUNES','POSSIBLE','SUGGESTED','namesake?');
INSERT INTO lw_cases(id,label_id,playbook,title,created_by) VALUES ('c1','lab-a','tv-cue-sheet','22 on Baddies','owner');
INSERT INTO lw_case_drafts(id,label_id,case_id,kind,recipient,subject,body,written_by) VALUES ('d1','lab-a','c1','EMAIL','Zeus Network','Cue sheet for 22','Hello','Codex');`)
await enqueue(db, { label: 'lab-a', kind: 'COLLECT_INTAKE', role: 'a', title: 'Credits for 22', input: {}, dedupe: 'q1' })
const qt = await claimNext(db, 1, ['lab-a'], 'Codex', false, ['COLLECT_INTAKE'])
await completeTask(db, 1, ['lab-a'], { taskId: qt.task.id, outcome: 'WAITING_FOR_INPUT', summary: 'need writers', questions: ['Who wrote 22 with you?', 'What split?'] }, 'Codex')
await enqueue(db, { label: 'lab-a', kind: 'SETUP_REACH', role: 'r', title: 'Install Agent Reach', input: {}, dedupe: 'r1' })
const ft = await claimNext(db, 1, ['lab-a'], 'Codex', false, ['SETUP_REACH'])
await completeTask(db, 1, ['lab-a'], { taskId: ft.task.id, outcome: 'BLOCKED', summary: 'Cannot run terminal commands in this app.' }, 'Codex')

t = await today.today(db, 'lab-a', 1)
assert.equal(t.needs.checkpoints.length, 1); assert.equal(t.needs.questions.length, 1); assert.deepEqual(t.needs.questions[0].questions, ['Who wrote 22 with you?', 'What split?'])
assert.equal(t.needs.profiles[0].confidence, 'STRONG'); assert.equal(t.needs.profiles[0].fillsCatalog, true)   // strongest first
assert.equal(t.needs.drafts[0].to, 'Zeus Network')
assert.equal(t.needsYou, 1 + 1 + 3 + 1); assert.match(t.headline, /6 things need you/)
assert.equal(t.stuck.length, 1); assert.match(t.stuck[0].why, /terminal/)
assert.ok(!t.queued.some(q => q.title === 'Credits for 22'))     // waiting on you is not "up next"
let res = await web('/labels/lab-a/today', 3); assert.equal(res.status, 200)                    // viewers can see Today
res = await web('/labels/lab-a/today', 2); assert.equal(res.status, 404)

// ---------- answer the agent's questions from Today ----------
await assert.rejects(quick.answerTask(db, 'lab-a', 3, qt.task.id, { answer: 'x' }), /permission/i)
await assert.rejects(quick.answerTask(db, 'lab-a', 1, qt.task.id, { answer: 'my password is hunter2' }), /Never type passwords/)
res = await web(`/labels/lab-a/tasks/${qt.task.id}/answer`, 1, { answer: 'Que Banz, 50/50' }); assert.equal(res.status, 200)
const back = await claimNext(db, 1, ['lab-a'], 'Codex', false, ['COLLECT_INTAKE'])
assert.equal(back.task.input.ownerAnswer, 'Que Banz, 50/50'); assert.deepEqual(back.task.input.ownerAnswerTo, ['Who wrote 22 with you?', 'What split?'])
assert.match(instructionsFor('COLLECT_INTAKE'), /input\.ownerAnswer/)
await assert.rejects(quick.answerTask(db, 'lab-a', 1, qt.task.id, { answer: 'again' }), /already answered|finished/)
assert.equal((await today.today(db, 'lab-a', 1)).needs.questions.length, 0)

// ---------- "That's me" fills the catalog on the spot ----------
const fake = async url => {
  if (url.includes('itunes.apple.com/lookup?id=953548295')) return { results: [{ wrapperType: 'artist' }, { wrapperType: 'track', trackId: 1, trackName: 'Hawaii', artistName: 'Aviator Keyz', collectionName: 'Hawaii', releaseDate: '2024-03-04T00:00:00Z' }, { wrapperType: 'track', trackId: 2, trackName: 'No Safety (feat. Benny the Butcher & Aviator Keyz)', artistName: 'Uncle Murda', releaseDate: '2024-02-23T00:00:00Z' }] }
  if (url.includes('api.deezer.com/artist/7257086/albums')) return { data: [{ id: 9, title: 'Hawaii', release_date: '2024-03-04' }] }
  if (url.includes('api.deezer.com/album/9/tracks')) return { data: [{ id: 91, title: 'Hawaii', artist: { name: 'Aviator Keyz' }, duration: 160 }] }
  throw new Error('unexpected ' + url)
}
let r = await quick.decideAndFill(db, 'lab-a', 1, 'l1', 'CONFIRMED', fake)
assert.equal(r.catalog.added, 2); assert.match(r.say, /Added 2 songs/)
assert.equal(sqlite.prepare("SELECT apple_artist_id FROM lw_label_identity WHERE label_id='lab-a'").get().apple_artist_id, '953548295')
r = await quick.decideAndFill(db, 'lab-a', 1, 'l1', 'CONFIRMED', fake); assert.equal(r.catalog.added, 0)   // idempotent
r = await quick.decideAndFill(db, 'lab-a', 1, 'l3', 'NOT_ME', fake); assert.equal(r.catalog, null)          // namesake: nothing imported
r = await quick.decideAndFill(db, 'lab-a', 1, 'l2', 'CONFIRMED', fake); assert.equal(r.catalog.added, 1)
await assert.rejects(quick.decideAndFill(db, 'lab-a', 3, 'l2', 'CONFIRMED', fake), /permission/i)
assert.equal(await quick.fillFromLink(db, 'lab-a', 1, { platform: 'instagram', url: 'https://instagram.com/x' }, fake), null)
assert.ok((await today.today(db, 'lab-a', 1)).numbers.songs >= 2)

// ---------- phone alerts (ntfy): private topic, batched, counts only, once ----------
let a = await alerts.getAlerts(db, 1, env); assert.equal(a.push, false); assert.equal(a.emailAvailable, false)
await assert.rejects(alerts.setAlerts(db, 1, { email: true }, env), /not set up/)
a = await alerts.setAlerts(db, 1, { push: true }, env); assert.match(a.topic, /^s2u-[a-f0-9]{32}$/); assert.equal(a.subscribeUrl, 'https://ntfy.sh/' + a.topic)
const topic1 = a.topic
assert.equal((await alerts.setAlerts(db, 1, { push: true }, env)).topic, topic1)                 // stable while on
await alerts.setAlerts(db, 1, { push: false }, env); a = await alerts.setAlerts(db, 1, { push: true }, env)
assert.notEqual(a.topic, topic1)                                                                // off+on = new private topic
const sent = []; const ntfy = async (url, init) => { sent.push({ url, body: JSON.parse(init.body) }); return new Response('{}', { status: 200 }) }
sqlite.exec("UPDATE lw_notifications SET delivered_at=CURRENT_TIMESTAMP")                       // start clean
await notify(db, { label: 'lab-a', kind: 'CHECKPOINT', title: 'Can I post this? Secret song name', body: 'secret', dedupe: 'n1' })
await notify(db, { label: 'lab-a', kind: 'QUESTIONS', title: 'Your team needs 2 answers', body: 'Who wrote "Secret song"?', dedupe: 'n2' })
await notify(db, { label: 'lab-a', kind: 'MONDAY_REPORT', title: 'Weekly report', body: 'x', dedupe: 'n3' })      // not urgent: no push
let d = await alerts.deliverAlerts(env, ntfy)
assert.equal(d.pushed, 1); assert.equal(sent.length, 1)                                         // one batched push
assert.equal(sent[0].url, 'https://ntfy.sh/'); assert.equal(sent[0].body.topic, a.topic)
assert.match(sent[0].body.message, /1 approval, 1 question/); assert.ok(!JSON.stringify(sent[0].body).includes('Secret'))   // no details leak
assert.equal(sent[0].body.click, 'https://studio2u.pages.dev/label-world/today')
d = await alerts.deliverAlerts(env, ntfy); assert.equal(d.pushed, 0)                            // never twice
assert.ok(sqlite.prepare("SELECT 1 FROM lw_notifications WHERE kind='MONDAY_REPORT' AND delivered_at IS NULL").get())
await notify(db, { label: 'lab-a', kind: 'CHECKPOINT', title: 'another', body: 'x', dedupe: 'n4' })
await today.markSeen(db, 'lab-a', 1); d = await alerts.deliverAlerts(env, ntfy); assert.equal(d.pushed, 0)  // seen on Today: no push
await notify(db, { label: 'lab-a', kind: 'CHECKPOINT', title: 'down', body: 'x', dedupe: 'n5' })
d = await alerts.deliverAlerts(env, async () => new Response('', { status: 500 })); assert.equal(d.failed, 1)
assert.ok(sqlite.prepare("SELECT 1 FROM lw_notifications WHERE dedupe_key LIKE 'n5:%' AND delivered_at IS NULL").get())   // retried next pass
assert.match((await alerts.testAlert(env, 1, ntfy)).say, /Test sent/)
await assert.rejects(alerts.testAlert(env, 2, ntfy), /Turn on phone alerts/)
res = await web('/alerts', 1); assert.equal((await res.json()).push, true)
res = await web('/alerts', 2); assert.equal((await res.json()).push, false)                       // per person

// email only when the deployment is configured
const envMail = { ...env, RESEND_API_KEY: 're_test', ALERT_EMAIL_FROM: 'Studio2U <alerts@example.com>' }
await alerts.setAlerts(db, 1, { email: true }, envMail)
await notify(db, { label: 'lab-a', kind: 'TEAM_IDLE', title: 'idle', body: 'x', dedupe: 'n6' })
const mail = []; d = await alerts.deliverAlerts(envMail, async (url, init) => { if (url.includes('resend')) mail.push(JSON.parse(init.body)); return new Response('{}', { status: 200 }) })
assert.equal(d.emailed, 1); assert.deepEqual(mail[0].to, ['test1@example.invalid']); assert.match(mail[0].text, /your team is waiting to run/)

// ---------- engine -> Pages delivery endpoint: shared secret only ----------
assert.equal(alerts.engineAuthorized({ ENGINE_SHARED_SECRET: 'short' }, 'short'), false)
assert.equal(alerts.engineAuthorized(env, 'x'.repeat(39) + 'y'), false); assert.equal(alerts.engineAuthorized(env, 'x'.repeat(40)), true)
const deliver = (h) => app.request('http://localhost/label-world/engine/deliver', { method: 'POST', headers: { 'Content-Type': 'application/json', ...h }, body: '{}' }, env)
assert.equal((await deliver({})).status, 401); assert.equal((await deliver({ 'X-Engine-Secret': 'nope' })).status, 401)
let ok = await deliver({ 'X-Engine-Secret': 'x'.repeat(40) }); assert.equal(ok.status, 200); assert.ok('pushed' in await ok.json())   // passes the site's CSRF guard like the real worker call
assert.match(readFileSync('tools/label-world-engine-worker.ts', 'utf8'), /'Content-Type': 'application\/json'/)
const worker = readFileSync('tools/label-world-engine-worker.ts', 'utf8')
assert.match(worker, /engine\/deliver/); assert.match(worker, /X-Engine-Secret/)

// ---------- stale jobs close themselves ----------
await enqueue(db, { label: 'lab-a', kind: 'CASE_STEP', role: 'c', title: 'old', input: {}, dedupe: 'old1' })
sqlite.exec("UPDATE lw_tasks SET created_at=datetime('now','-31 days') WHERE dedupe_key='old1'")
await enqueue(db, { label: 'lab-a', kind: 'CREATIVE_TOOL', role: 'p', title: 'parked', input: {}, dedupe: 'pk1' })
const pk = await claimNext(db, 1, ['lab-a'], 'Codex', true, ['CREATIVE_TOOL'])
const ask3 = await cp.askCheckpoint(db, 'lab-a', 1, { kind: 'SPEND', title: 'Spend credits' }, 'Codex')
await completeTask(db, 1, ['lab-a'], { taskId: pk.task.id, outcome: 'WAITING_FOR_APPROVAL', summary: 'asked', checkpointId: ask3.id }, 'Codex')
sqlite.prepare("UPDATE lw_checkpoints SET status='EXPIRED' WHERE id=?").run(ask3.id)
const sum = await runEngine(env, { labelIds: ['lab-a'] }); assert.ok(sum.expired >= 2)
assert.equal(sqlite.prepare("SELECT status FROM lw_tasks WHERE dedupe_key='old1'").get().status, 'CANCELLED')
assert.equal(sqlite.prepare('SELECT status FROM lw_tasks WHERE id=?').get(pk.task.id).status, 'CANCELLED')
console.log('PASS today: one screen (needs you: approvals, agent questions, "is this you?" strongest first, week plans, drafts, designs; stuck; what the team did; up next; team status; viewers see, other labels 404), answer agent questions from Today (no passwords, task returns with the answer), "That\'s me" fills the catalog on the spot from Apple Music/Deezer (idempotent, namesakes untouched), phone alerts via a private ntfy topic (batched, counts only, never twice, skipped once seen, retried on failure, new topic on re-enable, per person; email only when configured), engine->Pages delivery behind a shared secret, stale and orphaned jobs close themselves')
