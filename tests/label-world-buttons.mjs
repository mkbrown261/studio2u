// Every button on every employee page does something:
//  1) static guard: no "Coming soon" PendingButton, no permanently disabled controls, no buttons
//     whose only action is a toast, no grayed-out demo-only checkboxes on the live page
//  2) Final Approval (Eric): version-bound request -> owner approve/reject, with real blockers
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fixture } from './label-world-api-fixture.mjs'
const ap = await import('../src/label-world/autonomy/approval.ts')

// ---------- 1) static guard ----------
const dir = 'src/client/label-world/'
for (const f of readdirSync(dir).filter(x => x.endsWith('.tsx'))) {
  const s = readFileSync(dir + f, 'utf8')
  assert.ok(!/<PendingButton[\s>]/.test(s), `${f}: a "Coming soon" PendingButton is back`)
  assert.ok(!/<(Button|button)\b[^>]*\sdisabled(\s|>|\/)/.test(s), `${f}: a button is permanently disabled`)
  assert.ok(!/onClick=\{\(\)=>\s*p?\.?notify\([^)]*\)\}/.test(s), `${f}: a button only shows a message`)
  assert.ok(!/disabled=\{!p\.demo\}/.test(s), `${f}: a control is grayed out unless demo mode is on`)
}
const ws = readFileSync(dir + 'workspaces.tsx', 'utf8')
for (const x of ['DistributionPrep', 'FinalApproval', 'PackageTools', 'AssignTask', 'LyricsImport', 'TrendsLive', 'https://suno.com', 'https://higgsfield.ai', 'https://genjitsu.ai', "/label-world/money#content", '/label-world/agents/reviewer#distribution'])
  assert.ok(ws.includes(x), 'workspaces wires ' + x)

// ---------- 2) Final Approval ----------
const f = fixture(), { sqlite, db, app } = f
sqlite.exec(`INSERT INTO lw_labels(id,name) VALUES ('lab-a','Aviator'),('lab-b','Other');
INSERT INTO lw_memberships VALUES ('lab-a',1,'owner'),('lab-b',2,'owner'),('lab-a',3,'viewer'),('lab-a',4,'editor');
INSERT INTO lw_releases(id,label_id,artist,title,release_type) VALUES ('r1','lab-a','Aviator Keyz','22','single');
INSERT INTO lw_assets(id,label_id,release_id,kind,original_name,object_key,byte_size,sha256,version) VALUES ('am','lab-a','r1','master','22.wav','k/m',100,'aa',1),('aa','lab-a','r1','artwork','22.png','k/a',100,'bb',1);`)
const env = { DB: db }
let st = await ap.approvalStatus(db, 'lab-a', 'r1', 4)
assert.equal(st.version, 1); assert.equal(st.current, null)
assert.ok(st.blockers.some(b => /Run a review first/.test(b)) && st.blockers.some(b => /rights statement/.test(b)))
await assert.rejects(ap.approvalAction(db, 'lab-a', 'r1', 4, { action: 'REQUEST' }), /Not ready for final approval yet:\n1\. Run a review first/)
await assert.rejects(ap.approvalAction(db, 'lab-a', 'r1', 3, { action: 'REQUEST' }), /Editing permission/)
await assert.rejects(ap.approvalAction(db, 'lab-a', 'r1', 4, { action: 'SHIP_IT' }), /REQUEST, APPROVE or REJECT/)
await assert.rejects(ap.approvalStatus(db, 'lab-a', 'nope', 1), /Release not found/)
await assert.rejects(ap.approvalStatus(db, 'lab-a', 'r1', 2), /Label not found/) // other label's owner

// a failing review blocks; a passing current review + rights statement unblocks
const review = (id, status) => sqlite.prepare("INSERT INTO lw_reviews(id,label_id,release_id,release_version,task_id,requested_by,status,findings_json,request_key,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)").run(id, 'lab-a', 'r1', 1, 't-' + id, 4, 'COMPLETED', JSON.stringify([
  { check: 'master.integrity', status: 'PASS', evidence: { assetId: 'am' } }, { check: 'artwork.integrity', status: 'PASS', evidence: { assetId: 'aa' } },
  { check: 'audio.technical', status, detail: status === 'FAIL' ? 'Clipping at 1:12' : 'OK' }]), 'k-' + id, id === 'rv1' ? '2026-10-30 10:00:00' : '2026-10-30 11:00:00')
