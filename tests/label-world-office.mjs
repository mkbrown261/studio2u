// Label Office: statements, weekly report, split sheets + public e-sign, content studio,
// MLC/BMI playbooks, AI budget. No network, no model.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { fixture } from './label-world-api-fixture.mjs'
const office = await import('../src/label-world/autonomy/office.ts')
const agr = await import('../src/label-world/autonomy/agreements.ts')
const { bmiShares, suggestPlaybooks, playbookById } = await import('../src/label-world/autonomy/playbooks.ts')
const { runEngine } = await import('../src/label-world/autonomy/engine.ts')
const budget = await import('../src/label-world/providers/budget.ts')
const { recommendCheapest, costMicros } = await import('../src/label-world/providers/adapters.ts')
const { createStudioMcp } = await import('../src/label-world/mcp/server.ts')
const { Client, StreamableHTTPClientTransport } = await import('@modelcontextprotocol/client')

const f = fixture(), { sqlite, db, app } = f
sqlite.exec(`INSERT INTO lw_labels(id,name) VALUES ('lab-a','Aviator Music Group'),('lab-b','Other');
INSERT INTO lw_memberships VALUES ('lab-a',1,'owner'),('lab-b',2,'owner'),('lab-a',3,'viewer');`)
const env = { DB: db, LLM_KEY_ENCRYPTION_SECRET: Buffer.alloc(32, 7).toString('base64') }
const web = (path, user = 1, body, extra = {}) => app.request('http://localhost' + path, { method: body ? 'POST' : 'GET', headers: { Cookie: 'studio2u_session=test-session-' + user, Origin: 'http://localhost', 'Content-Type': 'application/json', ...extra }, body: body ? JSON.stringify(body) : undefined }, env)
const L = '/api/label-world/labels/lab-a'

// ---------- CSV parsing ----------
assert.deepEqual(office.parseCsv('a,b\r\n"x, y","say ""hi"""\n'), [['a', 'b'], ['x, y', 'say "hi"']])
assert.deepEqual(office.parseCsv('a;b\n1;2'), [['a', 'b'], ['1', '2']])
assert.equal(office.parseAmount('$1,234.56'), 1234.56); assert.equal(office.parseAmount('(2.50)'), -2.5); assert.equal(office.parseAmount('1.234,56'), 1234.56); assert.equal(office.parseAmount('n/a'), null)
const g = office.guessMapping(['Store', 'Track Title', 'ISRC', 'Country', 'Streams', 'Gross Revenue', 'Net Revenue (USD)', 'Sale Month'])
assert.equal(g.amount, 6); assert.equal(g.title, 1); assert.equal(g.isrc, 2); assert.equal(g.quantity, 4); assert.equal(g.platform, 0)

const csv = 'Store,Track Title,ISRC,Country,Streams,Net Revenue (USD),Sale Month\nSpotify,22,QZ85M1979735,US,1000,3.20,2026-08\nApple Music,22,QZ85M1979735,US,200,1.60,2026-08\nSpotify,Night Drive,QZ85M1979736,GB,50,0.10,2026-08\nTOTAL,,,,,,\n'
let r = await web(L + '/statements/preview', 1, { csv }); assert.equal(r.status, 200); const pv = await r.json(); assert.equal(pv.rows, 4); assert.equal(pv.mapping.amount, 5)
r = await web(L + '/statements', 3, { csv, source: 'unitedmasters' }); assert.equal(r.status, 403) // viewer
r = await web(L + '/statements', 1, { csv, source: 'unitedmasters', filename: 'um-aug.csv', mapping: { title: 1 } }); assert.equal(r.status, 400) // no amount column
r = await web(L + '/statements', 1, { csv, source: 'unitedmasters', filename: 'um-aug.csv' }); assert.equal(r.status, 201)
const im = await r.json(); assert.equal(im.statement.lines, 3); assert.equal(im.statement.skipped, 1); assert.equal(im.statement.totalUsd, 4.9)
r = await web(L + '/statements', 1, { csv, source: 'unitedmasters' }); assert.equal(r.status, 409) // same file twice
const ms = await office.moneySummary(db, 'lab-a'); assert.equal(ms.verifiedEarnedUsd, 4.9); assert.equal(ms.topSongs[0].song, '22'); assert.equal(ms.topSongs[0].usd, 4.8)
assert.equal((await office.moneySummary(db, 'lab-b')).verifiedEarnedUsd, 0) // label isolation
r = await web('/api/label-world/labels/lab-b/statements', 1); assert.equal(r.status, 404)

