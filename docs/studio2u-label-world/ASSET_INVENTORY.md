# Existing Blender Headquarters Asset Inventory

Exported on 2026-10-12 from a recovery copy of the open Studio2U_Headquarters.blend. The original open file and its unsaved state were preserved. No replacement scene or characters were generated.

Source recovery SHA-256: `eabfdf8e310e30dc1a123ac112b34e98d1d8557c65b25ed13294583ce964cb92`.

| Asset | Bytes | Meshes | Images | Skins | Animation clips |
|---|---:|---:|---:|---:|---:|
| studio.glb | 17930948 | 255 | 18 | 0 | 0 |
| lobby.glb | 11354012 | 166 | 8 | 0 | 0 |
| conference.glb | 12941516 | 384 | 10 | 0 | 0 |
| carla.glb | 1932912 | 1 | 2 | 1 | 1 |
| eric.glb | 8331112 | 2 | 6 | 1 | 1 |

## Preservation and conversion

- Coordinates and hierarchy preserved; glTF converts Blender Z-up into browser Y-up. Room bounds in Blender: studio x ±4/y ±3.5; lobby x -4..4/y -11.5..-3.5; conference x -10..-4/y -11..-4.
- Carla Researcher and Eric Reviewer use the existing 89-bone skeletons and currently assigned actions sampled over frames 1–145 at 24 fps. Historical actions are excluded. Eric’s fitted tablet is included as a static prop.
- Current character heights independently checked after GLB reload: Carla 2.1498 m, Eric 2.3 m. This verifies importability and sampled clips, not anatomical quality at every animation frame.
- Imported source image textures downsampled to maximum 2048 pixels. Procedural base colors baked for lobby veined stone, conference walnut, ocean, smoked walnut and the original sunset sky gradient (color plus emissive). Seven procedural normal maps baked into tangent space. Existing image PBR textures carried forward.
- Shared procedural material UV bakes approximate the original object/generated-coordinate patterns; room lighting and animation-driven procedural water cannot transfer identically into glTF. Browser lighting and ocean UV motion must be recreated in the client.
- Door hinge and leaf node names remain intact for interaction. Light inventory stores original positions, colors and energy; AREA lights require browser lighting equivalents.
- Geometry is not decimated. Shared geometry remains reused where the exporter supports it. Many foliage meshes remain; browser performance must be measured before claiming device support.
- Each individual GLB passes the Cloudflare Pages 25 MiB file limit. All five assets together total approximately 52.5 MB before network compression.

## Verification

- GLB structural checks passed: embedded meshes/images, every file below 25 MiB, both character skins with 89 joints and one clip each.
- Independent Blender reimport succeeded for all five exports, with character animations and source meter heights retained. Evidence: `public/label-world/assets/reload-verification.json`.
- Browser loading, navigation, lighting and visual comparison are separate integration checks; do not interpret these exporter checks as deployed UI verification.

## Attribution carried forward

Original headquarters architecture and procedural decoration: Studio2U project. Carla and Eric: Renderpeople, CC BY 4.0, https://sketchfab.com/3d-models/carla-rigged-001-rigged-3d-business-women-acf520f450d14dd799f98a6fede3edf5 and https://sketchfab.com/3d-models/eric-rigged-001-rigged-3d-business-man-a46bc9f67aaa415bb4f3241eef900e7f. Tablet: existing licensed project asset, Sketchfab UID 774782cf1069483196ede65274ba69d8. Existing Poly Haven PBR textures are CC0. Equipment license evidence is preserved in assets/blender/equipment_license_details.json and scarlett_license.json.
- Studio Monitors: Kyler Michaelson; Creative Commons Attribution; https://sketchfab.com/3d-models/studio-monitors-12b3ce23f32a4aa99cd5ba07330bf086. Inventory includes examined candidates; only actual exported scene objects are shipped.
- Midi Keyboard: dennissoderblom; Creative Commons Attribution; https://sketchfab.com/3d-models/midi-keyboard-e392c51356f24febb61ae27d1864628c. Inventory includes examined candidates; only actual exported scene objects are shipped.
- Super Low Poly Midi Keyboard: Designed By Jonathan; Creative Commons Attribution; https://sketchfab.com/3d-models/super-low-poly-midi-keyboard-dd034472beb1473ab94544f5acf0fd91. Inventory includes examined candidates; only actual exported scene objects are shipped.
- Basic Computer Monitor & TV - Lowpoly: fatihmcnn; Creative Commons Attribution; https://sketchfab.com/3d-models/basic-computer-monitor-tv-lowpoly-967ebecf66ef4d69b90655b173fb444f. Inventory includes examined candidates; only actual exported scene objects are shipped.
- Computer Monitor Lowpoly Model: Marco Zakaria; Creative Commons Attribution; https://sketchfab.com/3d-models/computer-monitor-lowpoly-model-1d4ee42eda804b02b05b63721921c1d7. Inventory includes examined candidates; only actual exported scene objects are shipped.
- Yamaha MG06 Mixer Lowpoly: Ivan_WSK; Creative Commons Attribution; https://sketchfab.com/3d-models/yamaha-mg06-mixer-lowpoly-a03a0da5a3b84402a8751b75dd9bffb9. Inventory includes examined candidates; only actual exported scene objects are shipped.
- audio mixing console: SURVIVED; Creative Commons Attribution; https://sketchfab.com/3d-models/audio-mixing-console-2de856e665044d41897ec6047f41aa91. Inventory includes examined candidates; only actual exported scene objects are shipped.
- Focusrite Scarlett Solo 4th Gen: Ivan_WSK; Creative Commons Attribution; https://sketchfab.com/3d-models/focusrite-scarlett-solo-4th-gen-9cdbec90442a4fd1a6aa7fd4b1be136a. Inventory includes examined candidates; only actual exported scene objects are shipped.


## Doorway correction and recoverability
Both green lobby seats (12 component objects) translated left 1.2 m in `Headquarters_Doorway_Clearance_20261012.blend` and exported lobby. Source SHA and private R2 recovery key are in `assets/blender/SOURCE_ARCHIVE.json`; no public source download is enabled. Updated lobby independently reimported successfully, with all baked textures preserved. Original source/open scene unchanged. Approved four dashboard images are preserved in `assets/reference-ui/`. Public attribution is `public/label-world/assets/credits.json`.
