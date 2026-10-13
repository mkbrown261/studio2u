import {createServer} from 'node:http'
import {readFileSync,mkdirSync,existsSync} from 'node:fs'
import {resolve,extname} from 'node:path'
import {fixture} from '../tests/label-world-api-fixture.mjs'
const {app,env,sqlite}=fixture('/private/tmp/studio2u-reviewer-qa.sqlite')
const {hashPassword}=await import('../src/lib/password.ts')
if(!sqlite.prepare('PRAGMA table_info(users)').all().some(x=>x.name==='password_hash'))sqlite.exec('ALTER TABLE users ADD COLUMN password_hash TEXT; CREATE TABLE rate_limit_attempts(key TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP)')
sqlite.prepare('UPDATE users SET password_hash=? WHERE id=1').run(await hashPassword('fixture-only-password'))
const {writeFile,readFile,mkdir}=await import('node:fs/promises')
const storage='/private/tmp/studio2u-reviewer-r2';await mkdir(storage,{recursive:true})
env.R2={async put(key,bytes){await writeFile(storage+'/'+Buffer.from(key).toString('hex'),new Uint8Array(bytes))},async get(key){try{const b=await readFile(storage+'/'+Buffer.from(key).toString('hex'));return {arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)}}catch{return null}}}
sqlite.prepare('INSERT OR IGNORE INTO lw_labels(id,name) VALUES (?,?)').run('preview-label','Local Test Label')
sqlite.prepare('INSERT OR IGNORE INTO lw_memberships VALUES (?,?,?)').run('preview-label',1,'owner')
createServer(async(req,res)=>{
 const publicPath=resolve('public','.'+decodeURIComponent((req.url||'/').split('?')[0]))
 if(publicPath.startsWith(resolve('public')+'/')&&existsSync(publicPath)&&extname(publicPath)){const types={'.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg'};res.setHeader('Content-Type',types[extname(publicPath)]||'application/octet-stream');res.end(readFileSync(publicPath));return}
 if(req.url==='/label-world.js'){res.setHeader('Content-Type','text/javascript');res.end(readFileSync('public/label-world.js'));return}
 if(req.url==='/preview-login'){res.setHeader('Set-Cookie','studio2u_session=test-session-1; HttpOnly; SameSite=Lax; Path=/');res.writeHead(302,{Location:'/label-world'});res.end();return}
 const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks)
 const result=await app.request('http://127.0.0.1:8791'+req.url,{method:req.method,headers:req.headers,...(body.length?{body}:{})},env)
 res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()))
}).listen(8791,'127.0.0.1',()=>console.log('Local fixture only: http://127.0.0.1:8791/preview-login'))
