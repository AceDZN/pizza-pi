#!/bin/sh
# Bakes face morph targets into every character and optimizes them into public/models.
# Numbers are Blender world metres read off front renders (scripts/face/render_face.py + a 1 cm grid).
set -e
cd "$(dirname "$0")/../.."
B=${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}
bake() { # name output args...
  n=$1; out=$2; shift 2
  "$B" -b --python scripts/face/build_face.py -- "scripts/raw/$n-calm.glb" "scripts/raw/$n-face.glb" "scripts/raw/$n-face.blend" "$@" | grep -E 'FACEKEYS|FROZEN'
  npx -y @gltf-transform/cli@4.2.1 optimize "scripts/raw/$n-face.glb" "public/models/$out.glb" --compress meshopt --texture-compress webp --texture-size 1024 --simplify false | tail -1
}
# Noa: glasses frozen, full face.
bake noa noa eyes=-0.030,0.829,0.034,0.829 eye=0.019,0.016 mouth=-0.019,0.787,0.015,0.786 glasses=1
# Chef and Saba: mustache / beard hide the mouth, so blink only.
bake chef chef eyes=-0.0197,0.7835,0.0211,0.7842 eye=0.0145,0.0118 lid=0.15 squash=0.97 lower=0.97 subdiv=2
bake saba saba eyes=-0.0295,0.849,0.0302,0.8498 eye=0.0132,0.0128 lid=0.15 squash=0.97 lower=0.97 subdiv=2
# Ido and Yoni: blink + mouth.
bake ido kid-ido eyes=-0.0501,0.7626,0.0494,0.7626 eye=0.021,0.0195 lid=0.75 squash=0.985 mouth=-0.0326,0.7045,0.0344,0.7045 smile=0.008,0.0016,-0.0016 frown=-0.011,-0.0005,0.0022
bake yoni kid-yoni eyes=-0.018,0.7496,0.0277,0.7496 eye=0.0105,0.0105 lid=0.6 squash=0.99 mouth=-0.0153,0.7164,0.0255,0.7164 smile=0.006,0.0013,-0.0012 frown=-0.0085,-0.0004,0.0016
# Maya: her eyes are painted closed (happy arcs), so mouth only.
bake maya kid-maya mouth=-0.0347,0.636,0.0353,0.636 smile=0.011,0.0016,-0.002 frown=-0.011,-0.0005,0.0022
