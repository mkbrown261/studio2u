import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {canOccupy,moveWithCollisions} from '../src/client/label-world/navigation.ts'
import {interactables,focusedTarget,inReach} from '../src/client/label-world/interactions.ts'
const blockers=JSON.parse(readFileSync('src/client/label-world/colliders.json'));const closed={studio:false,conference:false},open={studio:true,conference:true}
assert.equal(canOccupy(0,.25,open,blockers),false,'mixing desk blocks walking');assert.equal(canOccupy(-7,7,open,blockers),false,'conference table blocks walking');assert.equal(canOccupy(-1.9,4.15,open,blockers),false,'moved sofa blocks walking')
assert.equal(canOccupy(2.25,4.3,open,blockers),true,'sofas clear door approach');assert.equal(canOccupy(2.25,3.5,open,blockers),true);assert.equal(canOccupy(2.25,3.5,closed,blockers),false)
let p=moveWithCollisions(2.25,4.5,0,-2,open,blockers);assert.ok(p[1]<3.2,'walk through open studio door');p=moveWithCollisions(2.25,4.5,0,-2,closed,blockers);assert.ok(p[1]>3.7,'closed door blocks sprint/tunneling')
p=moveWithCollisions(1,7,0,-8,open,blockers);assert.ok(p[1]>3.7,'cannot tunnel through wall');p=moveWithCollisions(-3.4,5.25,-1.5,0,open,blockers);assert.ok(p[0]<-4.3,'conference has walkable door seam')
assert.equal(focusedTarget(2.25,4.8,0,-1)?.id,'door.studio');assert.equal(focusedTarget(-2.7,2.7,0,-1)?.agent,'researcher');assert.equal(focusedTarget(2.7,2.7,0,-1)?.agent,'reviewer');assert.equal(inReach(interactables[2],-2.7,4),false,'wall excludes agent prompt in lobby');assert.equal(focusedTarget(0,10,0,-1),null)
assert.equal(interactables.find(t=>t.id==='station.builder').agent,'builder');assert.equal(interactables.find(t=>t.id==='station.executive').agent,'executive')
for(const [x,z] of [[2.8,10.3],[0,2.7],[-4.6,5.25]])assert.ok(canOccupy(x,z,closed,blockers),'safe spawn')
console.log('PASS: furniture/wall/closed-door collisions, sprint tunneling, moved-sofa clearance, open-door crossings, safe spawns, registry proximity and role targets')

const {availableAnimation}=await import('../src/client/label-world/animation-registry.ts')
assert.deepEqual(availableAnimation('researcher','GREETING',['Animation']),{clip:'Animation',paused:false,missing:true})
assert.deepEqual(availableAnimation('reviewer','IDLE',['Animation']),{clip:'Animation',paused:true,missing:true})
assert.deepEqual(availableAnimation('reviewer','WORKING',[]),{clip:null,paused:false,missing:true})
assert.equal(availableAnimation('executive','IDLE',[]).clip,null)
console.log('PASS: actual-clip registry and nonblocking missing animation/model fallbacks')