// ---------- split sheets ----------
const terms = { workTitle: '22', samples: 'none', parties: [
  { legalName: 'Marcus Brown', stageName: 'Aviator Keys', email: 'marcus@example.com', roles: ['songwriter', 'performer'], pro: 'ASCAP', ipi: '123456789', compositionShare: 50, masterShare: 100 },
  { legalName: 'Jay Producer', email: 'jay@example.com', roles: ['producer', 'composer'], compositionShare: 50, producerPoints: 3 }] }
assert.throws(() => agr.validateTerms({ ...terms, parties: [{ ...terms.parties[0], compositionShare: 60 }, terms.parties[1]] }), /110%/)
assert.throws(() => agr.validateTerms({ ...terms, parties: [{ ...terms.parties[0], masterShare: 50 }, terms.parties[1]] }), /0 \(not covered\)|total 100/)
assert.throws(() => agr.validateTerms({ ...terms, parties: [terms.parties[0], { ...terms.parties[1], email: 'MARCUS@example.com' }] }), /twice/)
const pre = agr.attorneyPrecheck(agr.validateTerms(terms)); assert.ok(pre.flags.some(x => /no PRO/.test(x.issue))); assert.match(pre.disclaimer, /Not legal advice/)
assert.ok(agr.attorneyPrecheck(agr.validateTerms({ ...terms, samples: 'uncleared' })).flags.some(x => x.level === 'STOP'))
const doc1 = agr.renderDocument(agr.validateTerms(terms), 'L', 1); assert.equal(doc1, agr.renderDocument(agr.validateTerms(terms), 'L', 1)); assert.match(doc1, /total 100%/)

sqlite.exec(`INSERT INTO lw_releases(id,label_id,title,artist,release_type) VALUES ('rel-1','lab-a','22','Aviator Keys','single')`)
r = await web(L + '/agreements', 1, { ...terms, releaseId: 'rel-1' }); assert.equal(r.status, 201)
const created = await r.json(), A = created.agreement
assert.equal(A.status, 'OUT_FOR_SIGNATURE'); assert.equal(created.signLinks.length, 2)
assert.equal(A.docHash, createHash('sha256').update(A.document).digest('hex'))
const tok = l => new URL(l.signUrl).pathname.split('/').pop()
const [m, j] = created.signLinks.map(tok)
assert.ok(!JSON.stringify(sqlite.prepare('SELECT * FROM lw_agreement_parties').all()).includes(m)) // only hashes stored
assert.deepEqual(await agr.releaseAgreementStatus(db, 'lab-a', 'rel-1'), { total: 1, unsigned: [{ id: A.id, work: '22', status: 'OUT_FOR_SIGNATURE' }] })

