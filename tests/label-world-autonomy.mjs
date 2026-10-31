// End-to-end: a regular Claude/Codex client (official MCP SDK client) runs a release
// from nothing to "submitted + verified" via the queue, while the always-on engine
// (no LLM) refreshes packets, queues work, recovers leases and schedules follow-ups.
import assert from 'node:assert/strict'
import { fixture } from './label-world-api-fixture.mjs'
const { createStudioMcp, mcpScopes, readScopes } = await import('../src/label-world/mcp/server.ts')
const { runEngine, recoverLeases, wakeAgents } = await import('../src/label-world/autonomy/engine.ts')
const { buildPacket } = await import('../src/label-world/autonomy/packets.ts')
const { intakePatch } = await import('../src/label-world/autonomy/intake.ts')
const { encryptKey } = await import('../src/label-world/providers/vault.ts')
const { Client, StreamableHTTPClientTransport } = await import('@modelcontextprotocol/client')

const f = fixture(), { sqlite, db, app } = f
const secret = Buffer.alloc(32, 7).toString('base64'), env = { DB: db, LLM_KEY_ENCRYPTION_SECRET: secret }
sqlite.exec(`INSERT INTO lw_labels(id,name) VALUES ('lab-a','Label A'),('lab-b','Label B');
INSERT INTO lw_memberships VALUES ('lab-a',1,'owner'),('lab-b',2,'owner'),('lab-a',3,'viewer');`)

async function connect(user, labels, scopes, name = 'Claude Code') {
  let valid = true
  const handler = createStudioMcp(db, { userId: user, grantId: 'g' + user, labelIds: labels, scopes, clientName: name }, async () => valid)
  const client = new Client({ name: 'test', version: '1' })
  await client.connect(new StreamableHTTPClientTransport(new URL('https://studio.invalid/label-world/mcp'), { fetch: (u, o) => handler.fetch(new Request(u, o)) }))
  const call = async (tool, args = {}) => { const r = await client.callTool({ name: 'studio2u_' + tool, arguments: args }); return r.isError ? { error: r.content[0].text } : r.structuredContent.data }
  return { client, call, handler, revoke: () => { valid = false } }
}

// ---------- pure unit checks ----------
assert.throws(() => intakePatch({ password: 'x' }), /Unknown intake field/)
assert.throws(() => intakePatch({ isrc: 'bad' }), /ISRC/)
assert.equal(intakePatch({ isrc: 'us-abc-26-00001' }).isrc, 'USABC2600001')
assert.throws(() => intakePatch({ writers: [{ legalName: 'A', split: 150 }] }), /percentage/)
assert.throws(() => intakePatch({ writers: [{ legalName: 'A', split: 50, ipi: '12' }] }), /IPI/)
const rel = { id: 'r', title: 'Song', artist: 'Art', release_type: 'single', version: 1, target_distributor: 'UnitedMasters' }
const asc = buildPacket('ASCAP', rel, { writers: [{ legalName: 'A One', role: 'writer', split: 60, pro: 'ASCAP', ipi: '123456789' }, { legalName: 'B Two', role: 'writer', split: 40, pro: 'BMI' }] }, {})
assert.equal(asc.applicable, true)
const rows = asc.sections[1].fields[0].value
assert.equal(rows[0].writerShare, 30); assert.equal(rows[1].writerShare, 20) // writer shares total 50% at ASCAP
assert.equal(buildPacket('ASCAP', rel, { writers: [{ legalName: 'B', role: 'writer', split: 100, pro: 'BMI' }] }, {}).applicable, false)
const um = buildPacket('UNITEDMASTERS', rel, {}, { master: false, artwork: false })
assert.ok(um.missing.length >= 7); assert.ok(um.humanOnly.some(h => /Submit/.test(h)))
assert.ok(um.sections.flatMap(s => s.fields).filter(x => x.status === 'HUMAN_ONLY').some(x => x.key === 'submit'))

// ---------- read-only grant cannot write ----------
const ro = await connect(1, ['lab-a'], [...readScopes], 'Read only')
const roNames = (await ro.client.listTools()).tools.map(t => t.name)
assert.ok(!roNames.includes('studio2u_create_release') && !roNames.includes('studio2u_claim_next_task'))
assert.ok(roNames.includes('studio2u_get_submission_packet'))

