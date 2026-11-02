// ASCAP "Register a Work" for catalog songs: form-order fill list with skip logic,
// 50/50 share conversion, metadata cross-check (mocked), owner-only Submit, engine
// queueing, MCP tools, website routes. No network, no model.
import assert from 'node:assert/strict'
import { fixture } from './label-world-api-fixture.mjs'
const ascap = await import('../src/label-world/autonomy/ascap.ts')
const { parseDuration, hms, intakePatch } = await import('../src/label-world/autonomy/intake.ts')
const { runEngine } = await import('../src/label-world/autonomy/engine.ts')
const { suggestPlaybooks, playbookById } = await import('../src/label-world/autonomy/playbooks.ts')
const { createStudioMcp } = await import('../src/label-world/mcp/server.ts')
const { Client, StreamableHTTPClientTransport } = await import('@modelcontextprotocol/client')

const f = fixture(), { sqlite, db, app } = f
sqlite.exec(`INSERT INTO lw_labels(id,name) VALUES ('lab-a','Aviator Music Group'),('lab-b','Other');
INSERT INTO lw_memberships VALUES ('lab-a',1,'owner'),('lab-b',2,'owner'),('lab-a',3,'viewer');
INSERT INTO lw_label_identity(label_id,artist_name,legal_name,aliases_json,pro,ipi) VALUES ('lab-a','Aviator Keys','Mason Brown','["Aviator Keyz"]','ASCAP','00123456789');
INSERT INTO lw_catalog_tracks(id,label_id,source,source_id,title,artist_credit,isrc,release_date,duration_sec,link) VALUES
 ('t1','lab-a','deezer','1','22','Aviator Keys','QZ85M1979735','2019-05-01',196,'https://www.deezer.com/track/1'),
 ('t2','lab-a','itunes','5','Crash and Burn (feat. Aviator Keys)','Will2live',NULL,'2013-02-25',200,'https://music.apple.com/t'),
 ('t3','lab-a','manual',NULL,'Unreleased Demo','Aviator Keys',NULL,NULL,NULL,NULL);`)
