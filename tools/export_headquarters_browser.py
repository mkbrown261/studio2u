import bpy,json,os,hashlib,time
from pathlib import Path
OUT=Path('/Users/masonbrown/Documents/New project/studio2u/public/label-world/assets');OUT.mkdir(parents=True,exist_ok=True)
source=bpy.data.filepath
summary={'source':source,'source_sha256':hashlib.sha256(Path(source).read_bytes()).hexdigest(),'objects':len(bpy.data.objects),'materials':[], 'doors':[], 'lights':[], 'exports':{}}
for o in bpy.data.objects:
 if o.type=='LIGHT':summary['lights'].append({'name':o.name,'position':list(o.matrix_world.translation),'type':o.data.type,'color':list(o.data.color),'energy':o.data.energy})
 if 'door' in o.name.lower():summary['doors'].append({'name':o.name,'position':list(o.matrix_world.translation),'dimensions':list(o.dimensions)})
print('SOURCE_INVENTORY',json.dumps({'collections':[c.name for c in bpy.data.collections],'materials':len(bpy.data.materials)}),flush=True)
# Work only on the saved recovery copy. Resize packed source images for browser delivery.
for im in bpy.data.images:
 if im.type=='IMAGE' and im.size[0]>2048:
  im.scale(2048,2048); im.pack()
# Convert evaluated curves/text before selection exports; rigged meshes retain their modifiers.
for o in list(bpy.data.objects):
 if o.type in {'CURVE','FONT','SURFACE'}:
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
  try:bpy.ops.object.convert(target='MESH')
  except Exception as e:print('CONVERT',o.name,str(e),flush=True)
# Bake procedural base colors and roughness into UV texture maps using emission.
bpy.context.scene.render.engine='CYCLES';bpy.context.scene.cycles.samples=1
bpy.context.scene.render.bake.use_clear=True
for mat in list(bpy.data.materials):
 if not mat.use_nodes:continue
 nodes=mat.node_tree.nodes; bs=next((n for n in nodes if n.type=='BSDF_PRINCIPLED'),None)
 if not bs:continue
 users=[o for o in bpy.data.objects if o.type=='MESH' and any(s.material==mat for s in o.material_slots)]
 procedural=any(n.type in {'TEX_NOISE','TEX_VORONOI','TEX_WAVE','TEX_MUSGRAVE','TEX_GRADIENT','VALTORGB'} for n in nodes)
 rec={'name':mat.name,'procedural':procedural,'users':len(users)}
 if not procedural or not users:summary['materials'].append(rec);continue
 # UVs on export copy only.
 for o in users:
  if not o.data.uv_layers:
   bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
   bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.02);bpy.ops.object.mode_set(mode='OBJECT')
 # One shared atlas bake uses all objects in material; overlaps retain consistent procedural approximations.
 size=1024 if any(x in mat.name.lower() for x in ['stone','floor','ocean','walnut']) else 512
 output=next((n for n in nodes if n.type=='OUTPUT_MATERIAL'),None)
 if not output:continue
 old=output.inputs['Surface'].links[0].from_socket if output.inputs['Surface'].is_linked else None
 emission=nodes.new('ShaderNodeEmission'); nodes.active=emission
 for channel,socketname in [('color','Base Color'),('roughness','Roughness')]:
  inp=bs.inputs[socketname]; linked=inp.links[0].from_socket if inp.is_linked else None
  if not linked:continue
  for l in list(emission.inputs['Color'].links):mat.node_tree.links.remove(l)
  mat.node_tree.links.new(linked,emission.inputs['Color']);mat.node_tree.links.new(emission.outputs[0],output.inputs['Surface'])
  im=bpy.data.images.new('Baked_'+mat.name+'_'+channel,width=size,height=size);tex=nodes.new('ShaderNodeTexImage');tex.image=im;nodes.active=tex
  bpy.ops.object.select_all(action='DESELECT')
  for o in users:o.select_set(True)
  bpy.context.view_layer.objects.active=users[0]
  try:
   bpy.ops.object.bake(type='EMIT');im.pack();mat.node_tree.links.new(tex.outputs['Color'],inp);rec[channel]='baked'
   if channel=='color' and bs.inputs['Emission Color'].is_linked and bs.inputs['Emission Color'].links[0].from_socket==linked:mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Emission Color'])
  except Exception as e:rec[channel]='FAILED '+str(e)
 if old:mat.node_tree.links.new(old,output.inputs['Surface'])
 nodes.remove(emission);summary['materials'].append(rec); print('BAKED',mat.name,flush=True)