// public page: no session needed
const pub = (path, body, h = {}) => app.request('http://localhost' + path, { method: body ? 'POST' : 'GET', headers: { Origin: 'http://localhost', 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.9', 'User-Agent': 'TestPhone', ...h }, body: body ? JSON.stringify(body) : undefined }, env)
r = await pub('/label-world/sign/' + m); assert.equal(r.status, 200); const page = await r.text()
assert.match(page, /22&quot;|"22"/); assert.match(page, /ESIGN/); assert.match(page, /noindex/); assert.ok(!page.includes('marcus@example.com')) // email hidden
assert.equal((await pub('/label-world/sign/' + 'x'.repeat(43))).status, 404)
r = await pub('/label-world/sign/' + m, { action: 'sign', email: 'marcus@example.com', docHash: A.docHash, consent: true, signatureName: 'Marcus Brown' }, { Origin: 'https://evil.invalid', 'Content-Type': 'text/plain' }); assert.equal(r.status, 403) // csrf
r = await pub('/label-world/sign/' + m, { action: 'sign', email: 'wrong@example.com', docHash: A.docHash, consent: true, signatureName: 'Marcus Brown' }); assert.equal(r.status, 403)
r = await pub('/label-world/sign/' + m, { action: 'sign', email: 'marcus@example.com', docHash: 'bad', consent: true, signatureName: 'Marcus Brown' }); assert.equal(r.status, 409)
r = await pub('/label-world/sign/' + m, { action: 'sign', email: 'marcus@example.com', docHash: A.docHash, consent: false, signatureName: 'Marcus Brown' }); assert.equal(r.status, 400)
r = await pub('/label-world/sign/' + m, { action: 'sign', email: 'marcus@example.com', docHash: A.docHash, consent: true, signatureName: 'Aviator Keys' }); assert.equal(r.status, 400)
r = await pub('/label-world/sign/' + m, { action: 'sign', email: ' Marcus@Example.com ', docHash: A.docHash, consent: true, signatureName: 'marcus  brown' }); assert.equal(r.status, 200); assert.equal((await r.json()).status, 'SIGNED')
r = await pub('/label-world/sign/' + m, { action: 'sign', email: 'marcus@example.com', docHash: A.docHash, consent: true, signatureName: 'Marcus Brown' }); assert.equal(r.status, 409) // once
// producer declines -> owner revises -> new version, old links dead, everyone re-signs
r = await pub('/label-world/sign/' + j, { action: 'decline', email: 'jay@example.com', docHash: A.docHash, reason: 'I want 4 points' }); assert.equal((await r.json()).status, 'DECLINED')
assert.ok(sqlite.prepare("SELECT 1 FROM lw_notifications WHERE label_id='lab-a' AND kind='AGREEMENT'").get())
r = await web(L + `/agreements/${A.id}/revise`, 1, { parties: [terms.parties[0], { ...terms.parties[1], producerPoints: 4 }] }); assert.equal(r.status, 200)
const v2 = await r.json(); assert.equal(v2.agreement.version, 2); assert.notEqual(v2.agreement.docHash, A.docHash)
assert.equal(sqlite.prepare('SELECT status FROM lw_agreements WHERE id=?').get(A.id).status, 'SUPERSEDED')
r = await pub('/label-world/sign/' + m, { action: 'sign', email: 'marcus@example.com', docHash: A.docHash, consent: true, signatureName: 'Marcus Brown' }); assert.equal(r.status, 409)
assert.equal(v2.agreement.parties.filter(p => p.status === 'SIGNED').length, 0) // signatures never carry over
for (const l of v2.signLinks) { const p = terms.parties.find(x => x.email === l.email); r = await pub('/label-world/sign/' + tok(l), { action: 'sign', email: l.email, docHash: v2.agreement.docHash, consent: true, signatureName: p.legalName }); assert.equal(r.status, 200) }
const done = await agr.getAgreement(db, 'lab-a', 1, v2.agreement.id); assert.equal(done.status, 'FULLY_SIGNED'); assert.ok(done.events.some(e => e.kind === 'COMPLETED'))
assert.equal((await agr.releaseAgreementStatus(db, 'lab-a', 'rel-1')).unsigned.length, 0)
r = await web(L + `/agreements/${v2.agreement.id}/copy`); assert.equal(r.status, 200); const copy = await r.text()
assert.match(copy, /\/s\/ Jay Producer/); assert.match(copy, /AUDIT CERTIFICATE/); assert.match(copy, /203\.0\.113\.9/); assert.ok(copy.includes(v2.agreement.docHash))
assert.equal((await web('/api/label-world/labels/lab-a/agreements/' + v2.agreement.id + '/copy', 2)).status, 404) // other user
r = await web(L + `/agreements/${v2.agreement.id}/void`, 1, { reason: 'x' }); assert.equal(r.status, 409) // can't void signed

// ---------- content studio ----------
r = await web(L + '/campaigns', 1, { trackTitle: '22', objective: 'Pre-saves before release' }); assert.equal(r.status, 201); const C = await r.json()
r = await web(L + `/campaigns/${C.id}/concepts`, 1, { title: 'POV drive', hook: 'Car door slam on the beat drop', treatment: 'Night drive, lip sync the hook', platform: 'tiktok', durationSec: 12 }); assert.equal(r.status, 201); const K = await r.json()
r = await web(L + `/concepts/${K.id}/status`, 1, { status: 'POSTED' }); assert.equal(r.status, 409) // can't skip
r = await web(L + `/concepts/${K.id}/status`, 3, { status: 'APPROVED' }); assert.equal(r.status, 403) // viewer
r = await web(L + `/concepts/${K.id}/status`, 1, { status: 'APPROVED' }); assert.equal(r.status, 200)

// ---------- weekly report ----------
sqlite.exec(`INSERT INTO lw_case_drafts(id,label_id,case_id,kind,subject,body,written_by) VALUES ('d1','lab-a','c1','EMAIL','Cue sheet request','Hi','Codex');
INSERT INTO lw_cases(id,label_id,playbook,title,status,created_by,deadline) VALUES ('c1','lab-a','tv-cue-sheet','Baddies cue sheet','WAITING_ON_YOU',1,date('now','+20 days'));`)
r = await web(L + '/reports/generate', 3, {}); assert.equal(r.status, 403)
r = await web(L + '/reports/generate', 1, {}); assert.equal(r.status, 200); let rep = (await r.json()).report
assert.match(rep.headline[0], /\$4\.90 verified/); assert.equal(rep.deadlines.length, 1); assert.ok(rep.needsYou.some(n => n.key === 'draft:d1')); assert.equal(rep.carriedOver.length, 0)
// next week: same item still open -> flagged second week
sqlite.exec("UPDATE lw_reports SET local_date='2000-01-03'")
rep = (await office.generateReport(db, 'lab-a', 'MANUAL')).report
assert.equal(rep.needsYou.find(n => n.key === 'draft:d1').weeks, 2); assert.ok(rep.carriedOver.some(x => /Second week unresolved/.test(x)))
// scheduling: Monday 9am New York only, once per local day
await office.saveSettings(db, 'lab-a', 1, { timezone: 'America/New_York', reportWeekday: 1, reportHour: 9 })
await assert.rejects(office.saveSettings(db, 'lab-a', 1, { timezone: 'Mars/Base' }), /time zone/)
const mon8 = new Date('2026-11-02T13:30:00Z'), mon10 = new Date('2026-11-02T15:00:00Z') // 08:30 / 10:00 EST
assert.deepEqual(await office.scheduledReports(db, ['lab-a'], mon8), [])
assert.deepEqual(await office.scheduledReports(db, ['lab-a'], mon10), ['lab-a'])
assert.deepEqual(await office.scheduledReports(db, ['lab-a'], new Date('2026-11-02T20:00:00Z')), [])
assert.equal(office.localParts('Asia/Tokyo', new Date('2026-11-01T16:00:00Z')).weekday, 1) // already Monday in Tokyo
const sum = await runEngine(env, { labelIds: ['lab-a'] }); assert.ok('reports' in sum)

// ---------- playbooks ----------
assert.equal(suggestPlaybooks('how do I get my mechanicals from the MLC')[0].id, 'mlc-mechanicals')
assert.equal(suggestPlaybooks('I need a split sheet for my collab')[0].id, 'split-sheet')
assert.ok(playbookById('mlc-mechanicals').steps[0].includes('duplicate'))
assert.ok(playbookById('bmi-registration').facts.some(x => /200%/.test(x)))
const b = bmiShares([{ name: 'A', share: 50, publisher: 'A Pub' }, { name: 'B', share: 50 }]); assert.equal(b.registrationTotal, 150); assert.equal(b.unassignedPublisher, 50)
assert.throws(() => bmiShares([{ name: 'A', share: 60 }]), /100%/)

// ---------- AI budget + cheapest model ----------
assert.equal(recommendCheapest('openai', [{ id: 'gpt-6.1-sol' }, { id: 'gpt-6-luna' }, { id: 'gpt-6-astra' }]).id, 'gpt-6-luna')
assert.equal(costMicros('openai', 'gpt-6-luna', { input_tokens: 1_000_000, output_tokens: 0 }).micros, 100000)
let s = await budget.budgetStatus(db, 1); assert.equal(s.capUsd, 5)
await budget.setBudget(db, 1, 1); await budget.recordSpend(db, 1, 'xai', 'grok-4.7', { prompt_tokens: 500_000, completion_tokens: 0 })
await assert.rejects(budget.spendGuard(db, 1), /Monthly AI budget reached/)
await assert.rejects(budget.setBudget(db, 1, 5000), /between/)

// ---------- MCP: agents can draft but never approve; lint gate ----------
const handler = createStudioMcp(db, { userId: 1, grantId: 'g1', labelIds: ['lab-a'], scopes: ['labels:read', 'releases:read', 'releases:write', 'tasks:read', 'tasks:write', 'knowledge:read', 'research:read'], clientName: 'Codex', origin: 'https://studio.invalid' }, async () => true)
const client = new Client({ name: 't', version: '1' })
await client.connect(new StreamableHTTPClientTransport(new URL('https://studio.invalid/label-world/mcp'), { fetch: (u, o) => handler.fetch(new Request(u, o)) }))
const call = async (t, a = {}) => { const x = await client.callTool({ name: 'studio2u_' + t, arguments: a }); return x.isError ? { error: x.content[0].text } : x.structuredContent.data }
const names = (await client.listTools()).tools.map(t => t.name)
for (const n of ['get_report', 'money_summary', 'create_agreement', 'attorney_precheck', 'bmi_shares', 'add_concept', 'mark_concept']) assert.ok(names.includes('studio2u_' + n), n)
assert.equal((await call('money_summary', { labelId: 'lab-a' })).verifiedEarnedUsd, 4.9)
const viaMcp = await call('create_agreement', { labelId: 'lab-a', workTitle: 'Night Drive', samples: 'none', releaseId: 'rel-1', parties: [{ legalName: 'Marcus Brown', email: 'marcus@example.com', roles: ['songwriter'], compositionShare: 100 }] })
assert.match(viaMcp.signLinks[0].signUrl, /^https:\/\/studio\.invalid\/label-world\/sign\//)
const lint = await call('lint_release', { labelId: 'lab-a', releaseId: 'rel-1' }); assert.ok(lint.issues.some(i => i.field === 'splitSheet' && i.severity === 'BLOCKER')); assert.equal(lint.ok, false)
const K2 = await call('add_concept', { labelId: 'lab-a', campaignId: C.id, title: 'Studio BTS', hook: 'Beat starts', treatment: 'BTS' }); assert.equal(K2.status, 'DRAFT')
assert.match((await call('mark_concept', { labelId: 'lab-a', conceptId: K2.id, status: 'SHOT' })).error, /Can't go/)
assert.ok((await call('get_report', { labelId: 'lab-b' })).error) // label not granted
await client.close(); await handler.close()
console.log('PASS label-world office: statements, weekly report, split sheets + e-sign, content, MLC/BMI, budget, MCP')
