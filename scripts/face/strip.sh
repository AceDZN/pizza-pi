#!/bin/sh
# Renders neutral + each face key for a baked character into one strip: strip.sh name cx cz size out.png
set -e
cd "$(dirname "$0")/../.."
B=${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}
T=$(mktemp -d)
for k in none blink smile frown; do "$B" -b --python scripts/face/render_face.py -- "scripts/raw/$1-face.blend" "$T/$k.png" "$k" "$2" "$3" "$4" >/dev/null 2>&1 || true; done
python3 - "$T" "$5" <<'PY'
import sys, os
from PIL import Image, ImageDraw
t, out = sys.argv[1:]
ks = [k for k in ['none', 'blink', 'smile', 'frown'] if os.path.exists(f'{t}/{k}.png')]
ims = [Image.open(f'{t}/{k}.png').convert('RGB').resize((320, 320)) for k in ks]
o = Image.new('RGB', (320 * len(ims), 344), 'white'); d = ImageDraw.Draw(o)
for i, (im, k) in enumerate(zip(ims, ks)): o.paste(im, (320 * i, 24)); d.text((320 * i + 140, 6), 'neutral' if k == 'none' else k, fill='black')
o.save(out)
PY