# Bake procedural tangent-space normals; ordinary source-image normal maps remain unchanged.
for mat in list(bpy.data.materials):
 if not mat.use_nodes:continue
 nodes=mat.node_tree.nodes;bs=next((n for n in nodes if n.type=='BSDF_PRINCIPLED'),None)
 if not bs or not bs.inputs['Normal'].is_linked:continue
 if not any(n.type in {'TEX_NOISE','TEX_VORONOI','TEX_WAVE'} for n in nodes):continue
 users=[o for o in bpy.data.objects if o.type=='MESH' and any(s.material==mat for s in o.material_slots)]
 if not users:continue
 for o in users:
  if not o.data.uv_layers:
   bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
   bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(island_margin=.02);bpy.ops.object.mode_set(mode='OBJECT')
 im=bpy.data.images.new('Baked_'+mat.name+'_normal',width=512,height=512);im.colorspace_settings.name='Non-Color'
 tex=nodes.new('ShaderNodeTexImage');tex.image=im;nodes.active=tex
 # Other material slots require a bake target too; temporary nodes are removed afterwards.
 temporary=[]
 for o in users:
  for slot in o.material_slots:
   other=slot.material
   if other and other!=mat and other.use_nodes and not any(x[0]==other for x in temporary):
    tn=other.node_tree.nodes.new('ShaderNodeTexImage');tn.image=im;other.node_tree.nodes.active=tn;temporary.append((other,tn))
 bpy.ops.object.select_all(action='DESELECT')
 for o in users:o.select_set(True)
 bpy.context.view_layer.objects.active=users[0]
 try:
  bpy.ops.object.bake(type='NORMAL');im.pack();nm=nodes.new('ShaderNodeNormalMap');mat.node_tree.links.new(tex.outputs['Color'],nm.inputs['Color']);mat.node_tree.links.new(nm.outputs['Normal'],bs.inputs['Normal']);summary.setdefault('baked_normal_materials',[]).append(mat.name)
 except Exception as e:summary.setdefault('normal_limitations',[]).append({'material':mat.name,'reason':str(e)})
 for other,tn in temporary:other.node_tree.nodes.remove(tn)
# Export isolated room families and character hierarchies using current actions only.
collections=list(bpy.data.collections)
def descendants(o):
 return [o]+[x for child in o.children for x in descendants(child)]
chars=[o for c in collections if c.name.startswith('HQ') and 'character' in c.name.lower() for o in c.all_objects]
for name,prefix in [('studio','HQ'),('lobby','Lobby'),('conference','Conference')]:
 objects={o for c in collections if c.name.startswith(prefix) and 'character' not in c.name.lower() for o in c.all_objects if o.type in {'MESH','EMPTY'}}
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',use_selection=True,export_animations=False,export_lights=False,export_cameras=False,export_image_format='AUTO',export_yup=True)
 summary['exports'][name]={'objects':len(objects),'bytes':(OUT/(name+'.glb')).stat().st_size}
 print('EXPORTED',name,summary['exports'][name],flush=True)
for name,rig_name in [('carla','Object_4'),('eric','Object_4.001')]:
 rig=bpy.data.objects.get(rig_name); objects=set(descendants(rig))
 # Include hierarchy parents: imported FBX transformations are necessary for correct meter scale.
 p=rig.parent
 while p:objects.add(p);p=p.parent
 if name=='eric':objects.update(o for o in chars if 'tablet' in o.name.lower())
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.hide_set(False);o.hide_viewport=False;o.hide_render=False;o.hide_select=False;o.select_set(True)
 kwargs=dict(filepath=str(OUT/(name+'.glb')),export_format='GLB',use_selection=True,use_visible=False,use_renderable=False,export_animations=True,export_animation_mode='ACTIVE_ACTIONS',export_frame_range=True,export_force_sampling=True,export_lights=False,export_cameras=False,export_yup=True)
 bpy.ops.export_scene.gltf(**kwargs)
 summary['exports'][name]={'objects':len(objects),'bytes':(OUT/(name+'.glb')).stat().st_size,'action':rig.animation_data.action.name if rig.animation_data and rig.animation_data.action else None}
 print('EXPORTED',name,summary['exports'][name],flush=True)
(OUT/'export-inventory.json').write_text(json.dumps(summary,indent=2))
print('COMPLETE',flush=True)
