"""Render preview frames of an animated GLB (front + side) with Eevee, headless.
  blender -b --python tools/blender/render_preview.py -- IN.glb OUTDIR frame1,frame2,...
"""
import bpy, sys, math
from mathutils import Vector
argv = sys.argv[sys.argv.index('--') + 1:]
src, outdir = argv[0], argv[1]
frames = [int(x) for x in (argv[2] if len(argv) > 2 else '0,30,60,90').split(',')]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
sc = bpy.context.scene
meshes = [o for o in sc.objects if o.type == 'MESH']
sc.frame_set(0)
dg = bpy.context.evaluated_depsgraph_get()
pts = []
for m in meshes:
    e = m.evaluated_get(dg)
    pts += [e.matrix_world @ Vector(c) for c in e.bound_box]
mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
ctr, h = (mn + mx) / 2, mx.z - mn.z
print('BOUNDS min', tuple(round(v, 2) for v in mn), 'max', tuple(round(v, 2) for v in mx), 'height', round(h, 2))
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.lens = 50
for name, energy, loc in [('key', 900, (3, -4, ctr.z + 2)), ('fill', 300, (-4, -2, ctr.z + 1)), ('rim', 500, (0, 4, ctr.z + 2))]:
    L = bpy.data.objects.new(name, bpy.data.lights.new(name, 'AREA')); L.data.energy = energy; L.data.size = 3; L.location = loc
    L.rotation_euler = (Vector(ctr) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler(); sc.collection.objects.link(L)
sc.world = bpy.data.worlds.new('w'); sc.world.color = (0.05, 0.05, 0.06)
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 24; sc.cycles.use_denoising = False
sc.render.resolution_x, sc.render.resolution_y = 480, 640
sc.render.image_settings.file_format = 'PNG'
dist = h * 2.1
for view, d in [('front', Vector((0, -1, 0))), ('side', Vector((1, 0, 0)))]:
    cam.location = ctr + d * dist + Vector((0, 0, h * 0.05))
    cam.rotation_euler = (ctr - cam.location).to_track_quat('-Z', 'Y').to_euler()
    for f in frames:
        sc.frame_set(f); sc.render.filepath = f'{outdir}/{view}_{f:03d}.png'; bpy.ops.render.render(write_still=True)
print('RENDER OK')
