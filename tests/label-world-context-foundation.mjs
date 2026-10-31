import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {compile} from '../tools/compile-label-context.mjs'
const manifest=JSON.parse(readFileSync('docs/studio2u-label-world/context/CONTEXT_MANIFEST.json','utf8'))
const result=compile(manifest)
assert.equal(Object.keys(result.skills).length,23)
assert.deepEqual(Object.keys(result.routes),['reviewer','researcher','executive','builder'])
const bad=change=>{const m=structuredClone(manifest);change(m);assert.throws(()=>compile(m))}
bad(m=>m.resources[0].path='../../.env');bad(m=>m.resources[0].path='/tmp/secret');bad(m=>m.resources[0].path='missing.md');bad(m=>m.resources.push(m.resources[0]));bad(m=>m.resources[4].allowedNext.push(m.resources[4].id));bad(m=>m.routes[0].skillId='unknown');bad(m=>m.routes[0].requiredCapabilities=['publish']);bad(m=>m.routes[0].requiredContext=[]);bad(m=>m.resources[0].sourceHash='stale');bad(m=>m.budgets.maxFiles=2)
console.log('PASS context foundation: four routes, unchanged 23 canonical contracts, path confinement, missing files, cycles, duplicate IDs, hashes, policy/capability and file budgets')
