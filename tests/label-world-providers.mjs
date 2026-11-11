import assert from 'node:assert/strict'
import {fixture} from './label-world-api-fixture.mjs'
const {encryptKey,decryptKey,keyContext}=await import('../src/label-world/providers/vault.ts')
const {baseUrl,endpointConfig,generate,listModels}=await import('../src/label-world/providers/adapters.ts')
const secret=Buffer.alloc(32,17).toString('base64'),key='synthetic-provider-key-never-real'
const context=keyContext(1,'openai','{}'),encrypted=await encryptKey(secret,key,context)
assert.ok(!encrypted.includes(key));assert.equal(await decryptKey(secret,encrypted,context),key)
await assert.rejects(decryptKey(secret,encrypted,keyContext(2,'openai','{}')))
await assert.rejects(encryptKey(undefined,key,context));await assert.rejects(encryptKey('bad',key,context))
assert.throws(()=>endpointConfig('qwen',{region:'evil'}));assert.throws(()=>endpointConfig('qwen',{region:'singapore',workspace:'x.example.com/path'}))
assert.equal(baseUrl('qwen',{region:'singapore',workspace:'workspace-123'}),'https://workspace-123.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1')
const originalFetch=globalThis.fetch,calls=[]
let fail=false,timeout=false,pagination=false
const ids={openai:'gpt-6.1-sol',anthropic:'claude-sonnet-5-5',kimi:'kimi-k3',qwen:'qwen3.8-plus',openrouter:'qwen/qwen3.8-plus'}
globalThis.fetch=async(url,options)=>{
 calls.push({url,options})
 if(timeout)throw new Error('synthetic network failure')
 if(fail)return Response.json({error:{message:key}}, {status:401})
 const provider=url.includes('openai.com')?'openai':url.includes('anthropic')?'anthropic':url.includes('moonshot')?'kimi':url.includes('openrouter')?'openrouter':'qwen'
 if(url.includes('/models')){
  if(pagination&&provider==='anthropic'&&!url.includes('after_id'))return Response.json({data:[{id:'claude-opus-5-5',lifecycle:'active'}],has_more:true,last_id:'claude-opus-5-5'})
  return Response.json({data:[{id:ids[provider],name:'Model',created:123},...(provider==='openai'?[{id:'gpt-image-1'},{id:'gpt-realtime'},{id:'text-embedding-3'}]:[]),...(provider==='anthropic'?[{id:'claude-old',lifecycle:'retired'}]:[])],has_more:false})
 }
 const body=JSON.parse(options.body)
 assert.equal(body.model,ids[provider]);assert.equal(options.redirect,'error');assert.ok(options.signal)
 if(provider==='openai'){assert.equal(body.store,false);assert.equal(body.max_output_tokens,2048);return Response.json({model:body.model,output:[{type:'reasoning',summary:[]},{type:'message',content:[{type:'output_text',text:'OpenAI answer'}]}],usage:{input_tokens:12,output_tokens:24}})}
 if(provider==='anthropic'){assert.equal(options.headers['anthropic-version'],'2023-06-01');assert.equal(options.headers['x-api-key'],key);return Response.json({model:body.model,content:[{type:'thinking',thinking:'private'},{type:'text',text:'Claude answer'}],usage:{input_tokens:12,output_tokens:24}})}
 if(provider==='openrouter')assert.equal(body.provider.allow_fallbacks,false)
 return Response.json({model:body.model,choices:[{message:{content:'Compatible answer'}}],usage:{prompt_tokens:12,completion_tokens:24}})
}
try{
 for(const provider of Object.keys(ids)){
  if(provider!=='qwen')assert.equal((await listModels(provider,key,{}))[0].id,ids[provider])
  const result=await generate(provider,key,{},ids[provider],'Test question');assert.ok(result.text);assert.ok(!result.text.includes('private'))
 }
 pagination=true;assert.equal((await listModels('anthropic',key,{})).length,2);pagination=false
 const {sqlite,app,env}=fixture();env.LLM_KEY_ENCRYPTION_SECRET=secret
 async function req(path,user=1,body,method=body?'POST':'GET',origin='http://localhost'){
  const res=await app.request('http://localhost/api/label-world'+path,{method,headers:{...(user?{Cookie:`studio2u_session=test-session-${user}`} : {}),'Content-Type':'application/json',Origin:origin},...(body?{body:JSON.stringify(body)}:{})},env)
  return {status:res.status,body:await res.json(),headers:res.headers}
 }
 const label=(await req('/labels',1,{name:'Test label'})).body.id
 const other=(await req('/labels',2,{name:'Other label'})).body.id
 sqlite.prepare('INSERT INTO lw_memberships VALUES (?,?,?)').run(label,3,'editor');sqlite.prepare('INSERT INTO lw_memberships VALUES (?,?,?)').run(label,4,'viewer')
 assert.equal((await req('/providers',null)).status,401)
 assert.equal((await req('/providers')).headers.get('cache-control'),'no-store')
 assert.equal((await req('/providers/bad/connect',1,{apiKey:key})).status,400)
 assert.equal((await req('/providers/openai/connect',1,{apiKey:key},'POST','https://evil.invalid')).status,403)
 const missing=env.LLM_KEY_ENCRYPTION_SECRET;delete env.LLM_KEY_ENCRYPTION_SECRET
 assert.equal((await req('/providers/openai/connect',1,{apiKey:key})).status,503);env.LLM_KEY_ENCRYPTION_SECRET=missing
 assert.equal((await req('/providers/openai/connect',1,{apiKey:key})).status,200)
 assert.ok(!sqlite.prepare('SELECT encrypted_key FROM lw_provider_connections').get().encrypted_key.includes(key))
 assert.ok(!JSON.stringify((await req('/providers')).body).includes(key))
 assert.equal((await req('/providers',2)).body.providers[0].connection,null)
 assert.equal((await req('/providers/openai/models',2,{})).status,409)
 assert.equal((await req('/providers/openai/models',1,{})).status,200)
 const path='/labels/'+label+'/reasoning',otherPath='/labels/'+other+'/reasoning'
 assert.equal((await req(otherPath+'/settings',1)).status,404)
 assert.equal((await req(path+'/settings',4,{provider:'openai',model:ids.openai})).status,403)
 assert.equal((await req(path+'/settings',3,{provider:'openai',model:ids.openai})).status,409)
 assert.equal((await req(path+'/settings',1,{provider:'openai',model:'imaginary-model'})).status,400)
 assert.equal((await req(path+'/settings',1,{provider:'openai',model:ids.openai})).status,200)
 assert.equal((await req(path+'/settings',3)).body.preference,null)
 assert.equal((await req(path+'/test',1,{prompt:'Test question'})).status,200)
 assert.equal(sqlite.prepare('SELECT status FROM lw_reasoning_runs').get().status,'COMPLETED')
 assert.ok(!JSON.stringify(sqlite.prepare('SELECT * FROM lw_reasoning_runs').get()).includes('Test question'))
 fail=true
 // Reset fixture quota to test sanitized failure independently of throttling.
 sqlite.exec('DELETE FROM lw_provider_rate_limits')
 const failed=await req(path+'/test',1,{prompt:'Test question'});assert.equal(failed.status,502);assert.ok(!JSON.stringify(failed.body).includes(key));fail=false
 timeout=true;await assert.rejects(generate('openai',key,{},ids.openai,'Test'),/unavailable or timed out/);timeout=false
 sqlite.exec('DELETE FROM lw_provider_rate_limits')
 for(let i=0;i<6;i++)assert.equal((await req('/providers/openai/models',1,{})).status,200)
 assert.equal((await req('/providers/openai/models',1,{})).status,429)
 assert.equal((await req('/providers/openai/disconnect',1,{})).status,200)
 assert.equal((await req(path+'/settings')).body.preference,null)
 assert.equal((await req('/providers/qwen/models',1,{})).status,400)
 sqlite.close()
 console.log('PASS: five provider request/response adapters; current-catalog filtering/pagination; AES-GCM encryption/AAD isolation; auth/CSRF/RBAC; personal-key isolation; preference persistence; sanitized errors/timeouts; rate limits; disconnect cascade. Mock HTTP only, no live LLM calls.')
}finally{globalThis.fetch=originalFetch}
