# Adding the Builder and Executive characters

The 3D headquarters loads any employee whose file exists. No code change is needed.

## Files to deliver
| Employee | 3D model | Portrait (sidebar/chat avatar) |
|---|---|---|
| Executive | `public/label-world/assets/executive.glb` | `public/label-world/assets/executive-portrait.png` |
| Builder / Producer | `public/label-world/assets/builder.glb` | `public/label-world/assets/builder-portrait.png` |

## Model requirements (match Carla/Eric)
- glTF binary (`.glb`) with embedded textures, Y-up, metres, feet at origin (0,0,0), facing +Z.
- Under ~10 MB each (Carla 1.9 MB, Eric 8.3 MB). Cloudflare Pages limit is 25 MB per file.
- Optional idle animation named `Animation` (it auto-plays). No animation is fine; the character just stands.
- Portrait: square PNG, 512×512, face centred.

## Where they stand
Set in `src/client/label-world/registry.ts` → `placement`:
- Executive: conference room by the walnut table, `[-7, 0, 6.6]`, facing the door.
- Builder: studio production console, `[0, 0, -0.55]`.
Adjust `position`, `rotationY` (radians) or `scale` there if the export comes out at a different size.

## Ship it
1. Copy the files into `public/label-world/assets/`
2. `npm run test:label-world && npm run build`
3. `npm run deploy`

Missing or broken files never break the scene: that character is simply skipped and the sidebar shows the icon.