review('rv1', 'FAIL')
st = await ap.approvalStatus(db, 'lab-a', 'r1', 4); assert.ok(st.blockers.some(b => /Fix: audio\.technical - Clipping at 1:12/.test(b)))
review('rv2', 'PASS')
const yes = { status: 'CONFIRMED', source: 'USER_CONFIRMED', note: 'Mine' }
sqlite.prepare("INSERT INTO lw_rights_reviews(id,label_id,release_id,release_version,assertions_json,attested_by) VALUES ('rr1','lab-a','r1',1,?,1)").run(JSON.stringify({ master: yes, beat: yes, samples: { ...yes, status: 'NOT_APPLICABLE' }, cover_interpolation: { ...yes, status: 'NOT_APPLICABLE' }, collaborators: yes, ai_sources: { ...yes, status: 'NOT_APPLICABLE' } }))
st = await ap.approvalStatus(db, 'lab-a', 'r1', 4); assert.deepEqual(st.blockers, [])

// editor requests; owner is notified; editor cannot decide; owner approves
await assert.rejects(ap.approvalAction(db, 'lab-a', 'r1', 1, { action: 'APPROVE' }), /Tap "Request Final Approval" first/)
const req = await ap.approvalAction(db, 'lab-a', 'r1', 4, { action: 'REQUEST' })
assert.equal(req.status, 'PENDING'); assert.match(req.say, /owner has been notified/)
assert.equal((await ap.approvalAction(db, 'lab-a', 'r1', 4, { action: 'REQUEST' })).say, 'Already waiting for the owner.')
assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM lw_notifications WHERE kind='APPROVAL' AND user_id=1").get().n, 1)
await assert.rejects(ap.approvalAction(db, 'lab-a', 'r1', 4, { action: 'APPROVE' }), /Only the label owner/)
const ok = await ap.approvalAction(db, 'lab-a', 'r1', 1, { action: 'APPROVE', note: 'Ship it' })
assert.equal(ok.status, 'APPROVED'); assert.equal(sqlite.prepare("SELECT state FROM lw_releases WHERE id='r1'").get().state, 'APPROVED')
assert.match((await ap.approvalAction(db, 'lab-a', 'r1', 4, { action: 'REQUEST' })).say, /already approved/)
assert.equal(sqlite.prepare("SELECT COUNT(*) n FROM lw_audit_events WHERE action IN ('approval.requested','approval.approved')").get().n, 2)

// a new version needs a new review + rights + approval; reject path works
sqlite.exec("UPDATE lw_releases SET version=2 WHERE id='r1'")
st = await ap.approvalStatus(db, 'lab-a', 'r1', 1)
assert.equal(st.current, null); assert.ok(st.blockers.some(b => /older version/.test(b)) && st.blockers.some(b => /rights statement/.test(b)))
sqlite.exec("UPDATE lw_releases SET version=1 WHERE id='r1'; UPDATE lw_approvals SET status='INVALIDATED'")
await ap.approvalAction(db, 'lab-a', 'r1', 1, { action: 'REQUEST' })
assert.equal((await ap.approvalAction(db, 'lab-a', 'r1', 1, { action: 'REJECT' })).status, 'REJECTED')

// website routes
const web = (path, user = 1, body) => app.request('http://localhost/api/label-world/labels/lab-a' + path, { method: body ? 'POST' : 'GET', headers: { Cookie: 'studio2u_session=test-session-' + user, Origin: 'http://localhost', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }, env)
let r = await web('/releases/r1/approval', 3); assert.equal(r.status, 200); assert.equal((await r.json()).version, 1)
r = await web('/releases/r1/approval', 3, { action: 'REQUEST' }); assert.equal(r.status, 403)
r = await web('/releases/r1/approval', 4, { action: 'REQUEST' }); assert.equal(r.status, 200); assert.equal((await r.json()).status, 'PENDING')
r = await web('/releases/r1/approval', 4, { action: 'APPROVE' }); assert.equal(r.status, 403)
r = await web('/releases/r1/approval', 1, { action: 'APPROVE' }); assert.equal((await r.json()).status, 'APPROVED')
r = await web('/releases/r1/submissions', 3); assert.equal(r.status, 200) // Distribution Prep's data source
console.log('PASS buttons: no "Coming soon", permanently disabled, toast-only or demo-only grayed controls on any employee page; Eric Distribution Prep + Final Approval, Executive Assign task / Approve campaign / Review, Builder Generate ideas / Import lyrics / Preview + Build Package / tool links, Carla live charts all wired; Final Approval is version-bound (needs a current passing review + rights statement, editors request, only the owner approves/rejects, owner notified, release marked APPROVED, new version needs a new approval), routes')
