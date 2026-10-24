# Adds blink / smile / frown shape keys to a Tripo character whose face is painted on the texture.
# The painted features follow the vertices, so squashing the eye region toward a lid line closes the painted
# eye (skin stretches over it) and moving the mouth corners bends the painted mouth.
# Usage: blender -b --python build_face.py -- in.glb out.glb out.blend  eyeLx eyeLz eyeRx eyeRz mouthLx mouthLz mouthRx mouthRz eyeA eyeB
import bpy, sys, math
argv = sys.argv[sys.argv.index('--') + 1:]
src, out_glb, out_blend = argv[:3]
eL = (float(argv[3]), float(argv[4])); eR = (float(argv[5]), float(argv[6]))
mL = (float(argv[7]), float(argv[8])); mR = (float(argv[9]), float(argv[10]))
EA, EB = float(argv[11]), float(argv[12])  # eye half-width / half-height (m)
FRONT_Y = float(argv[13]) if len(argv) > 13 else -0.06  # only the front of the face moves

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
mesh = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
me = mesh.data
inv = mesh.matrix_world.inverted()
mw = mesh.matrix_world
mesh.shape_key_add(name='Basis', from_mix=False)

# Glasses (and any other accessory in front of the face) are separate geometric parts. Weld UV seams on a
# copy, find connected parts, and freeze the part that contains the front-most vertex at the nose bridge.
import bmesh
bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
key = {v.index: tuple(round(c, 5) for c in v.co) for v in bm.verts}
parent = {}
def find(a):
    while parent.get(a, a) != a: a = parent[a]
    return a
def union(a, b):
    ra, rb = find(a), find(b)
    if ra != rb: parent[ra] = rb
for e in bm.edges: union(key[e.verts[0].index], key[e.verts[1].index])
bx, bz = (eL[0] + eR[0]) / 2, (eL[1] + eR[1]) / 2
near = [v for v in me.vertices if abs((mw @ v.co).x - bx) < 0.006 and abs((mw @ v.co).z - bz) < 0.012]
frozen = set()
if near:
    bridge = min(near, key=lambda v: (mw @ v.co).y)
    part = find(key[bridge.index])
    members = [v.index for v in me.vertices if find(key[v.index]) == part]
    if len(members) < len(me.vertices) * 0.2: frozen = set(members)  # never freeze the whole head
print('FROZEN', len(frozen))

def smooth(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)

def add_key(name, fn):
    kb = mesh.shape_key_add(name=name, from_mix=False)
    n = 0
    for v in me.vertices:
        co = mw @ v.co
        if co.y > FRONT_Y or v.index in frozen: continue
        new = fn(co.copy())
        if new is not None and (new - co).length > 1e-7:
            kb.data[v.index].co = inv @ new; n += 1
    return n

def blink(co):
    best = None
    for (cx, cz) in (eL, eR):
        d = math.hypot((co.x - cx) / EA, (co.z - cz) / EB)
        if d < 1.45: best = (cx, cz, d)
    if not best: return None
    cx, cz, d = best
    w = 1 - smooth(1.0, 1.45, d)  # full inside the eye, fading out into the surrounding skin
    lid = cz - 0.30 * EB  # closed lid sits a little below the eye centre
    if co.z > lid: co.z = lid + (co.z - lid) * (1 - 0.94 * w)  # upper lid comes down
    else: co.z = lid + (co.z - lid) * (1 - 0.55 * w)  # lower lid rises a bit
    return co

def corners(dz, dx, mid_dz):
    # One smooth parabola across the mouth: the centre stays, the corners lift (smile) or drop (frown),
    # so the painted lip line bends into a clean U instead of an S.
    mx, mz = (mL[0] + mR[0]) / 2, (mL[1] + mR[1]) / 2
    hw = (mR[0] - mL[0]) / 2
    def fn(co):
        u = (co.x - mx) / hw
        if abs(u) > 1.6 or abs(co.z - mz) > 0.016: return None
        wx = min(1.0, u * u) * (1 - smooth(1.25, 1.6, abs(u)))
        wz = 1 - smooth(0.004, 0.016, abs(co.z - mz))
        co.z += dz * wx * wz + mid_dz * (1 - min(1.0, u * u)) * wz
        co.x += dx * u * wx * wz
        return co
    return fn

counts = dict(blink=add_key('blink', blink), smile=add_key('smile', corners(0.0055, 0.0012, -0.0012)), frown=add_key('frown', corners(-0.0055, -0.0004, 0.0012)))
print('FACEKEYS', counts)
bpy.ops.wm.save_as_mainfile(filepath=out_blend)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=out_glb, export_format='GLB', export_morph=True, export_morph_normal=False, export_skins=True, export_animations=False, export_yup=True)
