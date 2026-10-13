import assert from 'node:assert/strict'
import {fixture} from './label-world-api-fixture.mjs'
const {labelReturn}=await import('../src/label-world/login.ts')
const {app,env,sqlite}=fixture()
for(const p of ['/label-world','/label-world/agents/researcher','/label-world/agents/reviewer','/label-world/agents/executive','/label-world/agents/builder']){
 const r=await app.request('http://localhost'+p,{headers:p==='/label-world'?{}:{Cookie:'studio2u_session=test-session-1'}},env);assert.equal(r.status,200);const text=await r.text();assert.ok(text.includes('/label-world/app/main.js'));assert.ok(!text.includes('test1@example.invalid'))
}
for(const id of ['researcher','reviewer','executive','builder']){const r=await app.request('http://localhost/label-world/agents/'+id,{},env);assert.equal(r.status,302);assert.equal(r.headers.get('location'),'/label-world/login?returnTo='+encodeURIComponent('/label-world/agents/'+id))}
const unknown=await app.request('http://localhost/label-world/agents/fake',{},env);assert.equal(unknown.status,404)
for(const bad of ['https://evil.invalid','//evil.invalid','/label-world/../admin','/label-world/agents/fake','/label-world?return=https://evil.invalid'])assert.equal(labelReturn(bad),'/label-world')
const session=await app.request('http://localhost/label-world/login?returnTo=%2Flabel-world%2Fagents%2Freviewer',{headers:{Cookie:'studio2u_session=test-session-1'}},env);assert.equal(session.headers.get('location'),'/label-world/agents/reviewer')
sqlite.prepare('UPDATE users SET name=? WHERE id=1').run('</script><script>alert(1)</script>');const page=await (await app.request('http://localhost/label-world',{headers:{Cookie:'studio2u_session=test-session-1'}},env)).text();assert.ok(!page.includes('<script>alert'));const bootstrap=page.match(/id="label-world-bootstrap" type="application\/json">(.*?)<\/script>/)[1];assert.equal(JSON.parse(bootstrap).userName,'</script><script>alert(1)</script>')
console.log('PASS: public sanitized bootstrap, all four authenticated direct routes, scoped sign-in return, invalid role 404, redirect allowlist, script-safe user name')

const {hashPassword}=await import('../src/lib/password.ts')
sqlite.exec('ALTER TABLE users ADD COLUMN password_hash TEXT; CREATE TABLE rate_limit_attempts(key TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP)')
sqlite.prepare('UPDATE users SET password_hash=? WHERE id=1').run(await hashPassword('fixture-only-password'))
let login=await app.request('http://localhost/label-world/login',{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({email:'test1@example.invalid',password:'fixture-only-password',returnTo:'/label-world/agents/reviewer'})},env)
assert.equal(login.status,302);assert.equal(login.headers.get('location'),'/label-world/agents/reviewer');assert.match(login.headers.get('set-cookie'),/studio2u_session=.*HttpOnly; Secure; SameSite=Lax/)
login=await app.request('http://localhost/label-world/login',{method:'POST',headers:{Origin:'http://localhost','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({email:'test1@example.invalid',password:'wrong',returnTo:'/label-world/agents/reviewer'})},env);assert.ok((await login.text()).includes('Incorrect email or password'));assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM rate_limit_attempts').get().n,1)
console.log('PASS: real password verification, shared secure session cookie, selected-workspace redirect and failed-login rate limiting using synthetic account')
