# Render an orthographic front view of a character's face (optionally with a shape key at full strength).
import bpy, sys, mathutils
argv = sys.argv[sys.argv.index('--') + 1:]
src, out = argv[0], argv[1]
key = argv[2] if len(argv) > 2 else None
bpy.ops.wm.read_factory_settings(use_empty=True)
if src.endswith('.blend'): bpy.ops.wm.open_mainfile(filepath=src)
else: bpy.ops.import_scene.gltf(filepath=src)
sc = bpy.context.scene
mesh = next(o for o in sc.objects if o.type == 'MESH')
if key and mesh.data.shape_keys:
    for kb in mesh.data.shape_keys.key_blocks: kb.value = 1.0 if kb.name == key else 0.0
cx, cz, size = float(argv[3]) if len(argv) > 3 else -0.03, float(argv[4]) if len(argv) > 4 else 0.84, float(argv[5]) if len(argv) > 5 else 0.24
cam_data = bpy.data.cameras.new('cam'); cam_data.type = 'ORTHO'; cam_data.ortho_scale = size
cam = bpy.data.objects.new('cam', cam_data); sc.collection.objects.link(cam)
cam.location = (cx, -2.0, cz); cam.rotation_euler = mathutils.Euler((1.5708, 0, 0), 'XYZ')
sc.camera = cam
sc.render.engine = 'BLENDER_WORKBENCH'
sc.display.shading.light = 'FLAT'; sc.display.shading.color_type = 'TEXTURE'
sc.render.resolution_x = sc.render.resolution_y = 640
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
