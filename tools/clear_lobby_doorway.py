"""Edit only the preserved recovery copy; public GLB patch retains all baked textures."""
import bpy,json,hashlib,struct
from pathlib import Path
root=Path('/Users/masonbrown/Documents/New project/studio2u')
source=root/'assets/blender/export_copies/Headquarters_Recovery_20261012.blend'
out=root/'assets/blender/export_copies/Headquarters_Doorway_Clearance_20261012.blend'
bpy.ops.wm.open_mainfile(filepath=str(source))
names=[]
for o in bpy.data.objects:
 if o.name.startswith('Lobby') and 'sofa' in o.name.lower():
  o.location.x-=1.2;names.append(o.name)
assert len(names)==12, names
bpy.ops.wm.save_as_mainfile(filepath=str(out),compress=True)
p=root/'public/label-world/assets/lobby.glb';b=p.read_bytes();size=struct.unpack_from('<I',b,12)[0];d=json.loads(b[20:20+size]);changed=[]
for n in d['nodes']:
 if n.get('name') in names:
  n['translation'][0]-=1.2;changed.append(n['name'])
assert len(changed)==12
j=json.dumps(d,separators=(',',':')).encode();j+=b' '*((-len(j))%4);chunks=struct.pack('<II',len(j),0x4e4f534a)+j+b[20+size:];p.write_bytes(struct.pack('<III',0x46546c67,2,12+len(chunks))+chunks)
m=root/'public/label-world/assets/export-inventory.json';manifest=json.loads(m.read_text());manifest['doorway_clearance']={'source_copy':str(out),'source_sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'delta_x':-1.2,'objects':changed,'lobby_sha256':hashlib.sha256(p.read_bytes()).hexdigest()};manifest['exports']['lobby']['bytes']=p.stat().st_size;manifest['exports']['lobby']['sha256']=hashlib.sha256(p.read_bytes()).hexdigest();m.write_text(json.dumps(manifest,indent=2))
print('PASS: moved 12 parts of both seats left 1.2m; original source preserved')
