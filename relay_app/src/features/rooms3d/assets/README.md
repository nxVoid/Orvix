# Approved avatar assets

Only bundled approved models are accepted. No arbitrary URL/upload support. Existing preference IDs remain valid: violet/lunar select RobotExpressive variants, ember/mint select Fox variants. The former `orvix-guide.glb` is retained as a legacy original source artifact, but is no longer selected at runtime.

## RobotExpressive — CC0 1.0

Model by **Tomás Laulhé (Quaternius)**; modifications by **Don McCurdy** (morph targets, FBX2GLTF conversion, material cleanup). [Upstream attribution/license](https://github.com/mrdoob/three.js/blob/dev/examples/models/gltf/RobotExpressive/README.md), [CC0 legal code](https://creativecommons.org/publicdomain/zero/1.0/legalcode).

Original GLB retained byte-for-byte. Idle, Walking and Running clips are used. Other upstream clips remain available in the asset but are not exposed as networked emotes. Violet/Lunar colors are applied only to cloned Main materials at runtime.

## Fox — CC0 1.0 and CC BY 4.0

Model: **PixelMannen**, 2014, CC0. Rigging and animation: **tomkranis**, 2014, CC BY 4.0. glTF conversion: **AsoboStudio and scurest**, 2017, CC BY 4.0.

[Original model/source and attribution](https://github.com/KhronosGroup/glTF-Sample-Assets/blob/main/Models/Fox/README.md), [CC BY 4.0 legal code](https://creativecommons.org/licenses/by/4.0/legalcode).

Original GLB retained byte-for-byte. Survey, Walk and Run are mapped to idle/walk/run. Display scale is normalized; Moon Fox applies a cool tint to cloned materials at runtime. No endorsement by the authors is implied. Attribution is also available through Avatar credits inside the room UI.

## Reproducibility and runtime ownership

`avatar-provenance.json` records pinned source commits, exact source URLs, file sizes, SHA-256 hashes, clip names and licensing. Both models are served locally by the existing asset pipeline, without runtime requests to third-party hosts.

Skinned meshes use Three's MIT-licensed SkeletonUtils.clone to isolate each participant's bones. Geometry and embedded textures are shared in a bounded loader cache; per-instance material clones, skeleton bone textures and AnimationMixer bindings are disposed. Names are stable on the server; no preference/database migration is necessary.

`tools/relay/build-room-avatar.py` regenerates only the old original low-poly guide (AGPL-3.0-or-later). It does not generate or overwrite these third-party assets.
