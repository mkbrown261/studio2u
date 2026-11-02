"""Headless Blender: import the Executive (Mixamo-standard rig), optimise for the web,
author a seamless procedural idle on the existing bones and export a web GLB.

  blender -b --python tools/blender/executive_idle.py -- IN.glb OUT.glb

Idle (4 s loop @30fps): breathing in spine/chest, gentle weight shift through hips,
subtle head look-around, relaxed arms down at the sides (corrects T/A-pose), light
finger curl. All motion is rotation-only on existing bones, so the mesh/skin are
untouched and Mixamo clips authored later on the same rig remain compatible.
"""
import bpy, sys, math
from mathutils import Euler, Quaternion

argv = sys.argv[sys.argv.index('--') + 1:]
src, out = argv[0], argv[1]
TARGET_FACES = int(argv[2]) if len(argv) > 2 else 30000
TEX = int(argv[3]) if len(argv) > 3 else 1024
FPS, SECONDS = 30, 4
FRAMES = FPS * SECONDS

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
scene = bpy.context.scene
scene.render.fps = FPS
scene.frame_start, scene.frame_end = 0, FRAMES

arm = next(o for o in scene.objects if o.type == 'ARMATURE')
# Remove stray helper geometry that ships in some Sketchfab exports (e.g. an unskinned Icosphere).
for o in list(scene.objects):
    if o.type == 'MESH' and not any(md.type == 'ARMATURE' for md in o.modifiers) and o.parent is None:
        print('REMOVED helper mesh', o.name); bpy.data.objects.remove(o, do_unlink=True)
meshes = [o for o in scene.objects if o.type == 'MESH']
before = sum(len(m.data.polygons) for m in meshes)

# ---- web optimisation: decimate (skin weights preserved by the collapse modifier) ----
ratio = min(1.0, TARGET_FACES / max(before, 1))
if ratio < 0.98:
    for m in meshes:
        n = len(m.data.polygons)
        # keep small detail meshes (eyes, teeth) intact, reduce the heavy ones
        if n < 1500: continue
        mod = m.modifiers.new('web_decimate', 'DECIMATE'); mod.ratio = ratio; mod.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = m
        # decimate must be applied above the armature modifier
        m.modifiers.move(m.modifiers.find('web_decimate'), 0)
        with bpy.context.temp_override(object=m, active_object=m):
            bpy.ops.object.modifier_apply(modifier='web_decimate')
after = sum(len(m.data.polygons) for m in meshes)

# ---- texture downscale ----
for img in bpy.data.images:
    if img.size[0] > TEX or img.size[1] > TEX:
        s = TEX / max(img.size)
        img.scale(max(1, int(img.size[0] * s)), max(1, int(img.size[1] * s)))

# ---- bone lookup by Mixamo name (Sketchfab appends _NN suffixes) ----
pb = arm.pose.bones
def bone(name):
    for b in pb:
        base = b.name.rsplit('_', 1)[0] if b.name.rsplit('_', 1)[-1].isdigit() else b.name
        if base.replace('mixamorig:', '') == name: return b
    return None
need = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftShoulder', 'RightShoulder', 'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm', 'LeftHand', 'RightHand']
B = {n: bone(n) for n in need}
missing = [n for n, v in B.items() if v is None]
if missing: raise SystemExit('Rig missing bones: ' + ', '.join(missing))
for b in pb: b.rotation_mode = 'XYZ'

# ---- measure arm direction in rest pose so "arms down" works for T- or A-pose ----
def world_dir(b):
    m = arm.matrix_world @ b.bone.matrix_local
    return (m.to_3x3() @ __import__('mathutils').Vector((0, 1, 0))).normalized()
la, ra = world_dir(B['LeftArm']), world_dir(B['RightArm'])
print('REST left arm dir', tuple(round(x, 2) for x in la), 'right', tuple(round(x, 2) for x in ra))

