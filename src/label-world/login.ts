import {html} from 'hono/html'
import {getSessionUser,createSession,buildSessionCookieHeader} from '../lib/session'
import {findUserByEmail} from '../lib/db-users'
import {verifyPassword} from '../lib/password'
import {isRateLimited,recordAttempt,rateLimitKey} from '../lib/rate-limit'
export function labelReturn(value:unknown):string{
 return typeof value==='string'&&!/[\r\n]/.test(value)&&(/^\/label-world\/oauth\/authorize\?request=[a-f0-9]{64}$/.test(value)||/^\/label-world(?:\/agents\/(?:researcher|reviewer|executive|builder|partner)|\/dashboard|\/inbox)?$/.test(value))?value:'/label-world'
}
function loginPage(c:any,target:string,error=''){
 c.header('Cache-Control','no-store')
 return c.html(html`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in · Studio2U Label World</title><link rel="stylesheet" href="/label-world-ui.css"></head><body style="background:#080d12;color:#e9eef2;font:16px system-ui"><main style="max-width:420px;margin:10vh auto;padding:28px;border:1px solid #3d3524;border-radius:12px"><a href="/label-world" style="color:#e8bf6b">← Headquarters tour</a><h1>Sign in to Label World</h1><p>Use your existing Studio2U account.</p>${error?html`<p role="alert" style="color:#ffb1a7">${error}</p>`:''}<form method="post" action="/label-world/login" class="lw-stacked-form"><input type="hidden" name="returnTo" value="${target}"><label>Email<input type="email" name="email" required autocomplete="username"></label><label>Password<input type="password" name="password" required autocomplete="current-password"></label><button class="lw-button gold" type="submit">Sign in and continue</button></form><p><a href="/signup" style="color:#e8bf6b">Create a Studio2U account</a></p></main></body></html>`)
}
export function installLabelLogin(app:any){
 app.use('/label-world/login',async(c:any,next:any)=>{c.header('Cache-Control','no-store');await next()})
 app.get('/label-world/login',async(c:any)=>{const target=labelReturn(c.req.query('returnTo'));if(await getSessionUser(c.env.DB,c.req.raw))return c.redirect(target);return loginPage(c,target)})
 app.post('/label-world/login',async(c:any)=>{
  const body=await c.req.parseBody();const target=labelReturn(body.returnTo),email=typeof body.email==='string'?body.email.trim().toLowerCase():'',password=typeof body.password==='string'?body.password:''
  const key=rateLimitKey('login',c.req.raw)
  if(await isRateLimited(c.env.DB,key))return loginPage(c,target,'Too many attempts. Please try again in a few minutes.')
  const user=email&&password?await findUserByEmail(c.env.DB,email):null
  if(!user||!(await verifyPassword(password,user.password_hash))){await recordAttempt(c.env.DB,key);return loginPage(c,target,'Incorrect email or password.')}
  const token=await createSession(c.env.DB,user.id);c.header('Set-Cookie',buildSessionCookieHeader(token));return c.redirect(target)
 })
}
