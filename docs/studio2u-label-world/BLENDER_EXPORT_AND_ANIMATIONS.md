# Blender → glTF/GLB production pipeline and animation roadmap

## Export prerequisite checks
1. Locate and backup the true original `.blend` source, and enumerate relevant Studio/Lobby/Conference collections plus actual Carla and Eric armatures/materials/actions. Do not substitute old render images for source mesh evidence.
2. Capture current mesh/component statistics, UV maps, dependencies, procedurally generated node materials, texture packing, constraints, bones, animation clips, origins, unit scale, and asset naming.
3. Use non-destructive copies for material bake/texture preparation. Repair missing/overlapping UVs where needed; bake incompatible materials; correctly assign albedo/metallic/roughness/normal/emissive as supported; use rights-cleared images. Preserve silhouette and premium studio visual identity.
4. Keep cabinet front, cabinet trim, chosen wall panels/finishes and award slots as named objects or material groups with stable IDs. Do not collapse these into one inaccessible baked atlas if later customization requires independent edits.
5. Export modular static environment GLBs with textures appropriately embedded or linked; export character rigged GLBs with action clips where available. Make action names stable and map to semantic `idle`, `walk`, `greet`, `tablet`, `work` cues as an alias file without renaming Blender originals. Bake controller/IK-dependent motions to exportable FK/pose data only when required, validate root transforms and avoid corrupting skinning.
6. Independently open each GLB via viewer and in browser, inspect textures, skinning, eyes/hands, normals, bone animation, transform scale, bounds, shadows, draw calls and file sizes. Check loop continuity and playback across a few sample frames; preserve a baseline idle clip.
7. Track/export build manifest: source path+version, exported paths, hashes, materials/bakes, counts, LOD if useful, actual clips, omissions, tested clients, performance. Commit deployable GLBs within sensible Git/LFS size limits or published build assets in approved store, not large unreviewed original `.blend` if unsuitable.

## Minimum viable animations
Carla: play verified idle; OPEN Researcher UI on interaction regardless of whether greeting exists. Eric: play verified idle; OPEN Reviewer tablet UI on interaction even without tablet-raise clip. A reported walk clip is not a requirement for a static employee. `GREETING` and `TABLET_OPEN` cues remain optional until real tested clip/prop files exist. Never assume webcam-like facial animation, lip sync, walking AI or navigation exists.

## Later animation milestones
- Carla: subtle speaking/listening, seated/stand, workstation gestures, greeting, attention-turning; all exported and viewer-tested.
- Eric: seated tablet idle, hold/look/down, raise tablet, point/review gesture, return to idle, optional walk.
- Executive/Builder: approved new low-poly style-consistent meshes and rigging when supplied; no rushed generics. `AgentRegistry` gains mesh/clip pointers without changing domain services or dashboards.
- Later celebration: play valid clip and optional particles/audio only on evidence-backed milestone; honor reduced-motion/sound settings.

## Important distinction
Character/room art complete in Blender != exported GLB complete != loaded in browser != interactive headquarters complete != functional agent. Record each stage separately in BUILD_STATUS.
