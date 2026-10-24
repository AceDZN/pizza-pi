# Prints the front view framing (centre x, z and size) of a character's head from its Head-bone vertices.
import bpy, sys, json
argv = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=argv[0])
mesh = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
g = mesh.vertex_groups['mixamorig:Head']
pts = [mesh.matrix_world @ v.co for v in mesh.data.vertices if any(x.group == g.index and x.weight > 0.5 for x in v.groups)]
pts = [p for p in pts if p.y < min(q.y for q in pts) + 0.06]  # front of the head only (face, not hair at the back)
xs = sorted(p.x for p in pts); zs = sorted(p.z for p in pts)
cut = lambda a: (a[int(len(a) * 0.05)], a[int(len(a) * 0.95)])
(x0, x1), (z0, z1) = cut(xs), cut(zs)
print('HEADFRAME', json.dumps(dict(cx=round((x0 + x1) / 2, 4), cz=round((z0 + z1) / 2, 4), size=round(max(x1 - x0, z1 - z0) * 1.35, 4))))