// ---------- full agent session ----------
const a = await connect(1, ['lab-a'], [...mcpScopes])
const names = (await a.client.listTools()).tools.map(t => t.name)
for (const n of ['create_release', 'update_intake', 'save_party', 'get_submission_packet', 'report_submission', 'claim_next_task', 'complete_task', 'queue_status']) assert.ok(names.includes('studio2u_' + n), n)
assert.ok((await a.client.listPrompts()).prompts.some(p => p.name === 'run_label_shift'))
assert.equal((await a.call('whoami')).capability, 'READ_WRITE')

const created = await a.call('create_release', { labelId: 'lab-a', artist: 'Mason Brown', title: 'Night Drive' })
assert.ok(created.id); const R = created.id
const subs = (await a.call('list_submissions', { labelId: 'lab-a', releaseId: R })).items
assert.deepEqual(subs.map(s => s.target).sort(), ['ASCAP', 'SOUNDEXCHANGE', 'UNITEDMASTERS'])
assert.ok(subs.every(s => s.status !== 'READY'))

// First task: collect intake (no screen needed). Screen tasks are not offered without screen control.
let claim = await a.call('claim_next_task', { canControlScreen: false })
assert.equal(claim.task.kind, 'COLLECT_INTAKE'); assert.ok(/DATA/.test(claim.instructions))
// ONE combined question list per release; shared questions say which providers need them.
assert.equal(sqlite.prepare("SELECT count(*) n FROM lw_tasks WHERE kind='COLLECT_INTAKE' AND release_id=?").get(R).n, 1)
const qs = claim.task.input.questions; assert.ok(qs.length > 5)
assert.equal(new Set(qs.map(x => x.field)).size, qs.length, 'no duplicate questions')
assert.deepEqual(qs.find(x => x.field === 'writers').neededFor, ['UNITEDMASTERS'])
assert.equal(claim.context.submissions.find(x => x.target === 'ASCAP').status, 'NOT_APPLICABLE', 'ASCAP only applies once an ASCAP writer is known')
assert.ok(qs.find(x => x.field === 'masterOwner').providerFields.length >= 4, 'SoundExchange claim fields collapse to one masterOwner question')
assert.equal(claim.context.submissions.length, 3)
// Agent can't reach the artist right now -> WAITING_FOR_INPUT -> owner notified, task re-queued later (not lost).
let done = await a.call('complete_task', { taskId: claim.task.id, outcome: 'WAITING_FOR_INPUT', summary: 'Need details', questions: ['What genre is it?', 'Legal names of the writers?'] })
assert.equal(done.status, 'QUEUED'); assert.ok(done.runAfter)
const notes = await a.call('list_notifications', { labelId: 'lab-a' })
assert.ok(notes.items.some(n => n.kind === 'QUESTIONS' && /genre/.test(n.body)))

// Validation errors are returned to the agent so it can self-correct.
assert.match((await a.call('update_intake', { labelId: 'lab-a', releaseId: R, patch: { isrc: 'nope' } })).error, /ISRC/)
// Stale version rejected.
assert.match((await a.call('update_intake', { labelId: 'lab-a', releaseId: R, expectedVersion: 99, patch: { genre: 'Hip-Hop' } })).error, /version/)

const party = await a.call('save_party', { labelId: 'lab-a', legalName: 'Mason K Brown', pro: 'ASCAP', ipi: '00123456789' })
assert.equal(party.provenance, 'AGENT_PROVIDED')
const v0 = (await a.call('get_intake', { labelId: 'lab-a', releaseId: R })).release.version
const up = await a.call('update_intake', { labelId: 'lab-a', releaseId: R, expectedVersion: v0, patch: {
  genre: 'Hip-Hop', isRerelease: false, coverArtThirdParty: false, containsThirdPartyAudio: false, explicit: true, instrumental: false,
  releaseDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  writers: [{ partyId: party.id, legalName: 'Mason K Brown', role: 'writer', split: 100, pro: 'ASCAP', ipi: '00123456789' }],
  masterOwner: { entityName: 'Mason Brown Music LLC' }
} })
assert.equal(up.version, v0 + 1)
// Audit trail records the agent edit.
assert.ok(sqlite.prepare("SELECT payload_json FROM lw_audit_events WHERE action='release.intake.patched'").get().payload_json.includes('"via":"mcp"'))

