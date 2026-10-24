# Adds blink / smile / frown shape keys to a Tripo character whose face is painted on the texture.
# The painted features follow the vertices, so squashing the eye region toward a lid line closes the painted
# eye (skin stretches over it) and bending the mouth region bends the painted mouth.
#
# Usage: blender -b --python build_face.py -- in.glb out.glb out.blend key=value ...
#   eyes=Lx,Lz,Rx,Rz  eye=halfWidth,halfHeight      (omit eyes for characters with painted-closed eyes)
#   mouth=Lx,Lz,Rx,Rz                                (omit when a beard or mustache hides the mouth)
#   glasses=1                                         (freeze the accessory part at the nose bridge)
#   subdiv=2                                          (split coarse triangles around the eyes first)
#   lid=0.30 squash=0.94 lower=0.55                              (lid line below the eye centre, as a fraction of
#                                                      the half-height; how completely the eye closes)
#   smile=dz,dx,mid  frown=dz,dx,mid                  (metres; defaults suit a child-sized head)
# Coordinates are Blender world metres from a front render (scripts/face/render_face.py).
import bpy, bmesh, sys, math

argv = sys.argv[sys.argv.index('--') + 1:]
src, out_glb, out_blend = argv[:3]
opt = dict(a.split('=', 1) for a in argv[3:])
nums = lambda k, d=None: [float(x) for x in opt[k].split(',')] if k in opt else d
eyes = nums('eyes'); EA, EB = nums('eye', [0.019, 0.016])
mouth = nums('mouth')
LID = float(opt.get('lid', 0.30)); SQUASH = float(opt.get('squash', 0.94)); LOWER = float(opt.get('lower', 0.55))
smile_p = nums('smile', [0.0055, 0.0012, -0.0012]); frown_p = nums('frown', [-0.0055, -0.0004, 0.0012])
# Depth window measured from the front surface at the feature's centre: a nose a little further forward and
# hair at the back of the head stay put, while bulging eyeballs move with the lids.
FRONT_SLACK, BACK_DEPTH = 0.008, 0.05

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
mesh = next(o for o in bpy.context.scene.objects if o.type == 'MESH')
me = mesh.data
mw = mesh.matrix_world
inv = mw.inverted()
def eye_dist(c):
    return min(math.hypot((c.x - eyes[0]) / EA, (c.z - eyes[1]) / EB), math.hypot((c.x - eyes[2]) / EA, (c.z - eyes[3]) / EB))
if eyes and int(opt.get('subdiv', 0)):
    # Some faces paint a whole eye across a few big triangles; split them so the lid can bend smoothly.
    # BMesh interpolates UVs and skin weights for the new vertices.
    bm = bmesh.new(); bm.from_mesh(me)
    faces = [f for f in bm.faces if any(eye_dist(mw @ v.co) < 1.7 for v in f.verts)]
    edges = list({e for f in faces for e in f.edges})
    bmesh.ops.subdivide_edges(bm, edges=edges, cuts=int(opt['subdiv']), use_grid_fill=True)
    bm.to_mesh(me); bm.free(); me.update()
    print('SUBDIV faces', len(faces), '-> verts', len(me.vertices))
world = [mw @ v.co for v in me.vertices]
mesh.shape_key_add(name='Basis', from_mix=False)

frozen = set()
if opt.get('glasses') == '1' and eyes:
    # Glasses are a separate geometric part. Weld UV seams on a copy, find connected parts, and freeze the
    # part that holds the front-most vertex at the nose bridge (never the whole head).
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
    key = {v.index: tuple(round(c, 5) for c in v.co) for v in bm.verts}
    parent = {}
    def find(a):
        while parent.get(a, a) != a: a = parent[a]
        return a
    for e in bm.edges:
        ra, rb = find(key[e.verts[0].index]), find(key[e.verts[1].index])
        if ra != rb: parent[ra] = rb
    bx, bz = (eyes[0] + eyes[2]) / 2, (eyes[1] + eyes[3]) / 2
    near = [i for i, c in enumerate(world) if abs(c.x - bx) < 0.006 and abs(c.z - bz) < 0.012]
    if near:
        part = find(key[min(near, key=lambda i: world[i].y)])
        members = [i for i in range(len(world)) if find(key[i]) == part]
        if len(members) < len(world) * 0.2: frozen = set(members)
print('FROZEN', len(frozen))

def smooth(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a))); return t * t * (3 - 2 * t)

def front_surface(core):
    # Front-most surface at the centre of a feature; glTF -Z forward imports as Blender -Y.
    ys = [world[i].y for i in core if i not in frozen]
    return min(ys) if ys else 0.0

def add_key(name, region, fn, core):
    kb = mesh.shape_key_add(name=name, from_mix=False)
    cands = [i for i, c in enumerate(world) if region(c)]
    front = front_surface([i for i in cands if core(world[i])])
    n = 0
    for i in cands:
        y = world[i].y
        if i in frozen or y < front - FRONT_SLACK or y > front + BACK_DEPTH: continue
        new = fn(world[i].copy())
        if new is not None and (new - world[i]).length > 1e-7:
            kb.data[i].co = inv @ new; n += 1
    return n

counts = {}
if eyes:
    pairs = ((eyes[0], eyes[1]), (eyes[2], eyes[3]))
    eye_d = eye_dist
    def blink(co):
        cx, cz = min(pairs, key=lambda p: math.hypot((co.x - p[0]) / EA, (co.z - p[1]) / EB))
        w = 1 - smooth(1.0, 1.45, eye_d(co))  # full inside the eye, fading out into the surrounding skin
        lid = cz - LID * EB  # closed lid sits a little below the eye centre
        if co.z > lid: co.z = lid + (co.z - lid) * (1 - SQUASH * w)  # upper lid comes down
        else: co.z = lid + (co.z - lid) * (1 - LOWER * w)  # lower lid rises
        return co
    counts['blink'] = add_key('blink', lambda c: eye_d(c) < 1.45, blink, lambda c: eye_d(c) < 0.6)

if mouth:
    mL, mR = (mouth[0], mouth[1]), (mouth[2], mouth[3])
    mx, mz = (mL[0] + mR[0]) / 2, (mL[1] + mR[1]) / 2
    hw = (mR[0] - mL[0]) / 2
    band = max(0.016, hw * 0.55)
    def in_mouth(c): return abs((c.x - mx) / hw) <= 1.6 and abs(c.z - mz) <= band
    def bend(dz, dx, mid):
        # One smooth parabola across the mouth: the centre stays, the corners lift (smile) or drop (frown),
        # so the painted lip line bends into a clean U instead of an S.
        def fn(co):
            u = (co.x - mx) / hw
            wx = min(1.0, u * u) * (1 - smooth(1.25, 1.6, abs(u)))
            wz = 1 - smooth(band * 0.25, band, abs(co.z - mz))
            co.z += dz * wx * wz + mid * (1 - min(1.0, u * u)) * wz
            co.x += dx * u * wx * wz
            return co
        return fn
    mouth_core = lambda c: abs((c.x - mx) / hw) < 0.8 and abs(c.z - mz) < band * 0.4
    counts['smile'] = add_key('smile', in_mouth, bend(*smile_p), mouth_core)
    counts['frown'] = add_key('frown', in_mouth, bend(*frown_p), mouth_core)

print('FACEKEYS', counts)
bpy.ops.wm.save_as_mainfile(filepath=out_blend)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=out_glb, export_format='GLB', export_morph=True, export_morph_normal=False, export_skins=True, export_animations=False, export_yup=True)
