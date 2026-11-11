import {readFileSync,readdirSync} from 'node:fs'
import assert from 'node:assert/strict'
const phrase='Canonical contract (specification, not executable capability)'
assert.ok(readFileSync('dist/_worker.js','utf8').includes(phrase))
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(dir+'/'+e.name):[dir+'/'+e.name])}
for(const file of files('dist').filter(p=>p.endsWith('.js')&&!p.includes('_worker.js')))assert.ok(!readFileSync(file,'utf8').includes(phrase),file+' exposed runtime instructions')
console.log('PASS context bundle: compiled instructions present only in server Worker, absent from public JavaScript; no runtime filesystem imports')
