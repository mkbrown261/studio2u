import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fixture } from './label-world-api-fixture.mjs'
const { installWorkspaceRoutes }=await import('../src/label-world/workspace-services.ts')
const f=fixture()
if(!f.sqlite.prepare("SELECT name FROM sqlite_master WHERE name='lw_employee_messages'").get())f.sqlite.exec(readFileSync('migrations/0021_label_world_workspace.sql','utf8'))
// Root registration may already exist; install only when the fixture predates registration.
if(!f.app.routes.some(r=>r.path.endsWith('/inbox/:agentId/messages')))installWorkspaceRoutes(f.app)
const cookie='studio2u_session'
async function call(path,method='GET',body,user=1){const response=await f.app.request('https://studio.invalid/api/label-world/'+path,{method,headers:{Cookie:`${cookie}=test-session-${user}`,Origin:'https://studio.invalid','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})},f.env);return {status:response.status,body:await response.json()}}
const a=await call('labels','POST',{name:'Workspace A'}),b=await call('labels','POST',{name:'Workspace B'},2)
assert.equal(a.status,201);assert.equal(b.status,201)
const root=`labels/${a.body.id}`
const sent=await call(root+'/inbox/researcher/messages','POST',{content:'What evidence do we have?'})
assert.equal(sent.status,201);assert.equal(sent.body.status,'WAITING_FOR_PROVIDER');assert.equal(sent.body.messages.length,1)
assert.equal(sent.body.messages[0].role,'user');assert.equal((await call(root+'/inbox/researcher/messages')).body.messages.length,1)
assert.equal((await call(root+'/inbox/researcher/messages','GET',null,2)).status,404)
assert.equal((await call(root+'/inbox/reviewer/messages')).body.messages.length,0)
assert.equal((await call(root+'/inbox/unknown/messages')).status,404)
const note=await call(root+'/research/notes','POST',{title:'Evidence',content:'User observation',sourceUrl:'https://example.com/record'})
assert.equal(note.status,201);assert.equal((await call(root+'/research/notes')).body.records.length,1)
assert.equal((await call(root+'/research/notes','GET',null,2)).status,404)
assert.equal((await call(root+'/research/notes/'+note.body.id,'PATCH',{title:'Revised',content:'Updated',revision:1})).status,200)
assert.equal((await call(root+'/research/notes/'+note.body.id,'PATCH',{title:'Stale',revision:1})).status,409)
assert.equal((await call(root+'/research/notes','POST',{title:'Bad',sourceUrl:'https://secret:password@example.com'})).status,400)
f.sqlite.prepare("INSERT INTO lw_memberships VALUES (?,3,'viewer')").run(a.body.id)
assert.equal((await call(root+'/inbox/researcher/messages','GET',null,3)).status,200)
assert.equal((await call(root+'/inbox/researcher/messages','POST',{content:'Cannot mutate'},3)).status,403)
const release=await call(root+'/releases','POST',{title:'Song',artist:'Artist',releaseType:'single',releaseMode:'FAST_RELEASE'})
assert.equal(release.status,201)
const workspace=root+'/releases/'+release.body.id+'/workspace'
assert.equal((await call(workspace,'PUT',{brief:'Beat brief',lyrics:'Draft lyrics',catalog:'Singles',revision:0})).status,200)
assert.equal((await call(workspace)).body.workspace.lyrics,'Draft lyrics')
assert.equal((await call(workspace,'PUT',{brief:'Stale',revision:0})).status,409)
assert.equal((await call(root+'/inbox/reviewer/messages','POST',{content:'Review',releaseId:'missing'})).status,404)
assert.ok(!JSON.stringify(sent.body).includes('encrypted_key'))
assert.equal((await call(root+'/tasks')).body.workerStatus,'RUNNING_EVERY_5_MINUTES')
const {encryptKey,keyContext}=await import('../src/label-world/providers/vault.ts')
f.env.LLM_KEY_ENCRYPTION_SECRET=Buffer.alloc(32,7).toString('base64')
const privateKey='test-private-key-never-leak',config='{}'
const encrypted=await encryptKey(f.env.LLM_KEY_ENCRYPTION_SECRET,privateKey,keyContext(1,'openai',config))
f.sqlite.prepare('INSERT INTO lw_provider_connections(user_id,provider,endpoint_config,encrypted_key) VALUES (?,?,?,?)').run(1,'openai',config,encrypted)
f.sqlite.prepare('INSERT INTO lw_reasoning_preferences(label_id,user_id,provider,model) VALUES (?,?,?,?)').run(a.body.id,1,'openai','gpt-test')
f.sqlite.prepare("INSERT INTO lw_research_records(id,label_id,kind,title,content,created_by) VALUES ('other-secret',?,'notes','OTHER TENANT PRIVATE','Never expose',2)").run(b.body.id)
const originalFetch=globalThis.fetch;let providerCalls=0;let providerPrompt=''
globalThis.fetch=async(url,options)=>{providerCalls++;assert.equal(options.headers.Authorization,'Bearer '+privateKey);const request=JSON.parse(options.body);providerPrompt=request.input;return new Response(JSON.stringify({model:'gpt-test',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({summary:'Media checks remain NOT_TESTED.',evidenceRefs:[JSON.parse(providerPrompt).release?.id].filter(Boolean),limitations:['No current report'],nextSteps:['Run deterministic review']})}]}],usage:{output_tokens:12}}),{headers:{'Content-Type':'application/json'}})}
try{
 const generated=await call(root+'/inbox/reviewer/messages','POST',{content:'What blocks release?',releaseId:release.body.id,messageId:'dedupe-message-12345'})
 assert.equal(generated.body.status,'COMPLETED');assert.equal(providerCalls,1)
 const replay=await call(root+'/inbox/reviewer/messages','POST',{content:'What blocks release?',releaseId:release.body.id,messageId:'dedupe-message-12345'});assert.equal(replay.body.replayed,true);assert.equal(providerCalls,1)
 assert.ok(providerPrompt.includes('Song'));assert.ok(providerPrompt.includes('rightsProvenance'))
 assert.ok(!providerPrompt.includes('OTHER TENANT PRIVATE'));assert.ok(!providerPrompt.includes(privateKey));assert.ok(providerPrompt.length<=24000)
 assert.equal(generated.body.messages.at(-1).role,'assistant');assert.ok(!JSON.stringify(generated.body).includes(privateKey))
 globalThis.fetch=async()=>{throw new Error('Provider echoed '+privateKey)}
 const failure=await call(root+'/inbox/builder/messages','POST',{content:'Refine brief'})
 assert.equal(failure.body.status,'FAILED');assert.equal(failure.body.messages.length,1);assert.ok(!JSON.stringify(failure.body).includes(privateKey))
}finally{globalThis.fetch=originalFetch}
console.log('PASS workspace: tenant isolation, histories, missing-provider persistence, viewer scope, research revisions, creative drafts, mocked provider reasoning with bounded tenant context and sanitized failure; no live model call')
f.sqlite.close()
