// Builds public/models/clips.glb: the Tripo idle/cheer clips plus the bare Mixamo skeleton, no mesh or textures.
// All Pizza Pi characters share Tripo's Mixamo skeleton, so these clips drive any of them by bone name.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const [src, out] = process.argv.slice(2);
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(src);
const root = doc.getRoot();
for (const n of root.listNodes()) { n.setMesh(null); n.setSkin(null); }
for (const m of root.listMeshes()) m.dispose();
for (const s of root.listSkins()) s.dispose();
for (const m of root.listMaterials()) m.dispose();
for (const t of root.listTextures()) t.dispose();
for (const a of root.listAccessors()) if (!a.listParents().some((p) => p.propertyType !== 'Root')) a.dispose();
await io.write(out, doc);
console.log(out, root.listAnimations().map((a) => a.getName()));
