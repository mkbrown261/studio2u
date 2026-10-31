import assert from 'node:assert/strict'
const {walkable}=await import('../src/client/label-world/navigation.ts')
const closed={studio:false,conference:false},open={studio:true,conference:true}
assert.ok(walkable(0,7,closed));assert.ok(walkable(0,0,closed));assert.ok(walkable(-7,7,closed))
assert.ok(!walkable(2.25,3.5,closed));assert.ok(walkable(2.25,3.5,open));assert.ok(!walkable(0,3.5,open))
assert.ok(!walkable(-4,5.25,closed));assert.ok(walkable(-4,5.25,open));assert.ok(!walkable(-4,7,open))
assert.ok(!walkable(-7,2,open));assert.ok(!walkable(12,7,open))
console.log('PASS: three-room bounds; studio/lobby and lobby/conference door thresholds; no conference/studio passage')
