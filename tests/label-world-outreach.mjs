// Outreach: researched contact ladder (sources required), email + follow-up sequence the
// owner approves once, send gate, due follow-ups via engine, reply stops everything,
// bounce/wrong-person/do-not-contact, ASCAP role + product type lists. No network.
import assert from 'node:assert/strict'
import { fixture } from './label-world-api-fixture.mjs'
const outreach = await import('../src/label-world/autonomy/outreach.ts')
const cases = await import('../src/label-world/autonomy/cases.ts')
const ascap = await import('../src/label-world/autonomy/ascap.ts')
const { intakePatch, PRODUCT_TYPES } = await import('../src/label-world/autonomy/intake.ts')
const { runEngine } = await import('../src/label-world/autonomy/engine.ts')
const { playbookById } = await import('../src/label-world/autonomy/playbooks.ts')
const { createStudioMcp } = await import('../src/label-world/mcp/server.ts')
const { Client, StreamableHTTPClientTransport } = await import('@modelcontextprotocol/client')

const f = fixture(), { sqlite, db, app } = f
sqlite.exec(`INSERT INTO lw_labels(id,name) VALUES ('lab-a','Aviator Music Group'),('lab-b','Other');
INSERT INTO lw_memberships VALUES ('lab-a',1,'owner'),('lab-b',2,'owner'),('lab-a',3,'viewer');`)
const env = { DB: db }
const web = (path, user = 1, body) => app.request('http://localhost/api/label-world/labels/lab-a' + path, { method: body ? 'POST' : 'GET', headers: { Cookie: 'studio2u_session=test-session-' + user, Origin: 'http://localhost', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }, env)

// ---------- exact ASCAP dropdowns ----------
assert.deepEqual(ascap.ASCAP_ROLES, ['Composer / Author', 'Composer', 'Author', 'Arranger', 'Adapter', 'Translator'])
assert.deepEqual([...PRODUCT_TYPES], ['Commercial', 'Film', 'General Usage', 'Library', 'Multimedia', 'Radio', 'Television', 'Theater', 'Video'])
assert.equal(intakePatch({ commercialUse: { productType: 'television', productionName: 'Baddies East' } }).commercialUse.productType, 'Television')
assert.throws(() => intakePatch({ commercialUse: { productType: 'Podcast', productionName: 'X' } }), /must be one of Commercial, Film/)
assert.equal(intakePatch({ writers: [{ legalName: 'A', role: 'arranger', split: 100 }] }).writers[0].role, 'arranger')
let form = ascap.ascapForm({ title: 'X', artistCredit: 'A', intake: { writers: [{ legalName: 'A B', role: 'lyricist', split: 50, ipi: '00123456789', noPublisher: true }, { legalName: 'C D', role: 'arranger', split: 50, ipi: '00987654321', noPublisher: true }] }, released: true })
assert.equal(form.items.find(x => x.label === 'Writer 1: A B · Role*').value, 'Author')
assert.equal(form.items.find(x => x.label === 'Writer 2: C D · Role*').value, 'Arranger')

// ---------- contact ladder ----------
const opened = await cases.openCase(db, 'lab-a', 1, { playbook: 'tv-cue-sheet', title: 'Baddies cue sheet', facts: { show: 'Baddies', network: 'Zeus', airDate: '2025-11', songTitle: '22', writers: 'Mason Brown 100% (ASCAP)' } }, 'owner')
const C = opened.case.id
await assert.rejects(outreach.saveContact(db, 'lab-a', 1, C, { role: 'Music Supervisor', company: 'Example Productions', email: 'music@example.com', confidence: 'LIKELY' }, 'Codex'), /Say where you found/)
await assert.rejects(outreach.saveContact(db, 'lab-a', 1, C, { role: 'Music Supervisor', company: 'X', email: 'not-an-email', sourceUrl: 'https://imdb.com/x' }, 'Codex'), /email looks wrong/)
await assert.rejects(outreach.saveContact(db, 'lab-a', 3, C, { role: 'Music Supervisor', company: 'X', sourceUrl: 'https://imdb.com/x' }, 'Codex'), /permission/i)
await assert.rejects(outreach.saveContact(db, 'lab-a', 1, C, { role: 'X', company: 'Y', sourceUrl: 'javascript:alert(1)' }, 'Codex'), /web link/)
const sup = await outreach.saveContact(db, 'lab-a', 1, C, { name: 'Pat Doe', role: 'Music Supervisor', company: 'Example Productions', email: 'Pat@Example.com', sourceUrl: 'https://pro.imdb.com/company/co000000', confidence: 'VERIFIED', priority: 1 }, 'Codex')
const post = await outreach.saveContact(db, 'lab-a', 1, C, { role: 'Post-Production Supervisor', company: 'Example Productions', email: 'post@example.com', sourceUrl: 'https://www.linkedin.com/in/example', priority: 2 }, 'Codex')
const guess = await outreach.saveContact(db, 'lab-a', 1, C, { role: 'Business Affairs', company: 'Zeus Network', email: 'info@example.org', confidence: 'GUESS', priority: 4 }, 'Codex')
assert.equal(guess.confidence, 'GUESS')
await assert.rejects(outreach.saveContact(db, 'lab-a', 1, C, { role: 'Dup', company: 'X', email: 'pat@example.com', sourceUrl: 'https://x.com' }, 'Codex'), /already a contact/)
let ladder = await outreach.listContacts(db, 'lab-a', 1, C)
assert.deepEqual(ladder.map(x => x.priority), [1, 2, 4]); assert.equal(ladder[0].email, 'pat@example.com')

// ---------- email + sequence approved once ----------
assert.throws(() => outreach.sequenceInput([{ afterDays: 2, body: 'x' }]), /at least 3 days/)
assert.throws(() => outreach.sequenceInput([{ afterDays: 5, body: 'a' }, { afterDays: 6, body: 'b' }]), /at least 3 days/)
assert.throws(() => outreach.sequenceInput([5, 8, 11, 14, 17].map(d => ({ afterDays: d, body: 'x' }))), /up to 4/)
const followUps = [{ afterDays: 5, body: 'Just bumping this up.' }, { afterDays: 12, body: 'Happy to send a filled cue sheet.' }, { afterDays: 21, body: 'Is someone else the right person?' }]
await assert.rejects(cases.saveDraft(db, 'lab-a', 1, C, { kind: 'LETTER', body: 'x', followUps }, 'Codex'), /emails only/)
const dr = await cases.saveDraft(db, 'lab-a', 1, C, { kind: 'EMAIL', contactId: sup.id, subject: 'Cue sheet for Baddies S? E? ("22")', body: 'Hi Pat, ...', followUps }, 'Codex')
assert.equal(dr.followUps, 3)
let row = sqlite.prepare('SELECT * FROM lw_case_drafts WHERE id=?').get(dr.draftId)
assert.equal(row.recipient_email, 'pat@example.com'); assert.match(row.recipient, /Pat Doe/)
// cannot send or follow up before approval
await assert.rejects(cases.markSent(db, 'lab-a', 1, dr.draftId, null, 'Codex'), /owner-approved/)
await assert.rejects(outreach.markFollowupSent(db, 'lab-a', 1, dr.draftId, 1, 'Codex'), /owner approved/)
// owner approves with an edit to follow-up 2 (website)
let r = await web(`/drafts/${dr.draftId}/decision`, 1, { decision: 'APPROVED', followUps: [followUps[0], { afterDays: 12, body: 'Edited by owner.' }, followUps[2]] })
assert.equal(r.status, 200)
row = sqlite.prepare('SELECT * FROM lw_case_drafts WHERE id=?').get(dr.draftId)
assert.ok(row.sequence_approved_at); assert.equal(JSON.parse(row.sequence_json)[1].body, 'Edited by owner.')
const sent = await cases.markSent(db, 'lab-a', 1, dr.draftId, 'Sent from Gmail', 'Codex')
assert.equal(sent.followUpInDays, 5)
assert.equal(sqlite.prepare('SELECT status FROM lw_case_contacts WHERE id=?').get(sup.id).status, 'CONTACTED')

// nothing due yet; 6 days later follow-up 1 is due and the engine queues one task
assert.equal((await outreach.dueFollowups(db, ['lab-a'])).length, 0)
sqlite.exec(`UPDATE lw_case_drafts SET sent_at=datetime('now','-6 days') WHERE id='${dr.draftId}'`)
let due = await outreach.dueFollowups(db, ['lab-a'])
assert.equal(due.length, 1); assert.equal(due[0].number, 1); assert.equal(due[0].to, 'pat@example.com'); assert.match(due[0].subject, /^Re: Cue sheet/)
let sum = await runEngine(env, { labelIds: ['lab-a'] }); assert.equal(sum.followUpsDue, 1)
assert.equal((await runEngine(env, { labelIds: ['lab-a'] })).followUpsDue, 0) // deduped
assert.ok(sqlite.prepare("SELECT 1 FROM lw_tasks WHERE kind='CASE_STEP' AND json_extract(input_json,'$.followUpDraftId')=?").get(dr.draftId))
await assert.rejects(outreach.markFollowupSent(db, 'lab-a', 1, dr.draftId, 2, 'Codex'), /Next follow-up is #1/)
const fu1 = await outreach.markFollowupSent(db, 'lab-a', 1, dr.draftId, 1, 'Codex'); assert.equal(fu1.finished, false)
assert.equal((await outreach.dueFollowups(db, ['lab-a'])).length, 0) // #2 is day 12

// reply stops everything
sqlite.exec(`UPDATE lw_case_drafts SET sent_at=datetime('now','-13 days') WHERE id='${dr.draftId}'`)
assert.equal((await outreach.dueFollowups(db, ['lab-a']))[0].number, 2)
r = await web(`/drafts/${dr.draftId}/reply`, 3, { summary: 'x' }); assert.equal(r.status, 403) // viewer
r = await web(`/drafts/${dr.draftId}/reply`, 1, { summary: 'Pat says email clearances@example.com' }); assert.equal(r.status, 200)
assert.equal((await outreach.dueFollowups(db, ['lab-a'])).length, 0)
await assert.rejects(outreach.markFollowupSent(db, 'lab-a', 1, dr.draftId, 2, 'Codex'), /already replied/)
assert.equal(sqlite.prepare('SELECT status FROM lw_case_contacts WHERE id=?').get(sup.id).status, 'REPLIED')
assert.equal(sqlite.prepare('SELECT status FROM lw_cases WHERE id=?').get(C).status, 'OPEN')

// second contact: sequence runs out -> "next contact" guidance; bounce stops follow-ups
const d2 = await cases.saveDraft(db, 'lab-a', 1, C, { kind: 'EMAIL', contactId: post.id, subject: 'Cue sheet', body: 'Hi', followUps: [{ afterDays: 4, body: 'Bump' }] }, 'Codex')
await cases.decideDraft(db, 'lab-a', 1, d2.draftId, 'APPROVED'); await cases.markSent(db, 'lab-a', 1, d2.draftId, null, 'Codex')
sqlite.exec(`UPDATE lw_case_drafts SET sent_at=datetime('now','-5 days') WHERE id='${d2.draftId}'`)
const last = await outreach.markFollowupSent(db, 'lab-a', 1, d2.draftId, 1, 'Codex')
assert.equal(last.finished, true); assert.match(last.next, /next contact/)
const d3 = await cases.saveDraft(db, 'lab-a', 1, C, { kind: 'EMAIL', contactId: guess.id, subject: 'Cue sheet', body: 'Hi', followUps: [{ afterDays: 4, body: 'Bump' }] }, 'Codex')
await cases.decideDraft(db, 'lab-a', 1, d3.draftId, 'APPROVED'); await cases.markSent(db, 'lab-a', 1, d3.draftId, null, 'Codex')
sqlite.exec(`UPDATE lw_case_drafts SET sent_at=datetime('now','-5 days') WHERE id='${d3.draftId}'`)
assert.equal((await outreach.dueFollowups(db, ['lab-a'])).length, 1)
await outreach.updateContact(db, 'lab-a', 1, guess.id, { status: 'BOUNCED', notes: 'Mailbox does not exist' }, 'Codex')
assert.equal((await outreach.dueFollowups(db, ['lab-a'])).length, 0)
// owner do-not-contact: agent cannot draft to them or undo it
r = await web(`/contacts/${post.id}`, 1, { status: 'DO_NOT_CONTACT' }); assert.equal(r.status, 200)
await assert.rejects(cases.saveDraft(db, 'lab-a', 1, C, { kind: 'EMAIL', contactId: post.id, body: 'x' }, 'Codex'), /do-not-contact/)
await assert.rejects(outreach.updateContact(db, 'lab-a', 1, post.id, { status: 'NOT_CONTACTED' }, 'Codex'), /Only the owner/)
// resolved case: no more follow-ups
const d4 = await cases.saveDraft(db, 'lab-a', 1, C, { kind: 'EMAIL', recipient: 'ASCAP', recipientEmail: 'tvcuesheet@ascap.com', subject: 'x', body: 'x', followUps: [{ afterDays: 3, body: 'b' }] }, 'Codex')
await cases.decideDraft(db, 'lab-a', 1, d4.draftId, 'APPROVED'); await cases.markSent(db, 'lab-a', 1, d4.draftId, null, 'Codex')
sqlite.exec(`UPDATE lw_case_drafts SET sent_at=datetime('now','-4 days') WHERE id='${d4.draftId}'; UPDATE lw_cases SET status='RESOLVED' WHERE id='${C}'`)
assert.equal((await outreach.dueFollowups(db, ['lab-a'])).length, 0)
// case detail shows contacts + follow-ups
const detail = await cases.getCase(db, 'lab-a', 1, C)
assert.equal(detail.contacts.length, 3); assert.equal(detail.drafts.find(d => d.id === dr.draftId).followUps.length, 3)
assert.ok(detail.events.some(e => e.kind === 'REPLY')); assert.ok(detail.events.some(e => e.kind === 'FOLLOW_UP'))
r = await web(`/cases/${C}/contacts`); assert.equal((await r.json()).contacts.length, 3)
r = await app.request(`http://localhost/api/label-world/labels/lab-b/cases/${C}/contacts`, { headers: { Cookie: 'studio2u_session=test-session-1' } }, env); assert.equal(r.status, 404)

// ---------- playbook + MCP ----------
const pb = playbookById('tv-cue-sheet'); assert.equal(pb.version, 2)
assert.ok(pb.steps.some(s => /contact ladder/.test(s))); assert.ok(pb.rules.some(s => /Relentless but professional/.test(s)))
const C2 = (await cases.openCase(db, 'lab-a', 1, { playbook: 'tv-cue-sheet', title: 'Second show' }, 'owner')).case.id
const handler = createStudioMcp(db, { userId: 1, grantId: 'g1', labelIds: ['lab-a'], scopes: ['labels:read', 'tasks:read', 'tasks:write', 'knowledge:read'], clientName: 'Claude', toolMode: 'core' }, async () => true)
const client = new Client({ name: 't', version: '1' })
await client.connect(new StreamableHTTPClientTransport(new URL('https://studio.invalid/label-world/mcp'), { fetch: (u, o) => handler.fetch(new Request(u, o)) }))
const g = await client.callTool({ name: 'studio2u_guide', arguments: { topic: 'outreach' } })
assert.match(g.content[0].text, /save_case_contact/); assert.match(g.content[0].text, /record_reply/)
const run = async (tool, args) => { const x = await client.callTool({ name: 'studio2u_run', arguments: { tool, args } }); return x.isError ? { error: x.content[0].text } : JSON.parse(x.content[0].text) }
const mc = await run('save_case_contact', { labelId: 'lab-a', caseId: C2, role: 'Music Supervisor', company: 'Studio Q', email: 'ms@example.net', sourceUrl: 'https://variety.com/x', priority: 1 })
assert.equal(mc.confidence, 'LIKELY')
const md = await run('draft_case_message', { labelId: 'lab-a', caseId: C2, contactId: mc.id, subject: 'Cue sheet', body: 'Hi', followUps: [{ afterDays: 5, body: 'Bump' }] })
assert.equal(md.followUps, 1)
assert.ok((await run('mark_draft_sent', { labelId: 'lab-a', draftId: md.draftId })).error) // not approved
const st = await client.callTool({ name: 'studio2u_start', arguments: {} })
assert.ok(JSON.parse(st.content[0].text).labels[0].hasOwnProperty('followUpsDue'))
await client.close(); await handler.close()
console.log('PASS outreach: exact ASCAP Role/Product Type lists, researched contact ladder with sources + confidence, email + follow-ups approved once (owner can edit), send gate, engine queues due follow-ups (deduped), reply/bounce/do-not-contact stop sequences, sequence exhaustion -> next contact, resolved cases stop, website + MCP, viewer/tenant isolation')
