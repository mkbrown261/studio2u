// SoundExchange: account status + roles (no secrets), locked-out password guidance,
// Submit Recordings (owner) + Search & Claim (artist) fill lists, SUBMITTED vs CLAIMED,
// engine tasks, bulk ingest rows, Contact Information Update Form, Letters of Direction,
// no tax forms as email attachments, website + MCP topic. No network.
import assert from 'node:assert/strict'
import { fixture } from './label-world-api-fixture.mjs'
const sx = await import('../src/label-world/autonomy/soundexchange.ts')
const cases = await import('../src/label-world/autonomy/cases.ts')
const { runEngine } = await import('../src/label-world/autonomy/engine.ts')
const { playbookById } = await import('../src/label-world/autonomy/playbooks.ts')
const { createStudioMcp } = await import('../src/label-world/mcp/server.ts')
const { Client, StreamableHTTPClientTransport } = await import('@modelcontextprotocol/client')

const f = fixture(), { sqlite, db, app } = f
sqlite.exec(`INSERT INTO lw_labels(id,name) VALUES ('lab-a','Aviator Music Group'),('lab-b','Other');
INSERT INTO lw_memberships VALUES ('lab-a',1,'owner'),('lab-b',2,'owner'),('lab-a',3,'viewer');
INSERT INTO lw_label_identity(label_id,artist_name,legal_name,aliases_json,pro,ipi) VALUES ('lab-a','Aviator Keys','Mason Brown','["Aviator Keyz"]','ASCAP','00123456789');
INSERT INTO lw_catalog_tracks(id,label_id,source,source_id,title,artist_credit,isrc,release_date,duration_sec,link) VALUES
 ('t1','lab-a','deezer','1','22','Aviator Keys','QZ85M1979735','2019-05-01',196,'https://www.deezer.com/track/1'),
 ('t2','lab-a','itunes','5','No Code Yet','Aviator Keys',NULL,'2020-02-25',200,'https://music.apple.com/t');`)
