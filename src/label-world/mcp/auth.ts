import {Hono} from 'hono'
import {html,raw} from 'hono/html'
import {bodyLimit} from 'hono/body-limit'
import {getSessionUser} from '../../lib/session'
import {mcpScopes,createStudioMcp} from './server'
export const mcpRoutes=new Hono<any>()
const base='/label-world/oauth'
const scopeHelp:Record<string,string>={'releases:write':'create releases and save song details you confirm','submissions:write':'record that you submitted to UnitedMasters/ASCAP/SoundExchange','tasks:write':'claim and finish tasks from your always-on label queue','offline_access':'stay connected (refreshes for up to 30 days) so scheduled agents keep working'}
export function randomSecret(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('')}
export async function digest(text:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('')}
export async function challenge(verifier:string){const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')}
const date=(ms:number)=>new Date(Date.now()+ms).toISOString()
function origin(c:any){const url=new URL(c.req.url);if(url.protocol!=='https:'&&!['127.0.0.1','localhost','studio.invalid'].includes(url.hostname))throw Error();return url.origin}
function resource(c:any){return origin(c)+'/label-world/mcp'}
function failure(c:any,error='invalid_request',status=400){return c.json({error},status)}
function recoverAuthorization(c:any){return c.html(page('Reconnect to Studio2U',html`<div class="badge warn">Link expired</div><h1>This connection request is no longer active</h1><p class="lead">The request may have expired or already finished. This does not mean your Studio2U password is incorrect.</p><div class="box"><b>To connect again</b><p>Restart the connection from your AI app to get a fresh link.</p><p>Codex: run <code>codex mcp login studio2u</code></p><p>Claude Code: type <code>/mcp</code> and choose studio2u</p></div><div class="actions"><a class="btn primary" href="/label-world">Continue to headquarters</a><a class="btn" href="/label-world/login">Sign in to Label World</a></div>`),400)}
const pageCss=`*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(1200px 600px at 50% -10%,#3b1d5e 0%,transparent 60%),radial-gradient(900px 500px at 100% 100%,#14324a 0%,transparent 55%),#07090f;color:#eef0f6;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,sans-serif;display:flex;align-items:flex-start;justify-content:center;padding:32px 16px}
.card{width:100%;max-width:560px;background:rgba(18,20,30,.86);border:1px solid rgba(255,255,255,.09);border-radius:20px;box-shadow:0 30px 80px rgba(0,0,0,.55);padding:28px;backdrop-filter:blur(12px)}
.brand{display:flex;align-items:center;gap:10px;margin-bottom:22px;font-weight:700;letter-spacing:.2px}.brand img{width:30px;height:30px;border-radius:8px}.brand span{color:#f4cd74}
.link{display:flex;align-items:center;justify-content:center;gap:14px;margin:4px 0 18px}.app{width:54px;height:54px;border-radius:14px;display:grid;place-items:center;font-weight:800;font-size:20px;background:linear-gradient(135deg,#2a2f45,#191c2b);border:1px solid rgba(255,255,255,.12)}.app.s2u{background:linear-gradient(135deg,#f4cd74,#c9852b);color:#1b1206}.dots{color:#6d7390;letter-spacing:4px}
h1{font-size:22px;line-height:1.25;margin:0 0 6px;text-align:center}h2{font-size:13px;text-transform:uppercase;letter-spacing:1.2px;color:#9aa0b8;margin:22px 0 10px}
.lead{color:#b9bed2;margin:0 0 6px;text-align:center}.who{text-align:center;color:#8d93ab;font-size:13px;margin-bottom:6px}.who b{color:#eef0f6}
.notice{background:rgba(255,120,90,.12);border:1px solid rgba(255,120,90,.45);color:#ffd2c6;border-radius:12px;padding:12px 14px;margin:14px 0}
.opt{display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);border-radius:12px;margin-bottom:8px;cursor:pointer}.opt:hover{border-color:rgba(244,205,116,.45)}
.opt input[type=checkbox]{width:18px;height:18px;margin-top:2px;accent-color:#f4cd74;flex:none}.opt b{display:block;font-weight:600}.opt small{color:#9aa0b8}.role{float:right;font-size:11px;padding:2px 8px;border-radius:99px;background:rgba(244,205,116,.14);color:#f4cd74;text-transform:capitalize}
.field{display:block;width:100%;padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:#0d1018;color:#fff;font:inherit;margin-top:6px}.field:focus{outline:2px solid #f4cd74;border-color:transparent}
details{border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:4px 14px;background:rgba(255,255,255,.02)}summary{cursor:pointer;padding:10px 0;color:#c9cde0;font-weight:600}
.box{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px 14px;margin:14px 0;color:#b9bed2;font-size:13.5px}.box p{margin:6px 0}
.fine{color:#7f859c;font-size:12.5px;margin-top:16px}.fine code,.box code{background:#0d1018;padding:2px 6px;border-radius:6px;color:#f4cd74;word-break:break-all}
.actions{display:flex;gap:10px;margin-top:20px}.btn{flex:1;text-align:center;padding:13px 16px;border-radius:12px;border:1px solid rgba(255,255,255,.16);background:transparent;color:#eef0f6;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer;text-decoration:none}.btn.primary{border:0;background:linear-gradient(135deg,#f4cd74,#d9963a);color:#1b1206;flex:2}.btn:hover{filter:brightness(1.08)}
.badge{display:inline-block;margin:0 auto 10px;padding:3px 10px;border-radius:99px;font-size:12px;background:rgba(120,220,160,.14);color:#8fe3b3}.badge.warn{background:rgba(255,180,90,.14);color:#ffc98a}
@media(max-width:480px){.card{padding:20px;border-radius:16px}.actions{flex-direction:column-reverse}}`
function page(title:string,body:any){return html`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><link rel="icon" href="/static/brand/favicon-32.png"><style>${raw(pageCss)}</style></head><body><main class="card"><div class="brand"><img src="/static/brand/favicon-48.png" alt="">Studio2U <span>Label World</span></div>${body}</main></body></html>`}
const scopeNames:Record<string,[string,string]>={'labels:read':['See your labels','Label names and your role'],'releases:read':['See releases','Songs, credits and release details'],'reviews:read':['See review reports','Your private review results'],'research:read':['See research reports','Your private research results'],'messages:read':['See label messages','Messages in your label workspace'],'tasks:read':['See the task queue','What your label agents are working on'],'knowledge:read':['Read the label knowledge base','Saved guides and notes'],'releases:write':['Fill in release details','Create releases and save song info you confirm'],'submissions:write':['Record submissions','Log the UnitedMasters, ASCAP and SoundExchange submissions you make'],'tasks:write':['Work the task queue','Claim and finish tasks from your always-on label queue'],'offline_access':['Stay connected','Keep working for up to 30 days, even with your laptop closed']}
const notices:Record<string,string>={label:'Pick at least one label, or type a name to create your first label.',scope:'Keep at least one permission checked.',name:'Label names must be 1–100 characters.'}
function strictValue(value:any,max=2000){if(typeof value!=='string'||!value.length||value.length>max||/[\r\n\x00]/.test(value))throw Error();return value}
const loopbackHosts=['127.0.0.1','[::1]','localhost']
// RFC 8252 §7.3: native apps pick a fresh loopback port each login, so match loopback redirects on scheme+host+path and ignore the port.
export function redirectAllowed(registered:string[],uri:unknown){
 if(typeof uri!=='string'||uri.length>2000)return false
 if(registered.includes(uri))return true
 let u:URL;try{u=new URL(uri)}catch{return false}
 if(u.protocol!=='http:'||!loopbackHosts.includes(u.hostname)||u.username||u.password||u.hash)return false
 return registered.some(r=>{try{const x=new URL(r);return x.protocol==='http:'&&x.hostname===u.hostname&&x.pathname===u.pathname&&x.search===u.search}catch{return false}})
}
export function validRedirect(uri:string){const u=new URL(uri);return !u.username&&!u.password&&!u.hash&&(u.protocol==='https:'||u.protocol==='http:'&&['127.0.0.1','[::1]','localhost'].includes(u.hostname))}
async function limited(c:any,key:string,max=60){const window=new Date().toISOString().slice(0,16),r=await c.env.DB.prepare('INSERT INTO lw_mcp_limits(key,window,requests) VALUES (?,?,1) ON CONFLICT(key,window) DO UPDATE SET requests=requests+1 WHERE requests<? RETURNING requests').bind(key,window,max).first();return Boolean(r)}
const safe=(fn:any)=>async(c:any)=>{try{return await fn(c)}catch{return failure(c)}}
for(const path of [base+'/*','/label-world/mcp','/.well-known/oauth-protected-resource','/.well-known/oauth-protected-resource/label-world/mcp','/.well-known/oauth-authorization-server']){
mcpRoutes.use(path,bodyLimit({maxSize:65536}))
mcpRoutes.use(path,async(c:any,next:any)=>{c.header('Cache-Control','no-store');c.header('Referrer-Policy','same-origin');c.header('X-Content-Type-Options','nosniff');c.header('Content-Security-Policy',"default-src 'none'; img-src 'self'; style-src 'self' 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");await next()})
}
mcpRoutes.get('/.well-known/oauth-protected-resource/label-world/mcp',c=>c.json({resource:resource(c),authorization_servers:[origin(c)],scopes_supported:[...mcpScopes],resource_name:'Studio2U Label World connector'}))
mcpRoutes.get('/.well-known/oauth-protected-resource',c=>c.json({resource:resource(c),authorization_servers:[origin(c)],scopes_supported:[...mcpScopes]}))
mcpRoutes.get('/.well-known/oauth-authorization-server',c=>c.json({issuer:origin(c),authorization_endpoint:origin(c)+base+'/authorize',token_endpoint:origin(c)+base+'/token',registration_endpoint:origin(c)+base+'/register',revocation_endpoint:origin(c)+base+'/revoke',response_types_supported:['code'],grant_types_supported:['authorization_code','refresh_token'],token_endpoint_auth_methods_supported:['none'],code_challenge_methods_supported:['S256'],scopes_supported:[...mcpScopes,'offline_access']}))
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
  if(!client||!redirectAllowed(JSON.parse(client.redirects_json),q.redirect_uri)||q.response_type!=='code'||q.resource!==resource(c)||q.code_challenge_method!=='S256'||!/^[-_a-zA-Z0-9]{43}$/.test(q.code_challenge??''))return failure(c)
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
 c.header('Content-Security-Policy',"default-src 'none'; img-src 'self'; style-src 'self' 'unsafe-inline'; form-action 'self' "+new URL(request.redirect_uri).origin+"; frame-ancestors 'none'; base-uri 'none'")
 const scopes=JSON.parse(request.scopes_json) as string[],notice=notices[c.req.query('notice')??'']
 return c.html(page('Connect '+client.name+' to Studio2U',html`<div class="link"><div class="app">${String(client.name).trim().charAt(0).toUpperCase()||'?'}</div><div class="dots">• • •</div><div class="app s2u">S2</div></div>
<h1>Connect ${client.name} to your label</h1><p class="lead">${client.name} wants to work inside Studio2U Label World for you.</p><p class="who">Signed in as <b>${user.name}</b></p>
${notice?html`<div class="notice">${notice}</div>`:''}
<form method="post" action="${base}/consent"><input type="hidden" name="request" value="${request.id}"><input type="hidden" name="csrf" value="${csrf}">
<h2>${labels.length?'Which labels?':'Create your label'}</h2>
${labels.length?labels.map((l:any)=>html`<label class="opt"><input type="checkbox" name="label" value="${l.id}" ${labels.length===1?'checked':''}><span style="flex:1"><span class="role">${l.role}</span><b>${l.name}</b></span></label>`):html`<p style="margin:0;color:#b9bed2">You don't have a label yet. Name it and we'll create it as you connect. You can rename it later.</p><input class="field" name="new_label" maxlength="100" placeholder="e.g. Midnight Records" required autofocus>`}
<h2>What it can do</h2>
${scopes.map((s:string)=>{const [t,d]=scopeNames[s]??[s,scopeHelp[s]??''];return html`<label class="opt"><input type="checkbox" name="scope" value="${s}" checked><span><b>${t}</b><small>${d}</small></span></label>`})}
<div class="box">🔒 It never sees your passwords, and <b>you always press Submit</b> on official sites yourself. Private reports and messages stay limited to your own records. Disconnect any time in <b>AI Connections</b>.</div>
<div class="actions"><button class="btn" type="submit" name="decision" value="deny" formnovalidate>Cancel</button><button class="btn primary" type="submit" name="decision" value="allow">Authorize</button></div>
<p class="fine">${client.name} is the name the app gave itself. After you authorize, you'll go back to <code>${new URL(request.redirect_uri).origin}</code>.</p></form>`))
}))
mcpRoutes.post(base+'/consent',safe(async(c:any)=>{
 if(c.req.header('Origin')!==origin(c))return failure(c,'access_denied',403)
 const user=await getSessionUser(c.env.DB,c.req.raw);if(!user)return failure(c,'access_denied',401)
 const body=await c.req.parseBody({all:true}),request=await c.env.DB.prepare('SELECT * FROM lw_mcp_requests WHERE id=? AND user_id=? AND consumed=0 AND expires_at>?').bind(body.request,user.id,date(0)).first()
 if(!request||request.resource!==resource(c)||await digest(strictValue(body.csrf,64))!==request.consent_hash)return failure(c,'access_denied',403)
 const values=(v:any)=>v==null?[]:Array.isArray(v)?v:[v],labels=[...new Set(values(body.label))],scopes=[...new Set(values(body.scope))]
 if(body.decision==='allow'){
  const retry=(n:string)=>c.redirect(base+'/authorize?request='+request.id+'&notice='+n,303)
  if(labels.length>100||scopes.some(s=>!JSON.parse(request.scopes_json).includes(s)))return failure(c)
  if(!scopes.some((s:any)=>mcpScopes.includes(s)))return retry('scope')
  for(const label of labels)if(!await c.env.DB.prepare('SELECT role FROM lw_memberships WHERE user_id=? AND label_id=?').bind(user.id,label).first())return failure(c,'access_denied',403)
  if(!labels.length){
   const name=typeof body.new_label==='string'?body.new_label.trim():''
   if(!name)return retry('label')
   if(name.length>100||/[\x00-\x1f]/.test(name))return retry('name')
   const id=crypto.randomUUID()
   await c.env.DB.batch([c.env.DB.prepare('INSERT INTO lw_labels(id,name) VALUES (?,?)').bind(id,name),c.env.DB.prepare("INSERT INTO lw_memberships(label_id,user_id,role) VALUES (?,?,'owner')").bind(id,user.id)])
   labels.push(id)
  }
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
 if(!grant){c.header('WWW-Authenticate',`Bearer resource_metadata="${own}/.well-known/oauth-protected-resource/label-world/mcp", scope="${[...mcpScopes,'offline_access'].join(' ')}"`);return failure(c,'invalid_token',401)}
 if(!await limited(c,'mcp:'+grant.id,120))return failure(c,'temporarily_unavailable',429)
 const client=await c.env.DB.prepare('SELECT name FROM lw_mcp_clients WHERE id=?').bind(grant.client_id).first()
 const handler=createStudioMcp(c.env.DB,{userId:grant.user_id,grantId:grant.id,labelIds:JSON.parse(grant.labels_json),scopes:JSON.parse(grant.scopes_json),clientName:client?.name},async()=>Boolean(await authenticateMcp(c)))
 const response=await handler.fetch(c.req.raw);await handler.close();if(response.ok)await c.env.DB.prepare('UPDATE lw_mcp_grants SET last_used_at=? WHERE id=? AND revoked_at IS NULL').bind(date(0),grant.id).run();return response
}))
export function installMcpManagement(app:any){
 const path='/api/label-world/ai-connections'
 app.get(path,async(c:any)=>{c.header('Cache-Control','no-store');return c.json({connections:(await c.env.DB.prepare(`SELECT g.id,c.name,g.labels_json,g.scopes_json,g.expires_at,g.revoked_at,g.last_used_at,g.created_at,(SELECT MAX(expires_at) FROM lw_mcp_tokens WHERE grant_id=g.id AND kind='access' AND consumed=0) AS access_expires_at,(SELECT MAX(expires_at) FROM lw_mcp_tokens WHERE grant_id=g.id AND kind='refresh' AND consumed=0) AS refresh_expires_at,(SELECT COUNT(*) FROM lw_memberships WHERE user_id=g.user_id AND label_id IN (SELECT value FROM json_each(g.labels_json))) AS authorized_labels FROM lw_mcp_grants g JOIN lw_mcp_clients c ON c.id=g.client_id WHERE g.user_id=? ORDER BY g.created_at DESC LIMIT 100`).bind(c.get('lwUser').id).all()).results,websiteInference:'NOT_ENABLED_BY_MCP',endpoint:resource(c)})})
 app.post(path+'/:id/disconnect',async(c:any)=>{if(c.req.header('Origin')!==origin(c))return failure(c,'access_denied',403);await c.env.DB.prepare('UPDATE lw_mcp_grants SET revoked_at=? WHERE id=? AND user_id=?').bind(date(0),c.req.param('id'),c.get('lwUser').id).run();return c.json({status:'DISCONNECTED'})})
}
