import assert from 'node:assert/strict'
import { fixture } from './label-world-api-fixture.mjs'
const {sqlite,app,env}=fixture()
async function req(path,user=1,body,method=body?'POST':'GET'){
 const res=await app.request('http://localhost'+path,{method,headers:{...(user?{Cookie:`studio2u_session=test-session-${user}`} : {}),'Content-Type':'application/json',Origin:'http://localhost'},...(body?{body:JSON.stringify(body)}:{})},env)
 return {status:res.status,body:await res.json()}
}
const base='/api/label-world'
assert.equal((await req(base+'/labels',null)).status,401)
const a=(await req(base+'/labels',1,{name:'Label A'})).body.id,b=(await req(base+'/labels',2,{name:'Label B'})).body.id
const pa=base+'/labels/'+a,pb=base+'/labels/'+b
sqlite.prepare('INSERT INTO lw_memberships VALUES (?,?,?)').run(a,3,'editor');sqlite.prepare('INSERT INTO lw_memberships VALUES (?,?,?)').run(a,4,'viewer')
assert.deepEqual((await req(base+'/labels',1)).body.labels.map(l=>l.id),[a])
assert.equal((await req(pb+'/releases',1)).status,404)
assert.equal((await req(pb+'/events',1)).status,404)
sqlite.prepare("INSERT INTO lw_tasks(id,label_id,agent_role) VALUES ('event-fixture',?,'reviewer')").run(a)
sqlite.prepare("INSERT INTO lw_task_events(label_id,task_id,status) VALUES (?,'event-fixture','QUEUED')").run(a)
assert.equal((await req(pa+'/events')).body.events.length,1)
assert.equal((await req(pb+'/events',2)).body.events.length,0)
assert.equal((await req(pa+'/events?after=-1')).status,400)
assert.equal((await req(pa+'/releases',4,{artist:'A',title:'No'})).status,403)
assert.equal((await req(pa+'/releases',1,{artist:'A',title:'Bad',releaseMode:'LIVE'})).status,400)
const r=await req(pa+'/releases',1,{artist:'A',title:'Song',releaseMode:'FAST_RELEASE',labelId:b});assert.equal(r.status,201);const id=r.body.id,release=pa+'/releases/'+id
assert.equal(sqlite.prepare('SELECT label_id FROM lw_releases WHERE id=?').get(id).label_id,a)
const m=await req(pa+'/releases',1,{artist:'A',title:'Managed',releaseMode:'MANAGED_RELEASE'});assert.equal(m.status,201)
assert.equal((await req(pa+'/registrations')).body.registrations.length,8)
assert.equal((await req(pb+'/releases/'+id+'/workflow',2)).status,404)
assert.equal((await req(pb+'/registrations',1)).status,404)
let w=(await req(release+'/workflow')).body;assert.equal(w.rights.status,'BLOCKED');assert.equal(w.distribution.submission,'UNAVAILABLE');assert.equal(w.registrations.length,4)
assert.ok(w.registrations.every(t=>t.status==='PENDING'&&t.applicability==='UNKNOWN'))
const assertions=Object.fromEntries(['master','beat','samples','cover_interpolation','collaborators','ai_sources'].map(k=>[k,{status:k==='master'?'CONFIRMED':'NOT_APPLICABLE',source:'USER_CONFIRMED',note:'Owner test statement'}]))
assert.equal((await req(release+'/rights',3,{version:1,assertions})).status,403)
assert.equal((await req(release+'/rights',1,{version:1,assertions:{...assertions,master:{...assertions.master,source:'MACHINE_INFERRED'}}})).status,400)
assert.equal((await req(release+'/rights',1,{version:1,assertions})).status,201)
w=(await req(release+'/workflow')).body;assert.equal(w.rights.status,'OWNER_ATTESTED');assert.equal(w.readiness.status,'INCOMPLETE');assert.ok(w.readiness.checks.every(c=>c.result==='NOT_TESTED'))
assert.equal((await req(release+'/rights',1,{version:1,assertions})).status,409)
const task=w.registrations[0],tp=pa+'/registrations/'+task.id
assert.equal((await req(pb+'/registrations/'+task.id,2,{revision:1,status:'PENDING',reason:'x'})).status,404)
assert.equal((await req(tp,3,{revision:1,status:'PREPARED',reason:'x'})).status,403)
assert.equal((await req(tp,1,{revision:1,status:'CONFIRMED',reason:'Uploaded song'})).status,400)
assert.equal((await req(tp,1,{revision:1,status:'AWAITING_VERIFICATION',reason:'Claim'})).status,400)
assert.equal((await req(tp,1,{revision:1,status:'AWAITING_VERIFICATION',reason:'Owner supplied receipt',reportedStatus:'CONFIRMED',receiptUrl:'https://example.invalid/receipt'})).status,200)
const auditCount=()=>sqlite.prepare('SELECT count(*) n FROM lw_audit_events').get().n
const before=auditCount();assert.equal((await req(tp,1,{revision:1,status:'PENDING',reason:'Stale'})).status,409);assert.equal(auditCount(),before)
const stored=sqlite.prepare('SELECT * FROM lw_registration_tasks WHERE id=?').get(task.id);assert.equal(stored.status,'AWAITING_VERIFICATION');assert.equal(stored.evidence_status,'UNVERIFIED');assert.equal(stored.reported_status,'CONFIRMED')
// Persisted database survives a new request/client; no streams field or expiration is needed.
assert.equal((await req(pa+'/registrations')).body.registrations.length,8)
const approval=crypto.randomUUID();sqlite.prepare("INSERT INTO lw_approvals(id,label_id,release_id,release_version,action,requested_by,status) VALUES (?,?,?,1,'delivery',1,'APPROVED')").run(approval,a,id)
const intake={artist:'A',title:'Changed',releaseType:'single',releaseMode:'MANAGED_RELEASE',targetDistributor:'UnitedMasters',version:1}
assert.equal((await req(release+'/intake',1,intake)).status,200);assert.equal((await req(release+'/workflow')).body.rights.status,'BLOCKED');assert.equal(sqlite.prepare('SELECT status FROM lw_approvals WHERE id=?').get(approval).status,'INVALIDATED')
const nextApproval=crypto.randomUUID();sqlite.prepare("INSERT INTO lw_approvals(id,label_id,release_id,release_version,action,requested_by,status) VALUES (?,?,?,2,'delivery',1,'APPROVED')").run(nextApproval,a,id)
const beforeStale=auditCount();assert.equal((await req(release+'/intake',1,intake)).status,409);assert.equal(auditCount(),beforeStale);assert.equal(sqlite.prepare('SELECT status FROM lw_approvals WHERE id=?').get(nextApproval).status,'APPROVED')
assert.equal((await req(release+'/rights',1,{version:1,assertions})).status,409)
const risk={...assertions,samples:{status:'UNLICENSED',source:'USER_CONFIRMED',note:'Known unlicensed sample'}}
assert.equal((await req(release+'/rights',1,{version:2,assertions:risk})).status,201);w=(await req(release+'/workflow')).body;assert.equal(w.rights.status,'BLOCKED');assert.equal(w.rights.checks.find(c=>c.category==='samples').result,'FAIL')
assert.throws(()=>sqlite.exec('DELETE FROM lw_audit_events'));assert.throws(()=>sqlite.exec('UPDATE lw_rights_reviews SET assertions_json=\'{}\''))
assert.equal((await req(pa+'/settings',3,{name:'Bad',theme:'charcoal_gold'})).status,403)
assert.equal((await req(pa+'/settings',1,{name:'A Brand',theme:'midnight_cyan'})).status,200)
assert.equal((await req(pb+'/settings',2,{name:'B Brand',theme:'violet_gold'})).status,200)
assert.notEqual((await req(pa+'/settings')).body.label.headquarters_json,(await req(pb+'/settings',2)).body.label.headquarters_json)
assert.equal((await req(pa+'/artists',1,{displayName:'Artist A'})).status,201);assert.equal((await req(pb+'/artists',2)).body.artists.length,0)
const cross=await app.request('http://localhost'+pa+'/releases',{method:'POST',headers:{Cookie:'studio2u_session=test-session-1',Origin:'https://evil.invalid','Content-Type':'text/plain'},body:'{"artist":"A","title":"evil"}'},env);assert.equal(cross.status,403)
const count=sqlite.prepare('SELECT count(*) n FROM lw_releases').get().n
sqlite.exec("CREATE TRIGGER fail_created BEFORE INSERT ON lw_audit_events WHEN NEW.action='release.created' BEGIN SELECT RAISE(ABORT,'fixture failure'); END;")
assert.equal((await req(pa+'/releases',1,{artist:'A',title:'Rollback'})).status,500);assert.equal(sqlite.prepare('SELECT count(*) n FROM lw_releases').get().n,count);assert.equal((await req(pa+'/registrations')).body.registrations.length,8)
console.log('PASS: authenticated two-tenant API isolation, RBAC, both modes, durable independent queues, rights blockers, unverified receipts, optimistic edits, immutable audit, branding, profiles, CSRF and atomic rollback')
