import assert from 'node:assert/strict'
import {readFileSync,readdirSync} from 'node:fs'
import {parse} from 'yaml'
const root='docs/studio2u-label-world',trace=JSON.parse(readFileSync(root+'/TRACEABILITY.json','utf8'))
const required=['id','version','owner_role','goal','trigger','inputs','tools','steps','outputs','validations','approval_gates','failure_and_escalation','permissions','metrics','test_scenarios','knowledge_sources','status']
const files=readdirSync(root+'/skills').filter(f=>f.endsWith('.yaml'));assert.equal(files.length,23)
const ids=new Set()
for(const file of files){const s=parse(readFileSync(root+'/skills/'+file,'utf8'));for(const key of required)assert.ok(Object.hasOwn(s,key),`${file} missing ${key}`);assert.ok(!ids.has(s.id));ids.add(s.id);assert.match(s.version,/^\d+\.\d+\.\d+$/);assert.equal(s.status,'DESIGNED_NOT_IMPLEMENTED');for(const key of ['inputs','tools','steps','outputs','validations','failure_and_escalation','permissions','metrics','test_scenarios','knowledge_sources'])assert.ok(Array.isArray(s[key])&&s[key].length,`${file} invalid ${key}`);assert.ok(s.approval_gates===null||Array.isArray(s.approval_gates));assert.ok(s.permissions.includes('tenant_scope_enforced'));assert.ok(s.failure_and_escalation.length);const task=trace.skills.find(t=>t.id===s.id);assert.ok(task?.owner&&task?.gate&&task?.acceptance.length&&task?.requirements.length);assert.equal(task.runtime,'UNAVAILABLE')}
const registered=[...readFileSync(root+'/REQUIREMENTS.md','utf8').matchAll(/^- (R\d{3}) /gm)].map(m=>m[1]);assert.equal(registered.length,59);assert.equal(new Set(registered).size,59);assert.deepEqual(trace.requirements.map(r=>r.id),registered)
const earlier=[...readFileSync('docs/blueprint-archive/v1/REQUIREMENTS.md','utf8').matchAll(/^- (R\d{3}) /gm)].map(m=>m[1]);assert.ok(earlier.every(id=>registered.includes(id)),'Dropped v1 requirement')
for(const r of [...trace.requirements,...trace.nonfunctional,...trace.workflows])assert.ok(r.taskId&&r.owner&&r.gate&&r.acceptance.length)
for(const s of trace.skills)assert.ok(s.requirements.every(id=>registered.includes(id)))
assert.equal(trace.nonfunctional.length,6);assert.equal(trace.workflows.length,10)
console.log('PASS: all 59 requirements + 6 nonfunctional requirements, 10 workflows, all 23 YAML skill contracts, v1 preservation and explicit unavailable runtime statuses')
