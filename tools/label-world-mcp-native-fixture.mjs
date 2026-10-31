// Test-only loopback service. Never deploy this file.
import {createServer} from 'node:http'
import {mkdtempSync,writeFileSync,readFileSync,existsSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join,resolve,sep} from 'node:path'
import {Hono} from 'hono'
import {fixture} from '../tests/label-world-api-fixture.mjs'
import {wav,png} from '../tests/label-world-reviewer-inspect.mjs'
const {mcpRoutes}=await import('../src/label-world/mcp/auth.ts'),{hashPassword}=await import('../src/lib/password.ts')
const previous=process.env.STUDIO_MCP_QA_REUSE?JSON.parse(readFileSync('/private/tmp/studio2u-mcp-native-credentials.json')):null
const dir=previous?.fixtureDirectory??mkdtempSync(join(tmpdir(),'studio2u-mcp-native-')),f=fixture(join(dir,'qa.sqlite')),app=new Hono();app.route('/',mcpRoutes);app.route('/',f.app)
const root='http://localhost:8795'
if(!previous){
f.sqlite.exec('ALTER TABLE users ADD COLUMN password_hash TEXT; CREATE TABLE rate_limit_attempts(key TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP)')
const password=crypto.randomUUID()+'-'+crypto.randomUUID();f.sqlite.prepare('UPDATE users SET password_hash=? WHERE id=1').run(await hashPassword(password))
const objects=new Map();f.env.R2={async put(key,bytes){objects.set(key,new Uint8Array(bytes))},async get(key){const bytes=objects.get(key);return bytes?{arrayBuffer:async()=>bytes.slice().buffer}:null}}
const headers={Cookie:'studio2u_session=test-session-1',Origin:root,'Content-Type':'application/json'}
const create=async(path,body)=>{const response=await app.request(root+'/api/label-world/'+path,{method:'POST',headers,body:JSON.stringify(body)},f.env);if(!response.ok)throw Error('Fixture request failed');return response.json()}
const label=await create('labels',{name:'Native MCP isolated QA'}),release=await create('labels/'+label.id+'/releases',{title:'Native MCP test release',artist:'Synthetic QA Artist',releaseType:'single',releaseMode:'FAST_RELEASE'})
for(const [kind,bytes] of [['master',wav],['artwork',png(64)]])await app.request(root+'/api/label-world/labels/'+label.id+'/releases/'+release.id+'/assets?kind='+kind,{method:'POST',headers:{Cookie:headers.Cookie,Origin:root},body:bytes},f.env)
const review=await create('labels/'+label.id+'/releases/'+release.id+'/reviews',{requestId:'native-mcp-review-fixture-001'})
const csv='artist,track,platform,metric,value,period,source_url\nSynthetic Artist,Native test,other,test_count,17,2026-10,https://example.invalid/qa\n',preview=await create('labels/'+label.id+'/research/imports/preview',{adapter:'normalized-v1',csv});await create('labels/'+label.id+'/research/imports/commit',{requestId:'native-mcp-source-fixture-001',adapter:'normalized-v1',csv,previewDigest:preview.digest,authorized:true})
writeFileSync('/private/tmp/studio2u-mcp-native-credentials.json',JSON.stringify({email:'test1@example.invalid',password,labelId:label.id,releaseId:release.id,reviewId:review.reviewId,fixtureDirectory:dir}),{mode:0o600})
}
const server=createServer(async(req,res)=>{try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const request=new Request(root+req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});let response
 if(req.url.startsWith('/label-world-ui.css'))response=new Response(readFileSync('public/label-world-ui.css'),{headers:{'Content-Type':'text/css'}})
 else if(req.url.startsWith('/label-world/app/')||req.url.startsWith('/label-world/assets/')){const file=resolve('dist','.'+new URL(root+req.url).pathname);if(!file.startsWith(resolve('dist')+sep)||!existsSync(file))response=new Response('Not found',{status:404});else response=new Response(readFileSync(file),{headers:{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'application/octet-stream'}})}
 else response=await app.fetch(request,f.env)
 console.log(req.method,new URL(root+req.url).pathname,response.status,'origin',req.headers.origin??'absent','cookiePresent',Boolean(req.headers.cookie))
 res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()))
}catch{res.writeHead(500);res.end('QA fixture request failed')}})
server.listen(8795,'127.0.0.1',()=>console.log('Native MCP isolated fixture ready on localhost:8795; credentials stored privately, no model key.'))