// UnitedMasters still blocked only on files; ASCAP should now be READY; SoundExchange waits for ISRC/UPC.
let um2 = await a.call('get_submission_packet', { labelId: 'lab-a', releaseId: R, target: 'UNITEDMASTERS' })
assert.deepEqual(um2.packet.missing.map(m => m.key).sort(), ['artworkFile', 'masterFile'])
const asc2 = await a.call('get_submission_packet', { labelId: 'lab-a', releaseId: R, target: 'ASCAP' })
assert.equal(asc2.status, 'READY', JSON.stringify(asc2.packet.missing))
const sx = await a.call('get_submission_packet', { labelId: 'lab-a', releaseId: R, target: 'SOUNDEXCHANGE' })
assert.deepEqual(sx.packet.missing.map(m => m.key).sort(), ['isrc', 'upc'])

// Old-version intake questions are superseded (not left for an agent to ask again).
const intakeRows = sqlite.prepare("SELECT status,json_extract(input_json,'$.releaseVersion') v FROM lw_tasks WHERE kind='COLLECT_INTAKE' AND release_id=? ORDER BY created_at").all(R)
assert.ok(intakeRows.filter(x => x.status === 'QUEUED').every(x => x.v === up.version), JSON.stringify(intakeRows))
// Files arrive (simulated asset rows, as the existing upload route creates).
for (const kind of ['master', 'artwork']) sqlite.prepare('INSERT INTO lw_assets(id,label_id,release_id,kind,original_name,object_key,byte_size,sha256) VALUES (?,?,?,?,?,?,?,?)').run(kind + '1', 'lab-a', R, kind, kind, 'k/' + kind, 10, 'h')

// ---------- always-on engine (no model) ----------
const s1 = await runEngine(env)
assert.ok(s1.refreshed >= 1 && s1.queued >= 1, JSON.stringify(s1))
const again = await runEngine(env)
assert.equal(again.queued, 0, 'engine is idempotent: no duplicate tasks')
um2 = await a.call('get_submission_packet', { labelId: 'lab-a', releaseId: R, target: 'UNITEDMASTERS' })
assert.equal(um2.status, 'READY')
assert.ok((await a.call('list_notifications', { labelId: 'lab-a' })).items.some(n => n.kind === 'SUBMISSION_READY'))

// Agent without screen control is never handed a screen task.
let noScreen
while ((noScreen = await a.call('claim_next_task', { canControlScreen: false })).task) {
  assert.notEqual(noScreen.task.capability, 'SCREEN_CONTROL')
  await a.call('complete_task', { taskId: noScreen.task.id, outcome: 'COMPLETED', summary: 'done' })
}
// Screen-capable agent gets the form-fill task with full packet context.
const fill = await a.call('claim_next_task', { canControlScreen: true, kinds: ['FILL_PROVIDER_FORM'] })
assert.equal(fill.task.kind, 'FILL_PROVIDER_FORM'); assert.ok(fill.context.packet.officialUrl.startsWith('https://'))
assert.ok(/Do NOT press the final Submit/.test(fill.instructions))
const T = fill.task.input.target

// Cannot claim SUBMITTED without any evidence; cannot VERIFY without provider evidence.
assert.match((await a.call('report_submission', { labelId: 'lab-a', releaseId: R, target: T, outcome: 'SUBMITTED' })).error, /confirmation/)
assert.match((await a.call('report_submission', { labelId: 'lab-a', releaseId: R, target: T, outcome: 'VERIFIED' })).error, /evidence/)
const rep = await a.call('report_submission', { labelId: 'lab-a', releaseId: R, target: T, outcome: 'SUBMITTED', confirmationRef: 'CONF-123' })
assert.equal(rep.status, 'SUBMITTED_REPORTED')
await a.call('complete_task', { taskId: fill.task.id, outcome: 'COMPLETED', summary: 'User pressed Submit' })
// A verification task is scheduled for later (provider review time), not immediately claimable.
await runEngine(env)
const verifyRow = sqlite.prepare("SELECT run_after FROM lw_tasks WHERE kind='VERIFY_SUBMISSION'").get()
assert.ok(verifyRow && Date.parse(verifyRow.run_after) > Date.now())
sqlite.prepare("UPDATE lw_tasks SET run_after='2000-01-01T00:00:00Z' WHERE kind='VERIFY_SUBMISSION'").run()
const ver = await a.call('claim_next_task', { canControlScreen: true, kinds: ['VERIFY_SUBMISSION'] })
assert.equal(ver.task.kind, 'VERIFY_SUBMISSION')
assert.equal((await a.call('report_submission', { labelId: 'lab-a', releaseId: R, target: T, outcome: 'VERIFIED', evidence: 'Status page shows: Approved' })).status, 'VERIFIED')
await a.call('complete_task', { taskId: ver.task.id, outcome: 'COMPLETED', summary: 'verified' })
const verified = sqlite.prepare('SELECT status,verified_evidence FROM lw_submissions WHERE release_id=? AND target=?').get(R, T)
assert.equal(verified.status, 'VERIFIED'); assert.match(verified.verified_evidence, /^agent:Claude Code: /)

