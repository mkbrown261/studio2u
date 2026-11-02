import {readFileSync,writeFileSync} from 'node:fs'
import {Matrix4,Quaternion,Vector3,Box3} from 'three'
const assets='public/label-world/assets/';const blockers=[]
for(const room of ['studio','lobby','conference']){
 const b=readFileSync(assets+room+'.glb');const d=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());const parents=new Map();d.nodes.forEach((n,i)=>(n.children||[]).forEach(c=>parents.set(c,i)));const matrices=new Map()
 function matrix(i){if(matrices.has(i))return matrices.get(i);const n=d.nodes[i];const m=n.matrix?new Matrix4().fromArray(n.matrix):new Matrix4().compose(new Vector3(...(n.translation||[0,0,0])),new Quaternion(...(n.rotation||[0,0,0,1])),new Vector3(...(n.scale||[1,1,1])));if(parents.has(i))m.premultiply(matrix(parents.get(i)));matrices.set(i,m);return m}
 function bounds(i){const n=d.nodes[i],box=new Box3();if(n.mesh!==undefined)for(const p of d.meshes[n.mesh].primitives){const a=d.accessors[p.attributes.POSITION];if(a.min&&a.max)box.union(new Box3(new Vector3(...a.min),new Vector3(...a.max)).applyMatrix4(matrix(i)))}for(const child of n.children||[])box.union(bounds(child));return box}
 d.nodes.forEach((n,i)=>{const name=n.name||'';if(!/^(Production console|RESEARCH desk$|REVIEW desk$|Chair seat|Chair back|Coffee table|Lobby • (emerald sofa|reception stone|reception return|empty shelf)|Conference • (long walnut table|executive chair))/.test(name))return;const box=bounds(i);if(box.isEmpty())return;blockers.push({id:room+'.'+i,source:name,minX:box.min.x,maxX:box.max.x,minZ:box.min.z,maxZ:box.max.z})})
}
writeFileSync('src/client/label-world/colliders.json',JSON.stringify(blockers,null,2)+'\n');console.log('Derived '+blockers.length+' simplified furniture colliders from actual exported bounds')
