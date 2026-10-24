// Canvas-painted textures: everything is generated locally, nothing is fetched.
import * as THREE from 'three';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')!] as const;
}
function tex(c: HTMLCanvasElement, repeat = 1) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  return t;
}
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

export function woodTexture() {
  const [c, x] = canvas(1024, 512);
  x.fillStyle = '#b9824f'; x.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 9; i++) {
    const y0 = i * 57;
    x.fillStyle = i % 2 ? '#c48d57' : '#ad7645';
    x.fillRect(0, y0, 1024, 57);
    x.fillStyle = 'rgba(70,35,15,0.35)'; x.fillRect(0, y0, 1024, 2);
  }
  for (let i = 0; i < 260; i++) {
    x.strokeStyle = `rgba(${90 + rnd() * 40},${45 + rnd() * 20},${20},${0.08 + rnd() * 0.12})`;
    x.lineWidth = 1 + rnd() * 2;
    const y = rnd() * 512;
    x.beginPath(); x.moveTo(0, y);
    for (let px = 0; px <= 1024; px += 64) x.lineTo(px, y + Math.sin(px / 90 + i) * 4 + (rnd() - 0.5) * 3);
    x.stroke();
  }
  // Flour dust smudges.
  for (let i = 0; i < 40; i++) {
    const g = x.createRadialGradient(0, 0, 0, 0, 0, 40);
    g.addColorStop(0, 'rgba(255,250,235,0.18)'); g.addColorStop(1, 'rgba(255,250,235,0)');
    x.save(); x.translate(rnd() * 1024, rnd() * 512); x.scale(1 + rnd() * 2, 0.6 + rnd()); x.fillStyle = g; x.fillRect(-40, -40, 80, 80); x.restore();
  }
  return tex(c);
}

export function doughTexture() {
  const [c, x] = canvas(512, 512);
  x.fillStyle = '#f2dcae'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 900; i++) {
    const r = 1 + rnd() * 5;
    x.fillStyle = rnd() > 0.5 ? 'rgba(255,245,220,0.5)' : 'rgba(200,160,100,0.18)';
    x.beginPath(); x.arc(rnd() * 512, rnd() * 512, r, 0, Math.PI * 2); x.fill();
  }
  for (let i = 0; i < 120; i++) { x.fillStyle = 'rgba(255,255,255,0.45)'; x.fillRect(rnd() * 512, rnd() * 512, 2, 2); }
  return tex(c);
}

export function sauceTexture() {
  const [c, x] = canvas(512, 512);
  x.fillStyle = '#c8311f'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 500; i++) {
    x.fillStyle = rnd() > 0.6 ? 'rgba(120,15,10,0.35)' : 'rgba(240,90,50,0.3)';
    x.beginPath(); x.ellipse(rnd() * 512, rnd() * 512, 2 + rnd() * 9, 1 + rnd() * 5, rnd() * 3, 0, Math.PI * 2); x.fill();
  }
  for (let i = 0; i < 70; i++) { x.fillStyle = 'rgba(40,90,30,0.8)'; x.fillRect(rnd() * 512, rnd() * 512, 3, 2); }
  return tex(c);
}

export function brickTexture() {
  const [c, x] = canvas(1024, 512);
  x.fillStyle = '#4a2a20'; x.fillRect(0, 0, 1024, 512);
  for (let row = 0; row < 16; row++) for (let col = 0; col < 17; col++) {
    const w = 64, h = 32, off = row % 2 ? 32 : 0;
    const shade = 90 + rnd() * 50;
    x.fillStyle = `rgb(${shade + 40},${shade * 0.55},${shade * 0.4})`;
    x.fillRect(col * w - off + 2, row * h + 2, w - 4, h - 4);
  }
  return tex(c, 1);
}

export function rulerTexture(lengthCm: number, pxPerCm: number, color = '#f6d34a', every = 5, reverse = false) {
  const w = Math.ceil(lengthCm * pxPerCm), h = 96;
  const [c, x] = canvas(w, h);
  x.fillStyle = color; x.fillRect(0, 0, w, h);
  x.direction = 'ltr';
  x.fillStyle = '#2a1d10';
  x.font = 'bold 34px Rubik, system-ui, sans-serif';
  x.textAlign = 'center';
  for (let cm = 0; cm <= lengthCm; cm++) {
    const px = (reverse ? lengthCm - cm : cm) * pxPerCm;
    const big = cm % every === 0, mid = cm % 5 === 0;
    const len = big ? 44 : mid ? 30 : 16;
    x.fillRect(px - 1.5, 0, 3, len);
    if (big && cm > 0 && cm < lengthCm) x.fillText(String(cm), px, 86);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function chalkboardTexture(lines: string[]) {
  const [c, x] = canvas(1024, 640);
  x.fillStyle = '#23302a'; x.fillRect(0, 0, 1024, 640);
  x.strokeStyle = '#7a4b2a'; x.lineWidth = 28; x.strokeRect(14, 14, 996, 612);
  x.fillStyle = 'rgba(255,255,255,0.04)';
  for (let i = 0; i < 60; i++) x.fillRect(rnd() * 1024, rnd() * 640, 120 * rnd(), 3);
  x.direction = 'rtl';
  x.textAlign = 'center';
  x.fillStyle = '#f4ead2';
  x.font = 'bold 86px Rubik, system-ui, sans-serif';
  x.fillText(lines[0], 512, 130);
  x.font = '48px Rubik, system-ui, sans-serif';
  lines.slice(1).forEach((l, i) => { x.fillStyle = i % 2 ? '#f6c56a' : '#e8f0e0'; x.fillText(l, 512, 230 + i * 92); });
  return tex(c);
}

export function labelTexture(text: string, bg = 'rgba(30,18,10,0.85)', fg = '#fff3d6') {
  const [c, x] = canvas(256, 96);
  x.fillStyle = bg;
  x.beginPath(); x.roundRect(4, 4, 248, 88, 30); x.fill();
  x.direction = /[\u0590-\u05ff]/.test(text) ? 'rtl' : 'ltr';
  x.fillStyle = fg; x.font = 'bold 50px Rubik, system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(text, 128, 52);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function checkTexture() {
  const [c, x] = canvas(256, 256);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    x.fillStyle = (i + j) % 2 ? '#f4efe2' : '#c8311f';
    x.fillRect(i * 32, j * 32, 32, 32);
  }
  return tex(c);
}