// Editing after a filing flags NEEDS_CORRECTION on reported (not verified) packets and never silently resets VERIFIED.
const other = T === 'ASCAP' ? 'UNITEDMASTERS' : 'ASCAP'
const p2 = await a.call('get_submission_packet', { labelId: 'lab-a', releaseId: R, target: other })
assert.equal(p2.status, 'READY', 'other packet must be READY so the correction path is exercised')
{
  await a.call('report_submission', { labelId: 'lab-a', releaseId: R, target: other, outcome: 'SUBMITTED', evidence: 'Confirmation screen shown' })
  await a.call('update_intake', { labelId: 'lab-a', releaseId: R, patch: { producers: ['New Producer'] } })
  assert.equal(sqlite.prepare('SELECT status FROM lw_submissions WHERE release_id=? AND target=?').get(R, other).status, 'NEEDS_CORRECTION')
  assert.equal(sqlite.prepare('SELECT status FROM lw_submissions WHERE release_id=? AND target=?').get(R, T).status, 'VERIFIED')
}

// ---------- lease recovery: an agent that dies mid-task doesn't lose work ----------
const stuck = await a.call('claim_next_task', { canControlScreen: true })
assert.ok(stuck.task, 'a task must exist to exercise lease recovery')
{
  sqlite.prepare("UPDATE lw_tasks SET lease_until='2000-01-01T00:00:00Z' WHERE id=?").run(stuck.task.id)
  assert.equal((await recoverLeases(db)).requeued, 1)
  assert.equal(sqlite.prepare('SELECT status FROM lw_tasks WHERE id=?').get(stuck.task.id).status, 'QUEUED')
}

// ---------- tenant isolation ----------
const b = await connect(2, ['lab-b'], [...mcpScopes], 'Codex')
assert.ok((await b.call('get_intake', { labelId: 'lab-a', releaseId: R })).error)
assert.ok((await b.call('update_intake', { labelId: 'lab-a', releaseId: R, patch: { genre: 'x' } })).error)
const bClaim = await b.call('claim_next_task', { canControlScreen: true })
assert.equal(bClaim.task, null, 'label B agent never sees label A work')
// A grant that names a label the user is NOT a member of is refused.
const forged = await connect(2, ['lab-a'], [...mcpScopes])
assert.ok((await forged.call('create_release', { labelId: 'lab-a', artist: 'x', title: 'y' })).error)
// Viewer cannot write even with write scopes.
const viewer = await connect(3, ['lab-a'], [...mcpScopes])
assert.match((await viewer.call('create_release', { labelId: 'lab-a', artist: 'x', title: 'y' })).error, /permission/i)
// Revoked connection stops immediately.
a.revoke(); assert.ok((await a.call('queue_status')).error)

// ---------- optional Claude scheduled-task wake hook ----------
const calls = []
const fakeFetch = async (url, init) => { calls.push({ url, init }); return new Response('{}', { status: 200 }) }
assert.equal(await wakeAgents(db, env, 'lab-a', fakeFetch), 'NOT_CONFIGURED')
const url = 'https://api.anthropic.com/v1/claude_code/routines/trig_abc123/fire'
sqlite.prepare("INSERT INTO lw_label_secrets(label_id,name,value,created_by) VALUES ('lab-a','claude_routine',?,1)").run(await encryptKey(secret, JSON.stringify({ url, token: 'sk-ant-oat01-testtoken123' }), 'studio2u:routine:v1:lab-a'))
assert.equal(await wakeAgents(db, env, 'lab-a', fakeFetch), 'WOKEN')
assert.equal(calls[0].url, url); assert.equal(calls[0].init.headers.Authorization, 'Bearer sk-ant-oat01-testtoken123')
assert.equal(await wakeAgents(db, env, 'lab-a', fakeFetch), 'THROTTLED')
assert.ok(!sqlite.prepare("SELECT value FROM lw_label_secrets").get().value.includes('sk-ant'), 'token encrypted at rest')