const env = { DB: db }
const web = (path, user = 1, body) => app.request('http://localhost/api/label-world/labels/lab-a' + path, { method: body ? 'POST' : 'GET', headers: { Cookie: 'studio2u_session=test-session-' + user, Origin: 'http://localhost', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }, env)

// ---------- roles ----------
assert.deepEqual(sx.roleAdvice(true, false).roles, ['FEATURED_ARTIST', 'SRCO'])
assert.deepEqual(sx.roleAdvice(false, true).roles, ['FEATURED_ARTIST'])
assert.equal(sx.roleAdvice(null, null).roles, null)

// ---------- account: unknown -> asks; locked out -> forgot password, never the password ----------
let acct = await sx.getSxAccount(db, 'lab-a', 1)
assert.equal(acct.account.status, 'UNKNOWN'); assert.equal(acct.checklist.status, 'NEEDS_INFO')
await assert.rejects(sx.saveSxAccount(db, 'lab-a', 1, { password: 'hunter2' }), /Never save passwords/)
await assert.rejects(sx.saveSxAccount(db, 'lab-a', 1, { taxId: '1234' }), /Never save/)
await assert.rejects(sx.saveSxAccount(db, 'lab-a', 1, { notes: 'my ssn 123-45-6789' }), /Social Security/)
await assert.rejects(sx.saveSxAccount(db, 'lab-a', 1, { status: 'MAYBE' }), /status must be/)
await assert.rejects(sx.saveSxAccount(db, 'lab-a', 3, { status: 'ACTIVE' }), /permission/i)
await assert.rejects(sx.saveSxAccount(db, 'lab-b', 2, { status: 'ACTIVE' }), /identity/)
acct = await sx.saveSxAccount(db, 'lab-a', 1, { status: 'LOCKED_OUT', loginEmail: 'Mason@Example.com', registeredAs: ['FEATURED_ARTIST'], srcoEntity: 'Aviator Music Group LLC' })
const reset = acct.checklist.items.find(x => x.label === 'Reset your password')
assert.equal(reset.action, 'HUMAN'); assert.match(reset.note, /Forgot password/); assert.match(reset.note, /mason@example.com/); assert.match(reset.note, /1-800-961-2091/); assert.match(reset.note, /never sees/)
assert.equal(acct.checklist.items.find(x => x.label === 'Roles').value, 'Featured Artist + Rights Owner (SRCO)')
assert.match(acct.checklist.items.find(x => x.label === 'Names on the account').value, /Aviator Keyz/)
assert.ok(!JSON.stringify(sqlite.prepare("SELECT sx_json FROM lw_label_identity WHERE label_id='lab-a'").get()).match(/password/i))

// locked out blocks recording work and the engine queues nothing
let p = await sx.prepareSx(db, 'lab-a', 1, 't1')
assert.equal(p.status, 'BLOCKED'); assert.match(p.say, /Reset your SoundExchange password/)
assert.equal(await sx.queueSx(db, async () => true, ['lab-a']), 0)

// ACTIVE but missing SRCO role -> STOP to add it
acct = await sx.saveSxAccount(db, 'lab-a', 1, { status: 'ACTIVE' })
const roles = acct.checklist.items.find(x => x.label === 'Roles')
assert.equal(roles.action, 'STOP'); assert.match(roles.note, /Rights Owner \(SRCO\)/); assert.equal(acct.checklist.status, 'FIX')
acct = await sx.saveSxAccount(db, 'lab-a', 1, { registeredAs: ['FEATURED_ARTIST', 'SRCO', 'SRCO'] })
assert.deepEqual(acct.account.registeredAs, ['FEATURED_ARTIST', 'SRCO']); assert.equal(acct.checklist.status, 'READY')

// ---------- one recording ----------
p = await sx.prepareSx(db, 'lab-a', 1, 't1')
assert.equal(p.ownsMaster, true); assert.equal(p.status, 'NEEDS_INFO')
assert.equal(p.items.find(x => x.section.startsWith('B1') && x.label === 'ISRC').value, 'QZ85M1979735')
assert.equal(p.items.find(x => x.label === 'SRCO entity').value, 'Aviator Music Group LLC')
assert.equal(p.items.find(x => x.label === 'Basis of Claim').value, 'Copyright Owner')
assert.equal(p.items.find(x => x.label === 'Rights Begin').value, 'Inception')
assert.equal(p.items.find(x => x.label === 'Rights End').value, 'Perpetuity')
assert.equal(p.items.find(x => x.label === 'Release Label').value, 'Aviator Music Group LLC')
assert.equal(p.items.find(x => x.label === 'Press Submit Recordings').action, 'HUMAN')
assert.ok(p.asks.some(x => x.key === 'upc')); assert.match(p.say, /UPC/)
await assert.rejects(sx.saveSxWork(db, 'lab-a', 1, 't1', { writers: [] }), /Unknown field writers/)
p = await sx.saveSxWork(db, 'lab-a', 1, 't1', { upc: '196006123456', masterOwner: { entityName: 'Aviator Music Group LLC', percent: 100 } })
assert.equal(p.status, 'READY'); assert.equal(p.items.find(x => x.label === 'Percentage Claimed').value, '100'); assert.match(p.say, /You press Submit/)

// no ISRC -> mandatory ask
const p2 = await sx.prepareSx(db, 'lab-a', 1, 't2')
assert.ok(p2.asks.some(x => x.key === 'isrc')); assert.match(p2.say, /ISRC/)

// label owns the master -> artist claim only
const labelDeal = sx.sxRecordingForm({ title: 'X', artistCredit: 'A', isrc: 'QZ85M1979735', releaseDate: null, work: {}, account: { status: 'ACTIVE', registeredAs: ['FEATURED_ARTIST'], srcoEntity: null, signedToLabel: true } })
assert.equal(labelDeal.ownsMaster, false); assert.equal(labelDeal.status, 'READY')
assert.match(labelDeal.items.find(x => x.label === 'Whole section').note, /label submits it/)

// ---------- engine: READY song -> one SX_RECORDING task, deduped ----------
let sum = await runEngine(env, { labelIds: ['lab-a'] })
assert.equal(sum.soundexchange, 1)
assert.equal((await runEngine(env, { labelIds: ['lab-a'] })).soundexchange, 0)
const task = sqlite.prepare("SELECT * FROM lw_tasks WHERE kind='SX_RECORDING'").get()
assert.equal(JSON.parse(task.input_json).trackId, 't1'); assert.equal(JSON.parse(task.input_json).mode, 'FILL')

// ---------- bulk rows ----------
const bulk = await sx.sxBulkRows(db, 'lab-a', 1)
assert.equal(bulk.rows.length, 1); assert.equal(bulk.rows[0].upc, '196006123456'); assert.equal(bulk.rows[0].releaseLabel, 'Aviator Music Group LLC')

// ---------- SUBMITTED, then claim 2 days later, then CLAIMED ----------
await assert.rejects(sx.reportSx(db, 'lab-a', 1, 't1', { outcome: 'SUBMITTED' }), /Say what you saw/)
await assert.rejects(sx.reportSx(db, 'lab-a', 1, 't1', { outcome: 'DONE', evidence: 'x' }), /outcome must be/)
let rep = await sx.reportSx(db, 'lab-a', 1, 't1', { outcome: 'SUBMITTED', evidence: 'Upload History shows 22 / QZ85M1979735 Accepted' })
assert.equal(rep.sxStatus, 'NOT_CLAIMED'); assert.match(rep.next, /1-2 days/)
let q = await sx.sxQueue(db, 'lab-a', 1); assert.equal(q.progress, '0 of 2 claimed at SoundExchange'); assert.equal(q.ready, 0)
assert.equal(await sx.queueSx(db, async () => true, ['lab-a']), 0) // too soon
sqlite.exec("UPDATE lw_catalog_tracks SET sx_submitted_at=datetime('now','-3 days') WHERE id='t1'")
const queued = []; assert.equal(await sx.queueSx(db, async t => { queued.push(t); return true }, ['lab-a']), 1)
assert.equal(queued[0].input.mode, 'CLAIM'); assert.match(queued[0].title, /Claim "22" as artist/)
rep = await sx.reportSx(db, 'lab-a', 1, 't1', { outcome: 'CLAIMED', evidence: 'Shows in Associated Recordings' })
assert.equal(rep.sxStatus, 'CLAIMED')
q = await sx.sxQueue(db, 'lab-a', 1); assert.equal(q.progress, '1 of 2 claimed at SoundExchange')

// ---------- Contact Information Update Form ----------
sqlite.exec(`UPDATE lw_label_identity SET sx_json=json_set(sx_json,'$.accountName','Mason Brown') WHERE label_id='lab-a'`)
let cu = await sx.prepareContactUpdate(db, 'lab-a', 1, { filler: { phone: '555-0100' }, currentAddress: '1 Old St, Atlanta GA', changes: { address: '2 New Ave, Atlanta GA' } })
assert.equal(cu.status, 'READY'); assert.equal(cu.needsTaxForm, false)
assert.equal(cu.items.find(x => x.label === 'Name').value, 'Mason Brown')
assert.equal(cu.items.find(x => x.label === 'Email' && x.section.startsWith('Who')).value, 'mason@example.com')
assert.equal(cu.items.find(x => x.label === '*Last 4 Digits of Tax ID Number').action, 'HUMAN')
assert.equal(cu.items.find(x => x.label === 'New SoundExchange Account Name').value, 'N/A')
assert.equal(cu.items.find(x => x.label === 'Address' && x.section.startsWith('New')).value, '2 New Ave, Atlanta GA')
assert.equal(cu.items.find(x => x.label === 'Tax form').action, 'SKIP')
assert.ok(cu.routes.some(r => r.route === 'ONLINE'))
cu = await sx.prepareContactUpdate(db, 'lab-a', 1, { currentAddress: '1 Old St', changes: { accountName: 'Aviator Music Group LLC' }, newRepresentative: true })
assert.equal(cu.needsTaxForm, true); assert.match(cu.items.find(x => x.label.startsWith('W-9')).note, /Upload a Document/)
assert.equal(cu.needsAuthorizationForm, true)

// ---------- Letter of Direction ----------
const lod = sx.lodPrep({ performers: ['Mason Brown'], featuredArtist: 'Aviator Keys', participant: { name: 'Will Two', role: 'producer' }, percent: 3, tracks: [{ title: '22', isrc: 'QZ-85M-19-79735' }] })
assert.equal(lod.repertoireChart[0].isrc, 'QZ85M1979735'); assert.equal(lod.form.percentOfArtistShare, 3)
assert.ok(lod.requirements.some(r => /Certificate of Completion/.test(r))); assert.ok(lod.requirements.some(r => /45% featured artist share/.test(r)))
assert.throws(() => sx.lodPrep({ performers: [], participant: { name: 'X' }, percent: 3, tracks: [{ title: 'a' }] }), /every performer/)
assert.throws(() => sx.lodPrep({ performers: ['A'], participant: { name: 'X' }, percent: 0, tracks: [{ title: 'a' }] }), /percent/)
assert.throws(() => sx.lodPrep({ performers: ['A'], participant: { name: 'X' }, percent: 5, tracks: [{ title: 'a', isrc: 'BAD' }] }), /isrc invalid/)
assert.ok(sx.lodPrep({ performers: ['A'], participant: { name: 'X' }, percent: 5, tracks: [{ title: 'a' }], otherFeaturedArtists: ['B'] }).requirements.some(r => /featuring/.test(r)))

// ---------- reply in thread with the filled form; tax forms never attached ----------
const opened = await cases.openCase(db, 'lab-a', 1, { playbook: 'soundexchange-money', title: 'SoundExchange contact update', facts: {} }, 'owner')
await assert.rejects(cases.saveDraft(db, 'lab-a', 1, opened.case.id, { kind: 'EMAIL', recipient: 'SoundExchange', recipientEmail: 'support@example.com', subject: 'Re: update', body: 'Attached.', attachments: [{ name: 'W-9 2026.pdf' }] }, 'Codex'), /Never email tax forms/)
const d = await cases.saveDraft(db, 'lab-a', 1, opened.case.id, { kind: 'EMAIL', recipient: 'SoundExchange', recipientEmail: 'support@example.com', subject: 'Re: update', body: 'Attached is the signed form.', attachments: [{ name: 'Contact Information Update Form - signed.pdf' }], replyToThread: 'SoundExchange: Contact Information Update' }, 'Codex')
assert.equal(JSON.parse(sqlite.prepare('SELECT attachments_json FROM lw_case_drafts WHERE id=?').get(d.draftId).attachments_json)[0].name, 'Contact Information Update Form - signed.pdf')
assert.ok(playbookById('soundexchange-money'))

// ---------- website ----------
let r = await web('/soundexchange'); assert.equal(r.status, 200)
let j = await r.json(); assert.equal(j.account.status, 'ACTIVE'); assert.ok(j.queue.songs)
r = await web('/soundexchange/account', 3, { status: 'UNKNOWN' }); assert.equal(r.status, 403)
r = await web('/catalog/t2/soundexchange'); assert.equal(r.status, 200); assert.equal((await r.json()).status, 'NEEDS_INFO')
r = await web('/catalog/t2/soundexchange', 1, { work: { isrc: 'QZ85M1900001', upc: '196006999999', masterOwner: { entityName: 'Aviator Music Group LLC', percent: 100 } } }); assert.equal(r.status, 200); assert.equal((await r.json()).status, 'READY')
r = await web('/soundexchange/contact-update', 1, { currentAddress: '1 Old St' }); assert.equal(r.status, 200)

// ---------- MCP topic ----------
const handler = createStudioMcp(db, { userId: 1, grantId: 'g1', labelIds: ['lab-a'], scopes: ['labels:read', 'releases:read', 'releases:write', 'tasks:read', 'tasks:write'], clientName: 'Codex', toolMode: 'core' }, async () => true)
const client = new Client({ name: 't', version: '1' })
await client.connect(new StreamableHTTPClientTransport(new URL('https://studio.invalid/label-world/mcp'), { fetch: (u, o) => handler.fetch(new Request(u, o)) }))
const guide = await client.callTool({ name: 'studio2u_guide', arguments: { topic: 'soundexchange' } })
assert.match(guide.content[0].text, /prepare_sx_recording/); assert.match(guide.content[0].text, /sx_contact_update/)
const run = async (tool, args) => { const x = await client.callTool({ name: 'studio2u_run', arguments: { tool, args } }); return x.isError ? { error: x.content[0].text } : JSON.parse(x.content[0].text) }
assert.equal((await run('sx_account', { labelId: 'lab-a' })).account.status, 'ACTIVE')
assert.ok((await run('save_sx_account', { labelId: 'lab-a', password: 'x' })).error) // schema rejects
assert.equal((await run('sx_queue', { labelId: 'lab-a' })).account, 'ACTIVE')
assert.ok((await run('report_sx_recording', { labelId: 'lab-a', trackId: 't2', outcome: 'SUBMITTED' })).error)
assert.equal((await run('sx_letter_of_direction', { performers: ['A'], participant: { name: 'P' }, percent: 2, tracks: [{ title: 'S' }] })).form.percentOfArtistShare, 2)
assert.ok((await run('sx_account', { labelId: 'lab-b' })).error) // not granted
await client.close(); await handler.close()
console.log('PASS soundexchange: roles (both when self-released), locked-out -> Forgot password (never the password), secrets/SSN rejected, Submit Recordings + Search & Claim fill lists, ISRC/UPC asks, SUBMITTED -> claim task after 2 days -> CLAIMED, bulk ingest rows, contact update form (N/A, HUMAN tax digits, W-9 only on name change), LOD rules, no tax attachments, website + MCP')
