import type { Hono } from 'hono'
import type { AppEnv } from '../../types'
import type { SessionUser } from '../../lib/session'
import { providerIds,providerId,endpointConfig,listModels,generate,ProviderError,recommendCheapest } from './adapters'
import { spendGuard,recordSpend,budgetStatus,setBudget } from './budget'
import { encryptKey,decryptKey,keyContext } from './vault'
type Env=AppEnv & {Variables:{lwUser:SessionUser;lwRole:string}}
export function installProviderRoutes(app:Hono<Env>){
  const privateRequest=async(c:any,next:any)=>{
    c.header('Cache-Control','no-store')
    if(c.req.method!=='GET' && (c.req.header('Origin')!==new URL(c.req.url).origin && c.req.header('Sec-Fetch-Site')!=='same-origin'))return c.json({error:'Same-origin request required'},403)
    await next()
  }
  app.use('/api/label-world/providers/*',privateRequest)
  app.use('/api/label-world/labels/:labelId/reasoning/*',privateRequest)
  const safe=(fn:any)=>async(c:any)=>{try{return await fn(c)}catch(e){return c.json({error:e instanceof ProviderError?e.message:'Reasoning request failed'},e instanceof ProviderError?e.status:500)}}
  const limited=async(c:any)=>{
    const window=new Date().toISOString().slice(0,16)
    const row=await c.env.DB.prepare('INSERT INTO lw_provider_rate_limits(user_id,window,requests) VALUES (?,?,1) ON CONFLICT(user_id,window) DO UPDATE SET requests=requests+1 WHERE requests<6 RETURNING requests').bind(c.get('lwUser').id,window).first()
    if(!row)throw new ProviderError('Too many provider requests; try again next minute',429)
  }
  const connection=async(c:any,id:string)=>{
    const provider=providerId(id),user=c.get('lwUser').id
    const row=await c.env.DB.prepare('SELECT endpoint_config,encrypted_key FROM lw_provider_connections WHERE user_id=? AND provider=?').bind(user,provider).first()
    if(!row)throw new ProviderError('Connect your provider API key first',409)
    const key=await decryptKey(c.env.LLM_KEY_ENCRYPTION_SECRET,row.encrypted_key,keyContext(user,provider,row.endpoint_config))
    return {provider,key,config:endpointConfig(provider,JSON.parse(row.endpoint_config))}
  }
  app.get('/api/label-world/providers',safe(async(c:any)=>{
    c.header('Cache-Control','no-store')
    const rows=(await c.env.DB.prepare('SELECT provider,endpoint_config,revision,updated_at FROM lw_provider_connections WHERE user_id=?').bind(c.get('lwUser').id).all()).results
    return c.json({storageConfigured:Boolean(c.env.LLM_KEY_ENCRYPTION_SECRET),providers:providerIds.map(id=>({id,connection:rows.find((r:any)=>r.provider===id)||null})),mode:'PERSONAL_API_KEYS',agentRuntime:'NOT_IMPLEMENTED'})
  }))
  app.post('/api/label-world/providers/:provider/connect',safe(async(c:any)=>{
    const provider=providerId(c.req.param('provider')),body=await c.req.json().catch(()=>null)
    if(typeof body?.apiKey!=='string'||body.apiKey.length<10||body.apiKey.length>4096||/\s/.test(body.apiKey))throw new ProviderError('Valid provider API key required',400)
    const config=JSON.stringify(endpointConfig(provider,body.config)),user=c.get('lwUser').id
    const encrypted=await encryptKey(c.env.LLM_KEY_ENCRYPTION_SECRET,body.apiKey,keyContext(user,provider,config))
    await c.env.DB.prepare('INSERT INTO lw_provider_connections(user_id,provider,endpoint_config,encrypted_key) VALUES (?,?,?,?) ON CONFLICT(user_id,provider) DO UPDATE SET endpoint_config=excluded.endpoint_config,encrypted_key=excluded.encrypted_key,revision=revision+1,updated_at=CURRENT_TIMESTAMP').bind(user,provider,config,encrypted).run()
    return c.json({provider,status:'SAVED_NOT_VERIFIED'})
  }))
  app.post('/api/label-world/providers/:provider/disconnect',safe(async(c:any)=>{
    const provider=providerId(c.req.param('provider'))
    await c.env.DB.prepare('DELETE FROM lw_provider_connections WHERE user_id=? AND provider=?').bind(c.get('lwUser').id,provider).run()
    return c.json({provider,status:'DISCONNECTED'})
  }))
  app.post('/api/label-world/providers/:provider/models',safe(async(c:any)=>{
    if(c.req.param('provider')==='qwen')throw new ProviderError('Use an exact model ID from your Qwen Model Studio catalog',400)
    await limited(c);const conn=await connection(c,c.req.param('provider'))
    const models=await listModels(conn.provider,conn.key,conn.config)
    return c.json({provider:conn.provider,models,recommended:recommendCheapest(conn.provider,models),status:'CATALOG_FETCHED',generationVerified:false})
  }))
  app.get('/api/label-world/providers/budget',safe(async(c:any)=>c.json(await budgetStatus(c.env.DB,c.get('lwUser').id))))
  app.post('/api/label-world/providers/budget',safe(async(c:any)=>{const b=await c.req.json().catch(()=>null);return c.json(await setBudget(c.env.DB,c.get('lwUser').id,b?.monthlyCapUsd))}))
  app.get('/api/label-world/labels/:labelId/reasoning/settings',safe(async(c:any)=>{
    const preference=await c.env.DB.prepare('SELECT provider,model FROM lw_reasoning_preferences WHERE label_id=? AND user_id=?').bind(c.req.param('labelId'),c.get('lwUser').id).first()
    return c.json({preference,scope:'PERSONAL_WITHIN_LABEL',agentRuntime:'NOT_IMPLEMENTED'})
  }))
  app.post('/api/label-world/labels/:labelId/reasoning/settings',safe(async(c:any)=>{
    const body=await c.req.json().catch(()=>null),provider=providerId(body?.provider)
    if(typeof body?.model!=='string'||!body.model.trim()||body.model.length>200||/[\s\x00-\x1f]/.test(body.model))throw new ProviderError('Valid model ID required',400)
    const conn=await connection(c,provider)
    // Qwen's official compatible API docs do not establish a model-list endpoint.
    // Accept a user-supplied Qwen model ID; only a generation test verifies availability.
    if(provider==='qwen'){
      if(!/^qwen[a-zA-Z0-9._:-]*$/.test(body.model))throw new ProviderError('Qwen model ID required',400)
    }else{
      await limited(c)
      const models=await listModels(provider,conn.key,conn.config)
      if(!models.some(m=>m.id===body.model))throw new ProviderError('Model is not in your provider catalog',400)
    }
    const label=c.req.param('labelId'),user=c.get('lwUser').id
    await c.env.DB.batch([
      c.env.DB.prepare('INSERT INTO lw_reasoning_preferences(label_id,user_id,provider,model) VALUES (?,?,?,?) ON CONFLICT(label_id,user_id) DO UPDATE SET provider=excluded.provider,model=excluded.model,updated_at=CURRENT_TIMESTAMP').bind(label,user,provider,body.model),
      c.env.DB.prepare('INSERT INTO lw_audit_events(id,label_id,actor_id,action,payload_json) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),label,user,'reasoning.preference.updated',JSON.stringify({provider,model:body.model}))
    ])
    return c.json({provider,model:body.model,status:'SAVED',generationVerified:false})
  }))
  app.post('/api/label-world/labels/:labelId/reasoning/test',safe(async(c:any)=>{
    const body=await c.req.json().catch(()=>null)
    if(typeof body?.prompt!=='string'||!body.prompt.trim()||body.prompt.length>8000)throw new ProviderError('Prompt must be 1–8000 characters',400)
    await limited(c)
    const user=c.get('lwUser').id,label=c.req.param('labelId')
    const preference=await c.env.DB.prepare('SELECT provider,model FROM lw_reasoning_preferences WHERE label_id=? AND user_id=?').bind(label,user).first()
    if(!preference)throw new ProviderError('Save a model selection first',409)
    const conn=await connection(c,preference.provider),id=crypto.randomUUID()
    await spendGuard(c.env.DB,user)
    await c.env.DB.prepare("INSERT INTO lw_reasoning_runs(id,label_id,user_id,provider,model,status) VALUES (?,?,?,?,?,'RUNNING')").bind(id,label,user,conn.provider,preference.model).run()
    try{
      const result=await generate(conn.provider,conn.key,conn.config,preference.model,body.prompt.trim())
      await c.env.DB.prepare("UPDATE lw_reasoning_runs SET status='COMPLETED',usage_json=? WHERE id=?").bind(JSON.stringify(result.usage),id).run()
      await recordSpend(c.env.DB,user,conn.provider,result.model,result.usage)
      return c.json({id,provider:conn.provider,requestedModel:preference.model,...result,status:'COMPLETED',agentRuntime:'NOT_IMPLEMENTED'})
    }catch(e){
      await c.env.DB.prepare("UPDATE lw_reasoning_runs SET status='FAILED' WHERE id=?").bind(id).run()
      throw e
    }
  }))
}