def rot_toward(b, target_world, amount):
    """Local XYZ euler that rotates bone b's Y axis `amount` of the way toward target_world."""
    from mathutils import Vector, Matrix
    rest = (arm.matrix_world @ b.bone.matrix_local).to_3x3()
    cur = (rest @ Vector((0, 1, 0))).normalized()
    q_world = cur.rotation_difference(target_world.normalized())
    q_world = Quaternion().slerp(q_world, amount)
    q_local = rest.inverted() @ q_world.to_matrix() @ rest
    return q_local.to_euler('XYZ')

from mathutils import Vector
down = Vector((0, 0, -1))
# Blender is Z-up after glTF import. Arms down and slightly forward/outward = relaxed stance.
left_target = (down + Vector((0.18 if la.x > 0 else -0.18, -0.06, 0))).normalized()
right_target = (down + Vector((0.18 if ra.x > 0 else -0.18, -0.06, 0))).normalized()
L_ARM = rot_toward(B['LeftArm'], left_target, 1.0)
R_ARM = rot_toward(B['RightArm'], right_target, 1.0)

action = bpy.data.actions.new('Animation')
arm.animation_data_create(); arm.animation_data.action = action
TAU = 2 * math.pi
def key(b, frame, euler):
    b.rotation_euler = euler; b.keyframe_insert('rotation_euler', frame=frame)
def add(e, dx=0, dy=0, dz=0): return Euler((e.x + dx, e.y + dy, e.z + dz), 'XYZ')

STEP = 3  # key every 3 frames; Bezier smooths between
for f in list(range(0, FRAMES, STEP)) + [FRAMES]:
    t = (f % FRAMES) / FRAMES
    breathe = math.sin(TAU * t * 2)          # 2 breaths per loop
    sway = math.sin(TAU * t)                 # 1 weight shift per loop
    look = math.sin(TAU * t + 1.2)
    key(B['Hips'], f, Euler((0, sway * 0.02, sway * 0.025), 'XYZ'))
    key(B['Spine'], f, Euler((breathe * 0.012, 0, -sway * 0.012), 'XYZ'))
    key(B['Spine1'], f, Euler((breathe * 0.015, 0, -sway * 0.008), 'XYZ'))
    key(B['Spine2'], f, Euler((breathe * 0.02, 0, 0), 'XYZ'))
    key(B['Neck'], f, Euler((-breathe * 0.008, look * 0.03, 0), 'XYZ'))
    key(B['Head'], f, Euler((math.sin(TAU * t * 2 + .5) * 0.015, look * 0.06, -sway * 0.01), 'XYZ'))
    key(B['LeftShoulder'], f, Euler((0, 0, breathe * 0.01), 'XYZ'))
    key(B['RightShoulder'], f, Euler((0, 0, -breathe * 0.01), 'XYZ'))
    key(B['LeftArm'], f, add(L_ARM, breathe * 0.01, 0, sway * 0.015))
    key(B['RightArm'], f, add(R_ARM, breathe * 0.01, 0, sway * 0.015))
    key(B['LeftForeArm'], f, Euler((0.22 + breathe * 0.01, 0, 0), 'XYZ'))
    key(B['RightForeArm'], f, Euler((0.22 + breathe * 0.01, 0, 0), 'XYZ'))
    key(B['LeftHand'], f, Euler((0.05, 0, 0), 'XYZ'))
    key(B['RightHand'], f, Euler((0.05, 0, 0), 'XYZ'))
# relaxed finger curl (static)
for b in pb:
    n = b.name
    if any(k in n for k in ('Index', 'Middle', 'Ring', 'Pinky')) and n.rsplit('_', 1)[0][-1] in '123':
        for f in (0, FRAMES): key(b, f, Euler((0.18, 0, 0), 'XYZ'))
# seamless loop
for fc in action.fcurves:
    for kp in fc.keyframe_points: kp.interpolation = 'BEZIER'
    m = fc.modifiers.new('CYCLES')

# ---- export ----
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=True, export_frame_range=True,
    export_force_sampling=True, export_skins=True, export_image_format='JPEG', export_jpeg_quality=85,
    export_apply=False, export_yup=True)
print(f'EXPORT OK faces {before} -> {after}; frames {FRAMES}; textures <= {TEX}px; action "Animation"')