// ---------- website API (same services) ----------
const web = (path, user = 1, body, method) => app.request('http://localhost/api/label-world/labels/lab-a' + path, { method: method ?? (body ? 'POST' : 'GET'), headers: { Cookie: 'studio2u_session=test-session-' + user, Origin: 'http://localhost', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }, env)
assert.equal((await web('/releases/' + R + '/submissions/ascap')).status, 200)
assert.equal((await web('/releases/' + R + '/intake/patch', 3, { patch: { genre: 'x' } })).status, 403) // viewer
assert.equal((await web('/releases/' + R + '/intake/patch', 1, { patch: { bogus: 1 } })).status, 400)
assert.equal((await web('/agents/claude-routine', 1, { url: 'https://evil.example/fire', token: 'x' })).status, 400)
assert.equal((await web('/agents/claude-routine', 1, { url, token: 'sk-ant-oat01-testtoken456' })).status, 200)
const setup = await (await web('/agents/setup')).json(); assert.ok(setup.mcpUrl.endsWith('/label-world/mcp') && setup.claudeRoutineConfigured)
assert.ok(!JSON.stringify(setup).includes('sk-ant'))
assert.equal((await web('/engine/run', 1, {})).status, 200)
const q = await (await web('/queue')).json(); assert.ok(q.engine.lastRun)
const crossSite = await app.request('http://localhost/api/label-world/labels/lab-a/releases/' + R + '/intake/patch', { method: 'POST', headers: { Cookie: 'studio2u_session=test-session-1', Origin: 'https://evil.invalid', 'Content-Type': 'text/plain' }, body: '{"patch":{"genre":"x"}}' }, env)
assert.equal(crossSite.status, 403)

// ---------- website chat answered by the user's own Codex/Claude via MCP ----------
sqlite.exec(`INSERT INTO lw_employee_messages(id,label_id,user_id,agent_id,role,content,status) VALUES ('msg-1','lab-a',1,'executive','user','What should we push this month?','WAITING_FOR_PROVIDER'),('msg-x','lab-b',2,'executive','user','other label','WAITING_FOR_PROVIDER')`)
const inbox = await connect(1, ['lab-a'], [...mcpScopes], 'Codex')
const pending = await inbox.call('list_unanswered_messages', { labelId: 'lab-a' })
assert.deepEqual(pending.messages.map(m => m.id), ['msg-1'])
assert.ok((await inbox.call('list_unanswered_messages', { labelId: 'lab-b' })).error)
assert.ok((await inbox.call('reply_to_message', { labelId: 'lab-b', messageId: 'msg-x', reply: 'nope' })).error)
assert.ok((await ro.client.listTools()).tools.every(t => t.name !== 'studio2u_reply_to_message'))
const replied = await inbox.call('reply_to_message', { labelId: 'lab-a', messageId: 'msg-1', reply: 'Push Night Drive: finish the ASCAP packet first.' })
assert.equal(replied.employeeId, 'executive')
assert.ok((await inbox.call('reply_to_message', { labelId: 'lab-a', messageId: 'msg-1', reply: 'dup' })).error)
assert.equal(sqlite.prepare("SELECT status FROM lw_employee_messages WHERE id='msg-1'").get().status, 'COMPLETED')
assert.equal(sqlite.prepare("SELECT role FROM lw_employee_messages WHERE reply_to='msg-1'").get().role, 'assistant')
assert.equal((await inbox.call('list_unanswered_messages', { labelId: 'lab-a' })).messages.length, 0)

await inbox.client.close(); await inbox.handler.close()

for (const c of [ro, b, forged, viewer]) { await c.client.close(); await c.handler.close() }
await a.client.close().catch(() => {}); await a.handler.close()
sqlite.close()
console.log('PASS autonomy: MCP write tools gated by scope/membership/role, agent intake with validation + versioning + audit, UnitedMasters/ASCAP/SoundExchange packets, idempotent always-on engine, screen-capability routing, evidence-gated SUBMITTED/VERIFIED, NEEDS_CORRECTION on post-filing edits, lease recovery, tenant isolation, revocation, encrypted Claude scheduled-task wake hook, website API parity and CSRF.')
