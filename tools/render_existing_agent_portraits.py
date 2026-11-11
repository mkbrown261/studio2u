import bpy
from mathutils import Vector
from pathlib import Path
out=Path('/Users/masonbrown/Documents/New project/studio2u/public/label-world/assets')
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.render.resolution_x=512;scene.render.resolution_y=512;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.film_transparent=True
scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.2,.23,.3,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
for o in bpy.data.objects:o.hide_render=True
for name,meshname in [('carla','Object_6'),('eric','Object_6.001')]:
 mesh=bpy.data.objects[meshname];mesh.hide_render=False
 points=[mesh.matrix_world@Vector(v) for v in mesh.bound_box];center=sum(points,Vector())/8;top=max(v.z for v in points);target=Vector((center.x,center.y,top-.26))
 camdata=bpy.data.cameras.new(name+' portrait');cam=bpy.data.objects.new(name+' portrait',camdata);scene.collection.objects.link(cam);cam.location=target+Vector((0,-2.3,.06));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();camdata.lens=85;scene.camera=cam
 lights=[]
 for offset,power,size in [((-1,-2,1),170,2),((1,-1,.4),80,2),((0,1,.8),130,1)]:
  d=bpy.data.lights.new('portrait light','AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new('portrait light',d);scene.collection.objects.link(o);o.location=target+Vector(offset);o.rotation_euler=(target-o.location).to_track_quat('-Z','Y').to_euler();lights.append(o)
 scene.render.filepath=str(out/(name+'-portrait.png'));bpy.ops.render.render(write_still=True);mesh.hide_render=True
 for o in lights:bpy.data.objects.remove(o,do_unlink=True)
 bpy.data.objects.remove(cam,do_unlink=True)
