import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {fixture} from './label-world-api-fixture.mjs'
const {env}=fixture();const {default:worker}=await import('../dist/_worker.js')
const scene=await worker.fetch(new Request('https://studio2u.pages.dev/label-world'),env);assert.equal(scene.status,200);const policy=scene.headers.get('content-security-policy');assert.match(policy,/connect-src 'self' blob:/);assert.match(policy,/img-src 'self' data: blob:/);assert.ok(!policy.includes("'unsafe-eval'"));assert.equal(scene.headers.get('cache-control'),'no-store')
const legacy=await worker.fetch(new Request('https://studio2u.pages.dev/login'),env);assert.equal(legacy.status,200);assert.ok(!legacy.headers.get('content-security-policy').includes('blob:'));assert.match(legacy.headers.get('content-security-policy'),/https:\/\/api.stripe.com/)
const api=await worker.fetch(new Request('https://studio2u.pages.dev/api/label-world/labels'),env);assert.equal(api.status,401)
console.log('PASS: built production worker preserves scoped texture CSP after global security middleware; original login policy unchanged; anonymous private API denied')

const routes=JSON.parse(readFileSync('dist/_routes.json'));assert.deepEqual(routes,JSON.parse(readFileSync('public/_routes.json')))
for(const url of ['/label-world/app/main.js','/label-world/assets/studio.glb','/label-world-ui.css','/label-world-hq.css']){assert.ok(routes.exclude.some(pattern=>pattern.endsWith('*')?url.startsWith(pattern.slice(0,-1)):url===pattern));assert.ok(readFileSync('dist'+url).length>0)}
for(const url of ['/label-world','/label-world/login','/label-world/agents/researcher','/api/label-world/labels'])assert.ok(!routes.exclude.some(pattern=>pattern.endsWith('*')?url.startsWith(pattern.slice(0,-1)):url===pattern))
console.log('PASS: Pages serves all scene JS/CSS/GLBs statically while authenticated HTML/APIs remain routed through worker')
