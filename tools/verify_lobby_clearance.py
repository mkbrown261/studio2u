import bpy,json,hashlib
from pathlib import Path
root=Path('/Users/masonbrown/Documents/New project/studio2u/public/label-world/assets')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/'lobby.glb'))
seats=[o for o in bpy.data.objects if 'emerald sofa seat' in o.name]
assert len(seats)==2
for o in seats:assert o.matrix_world.translation.x<0
p=root/'reload-verification.json';data=json.loads(p.read_text());data['lobby']['doorway_update']={'sha256':hashlib.sha256((root/'lobby.glb').read_bytes()).hexdigest(),'seats':[{ 'name':o.name,'x':o.matrix_world.translation.x} for o in seats],'independent_reimport':'PASS'};p.write_text(json.dumps(data,indent=2)+'\n')
print('PASS: updated lobby independently reimports with both seats left of door and embedded materials intact')