const env = { DB: db }
const web = (path, user = 1, body) => app.request('http://localhost/api/label-world/labels/lab-a' + path, { method: body ? 'POST' : 'GET', headers: { Cookie: 'studio2u_session=test-session-' + user, Origin: 'http://localhost', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }, env)

// ---------- helpers ----------
assert.equal(parseDuration('3:25'), 205); assert.equal(parseDuration('00:03:25'), 205); assert.equal(parseDuration('205'), 205); assert.equal(parseDuration('3:75'), null)
assert.equal(hms(196), '00:03:16')
assert.equal(intakePatch({ durationSec: '3:16' }).durationSec, 196)
assert.throws(() => intakePatch({ durationSec: 50000 }), /12 hours/)
assert.throws(() => intakePatch({ writers: [{ legalName: 'A', split: 100, publisherName: 'P', noPublisher: true }] }), /noPublisher/)
assert.deepEqual(ascap.halfShares([60, 40]), [30, 20])
assert.deepEqual([...ascap.halfShares([33.33, 33.33, 33.34])].sort(), [16.66, 16.67, 16.67]) // always totals exactly 50
assert.equal(ascap.halfShares([33.33, 33.33, 33.34]).reduce((a, b) => a + b, 0).toFixed(2), '50.00')

// ---------- form logic ----------
let form = ascap.ascapForm({ title: '22', artistCredit: 'Aviator Keys', releaseDate: '2019-05-01', isrc: 'QZ85M1979735', durationSec: 196, intake: {}, released: true })
assert.equal(form.status, 'NEEDS_INFO'); assert.match(form.say, /Who wrote this song/)
const get = (fm, label) => fm.items.find(x => x.label.includes(label))
assert.equal(get(form, 'Work Title*').value, '22')
assert.equal(get(form, 'Release Date').value, '05/01/2019'); assert.equal(get(form, 'ISRC').value, 'QZ85M1979735')
assert.equal(get(form, 'HH:MM:SS').value, '00:03:16')
assert.equal(get(form, 'Performer Name').value, 'Aviator Keys')
for (const s of ['Commercial, film or other Product?', 'Is this a concert work?', 'Does this work include a sample?', 'Does this work use public domain elements?']) assert.equal(form.items.find(x => x.section === s).action, 'SKIP', s)
assert.equal(form.items.at(-1).action, 'HUMAN') // Submit is always the owner's

const writers = [
  { legalName: 'Mason Brown', role: 'writer', split: 60, pro: 'ASCAP', ipi: '00123456789', noPublisher: true },
  { legalName: 'Jay Producer', role: 'writer_producer', split: 40, pro: 'BMI', ipi: '00987654321', publisherName: 'Jay Beats Publishing', publisherIpi: '00555555555' }
]
form = ascap.ascapForm({ title: '22', artistCredit: 'Aviator Keys', releaseDate: '2019-05-01', durationSec: 196, intake: { writers }, released: true })
assert.equal(form.status, 'READY', JSON.stringify(form.asks)); assert.match(form.say, /press Submit|stop on Submit/)
assert.equal(get(form, 'Writer 1: Mason Brown · Share').value, '30'); assert.equal(get(form, 'Writer 2: Jay Producer · Share').value, '20')
assert.equal(get(form, 'Writer 1: Mason Brown · Role').value, 'Composer / Author')
assert.equal(get(form, 'Writer 1: Mason Brown · Search by Writer').value, '00123456789')
assert.ok(get(form, 'Writer 1: Mason Brown · [x] This writer has no Publisher'))
assert.equal(get(form, 'Writer 2: Jay Producer · Publisher Share').value, '20'); assert.equal(get(form, 'Writer 2: Jay Producer · Territory').value, 'WORLD')
assert.match(get(form, 'Writer 2: Jay Producer · PRO').note, /BMI/)
assert.equal(get(form, 'ISRC').action, 'SKIP') // optional

// missing publisher answer -> ask, never assume "no publisher"
form = ascap.ascapForm({ title: 'X', artistCredit: 'A', intake: { writers: [{ legalName: 'Mason Brown', role: 'writer', split: 100, ipi: '00123456789' }] }, released: true })
assert.equal(form.status, 'NEEDS_INFO'); assert.match(form.asks[0].note, /publisher/)
// bad splits / uncleared sample -> STOP
form = ascap.ascapForm({ title: 'X', intake: { writers: [{ legalName: 'A', role: 'writer', split: 70 }] }, released: false })
assert.equal(form.status, 'BLOCKED'); assert.match(form.stops[0].note, /70%/)
form = ascap.ascapForm({ title: 'X', artistCredit: 'A', intake: { writers: [{ ...writers[0], split: 100 }], samples: [{ description: 'Loop from old soul record', cleared: false }] }, released: true })
assert.equal(form.status, 'BLOCKED'); assert.match(form.stops[0].note, /Not cleared/)
form = ascap.ascapForm({ title: 'X', artistCredit: 'A', intake: { writers: [{ ...writers[0], split: 100 }], samples: [{ description: 'Hook', workTitle: 'Old Song', cleared: true, writers: [{ name: 'Old Writer', ipi: '00111111111' }] }], commercialUse: { productType: 'Commercial', productionName: 'Nike Spring' } }, released: true })
assert.equal(form.status, 'READY'); assert.equal(get(form, 'Title of Work Used').value, 'Old Song'); assert.equal(get(form, 'Writer Name*, IPI').value, 'Old Writer, 00111111111'); assert.equal(get(form, 'Product Type').value, 'Commercial')
// unreleased -> recorded/performed skipped
form = ascap.ascapForm({ title: 'Demo', intake: {}, released: false })
assert.equal(form.items.find(x => x.section === 'Has this work been recorded?').action, 'SKIP')
assert.equal(form.items.find(x => x.section === 'Has this work been performed?').action, 'SKIP')

// ---------- metadata cross-check (mocked) ----------
const fake = async url => {
  if (url.includes('deezer.com/track/isrc:QZ85M1979735')) return { title: '22', isrc: 'QZ85M1979735', duration: 196, release_date: '2019-05-01', artist: { name: 'Aviator Keyz' }, contributors: [{ name: 'Aviator Keyz' }] }
  if (url.includes('itunes.apple.com/search')) return { results: [{ trackName: '22', artistName: 'Aviator Keys', trackTimeMillis: 197000, releaseDate: '2019-05-01T07:00:00Z' }] }
  throw new Error('unexpected ' + url)
}
const md = await ascap.checkMetadata({ title: '22', artistCredit: 'Aviator Keys', isrc: 'QZ85M1979735', durationSec: 196, releaseDate: '2019-05-01' }, fake)
assert.deepEqual(md.sources, ['Deezer (by ISRC)', 'Apple Music'])
assert.ok(md.conflicts.some(c => /Aviator Keyz/.test(c))) // the name dispute shows up
assert.equal(md.verified, false)
const md2 = await ascap.checkMetadata({ title: 'Nothing', artistCredit: 'Nobody' }, async () => { throw new Error('offline') })
assert.deepEqual(md2.sources, []); assert.equal(md2.verified, false) // offline never throws

// ---------- catalog song flow ----------
let p = await ascap.prepareTrack(db, 'lab-a', 1, 't1')
assert.equal(p.status, 'NEEDS_INFO'); assert.match(p.before[0], /search ASCAP Member Access > Works/i)
assert.match((await ascap.prepareTrack(db, 'lab-a', 1, 't2')).say, /featured/) // featured-only song: check main artist's registration
await assert.rejects(ascap.saveTrackWork(db, 'lab-a', 3, 't1', { writers }), /permission/i) // viewer
await assert.rejects(ascap.saveTrackWork(db, 'lab-a', 1, 't1', { genre: 'x' }), /Unknown song field/)
// owner's IPI fills in from the artist identity (exact legal name match only)
p = await ascap.saveTrackWork(db, 'lab-a', 1, 't1', { writers: [{ legalName: 'Mason Brown', role: 'writer', split: 60, noPublisher: true }, writers[1]], durationSec: '3:16' })
assert.equal(p.status, 'READY', JSON.stringify(p.asks)); assert.equal(p.items.find(x => x.label.includes('Writer 1: Mason Brown · Search')).value, '00123456789')
assert.ok(sqlite.prepare("SELECT 1 FROM lw_audit_events WHERE action='catalog.work.saved'").get())
await assert.rejects(ascap.saveTrackWork(db, 'lab-b', 2, 't1', { durationSec: 10 }), /not found/i) // other label

let q = await ascap.registrationQueue(db, 'lab-a', 1)
assert.equal(q.progress, '0 of 3 registered'); assert.equal(q.ready, 1); assert.equal(q.songs.find(s => s.trackId === 't1').status, 'READY')

// engine: READY song -> one screen task (deduped); viewers can't claim
let sum = await runEngine(env, { labelIds: ['lab-a'] })
assert.equal(sum.registrations, 1)
assert.equal((await runEngine(env, { labelIds: ['lab-a'] })).registrations, 0)
const task = sqlite.prepare("SELECT * FROM lw_tasks WHERE kind='REGISTER_WORK'").get()
assert.equal(task.capability, 'SCREEN_CONTROL'); assert.match(task.title, /you press Submit/)

// owner submits -> SUBMITTED (not yet REGISTERED) -> verify later
await assert.rejects(ascap.reportTrack(db, 'lab-a', 1, 't1', { outcome: 'SUBMITTED' }), /what you saw/)
let rp = await ascap.reportTrack(db, 'lab-a', 1, 't1', { outcome: 'SUBMITTED', evidence: 'ASCAP: "Your work has been submitted" ref 88812' })
assert.equal(rp.proStatus, 'NOT_REGISTERED') // submitted is not registered until it shows in Works
assert.ok(sqlite.prepare("SELECT pro_submitted_at FROM lw_catalog_tracks WHERE id='t1'").get().pro_submitted_at)
sqlite.exec("UPDATE lw_catalog_tracks SET pro_submitted_at=datetime('now','-11 days') WHERE id='t1'")
sum = await runEngine(env, { labelIds: ['lab-a'] }); assert.equal(sum.registrations, 1)
assert.ok(sqlite.prepare("SELECT 1 FROM lw_tasks WHERE kind='REGISTER_WORK' AND json_extract(input_json,'$.mode')='VERIFY'").get())
rp = await ascap.reportTrack(db, 'lab-a', 1, 't1', { outcome: 'REGISTERED', workId: '9001234', evidence: 'Works list shows 22, Mason Brown 30%, Jay Producer 20%' })
assert.equal(rp.proStatus, 'REGISTERED')
q = await ascap.registrationQueue(db, 'lab-a', 1); assert.equal(q.progress, '1 of 3 registered')

// ---------- website ----------
let r = await web('/registrations/ascap'); assert.equal(r.status, 200); assert.equal((await r.json()).progress, '1 of 3 registered')
r = await web('/catalog/t3/ascap', 3); assert.equal(r.status, 200) // viewer can read
r = await web('/catalog/t3/work', 3, { work: { durationSec: 120 } }); assert.equal(r.status, 403)
r = await web('/catalog/t3/work', 1, { work: { writers: [{ legalName: 'Mason Brown', role: 'writer', split: 100, noPublisher: true }] } }); assert.equal(r.status, 200)
const t3 = await r.json(); assert.equal(t3.status, 'READY'); assert.equal(t3.items.find(x => x.section === 'Has this work been recorded?').action, 'SKIP')
r = await web('/catalog/t3/ascap/report', 1, { outcome: 'ALREADY_REGISTERED', evidence: 'Found in Works', workId: '777' }); assert.equal((await r.json()).proStatus, 'REGISTERED')

// ---------- playbook + MCP ----------
assert.equal(playbookById('register-songs').version, 2)
assert.ok(playbookById('register-songs').steps.some(s => /do NOT register again/.test(s)))
assert.equal(suggestPlaybooks('I only have 8 of my 60 songs registered with ASCAP')[0].id, 'register-songs')
const handler = createStudioMcp(db, { userId: 1, grantId: 'g1', labelIds: ['lab-a'], scopes: ['labels:read', 'releases:read', 'releases:write', 'tasks:read', 'tasks:write'], clientName: 'Codex', toolMode: 'core' }, async () => true)
const client = new Client({ name: 't', version: '1' })
await client.connect(new StreamableHTTPClientTransport(new URL('https://studio.invalid/label-world/mcp'), { fetch: (u, o) => handler.fetch(new Request(u, o)) }))
const guide = await client.callTool({ name: 'studio2u_guide', arguments: { topic: 'register' } })
assert.match(guide.content[0].text, /registration_queue/); assert.match(guide.content[0].text, /save_song_work\(labelId, trackId, work/)
const run = async (tool, args) => { const x = await client.callTool({ name: 'studio2u_run', arguments: { tool, args } }); return x.isError ? { error: x.content[0].text } : JSON.parse(x.content[0].text) }
const mq = await run('registration_queue', { labelId: 'lab-a' }); assert.equal(mq.progress, '2 of 3 registered')
const prep = await run('prepare_song_registration', { labelId: 'lab-a', trackId: 't2', verify: false }); assert.equal(prep.status, 'NEEDS_INFO')
const saved = await run('save_song_work', { labelId: 'lab-a', trackId: 't2', work: { writers: [{ legalName: 'Mason Brown', split: 25, noPublisher: true }, { legalName: 'Will Two', split: 75, pro: 'BMI', ipi: '00222222222', noPublisher: true }] } })
assert.equal(saved.status, 'READY'); assert.equal(saved.items.find(x => x.label.includes('Will Two · Share')).value, '37.5')
assert.ok((await run('report_song_registration', { labelId: 'lab-a', trackId: 't2', outcome: 'SUBMITTED' })).error) // evidence required
assert.ok((await run('prepare_song_registration', { labelId: 'lab-b', trackId: 't1' })).error) // label not granted
await client.close(); await handler.close()
console.log('PASS ascap: Register-a-Work form order with skip logic, 50/50 share conversion (exact totals), no-publisher only when confirmed, sample/split STOPs, Deezer/Apple metadata cross-check, owner IPI reuse, featured-song check, engine fill + 10-day verify tasks, SUBMITTED vs REGISTERED evidence, website + MCP, viewer/tenant isolation')
