export const providerIds = ['openai','anthropic','kimi','qwen','openrouter','xai','gemini'] as const
export type Provider = typeof providerIds[number]
export type EndpointConfig = { region?: string; workspace?: string }
export class ProviderError extends Error {
  status: number
  constructor(code: string, status = 502) { super(code); this.status=status }
}
export function providerId(value: unknown): Provider {
  if (!providerIds.includes(value as Provider)) throw new ProviderError('Unsupported provider',400)
  return value as Provider
}
export function endpointConfig(provider: Provider, value: any = {}): EndpointConfig {
  if (provider !== 'qwen') return {}
  const region = value?.region ?? 'us'
  if (!['us','singapore','beijing','hongkong','tokyo'].includes(region)) throw new ProviderError('Unsupported Qwen region',400)
  if (region === 'us') return { region }
  if (typeof value.workspace !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(value.workspace)) throw new ProviderError('Qwen workspace ID required for this region',400)
  return { region, workspace:value.workspace }
}
export function baseUrl(provider: Provider, config: EndpointConfig): string {
  const urls = {openai:'https://api.openai.com/v1',anthropic:'https://api.anthropic.com/v1',kimi:'https://api.moonshot.ai/v1',openrouter:'https://openrouter.ai/api/v1',xai:'https://api.x.ai/v1',gemini:'https://generativelanguage.googleapis.com/v1beta/openai'}
  if (provider !== 'qwen') return urls[provider]
  const c=endpointConfig(provider,config)
  if(c.region==='us')return 'https://dashscope-us.aliyuncs.com/compatible-mode/v1'
  const regions: Record<string,string>={singapore:'ap-southeast-1',beijing:'cn-beijing',hongkong:'cn-hongkong',tokyo:'ap-northeast-1'}
  return `https://${c.workspace}.${regions[c.region!]}.maas.aliyuncs.com/compatible-mode/v1`
}
async function request(provider: Provider,key: string,config: EndpointConfig,path: string,body?: unknown) {
  const headers: Record<string,string>={'Content-Type':'application/json'}
  if(provider==='anthropic'){headers['x-api-key']=key;headers['anthropic-version']='2023-06-01'}
  else headers.Authorization='Bearer '+key
  if(provider==='openrouter')headers['X-OpenRouter-Title']='Studio2U Label World'
  let response: Response
  try {response=await fetch(baseUrl(provider,config)+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(body?60000:15000)})}
  catch {throw new ProviderError('Provider unavailable or timed out')}
  // Never forward raw provider errors: some services echo credentials or prompt text.
  if(!response.ok)throw new ProviderError(response.status===401||response.status===403?'Provider rejected credentials':response.status===429?'Provider rate limit or balance exceeded':'Provider request failed',response.status===429?429:502)
  const data:any=await response.json().catch(()=>null)
  if(!data || data.error)throw new ProviderError('Invalid provider response')
  return data
}
export type Model = {id:string; name:string; created:number}
export function textModel(provider: Provider,id:string,model:any):boolean {
  if(model.lifecycle && model.lifecycle!=='active')return false
  if(provider==='openai')return /^(gpt-|chatgpt-|o[1-9])/.test(id)&&!/(audio|realtime|image|transcrib|tts|search|research|codex)/i.test(id)
  if(provider==='anthropic')return id.startsWith('claude-')
  if(provider==='kimi')return /^(kimi-|moonshot-)/.test(id)
  if(provider==='qwen')return id.startsWith('qwen')&&!/(audio|tts|image|embed|rerank|omni)/i.test(id)
  if(provider==='xai')return /^grok/.test(id)&&!/(image|imagine|video|vision-only|tts|stt)/i.test(id)
  if(provider==='gemini')return /^(models\/)?gemini/.test(id)&&!/(image|tts|embed|live|audio|veo|imagen)/i.test(id)
  return (!model.architecture?.output_modalities || model.architecture.output_modalities.includes('text')) && !/(embed|rerank)/i.test(id)
}
export async function listModels(provider:Provider,key:string,config:EndpointConfig):Promise<Model[]> {
  const models:Model[]=[],seen=new Set<string>();let after=''
  for(let page=0;page<20;page++){
    const data=await request(provider,key,config,'/models'+(provider==='anthropic'?'?limit=100'+(after?'&after_id='+encodeURIComponent(after):''):''))
    if(!Array.isArray(data.data))throw new ProviderError('Provider model catalog unavailable')
    for(const m0 of data.data){const m={...m0,id:typeof m0.id==='string'?m0.id.replace(/^models\//,''):m0.id};if(typeof m.id==='string'&&m.id.length<=200&&textModel(provider,m.id,m)&&!seen.has(m.id)){seen.add(m.id);models.push({id:m.id,name:m.display_name||m.name||m.id,created:Number(m.created)||Date.parse(m.created_at||'')/1000||0})}}
    if(provider!=='anthropic'||!data.has_more)return models.sort((a,b)=>b.created-a.created||a.id.localeCompare(b.id))
    if(typeof data.last_id!=='string'||data.last_id===after)throw new ProviderError('Invalid provider pagination')
    after=data.last_id
  }
  throw new ProviderError('Provider catalog pagination exceeded')
}
export async function generate(provider:Provider,key:string,config:EndpointConfig,model:string,prompt:string,context?:{instructions:string}){
  const system=context?.instructions??'You are a Studio2U Label World assistant. Give useful reasoning. Do not claim you executed tools, inspected files, registered rights, or submitted releases. No business tools are available in this connection test.'
  let data:any,answer:string
  if(provider==='openai'){
    data=await request(provider,key,config,'/responses',{model,instructions:system,input:prompt,max_output_tokens:2048,store:false})
    answer=(data.output||[]).flatMap((o:any)=>o.type==='message'?(o.content||[]).filter((v:any)=>v.type==='output_text').map((v:any)=>v.text):[]).join('\n')
  }else if(provider==='anthropic'){
    data=await request(provider,key,config,'/messages',{model,system,max_tokens:2048,messages:[{role:'user',content:prompt}]})
    answer=(data.content||[]).filter((b:any)=>b.type==='text').map((b:any)=>b.text).join('\n')
  }else{
    data=await request(provider,key,config,'/chat/completions',{model,max_tokens:2048,messages:[{role:'system',content:system},{role:'user',content:prompt}],...(provider==='openrouter'?{provider:{allow_fallbacks:false}}:{})})
    answer=data.choices?.[0]?.message?.content
  }
  if(typeof answer!=='string'||!answer.trim())throw new ProviderError('Provider returned no text; model may need a larger reasoning budget')
  const usage:Record<string,number>={}
  for(const field of ['input_tokens','output_tokens','prompt_tokens','completion_tokens','total_tokens'])if(Number.isFinite(data.usage?.[field]))usage[field]=data.usage[field]
  return {text:answer.slice(0,64000),usage,model:typeof data.model==='string'?data.model:model}
}

// Desk work (answering chats, filing data) does not need a frontier model. Prices are
// the providers' published standard rates per 1M tokens, checked 2026-10-27; used only
// to estimate spend against the user's cap. Unknown models are estimated conservatively.
export const PRICES: {provider:Provider;match:RegExp;inUsd:number;outUsd:number;note:string}[] = [
  {provider:'openai',match:/^gpt-6-luna/,inUsd:0.10,outUsd:0.50,note:'OpenAI pricing page'},
  {provider:'openai',match:/^gpt-6\.1-terra/,inUsd:1.00,outUsd:5.00,note:'OpenAI pricing page'},
  {provider:'openai',match:/^gpt-6\.1-sol/,inUsd:2.00,outUsd:10.00,note:'OpenAI pricing page'},
  {provider:'openai',match:/^gpt-6-astra/,inUsd:10.00,outUsd:50.00,note:'OpenAI pricing page'},
  {provider:'gemini',match:/flash-lite/,inUsd:0.25,outUsd:1.50,note:'Gemini API pricing page (Flash-Lite tier)'},
  {provider:'gemini',match:/flash/,inUsd:0.75,outUsd:3.75,note:'Gemini API pricing page (Flash tier, through 2026-12-31)'},
  {provider:'xai',match:/^grok-4\.7/,inUsd:2.00,outUsd:6.00,note:'xAI models page'}
]
const FALLBACK={inUsd:3,outUsd:15}
export function priceFor(provider:Provider,model:string){const p=PRICES.find(x=>x.provider===provider&&x.match.test(model));return p?{...p,known:true}:{...FALLBACK,known:false,note:'Unknown model: estimated at a high rate so the cap stays safe'}}
/** Cheapest known text model in the user's catalog, for the "recommended" badge. */
export function recommendCheapest(provider:Provider,models:{id:string}[]){
  const priced=models.map(m=>({id:m.id,p:PRICES.find(x=>x.provider===provider&&x.match.test(m.id))})).filter(x=>x.p) as {id:string;p:typeof PRICES[number]}[]
  priced.sort((a,b)=>(a.p.inUsd+a.p.outUsd*0.3)-(b.p.inUsd+b.p.outUsd*0.3))
  if(priced[0])return {id:priced[0].id,why:`Cheapest known model ($${priced[0].p.inUsd} in / $${priced[0].p.outUsd} out per 1M tokens). Desk work doesn't need more.`}
  const guess=models.find(m=>/(mini|nano|lite|haiku|flash|small|luna|fast)/i.test(m.id))
  return guess?{id:guess.id,why:'Looks like the provider\'s small/fast model. Good for desk work.'}:null
}
export function costMicros(provider:Provider,model:string,usage:Record<string,number>){
  const p=priceFor(provider,model),i=usage.input_tokens??usage.prompt_tokens??0,o=usage.output_tokens??usage.completion_tokens??0
  return {micros:Math.ceil(i*p.inUsd+o*p.outUsd),input:i,output:o,estimated:!p.known}
}
