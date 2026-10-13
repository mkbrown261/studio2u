import {Hono} from 'hono'
import {html} from 'hono/html'
import {bodyLimit} from 'hono/body-limit'
import {getSessionUser} from '../../lib/session'
import {mcpScopes,createStudioMcp} from './server'
export const mcpRoutes=new Hono<any>()
const base='/label-world/oauth'
export function randomSecret(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('')}
export async function digest(text:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('')}
export async function challenge(verifier:string){const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')}
const date=(ms:number)=>new Date(Date.now()+ms).toISOString()
function origin(c:any){const url=new URL(c.req.url);if(url.protocol!=='https:'&&!['127.0.0.1','localhost','studio.invalid'].includes(url.hostname))throw Error();return url.origin}
function resource(c:any){return origin(c)+'/label-world/mcp'}
function failure(c:any,error='invalid_request',status=400){return c.json({error},status)}
function recoverAuthorization(c:any){return c.html(html`<!doctype html><html><head><meta charset="utf-8"><title>Reconnect to Studio2U</title></head><body style="background:#080d12;color:white;font:16px system-ui"><main style="max-width:640px;margin:40px auto;padding:24px"><h1>This connection request is no longer active</h1><p>The request may have expired or already finished. This does not mean your Studio2U password is incorrect.</p><p><a style="color:#f4cd74" href="/label-world/login">Sign in to Label World</a> · <a style="color:#f4cd74" href="/label-world">Continue to headquarters</a></p><p>To connect Codex or Claude Code, restart the connection from that client to receive a fresh authorization link. For an existing Codex configuration, run <code>codex mcp login studio2u</code>. In Claude Code, use <code>/mcp</code>.</p></main></body></html>`,400)}
function strictValue(value:any,max=2000){if(typeof value!=='string'||!value.length||value.length>max||/[\r\n\x00]/.test(value))throw Error();return value}
export function validRedirect(uri:string){const u=new URL(uri);return !u.username&&!u.password&&!u.hash&&(u.protocol==='https:'||u.protocol==='http:'&&['127.0.0.1','[::1]','localhost'].includes(u.hostname))}
async function limited(c:any,key:string,max=60){const window=new Date().toISOString().slice(0,16),r=await c.env.DB.prepare('INSERT INTO lw_mcp_limits(key,window,requests) VALUES (?,?,1) ON CONFLICT(key,window) DO UPDATE SET requests=requests+1 WHERE requests<? RETURNING requests').bind(key,window,max).first();return Boolean(r)}
const safe=(fn:any)=>async(c:any)=>{try{return await fn(c)}catch{return failure(c)}}
for(const path of [base+'/*','/label-world/mcp','/.well-known/oauth-protected-resource','/.well-known/oauth-protected-resource/label-world/mcp','/.well-known/oauth-authorization-server']){
mcpRoutes.use(path,bodyLimit({maxSize:65536}))
mcpRoutes.use(path,async(c:any,next:any)=>{c.header('Cache-Control','no-store');c.header('Referrer-Policy','same-origin');c.header('X-Content-Type-Options','nosniff');c.header('Content-Security-Policy',"default-src 'none'; style-src 'self' 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");await next()})
}
mcpRoutes.get('/.well-known/oauth-protected-resource/label-world/mcp',c=>c.json({resource:resource(c),authorization_servers:[origin(c)],scopes_supported:[...mcpScopes],resource_name:'Studio2U Label World read-only connector'}))
mcpRoutes.get('/.well-known/oauth-protected-resource',c=>c.json({resource:resource(c),authorization_servers:[origin(c)],scopes_supported:[...mcpScopes]}))
mcpRoutes.get('/.well-known/oauth-authorization-server',c=>c.json({issuer:origin(c),authorization_endpoint:origin(c)+base+'/authorize',token_endpoint:origin(c)+base+'/token',registration_endpoint:origin(c)+base+'/register',revocation_endpoint:origin(c)+base+'/revoke',response_types_supported:['code'],grant_types_supported:['authorization_code','refresh_token'],token_endpoint_auth_methods_supported:['none'],code_challenge_methods_supported:['S256'],scopes_supported:[...mcpScopes,'offline_access'],authorization_response_iss_parameter_supported:true}))
mcpRoutes.post(base+'/register',safe(async(c:any)=>{
 if(!await limited(c,'register:'+ (c.req.header('CF-Connecting-IP')??'local'),10))return failure(c,'temporarily_unavailable',429)
 const body=await c.req.json(),redirects=body.redirect_uris
 if(body.token_endpoint_auth_method&&body.token_endpoint_auth_method!=='none'||!Array.isArray(redirects)||redirects.length<1||redirects.length>5||redirects.some(r=>typeof r!=='string'||r.length>2000||!validRedirect(r)))return failure(c,'invalid_client_metadata')
 if(body.grant_types?.some((g:string)=>!['authorization_code','refresh_token'].includes(g))||body.response_types?.some((g:string)=>g!=='code'))return failure(c,'invalid_client_metadata')
 const id=randomSecret(),name=typeof body.client_name==='string'?body.client_name.slice(0,100):'External MCP client'
 await c.env.DB.prepare('INSERT INTO lw_mcp_clients(id,name,redirects_json) VALUES (?,?,?)').bind(id,name,JSON.stringify(redirects)).run()
 return c.json({client_id:id,client_name:name,redirect_uris:redirects,token_endpoint_auth_method:'none',grant_types:['authorization_code','refresh_token'],response_types:['code'],client_id_issued_at:Math.floor(Date.now()/1000)},201)
}))
mcpRoutes.get(base+'/authorize',safe(async(c:any)=>{
 const db=c.env.DB;let request:any
 if(c.req.query('request')){
  const id=c.req.query('request'),params=new URL(c.req.url).searchParams
  if(!/^[a-f0-9]{64}$/.test(id)||params.getAll('request').length!==1)return recoverAuthorization(c)
  request=await db.prepare('SELECT * FROM lw_mcp_requests WHERE id=? AND consumed=0 AND expires_at>?').bind(id,date(0)).first()
  if(!request||request.resource!==resource(c))return recoverAuthorization(c)
 }
 else{
  const params=new URL(c.req.url).searchParams;if([...params.keys()].some(k=>params.getAll(k).length!==1))return failure(c)
 const q=c.req.query(),client=await db.prepare('SELECT * FROM lw_mcp_clients WHERE id=?').bind(strictValue(q.client_id,64)).first()
  if(!client||!JSON.parse(client.redirects_json).includes(q.redirect_uri)||q.response_type!=='code'||q.resource!==resource(c)||q.code_challenge_method!=='S256'||!/^[-_a-zA-Z0-9]{43}$/.test(q.code_challenge??''))return failure(c)
  const scopes=(q.scope??mcpScopes.join(' ')).split(' ').filter(Boolean)
  if(!scopes.length||scopes.some((s:string)=>s!=='offline_access'&&!mcpScopes.includes(s as any)))return failure(c,'invalid_scope')
  if(!await limited(c,'authorize:'+(c.req.header('CF-Connecting-IP')??'local'),60))return failure(c,'temporarily_unavailable',429)
  request={id:randomSecret(),client_id:client.id,redirect_uri:q.redirect_uri,resource:q.resource,state:strictValue(q.state,1000),challenge:q.code_challenge,scopes_json:JSON.stringify([...new Set(scopes)])}
  await db.prepare('INSERT INTO lw_mcp_requests(id,client_id,redirect_uri,resource,state,challenge,scopes_json,expires_at) VALUES (?,?,?,?,?,?,?,?)').bind(request.id,request.client_id,request.redirect_uri,request.resource,request.state,request.challenge,request.scopes_json,date(10*60000)).run()
 }
 if(!request||request.resource!==resource(c))return failure(c)
 const user=await getSessionUser(db,c.req.raw)
 if(!user)return c.redirect('/label-world/login?returnTo='+encodeURIComponent(base+'/authorize?request='+request.id))
 if(request.user_id&&request.user_id!==user.id)return failure(c,'access_denied',403)
 const csrf=randomSecret(),claim=await db.prepare('UPDATE lw_mcp_requests SET user_id=?,consent_hash=? WHERE id=? AND (user_id IS NULL OR user_id=?) AND consumed=0').bind(user.id,await digest(csrf),request.id,user.id).run();if(!claim.meta.changes)return failure(c)
 const labels=(await db.prepare('SELECT l.id,l.name,m.role FROM lw_labels l JOIN lw_memberships m ON m.label_id=l.id WHERE m.user_id=? ORDER BY l.name LIMIT 100').bind(user.id).all()).results,client=await db.prepare('SELECT name FROM lw_mcp_clients WHERE id=?').bind(request.client_id).first()
 // Permit the validated OAuth callback after the same-origin consent POST.
 c.header('Content-Security-Policy',"default-src 'none'; style-src 'self' 'unsafe-inline'; form-action 'self' "+new URL(request.redirect_uri).origin+"; frame-ancestors 'none'; base-uri 'none'")
 return c.html(html`<!doctype html><html><head><meta charset="utf-8"><title>Authorize Studio2U connector</title><link rel="stylesheet" href="/label-world-ui.css"></head><body style="background:#080d12;color:white;font:16px system-ui"><main style="max-width:640px;margin:40px auto;padding:24px"><h1>Connect to Studio2U</h1><p>External client: ${client.name} (client name is self-declared).</p><p>Callback: ${request.redirect_uri}</p><p>Signed in as ${user.name}. This grants read-only Studio2U access, not access to your AI account or website subscription inference.</p><form method="post" action="${base}/consent"><input type="hidden" name="request" value="${request.id}"><input type="hidden" name="csrf" value="${csrf}"><h2>Select labels</h2>${labels.map((l:any)=>html`<label style="display:block;padding:8px"><input type="checkbox" name="label" value="${l.id}"> ${l.name} (${l.role})</label>`)}<h2>Requested read scopes</h2>${JSON.parse(request.scopes_json).map((s:string)=>html`<label style="display:block;padding:8px"><input type="checkbox" name="scope" value="${s}" checked> ${s}</label>`)}<p>Private review/research reports and messages remain limited to your own records. You can revoke this connection at any time in AI Connections.</p><button type="submit" name="decision" value="allow">Authorize selected access</button><button type="submit" name="decision" value="deny">Cancel</button></form></main></body></html>`)
}))
mcpRoutes.post(base+'/consent',safe(async(c:any)=>{
 if(c.req.header('Origin')!==origin(c))return failure(c,'access_denied',403)
 const user=await getSessionUser(c.env.DB,c.req.raw);if(!user)return failure(c,'access_denied',401)
 const body=await c.req.parseBody({all:true}),request=await c.env.DB.prepare('SELECT * FROM lw_mcp_requests WHERE id=? AND user_id=? AND consumed=0 AND expires_at>?').bind(body.request,user.id,date(0)).first()
 if(!request||request.resource!==resource(c)||await digest(strictValue(body.csrf,64))!==request.consent_hash)return failure(c,'access_denied',403)
 const values=(v:any)=>v==null?[]:Array.isArray(v)?v:[v],labels=[...new Set(values(body.label))],scopes=[...new Set(values(body.scope))]
 if(body.decision==='allow'){
  if(!labels.length||!scopes.some((s:any)=>mcpScopes.includes(s))||labels.length>100||scopes.some(s=>!JSON.parse(request.scopes_json).includes(s)))return failure(c)
  for(const label of labels)if(!await c.env.DB.prepare('SELECT role FROM lw_memberships WHERE user_id=? AND label_id=?').bind(user.id,label).first())return failure(c,'access_denied',403)
 }
 const code=randomSecret(),grant=randomSecret(),consumed=await c.env.DB.prepare('UPDATE lw_mcp_requests SET consumed=1 WHERE id=? AND consumed=0 RETURNING id').bind(request.id).first();if(!consumed)return failure(c)
 const callback=new URL(request.redirect_uri);callback.searchParams.set('state',request.state);callback.searchParams.set('iss',origin(c))
 if(body.decision!=='allow'){callback.searchParams.set('error','access_denied');return c.redirect(callback.href)}
 await c.env.DB.batch([c.env.DB.prepare('INSERT INTO lw_mcp_grants(id,client_id,user_id,resource,labels_json,scopes_json,expires_at) VALUES (?,?,?,?,?,?,?)').bind(grant,request.client_id,user.id,request.resource,JSON.stringify(labels),JSON.stringify(scopes),date(30*86400000)),c.env.DB.prepare('INSERT INTO lw_mcp_codes(hash,grant_id,redirect_uri,challenge,expires_at) VALUES (?,?,?,?,?)').bind(await digest(code),grant,request.redirect_uri,request.challenge,date(5*60000))])
 callback.searchParams.set('code',code);return c.redirect(callback.href)
}))
mcpRoutes.post(base+'/token',safe(async(c:any)=>{
 if(!await limited(c,'token:'+(c.req.header('CF-Connecting-IP')??'local'),120))return failure(c,'temporarily_unavailable',429)
 const body=await c.req.parseBody({all:true}),db=c.env.DB;if(Object.values(body).some(Array.isArray))return failure(c);if(body.resource!==resource(c)||typeof body.client_id!=='string')return failure(c,'invalid_target')
 let grant:any
 if(body.grant_type==='authorization_code'){
  if(!/^[-._~a-zA-Z0-9]{43,128}$/.test(String(body.code_verifier??'')))return failure(c,'invalid_grant')
  const row=await db.prepare('SELECT c.*,g.client_id,g.resource FROM lw_mcp_codes c JOIN lw_mcp_grants g ON g.id=c.grant_id WHERE c.hash=? AND c.consumed=0 AND c.expires_at>? AND g.revoked_at IS NULL AND g.expires_at>?').bind(await digest(strictValue(body.code,64)),date(0),date(0)).first()
  if(!row||row.client_id!==body.client_id||row.resource!==body.resource||row.redirect_uri!==body.redirect_uri||row.challenge!==await challenge(String(body.code_verifier)))return failure(c,'invalid_grant')
  if(!await db.prepare('UPDATE lw_mcp_codes SET consumed=1 WHERE hash=? AND consumed=0 RETURNING hash').bind(row.hash).first())return failure(c,'invalid_grant')
  grant=await db.prepare('SELECT * FROM lw_mcp_grants WHERE id=?').bind(row.grant_id).first()
 }else if(body.grant_type==='refresh_token'){
  const row=await db.prepare("SELECT t.hash,t.grant_id,t.consumed,g.* FROM lw_mcp_tokens t JOIN lw_mcp_grants g ON g.id=t.grant_id WHERE t.hash=? AND t.kind='refresh' AND t.expires_at>? AND g.expires_at>? AND g.revoked_at IS NULL").bind(await digest(strictValue(body.refresh_token,64)),date(0),date(0)).first()
  if(!row||row.client_id!==body.client_id||row.resource!==body.resource)return failure(c,'invalid_grant')
  if(row.consumed){await db.prepare('UPDATE lw_mcp_grants SET revoked_at=? WHERE id=?').bind(date(0),row.id).run();return failure(c,'invalid_grant')}
  if(!await db.prepare('UPDATE lw_mcp_tokens SET consumed=1 WHERE hash=? AND consumed=0 RETURNING hash').bind(row.hash).first())return failure(c,'invalid_grant')
  grant=row
 }else return failure(c,'unsupported_grant_type')
 if(body.scope&&String(body.scope).split(' ').some(s=>!JSON.parse(grant.scopes_json).includes(s)))return failure(c,'invalid_scope')
 const access=randomSecret(),refresh=randomSecret(),statements=[db.prepare("INSERT INTO lw_mcp_tokens(hash,grant_id,kind,expires_at) VALUES (?,?,'access',?)").bind(await digest(access),grant.id,date(10*60000))],scopes=JSON.parse(grant.scopes_json)
 if(scopes.includes('offline_access'))statements.push(db.prepare("INSERT INTO lw_mcp_tokens(hash,grant_id,kind,expires_at) VALUES (?,?,'refresh',?)").bind(await digest(refresh),grant.id,date(7*86400000)))
 await db.batch(statements)
 return c.json({access_token:access,token_type:'Bearer',expires_in:600,scope:scopes.join(' '),...(scopes.includes('offline_access')?{refresh_token:refresh}:{})})
}))
mcpRoutes.post(base+'/revoke',safe(async(c:any)=>{const body=await c.req.parseBody();if(typeof body.token==='string'&&typeof body.client_id==='string')await c.env.DB.prepare('UPDATE lw_mcp_grants SET revoked_at=? WHERE client_id=? AND id IN (SELECT grant_id FROM lw_mcp_tokens WHERE hash=?)').bind(date(0),body.client_id,await digest(body.token)).run();return c.json({})}))
export async function authenticateMcp(c:any){
 const auth=c.req.header('Authorization')??'';if(!/^Bearer [a-f0-9]{64}$/.test(auth))return null
 return c.env.DB.prepare("SELECT g.*,t.expires_at AS token_expires_at FROM lw_mcp_tokens t JOIN lw_mcp_grants g ON g.id=t.grant_id WHERE t.hash=? AND t.kind='access' AND t.consumed=0 AND t.expires_at>? AND g.expires_at>? AND g.revoked_at IS NULL AND g.resource=?").bind(await digest(auth.slice(7)),date(0),date(0),resource(c)).first()
}
mcpRoutes.all('/label-world/mcp',safe(async(c:any)=>{
 const own=origin(c),source=c.req.header('Origin');if(source&&source!==own)return failure(c,'access_denied',403)
 const grant=await authenticateMcp(c)
 if(!grant){c.header('WWW-Authenticate',`Bearer resource_metadata="${own}/.well-known/oauth-protected-resource/label-world/mcp", scope="labels:read knowledge:read"`);return failure(c,'invalid_token',401)}
 if(!await limited(c,'mcp:'+grant.id,120))return failure(c,'temporarily_unavailable',429)
 const handler=createStudioMcp(c.env.DB,{userId:grant.user_id,grantId:grant.id,labelIds:JSON.parse(grant.labels_json),scopes:JSON.parse(grant.scopes_json)},async()=>Boolean(await authenticateMcp(c)))
 const response=await handler.fetch(c.req.raw);await handler.close();if(response.ok)await c.env.DB.prepare('UPDATE lw_mcp_grants SET last_used_at=? WHERE id=? AND revoked_at IS NULL').bind(date(0),grant.id).run();return response
}))
export function installMcpManagement(app:any){
 const path='/api/label-world/ai-connections'
 app.get(path,async(c:any)=>{c.header('Cache-Control','no-store');return c.json({connections:(await c.env.DB.prepare(`SELECT g.id,c.name,g.labels_json,g.scopes_json,g.expires_at,g.revoked_at,g.last_used_at,g.created_at,(SELECT MAX(expires_at) FROM lw_mcp_tokens WHERE grant_id=g.id AND kind='access' AND consumed=0) AS access_expires_at,(SELECT MAX(expires_at) FROM lw_mcp_tokens WHERE grant_id=g.id AND kind='refresh' AND consumed=0) AS refresh_expires_at,(SELECT COUNT(*) FROM lw_memberships WHERE user_id=g.user_id AND label_id IN (SELECT value FROM json_each(g.labels_json))) AS authorized_labels FROM lw_mcp_grants g JOIN lw_mcp_clients c ON c.id=g.client_id WHERE g.user_id=? ORDER BY g.created_at DESC LIMIT 100`).bind(c.get('lwUser').id).all()).results,websiteInference:'NOT_ENABLED_BY_MCP',endpoint:resource(c)})})
 app.post(path+'/:id/disconnect',async(c:any)=>{if(c.req.header('Origin')!==origin(c))return failure(c,'access_denied',403);await c.env.DB.prepare('UPDATE lw_mcp_grants SET revoked_at=? WHERE id=? AND user_id=?').bind(date(0),c.req.param('id'),c.get('lwUser').id).run();return c.json({status:'DISCONNECTED'})})
}
