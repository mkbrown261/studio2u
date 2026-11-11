import assert from 'node:assert/strict'
import { canTransition, releaseInput } from '../src/label-world/contracts.ts'
assert.equal(canTransition('QUEUED','COMPLETED'),false)
assert.equal(canTransition('COMPLETED','RUNNING'),false)
assert.equal(canTransition('WAITING_FOR_APPROVAL','RUNNING'),false)
assert.equal(canTransition('WAITING_FOR_APPROVAL','QUEUED'),true)
assert.equal(canTransition('RUNNING','WAITING_FOR_INPUT'),true)
assert.throws(()=>releaseInput({artist:' ',title:'Song'}))
assert.throws(()=>releaseInput({artist:'Artist',title:'Song',releaseType:'fake'}))
assert.deepEqual(releaseInput({artist:' Artist ',title:'Song'}),{artist:'Artist',title:'Song',releaseType:'single'})
console.log('PASS: terminal states, approval resumption and release validation')
