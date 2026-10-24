// Three.js rendering of the game state. Math-critical shapes (dough, sauce, crust, rulers) are exact procedural geometry.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Cue, GameState, PieState, Station, ToppingKind } from './game';
import { activeTicket } from './game';
import { crustRange, sauceRange } from './rules';
import { brickTexture, chalkboardTexture, checkTexture, doughTexture, labelTexture, rulerTexture, sauceTexture, woodTexture } from './textures';
import type { CustomerId } from './levels';

export const U = 0.1; // world units per cm
/** One cozy diorama (see design/mockups): the pie stays centre stage and the tools come to it. */
const HOME = new THREE.Vector3(0, 0, 0.2);
const FLOOR_Y = -4.5;
const WALL_Z = -8.5;
const PEEL_Y = 0.12;
const PIE_Y = PEEL_Y + 0.07;
const ROPE_Z = 3.35;
const REEL_X = 6.4;
const PICKUP = new THREE.Vector3(0.2, 0, -3.0);
const OVEN_POS = new THREE.Vector3(-8.6, -1.4, -5.2);
const OVEN_MOUTH = new THREE.Vector3(-6.7, 0.9, -3.7);
const MIX_POS = new THREE.Vector3(3.9, 0, 0.9);
const BASE = import.meta.env.BASE_URL;

const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const damp = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt));

// ---------------- particles ----------------
interface P { alive: boolean; p: THREE.Vector3; v: THREE.Vector3; life: number; max: number; size: number; g: number; drag: number; color: THREE.Color; grow: number }
class Particles {
  mesh: THREE.InstancedMesh;
  items: P[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  constructor(scene: THREE.Scene, n = 700) {
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0, flatShading: true });
    this.mesh = new THREE.InstancedMesh(geo, mat, n);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    for (let i = 0; i < n; i++) {
      this.items.push({ alive: false, p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, max: 1, size: 0.1, g: 0, drag: 0, color: new THREE.Color(), grow: 0 });
      this.mesh.setColorAt(i, new THREE.Color(1, 1, 1));
      this.m.makeScale(0, 0, 0); this.mesh.setMatrixAt(i, this.m);
    }
    scene.add(this.mesh);
  }
  emit(o: { pos: THREE.Vector3; n: number; color: THREE.ColorRepresentation | THREE.ColorRepresentation[]; speed?: number; up?: number; spread?: number; size?: number; life?: number; g?: number; drag?: number; grow?: number }) {
    const colors = Array.isArray(o.color) ? o.color : [o.color];
    let k = 0;
    for (const it of this.items) {
      if (k >= o.n) break;
      if (it.alive) continue;
      k++;
      it.alive = true;
      const sp = o.spread ?? 0.1;
      it.p.set(o.pos.x + (Math.random() - 0.5) * sp, o.pos.y + (Math.random() - 0.5) * sp * 0.3, o.pos.z + (Math.random() - 0.5) * sp);
      const a = Math.random() * Math.PI * 2, s = (o.speed ?? 2) * (0.4 + Math.random() * 0.8);
      it.v.set(Math.cos(a) * s, (o.up ?? 2) * (0.6 + Math.random() * 0.7), Math.sin(a) * s);
      it.max = it.life = (o.life ?? 0.9) * (0.7 + Math.random() * 0.6);
      it.size = (o.size ?? 0.08) * (0.6 + Math.random() * 0.8);
      it.g = o.g ?? 9; it.drag = o.drag ?? 1; it.grow = o.grow ?? 0;
      it.color.set(colors[Math.floor(Math.random() * colors.length)]);
    }
  }
  update(dt: number) {
    this.items.forEach((it, i) => {
      if (!it.alive) return;
      it.life -= dt;
      if (it.life <= 0) { it.alive = false; this.m.makeScale(0, 0, 0); this.mesh.setMatrixAt(i, this.m); return; }
      it.v.y -= it.g * dt;
      it.v.multiplyScalar(Math.exp(-it.drag * dt));
      it.p.addScaledVector(it.v, dt);
      if (it.p.y < 0.02 && it.g > 0 && Math.abs(it.p.x) < 18 && Math.abs(it.p.z) < 3.4) { it.p.y = 0.02; it.v.set(0, 0, 0); }
      const f = it.life / it.max;
      const sc = it.size * (it.grow ? 1 + (1 - f) * it.grow : Math.min(1, f * 3));
      this.s.set(sc, sc, sc);
      this.m.compose(it.p, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
      this.mesh.setColorAt(i, it.color);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

// ---------------- one pie ----------------
const TOPPING_GEO: Record<ToppingKind, THREE.BufferGeometry> = {
  basil: new THREE.SphereGeometry(1, 10, 6).scale(0.11, 0.025, 0.07),
  pepperoni: new THREE.CylinderGeometry(0.13, 0.13, 0.04, 18),
  olive: new THREE.TorusGeometry(0.06, 0.03, 8, 14).rotateX(Math.PI / 2),
  mushroom: new THREE.SphereGeometry(0.1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.6, 1),
};
const TOPPING_MAT: Record<ToppingKind, THREE.Material> = {
  basil: new THREE.MeshStandardMaterial({ color: '#3f8f3a', roughness: 0.5 }),
  pepperoni: new THREE.MeshStandardMaterial({ color: '#a8321f', roughness: 0.55 }),
  olive: new THREE.MeshStandardMaterial({ color: '#1e1a1a', roughness: 0.3 }),
  mushroom: new THREE.MeshStandardMaterial({ color: '#e7d6bb', roughness: 0.7 }),
};

class PieView {
  group = new THREE.Group();
  dough: THREE.Mesh;
  ball: THREE.Mesh;
  edge: THREE.Mesh;
  sauce: THREE.Mesh;
  char: THREE.Mesh;
  puddle: THREE.Mesh;
  crust: THREE.Mesh | null = null;
  toppings = new THREE.Group();
  defects = new THREE.Group();
  lava = new THREE.Group();
  doughMat: THREE.MeshStandardMaterial;
  sauceMat: THREE.MeshStandardMaterial;
  crustMat = new THREE.MeshStandardMaterial({ color: '#f5cf5a', roughness: 0.45, emissive: '#2a1800' });
  shownR = 0;
  shownSauce = 0;
  edgeR = -1;
  crustBuiltFor = '';
  wrap = 1;
  bake = 0;
  wobble = 0;
  toppingCount = 0;
  defectKind: string | null = null;
  constructor(doughTex: THREE.Texture, sauceTex: THREE.Texture) {
    this.doughMat = new THREE.MeshStandardMaterial({ map: doughTex, roughness: 0.85, color: '#ffffff' });
    this.sauceMat = new THREE.MeshStandardMaterial({ map: sauceTex, roughness: 0.35, color: '#ffffff', polygonOffset: true, polygonOffsetFactor: -2 });
    this.dough = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.12, 128), this.doughMat);
    this.dough.castShadow = this.dough.receiveShadow = true;
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.65, 32, 20), this.doughMat);
    this.ball.scale.y = 0.62; this.ball.castShadow = true;
    this.edge = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 10, 128), this.doughMat);
    this.edge.rotation.x = Math.PI / 2; this.edge.castShadow = true;
    this.sauce = new THREE.Mesh(new THREE.CircleGeometry(1, 128), this.sauceMat);
    this.sauce.rotation.x = -Math.PI / 2;
    this.char = new THREE.Mesh(new THREE.RingGeometry(0.5, 1, 128), new THREE.MeshStandardMaterial({ color: '#3a2214', roughness: 1, transparent: true, opacity: 0, polygonOffset: true, polygonOffsetFactor: -3 }));
    this.char.rotation.x = -Math.PI / 2;
    this.puddle = new THREE.Mesh(blobGeometry(), new THREE.MeshStandardMaterial({ color: '#b42a18', roughness: 0.25, metalness: 0.05 }));
    this.puddle.rotation.x = -Math.PI / 2;
    this.puddle.receiveShadow = true;
    this.group.add(this.dough, this.ball, this.edge, this.sauce, this.char, this.puddle, this.toppings, this.defects, this.lava);
  }
  /** r, sauce in cm / cm². */
  update(pie: PieState, dt: number, g: GameState, index: number) {
    const R = pie.r * U;
    this.shownR = damp(this.shownR, R, 18, dt);
    const r = this.shownR;
    const isBall = pie.r <= 0;
    this.ball.visible = isBall;
    this.ball.position.y = PIE_Y + 0.25;
    this.dough.visible = this.edge.visible = !isBall && r > 0.05;
    const w = 1 + Math.sin(this.wobble * 30) * 0.12 * this.wobble;
    this.wobble = Math.max(0, this.wobble - dt * 1.6);
    this.dough.scale.set(r, w, r);
    this.dough.position.y = PIE_Y;
    if (Math.abs(this.edgeR - r) > 0.004) {
      this.edgeR = r;
      this.edge.geometry.dispose();
      this.edge.geometry = new THREE.TorusGeometry(Math.max(0.05, r), Math.min(0.075, 0.03 + r * 0.025), 10, 128);
    }
    this.edge.position.y = PIE_Y + 0.05;

    // Sauce: exact disc of the poured area; clamp to the dough only when the tolerance hides the difference.
    const target = Math.sqrt(pie.sauce / Math.PI) * U;
    const spreading = g.busy?.kind === 'squeeze' || g.busy?.kind === 'cleanup';
    this.shownSauce = spreading ? damp(this.shownSauce, target, 5, dt) : damp(this.shownSauce, target, 30, dt);
    const range = pie.r > 0 ? sauceRange(pie.r) : null;
    const within = range && pie.sauce >= range.min && pie.sauce <= range.max;
    const sr = within ? Math.min(this.shownSauce, r * 0.985) : Math.min(this.shownSauce, r * 0.995);
    this.sauce.visible = pie.sauce > 0 && !isBall;
    this.sauce.scale.set(Math.max(0.001, sr), Math.max(0.001, sr), 1);
    this.sauce.position.y = PIE_Y + 0.062;

    // Overflow puddle: the area beyond the dough lies on the counter around it.
    const overflowR = this.shownSauce > r * 1.0 && range && pie.sauce > range.max ? this.shownSauce : 0;
    const cleaning = g.busy?.kind === 'cleanup' ? g.busy.left / g.busy.total : 0;
    const puddleR = overflowR > 0 ? r + (overflowR - r) * (g.busy?.kind === 'cleanup' ? Math.min(1, cleaning * 1.6) : 0) * 1.0 : 0;
    this.puddle.visible = puddleR > r + 0.01;
    this.puddle.scale.setScalar(puddleR * 1.04);
    this.puddle.position.y = 0.012;

    // Baked look.
    const baked = pie.baked ? 1 : g.busy?.kind === 'bake' ? 1 - g.busy.left / g.busy.total : 0;
    this.bake = damp(this.bake, baked, 3, dt);
    this.doughMat.color.setRGB(1 - this.bake * 0.12, 1 - this.bake * 0.32, 1 - this.bake * 0.6);
    this.sauceMat.color.setRGB(1 - this.bake * 0.25, 1 - this.bake * 0.45, 1 - this.bake * 0.4);
    this.crustMat.color.setRGB(0.96 - this.bake * 0.1, 0.81 - this.bake * 0.25, 0.35 - this.bake * 0.2);

    // Bare ring chars in the oven.
    const bare = range && pie.sauce > 0 && pie.sauce < range.min;
    const bareNoSauce = range && pie.sauce === 0 && g.tickets[g.active]?.def.order.sauce;
    this.char.visible = !!(bare || bareNoSauce) && this.bake > 0.05;
    if (this.char.visible) {
      const inner = bare ? sr / Math.max(r, 0.01) : 0.0;
      this.char.geometry.dispose();
      this.char.geometry = new THREE.RingGeometry(Math.max(0.0001, inner), 1, 128);
      this.char.scale.set(r * 0.995, r * 0.995, 1);
      this.char.position.y = PIE_Y + 0.064;
      (this.char.material as THREE.MeshStandardMaterial).opacity = this.bake * 0.75;
      (this.char.material as THREE.MeshStandardMaterial).transparent = true;
    }

    this.updateCrust(pie, dt, r);
    this.updateToppings(pie, index, dt);
    this.updateDefects(pie, r);
  }
  private updateCrust(pie: PieState, dt: number, r: number) {
    const key = pie.cheese === null ? '' : `${pie.cheese}@${pie.r}`;
    if (key !== this.crustBuiltFor) {
      this.crustBuiltFor = key;
      if (this.crust) { this.group.remove(this.crust); this.crust.geometry.dispose(); this.crust = null; }
      this.lava.clear();
      if (pie.cheese !== null && pie.r > 0) {
        this.crust = new THREE.Mesh(crustGeometry(pie.cheese, pie.r), this.crustMat);
        this.crust.castShadow = true;
        this.group.add(this.crust);
        this.wrap = 0;
      }
    }
    if (this.crust) {
      this.wrap = Math.min(1, this.wrap + dt / 0.9);
      const idx = this.crust.geometry.index!.count;
      this.crust.geometry.setDrawRange(0, Math.floor((idx * ease(this.wrap)) / 6) * 6);
      this.crust.position.y = PIE_Y + 0.06;
      const short = pie.cheese! < crustRange(pie.r).min;
      if (short && this.bake > 0.3 && this.lava.children.length < 10) {
        const theta = pie.cheese! / pie.r;
        const ends = [Math.PI / 2, Math.PI / 2 - theta];
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.09 + Math.random() * 0.08, 10, 8), new THREE.MeshStandardMaterial({ color: '#ffc935', emissive: '#7a3d00', roughness: 0.3 }));
        const a = ends[this.lava.children.length % 2] + (Math.random() - 0.5) * 0.1;
        const out = r * (1.02 + Math.random() * 0.25);
        m.position.set(Math.cos(a) * out, PIE_Y + 0.04, Math.sin(a) * out);
        m.scale.y = 0.4;
        this.lava.add(m);
      }
    }
    this.crust && (this.crust.visible = r > 0.05);
  }
  private updateToppings(pie: PieState, index: number, dt: number) {
    const mine = pie.toppings.filter((t) => t.pie === index || pie.count === 1);
    if (mine.length < this.toppingCount) { this.toppings.clear(); this.toppingCount = 0; }
    while (this.toppingCount < mine.length) {
      const t = mine[this.toppingCount++];
      const m = new THREE.Mesh(TOPPING_GEO[t.kind], TOPPING_MAT[t.kind]);
      m.castShadow = true;
      m.userData = { tx: t.x * U, tz: t.z * U, age: 0 };
      m.rotation.y = t.rot;
      this.toppings.add(m);
    }
    for (const m of this.toppings.children) {
      const d = m.userData as { tx: number; tz: number; age: number };
      d.age += dt;
      const f = ease(d.age / 0.45);
      m.position.set(d.tx * f + 2.5 * (1 - f), PIE_Y + 0.1 + Math.sin(f * Math.PI) * 1.4 + (1 - f) * 0.3, d.tz * f + 2.2 * (1 - f));
    }
  }
  private updateDefects(pie: PieState, r: number) {
    if (pie.tore === this.defectKind) return;
    this.defectKind = pie.tore;
    this.defects.clear();
    if (!pie.tore) return;
    const mat = new THREE.MeshBasicMaterial({ color: pie.tore === 'tear' ? '#5a3b22' : '#7c5a35' });
    for (let i = 0; i < (pie.tore === 'tear' ? 6 : 9); i++) {
      const a = (i / 9) * Math.PI * 2 + Math.random() * 0.4;
      const m = pie.tore === 'tear'
        ? new THREE.Mesh(new THREE.CircleGeometry(0.06 + Math.random() * 0.1, 12), mat)
        : new THREE.Mesh(new THREE.PlaneGeometry(0.02, 0.25 + Math.random() * 0.25), mat);
      m.rotation.x = -Math.PI / 2;
      if (pie.tore === 'crack') m.rotation.z = -a + Math.PI / 2;
      const rr = (0.35 + Math.random() * 0.5) * Math.max(r, 0.7);
      m.position.set(Math.cos(a) * rr, PIE_Y + 0.07, Math.sin(a) * rr);
      this.defects.add(m);
    }
  }
}

function blobGeometry() {
  const shape = new THREE.Shape();
  const n = 64;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = 1 + Math.sin(a * 5) * 0.04 + Math.sin(a * 11 + 1) * 0.03;
    if (i === 0) shape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else shape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  return new THREE.ShapeGeometry(shape, 2);
}

/** The cheese rope wraps the rim starting at the front: exact arc length L on radius r; extra rope rides up as a second layer. */
function crustGeometry(Lcm: number, rcm: number) {
  const R = rcm * U;
  const theta = Lcm / rcm;
  const pts: THREE.Vector3[] = [];
  const steps = Math.max(8, Math.ceil(theta / 0.04));
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * theta;
    const lap = t / (Math.PI * 2);
    const extra = Math.max(0, lap - 1);
    const lift = Math.min(1, extra * 12) * 0.12;
    const a = Math.PI / 2 - t;
    const rr = R - Math.min(1, extra * 12) * 0.03;
    pts.push(new THREE.Vector3(Math.cos(a) * rr, 0.04 + lift, Math.sin(a) * rr));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  return new THREE.TubeGeometry(curve, steps, 0.1, 10, false);
}

// ---------------- characters ----------------
interface Actor { root: THREE.Object3D; mixer?: THREE.AnimationMixer; actions: Record<string, THREE.AnimationAction>; current?: string; react: number; mood: 'happy' | 'sad' | 'idle'; home: THREE.Vector3; target: THREE.Vector3; baseY: number; phase: number }

export interface ModelInfo { name: string; ok: boolean; triangles: number; animations: string[] }

export class PizzaScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  particles: Particles;
  pies: PieView[];
  peel = new THREE.Group();
  ovenLight: THREE.PointLight;
  oven = new THREE.Group();
  bottle = new THREE.Group();
  bell = new THREE.Group();
  knife = new THREE.Group();
  sponge: THREE.Mesh;
  rope!: THREE.Mesh;
  ropeEnd!: THREE.Mesh;
  reel = new THREE.Group();
  tape!: THREE.Mesh;
  doughRuler: THREE.Mesh;
  rulerPin: THREE.Sprite;
  ghost: THREE.LineLoop;
  ghostLabel: THREE.Sprite;
  mixGroup = new THREE.Group();
  flourMound!: THREE.Mesh;
  water!: THREE.Mesh;
  jug = new THREE.Group();
  mixBall!: THREE.Mesh;
  jars: THREE.Object3D[] = [];
  dust: THREE.Points;
  chef: Actor | null = null;
  customers: Record<string, Actor[]> = {};
  modelInfo: ModelInfo[] = [];
  camPos = new THREE.Vector3(0, 14, 20);
  camLook = new THREE.Vector3(0, 0, 0);
  private shake = 0;
  private time = 0;
  private bottleSquash = 0;
  private bellBounce = 0;
  private knifeDrop = 0;
  private pourTilt = 0;
  private lastPin = '';
  private raycaster = new THREE.Raycaster();
  private counterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -PIE_Y);
  reducedMotion = false;
  lost = false;
  fps = 0;
  private fpsAcc = 0; private fpsN = 0;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; window.dispatchEvent(new CustomEvent('pizza-context-lost')); });
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
    this.scene.background = new THREE.Color('#1a0f0b');
    this.scene.fog = new THREE.Fog('#1a0f0b', 26, 60);

    this.buildRoom();
    this.particles = new Particles(this.scene);
    const dt = doughTexture(), st = sauceTexture();
    this.pies = [new PieView(dt, st), new PieView(dt, st)];
    this.buildPeel();
    this.pies.forEach((p) => this.peel.add(p.group));
    this.scene.add(this.peel);
    this.ovenLight = new THREE.PointLight('#ff8a3a', 60, 22, 1.6);
    this.ovenLight.position.copy(OVEN_MOUTH).add(new THREE.Vector3(0.6, 0.6, 0.8));
    this.scene.add(this.ovenLight);

    // Dough ruler: 0 at the pie centre, pointing right.
    const rt = rulerTexture(26, 40, '#f8e9a8', 5);
    this.doughRuler = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.3), new THREE.MeshStandardMaterial({ map: rt, transparent: true, opacity: 0.92, roughness: 0.4 }));
    this.doughRuler.rotation.x = -Math.PI / 2;
    this.doughRuler.geometry.translate(1.3, 0, 0);
    this.scene.add(this.doughRuler);
    this.rulerPin = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture('r = 0'), depthTest: false }));
    this.rulerPin.scale.set(1.3, 0.49, 1);
    this.rulerPin.renderOrder = 10;
    this.scene.add(this.rulerPin);

    const ghostGeo = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 129 }, (_, i) => { const a = (i / 128) * Math.PI * 2; return new THREE.Vector3(Math.cos(a), 0, Math.sin(a)); }));
    this.ghost = new THREE.LineLoop(ghostGeo, new THREE.LineDashedMaterial({ color: '#ffffff', dashSize: 0.08, gapSize: 0.06, transparent: true, opacity: 0.9, depthTest: false }));
    this.ghost.computeLineDistances();
    this.ghost.renderOrder = 9;
    this.ghostLabel = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture('הרגילה', 'rgba(255,255,255,0.85)', '#3a2214'), depthTest: false }));
    this.ghostLabel.scale.set(1.1, 0.41, 1);
    this.ghostLabel.renderOrder = 10;
    this.scene.add(this.ghost, this.ghostLabel);

    this.buildCrustStation();
    this.buildMix();
    this.buildToppings();
    this.buildBellAndKnife();
    this.sponge = new THREE.Mesh(new RoundedBox(0.7, 0.25, 0.45), new THREE.MeshStandardMaterial({ color: '#d7e04a', roughness: 0.9 }));
    this.sponge.visible = false; this.sponge.castShadow = true;
    this.scene.add(this.sponge);
    this.dust = this.buildDust();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  // ---------- building ----------
  private buildRoom() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight('#ffd9a8', '#3a1d10', 0.85));
    const key = new THREE.DirectionalLight('#fff0d8', 2.0);
    key.position.set(7, 18, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -14, right: 14, top: 10, bottom: -10, near: 1, far: 50 });
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.02;
    s.add(key);
    // One green pendant lamp over the pie, as in the mockup.
    const lamp = new THREE.PointLight('#ffc27a', 34, 16, 1.6);
    lamp.position.set(0.5, 6.2, -0.5);
    s.add(lamp);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(1.2, 0.9, 32, 1, true), new THREE.MeshStandardMaterial({ color: '#2f5b3a', side: THREE.DoubleSide, roughness: 0.5, metalness: 0.2 }));
    shade.position.set(0.5, 7.4, -0.5);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 10), new THREE.MeshBasicMaterial({ color: '#fff1c4' }));
    bulb.position.set(0.5, 6.95, -0.5);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 8), new THREE.MeshBasicMaterial({ color: '#111' }));
    cord.position.set(0.5, 11.8, -0.5);
    s.add(shade, bulb, cord);

    // Butcher-block counter on a terracotta body with a tiled front.
    const wood = woodTexture();
    wood.repeat.set(2, 1);
    const top = new THREE.Mesh(new THREE.BoxGeometry(26, 0.5, 8.4), new THREE.MeshStandardMaterial({ map: wood, roughness: 0.75 }));
    top.position.set(-1, -0.25, 0.1);
    top.receiveShadow = true;
    s.add(top);
    const body = new THREE.Mesh(new THREE.BoxGeometry(25.6, -FLOOR_Y, 8), new THREE.MeshStandardMaterial({ color: '#b8583a', roughness: 0.9 }));
    body.position.set(-1, FLOOR_Y / 2 - 0.25, 0.1);
    s.add(body);
    for (let i = 0; i < 26; i++) for (let j = 0; j < 3; j++) {
      const tile = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.92, 0.05), new THREE.MeshStandardMaterial({ color: (i + j) % 2 ? '#e6cf9f' : '#2f6b4a', roughness: 0.6 }));
      tile.position.set(-13.5 + i, -1.0 - j, 4.13);
      (tile.material as THREE.MeshStandardMaterial).color.set((i + j) % 3 === 0 ? '#d98a5a' : (i + j) % 3 === 1 ? '#c46a3f' : '#e8c79a');
      s.add(tile);
    }
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), new THREE.MeshStandardMaterial({ color: '#4a2c1c', roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR_Y; floor.receiveShadow = true;
    s.add(floor);

    // Brick back wall with a pass window where the customer waits.
    const bricks = () => { const t = brickTexture(); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }); };
    const win = { x0: -3.2, x1: 3.6, y0: 1.6, y1: 6.4 };
    const addWall = (x0: number, x1: number, y0: number, y1: number) => {
      const w = x1 - x0, h = y1 - y0;
      const m = bricks(); m.map!.repeat.set(w / 9, h / 4.5);
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
      plane.position.set((x0 + x1) / 2, (y0 + y1) / 2, WALL_Z);
      plane.receiveShadow = true;
      s.add(plane);
    };
    addWall(-30, win.x0, FLOOR_Y, 22); addWall(win.x1, 30, FLOOR_Y, 22);
    addWall(win.x0, win.x1, FLOOR_Y, win.y0); addWall(win.x0, win.x1, win.y1, 22);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(win.x1 - win.x0 + 0.6, 0.3, 1.6), new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.7 }));
    sill.position.set((win.x0 + win.x1) / 2, win.y0, WALL_Z + 0.2);
    sill.receiveShadow = sill.castShadow = true;
    s.add(sill);
    const frameMat = new THREE.MeshStandardMaterial({ color: '#2f5b3a', roughness: 0.6 });
    for (const [x, w] of [[win.x0, 0.25], [win.x1, 0.25]] as const) { const f = new THREE.Mesh(new THREE.BoxGeometry(w, win.y1 - win.y0, 0.4), frameMat); f.position.set(x, (win.y0 + win.y1) / 2, WALL_Z); s.add(f); }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(win.x1 - win.x0 + 0.25, 0.3, 0.4), frameMat);
    lintel.position.set((win.x0 + win.x1) / 2, win.y1, WALL_Z); s.add(lintel);
    // The dining room beyond the window: warm and dim.
    const dining = new THREE.Mesh(new THREE.PlaneGeometry(30, 20), new THREE.MeshStandardMaterial({ color: '#5a3424', roughness: 1 }));
    dining.position.set(0, 4, WALL_Z - 6);
    s.add(dining);
    const diningLight = new THREE.PointLight('#ffb070', 30, 14, 1.5);
    diningLight.position.set(0.5, 6, WALL_Z - 2.5);
    s.add(diningLight);
    // Italian flag bunting in the window.
    for (let i = 0; i < 9; i++) {
      const flag = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 3), new THREE.MeshStandardMaterial({ color: ['#2f8f4a', '#f4efe2', '#d23a2a'][i % 3], roughness: 0.8 }));
      flag.rotation.x = Math.PI; flag.position.set(win.x0 + 0.5 + i * 0.75, win.y1 - 0.55 - Math.sin((i / 8) * Math.PI) * 0.3, WALL_Z - 0.4);
      s.add(flag);
    }

    // Chalkboard menu left of the window.
    const board = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.9), new THREE.MeshStandardMaterial({ map: chalkboardTexture(['תפריט', 'מרגריטה · קוטר 30', 'קרום ממולא · 2πr', 'משפחתית · πr²', 'בצק 5 : 3']), roughness: 0.9 }));
    board.position.set(-6.2, 4.6, WALL_Z + 0.05);
    s.add(board);
    // String lights across the wall.
    const bulbMat = new THREE.MeshBasicMaterial({ color: '#ffcf7a' });
    for (let i = 0; i < 34; i++) {
      const x = -16 + i * 1.0;
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), bulbMat);
      b.position.set(x, 8.1 - Math.abs(Math.sin(i * 0.33)) * 0.9, WALL_Z + 0.3);
      s.add(b);
    }
    // Shelf with jars, basil pots on the counter, a flour bowl and olive oil (set dressing).
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(5, 0.2, 1), new THREE.MeshStandardMaterial({ color: '#6b3f22' }));
    shelf.position.set(7.5, 4.3, WALL_Z + 0.5);
    s.add(shelf);
    for (let i = 0; i < 4; i++) {
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.9, 16), new THREE.MeshStandardMaterial({ color: ['#c8311f', '#e8c35a', '#3f8f3a', '#e7d6bb'][i], roughness: 0.3, transparent: true, opacity: 0.85 }));
      jar.position.set(5.8 + i * 1.15, 4.85, WALL_Z + 0.5);
      s.add(jar);
    }
    const pot = (x: number, z: number, sc = 1) => {
      const g = new THREE.Group();
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.35, 0.7, 16), new THREE.MeshStandardMaterial({ color: '#b8583a', roughness: 0.9 }));
      p.position.y = 0.35; g.add(p);
      for (let i = 0; i < 14; i++) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshStandardMaterial({ color: i % 2 ? '#3f8f3a' : '#4fa645', roughness: 0.6 }));
        leaf.scale.set(1, 0.45, 0.7);
        leaf.position.set((Math.random() - 0.5) * 0.7, 0.8 + Math.random() * 0.6, (Math.random() - 0.5) * 0.7);
        leaf.rotation.set(Math.random(), Math.random() * 3, Math.random());
        g.add(leaf);
      }
      g.position.set(x, 0, z); g.scale.setScalar(sc);
      g.traverse((o) => (o.castShadow = true));
      s.add(g);
    };
    pot(-10.5, -2.6, 1.3); pot(-2.8, -3.2); pot(9.5, -2.8, 1.2);
    const flourBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.6, 0.5, 24), new THREE.MeshStandardMaterial({ color: '#8a5a3a', roughness: 0.6 }));
    flourBowl.position.set(-4.8, 0.25, 1.9);
    const flour = new THREE.Mesh(new THREE.SphereGeometry(0.8, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#fbf6ea', roughness: 1 }));
    flour.scale.y = 0.4; flour.position.set(-4.8, 0.45, 1.9);
    const oil = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 1.4, 12), new THREE.MeshStandardMaterial({ color: '#c9a227', roughness: 0.15, transparent: true, opacity: 0.8 }));
    oil.position.set(-3.4, 0.7, -2.4);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.2), new THREE.MeshStandardMaterial({ map: checkTexture(), roughness: 0.9 }));
    cloth.rotation.x = -Math.PI / 2; cloth.rotation.z = 0.3; cloth.position.set(-6.2, 0.01, 2.5);
    for (const m of [flourBowl, flour, oil]) m.castShadow = true;
    cloth.receiveShadow = true;
    s.add(flourBowl, flour, oil, cloth);
  }

  private buildPeel() {
    const wood = new THREE.MeshStandardMaterial({ color: '#d9a066', roughness: 0.8 });
    const board = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.1, 64), wood);
    board.position.y = PEEL_Y - 0.03; board.receiveShadow = true; board.castShadow = true;
    board.scale.x = 1.1;
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.1, 3.2), wood);
    handle.position.set(-0.6 * 4.1, PEEL_Y - 0.03, 0.8 * 4.1); handle.rotation.y = Math.atan2(-0.6, 0.8); handle.castShadow = true;
    this.peel.add(board, handle);
    this.peel.userData.board = board;
    this.peel.userData.handle = handle;
  }

  private buildCrustStation() {
    const cx = REEL_X;
    const tape = new THREE.Mesh(new THREE.PlaneGeometry(14, 0.42), new THREE.MeshStandardMaterial({ map: rulerTexture(140, 24, '#f6d34a', 10, true), roughness: 0.5 }));
    tape.rotation.x = -Math.PI / 2;
    tape.position.set(cx - 7, 0.012, ROPE_Z + 0.02);
    tape.receiveShadow = true;
    this.tape = tape;
    this.scene.add(tape);
    const reelBody = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.55, 32), new THREE.MeshStandardMaterial({ color: '#2f6b4a', roughness: 0.5, metalness: 0.2 }));
    reelBody.rotation.x = Math.PI / 2;
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.18, 12, 32), new THREE.MeshStandardMaterial({ color: '#f5cf5a', roughness: 0.45 }));
    coil.position.z = 0.3;
    this.reel.add(reelBody, coil);
    this.reel.position.set(cx + 0.7, 0.75, ROPE_Z);
    this.reel.traverse((o) => (o.castShadow = true));
    this.scene.add(this.reel);
    this.rope = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1, 12).rotateZ(Math.PI / 2).translate(-0.5, 0, 0), new THREE.MeshStandardMaterial({ color: '#f5cf5a', roughness: 0.45, emissive: '#2a1800' }));
    this.rope.position.set(cx, 0.12, ROPE_Z);
    this.rope.castShadow = true;
    this.ropeEnd = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 10), new THREE.MeshStandardMaterial({ color: '#ffe08a', roughness: 0.4 }));
    this.ropeEnd.castShadow = true;
    this.scene.add(this.rope, this.ropeEnd);
  }

  private buildMix() {
    const g = this.mixGroup;
    const pts = [new THREE.Vector2(0, 0), new THREE.Vector2(1.2, 0), new THREE.Vector2(1.9, 0.6), new THREE.Vector2(2.2, 1.4), new THREE.Vector2(2.3, 1.55), new THREE.Vector2(2.1, 1.5), new THREE.Vector2(1.7, 0.75), new THREE.Vector2(1.1, 0.15), new THREE.Vector2(0, 0.15)];
    const bowl = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), new THREE.MeshStandardMaterial({ color: '#e9e2d4', roughness: 0.25, metalness: 0.4, side: THREE.DoubleSide }));
    bowl.castShadow = bowl.receiveShadow = true;
    this.flourMound = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#fbf6ea', roughness: 1 }));
    this.water = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.3, 0.1, 32), new THREE.MeshStandardMaterial({ color: '#8fc6e8', roughness: 0.05, transparent: true, opacity: 0.7 }));
    this.mixBall = new THREE.Mesh(new THREE.SphereGeometry(0.85, 32, 20), new THREE.MeshStandardMaterial({ map: doughTexture(), roughness: 0.85 }));
    this.mixBall.scale.y = 0.7;
    const jugBody = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 1.6, 24, 1, true), new THREE.MeshStandardMaterial({ color: '#cfe6f2', roughness: 0.1, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    const jugWater = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 1.0, 24), new THREE.MeshStandardMaterial({ color: '#6fb3df', roughness: 0.1, transparent: true, opacity: 0.8 }));
    jugWater.position.y = -0.25;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.07, 8, 16, Math.PI), new THREE.MeshStandardMaterial({ color: '#cfe6f2' }));
    handle.rotation.z = -Math.PI / 2; handle.position.x = 0.62;
    this.jug.add(jugBody, jugWater, handle);
    this.jug.position.set(2.9, 1.0, 0.3);
    const sack = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshStandardMaterial({ color: '#d8c49a', roughness: 1 }));
    sack.scale.set(0.95, 1.15, 0.8); sack.position.set(-2.8, 1.05, -0.6);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), new THREE.MeshStandardMaterial({ map: labelTexture('קמח', '#2f6b4a', '#fff') }));
    label.position.set(-2.8, 1.15, 0.2);
    g.add(bowl, this.flourMound, this.water, this.mixBall, this.jug, sack, label);
    g.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
    g.position.copy(MIX_POS);
    g.scale.setScalar(0.85);
    this.scene.add(g);
  }

  private buildToppings() {
    const kinds: ToppingKind[] = ['basil', 'pepperoni', 'olive', 'mushroom'];
    kinds.forEach((k, i) => {
      const jar = new THREE.Group();
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.5, 0.9, 24), new THREE.MeshStandardMaterial({ color: '#f3efe6', roughness: 0.1, transparent: true, opacity: 0.4 }));
      glass.position.y = 0.45;
      jar.add(glass);
      for (let j = 0; j < 10; j++) {
        const m = new THREE.Mesh(TOPPING_GEO[k], TOPPING_MAT[k]);
        m.position.set((Math.random() - 0.5) * 0.6, 0.15 + Math.random() * 0.5, (Math.random() - 0.5) * 0.6);
        m.scale.setScalar(1.6);
        m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
        jar.add(m);
      }
      jar.position.set(3.4 + i * 1.25, 0, -2.3 + (i % 2) * 0.5);
      jar.userData = { topping: k };
      jar.traverse((o) => { o.userData.topping = k; o.castShadow = true; });
      this.jars.push(jar);
      this.scene.add(jar);
    });
  }

  private buildBellAndKnife() {
    const gold = new THREE.MeshStandardMaterial({ color: '#e3b341', metalness: 0.85, roughness: 0.25 });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), gold);
    dome.position.y = 0.12;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.12, 24), new THREE.MeshStandardMaterial({ color: '#3a2a20' }));
    base.position.y = 0.06;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), gold);
    knob.position.y = 0.6;
    this.bell.add(base, dome, knob);
    this.bell.position.set(-3.4, 0, 2.7);
    this.bell.traverse((o) => (o.castShadow = true));
    this.bell.userData.bell = true;
    this.bell.traverse((o) => (o.userData.bell = true));
    this.scene.add(this.bell);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.9, 1.1), new THREE.MeshStandardMaterial({ color: '#d9dee3', metalness: 0.9, roughness: 0.2 }));
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.35, 0.9), new THREE.MeshStandardMaterial({ color: '#5b3420' }));
    handle.position.set(0, 0.6, -0.1);
    this.knife.add(blade, handle);
    this.knife.traverse((o) => (o.castShadow = true));
    this.scene.add(this.knife);
  }

  private buildDust() {
    const n = 380;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = -16 + Math.random() * 30; pos[i * 3 + 1] = Math.random() * 8; pos[i * 3 + 2] = -4 + Math.random() * 8; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#fff2d0', size: 0.06, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.scene.add(pts);
    return pts;
  }

  // ---------- models ----------
  async loadModels(onProgress: (msg: string) => void) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const load = (file: string) => new Promise<{ scene: THREE.Object3D; animations: THREE.AnimationClip[] } | null>((res) => loader.load(`${BASE}models/${file}`, (g) => res(g), undefined, () => res(null)));
    const tris = (o: THREE.Object3D) => { let t = 0; o.traverse((m) => { const g = (m as THREE.Mesh).geometry; if ((m as THREE.Mesh).isMesh && g) t += (g.index ? g.index.count : g.attributes.position.count) / 3; }); return Math.round(t); };
    const fit = (o: THREE.Object3D, height: number) => {
      o.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(o);
      const size = box.getSize(new THREE.Vector3());
      const s = height / size.y;
      o.scale.multiplyScalar(s);
      o.updateMatrixWorld(true);
      const b2 = new THREE.Box3().setFromObject(o);
      const c = b2.getCenter(new THREE.Vector3());
      o.position.x -= c.x; o.position.z -= c.z; o.position.y -= b2.min.y;
      const wrap = new THREE.Group(); wrap.add(o);
      o.traverse((m) => { if ((m as THREE.Mesh).isMesh) { m.castShadow = true; m.receiveShadow = true; } });
      return wrap;
    };
    onProgress('מחממים את התנור…');
    const [oven, bottle, chef, noa, saba] = await Promise.all(['oven.glb', 'sauce-bottle.glb', 'chef.glb', 'noa.glb', 'saba.glb'].map(load));
    const info = (name: string, g: { scene: THREE.Object3D; animations: THREE.AnimationClip[] } | null) => this.modelInfo.push({ name, ok: !!g, triangles: g ? tris(g.scene) : 0, animations: g ? g.animations.map((a) => a.name) : [] });
    info('oven', oven); info('sauce-bottle', bottle); info('chef', chef); info('noa', noa); info('saba', saba);

    if (oven) { const o = fit(oven.scene, 7.4); this.oven.add(o); this.oven.rotation.y = 0.7; }
    else { const dome = new THREE.Mesh(new THREE.SphereGeometry(5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#b8583a' })); dome.position.y = 4.6; this.oven.add(dome); }
    this.oven.position.copy(OVEN_POS);
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(8.5, OVEN_POS.y - FLOOR_Y, 7), new THREE.MeshStandardMaterial({ color: '#7a6a5a', roughness: 0.95 }));
    plinth.position.set(OVEN_POS.x, (OVEN_POS.y + FLOOR_Y) / 2, OVEN_POS.z);
    plinth.receiveShadow = true;
    this.scene.add(plinth);
    this.scene.add(this.oven);

    if (bottle) this.bottle.add(fit(bottle.scene, 2.2));
    else this.bottle.add(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 2, 16), new THREE.MeshStandardMaterial({ color: '#c8311f' })));
    this.scene.add(this.bottle);

    const actor = (g: { scene: THREE.Object3D; animations: THREE.AnimationClip[] } | null, height: number, color: string, pos: THREE.Vector3, clone = false): Actor => {
      let root: THREE.Object3D;
      let mixer: THREE.AnimationMixer | undefined;
      const actions: Record<string, THREE.AnimationAction> = {};
      if (g) {
        const src = clone ? SkeletonUtils.clone(g.scene) : g.scene;
        root = fit(src, height);
        if (g.animations.length) {
          mixer = new THREE.AnimationMixer(src);
          for (const clip of g.animations) actions[clip.name.toLowerCase()] = mixer.clipAction(clip);
        }
      } else {
        root = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(height * 0.18, height * 0.5, 8, 16), new THREE.MeshStandardMaterial({ color }));
        body.position.y = height * 0.45; root.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(height * 0.14, 20, 14), new THREE.MeshStandardMaterial({ color: '#f0c9a0' }));
        head.position.y = height * 0.88; root.add(head);
      }
      root.position.copy(pos);
      this.scene.add(root);
      const a: Actor = { root, mixer, actions, react: 0, mood: 'idle', home: pos.clone(), target: pos.clone(), baseY: pos.y, phase: Math.random() * 6 };
      this.play(a, 'idle');
      return a;
    };
    onProgress('מזמינים לקוחות…');
    this.chef = actor(chef, 12.5, '#ffffff', new THREE.Vector3(7.6, FLOOR_Y, -4.4));
    this.chef.root.rotation.y = -0.55;
    const noaPos = new THREE.Vector3(18, FLOOR_Y, WALL_Z - 1.6);
    this.customers.noa = [actor(noa, 10.5, '#9b6fd1', noaPos.clone())];
    this.customers.saba = [actor(saba, 11.8, '#3f8f3a', noaPos.clone())];
    this.customers.kids = [0, 1, 2].map((i) => {
      const a = actor(noa, 8.6 + i * 0.5, '#9b6fd1', noaPos.clone(), true);
      a.root.traverse((m) => { const mm = (m as THREE.Mesh).material as THREE.MeshStandardMaterial; if ((m as THREE.Mesh).isMesh && mm?.color) { (m as THREE.Mesh).material = mm.clone(); ((m as THREE.Mesh).material as THREE.MeshStandardMaterial).color.offsetHSL([0, 0.35, -0.25][i], 0, 0); } });
      return a;
    });
    onProgress('');
  }

  private play(a: Actor, want: 'idle' | 'happy' | 'sad') {
    const names = Object.keys(a.actions);
    if (!names.length) return;
    const pick = (keys: string[]) => names.find((n) => keys.some((k) => n.includes(k)));
    const name = (want === 'happy' ? pick(['cheer', 'jump', 'dance', 'happy', 'clap', 'victory']) : want === 'sad' ? pick(['sad', 'hurt', 'fall', 'defeat', 'angry', 'shake']) : pick(['idle', 'breath', 'stand'])) ?? pick(['idle']) ?? names[0];
    if (a.current === name) return;
    const next = a.actions[name];
    next.reset().fadeIn(0.25).play();
    if (want !== 'idle') { next.setLoop(THREE.LoopRepeat, 2); }
    if (a.current) a.actions[a.current].fadeOut(0.25);
    a.current = name;
  }

  // ---------- frame ----------
  resize() {
    const w = this.renderer.domElement.parentElement?.clientWidth || window.innerWidth;
    const h = this.renderer.domElement.parentElement?.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Camera framing: keeps a target width visible whatever the aspect ratio. */
  private frame(look: THREE.Vector3, width: number, pitch: number, yaw: number, out: THREE.Vector3) {
    const vfov = THREE.MathUtils.degToRad(this.camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    const portrait = this.camera.aspect < 0.9;
    const dist = Math.max((width / 2) / Math.tan(hfov / 2), (width * 0.5) / 2 / Math.tan(vfov / 2)) * (portrait ? 1.0 : 1.0);
    out.set(look.x + Math.sin(yaw) * Math.cos(pitch) * dist, look.y + Math.sin(pitch) * dist, look.z + Math.cos(yaw) * Math.cos(pitch) * dist);
  }

  handleCue(c: Cue, g: GameState) {
    const pieWorld = this.peel.position.clone().add(new THREE.Vector3(0, PIE_Y + 0.2, 0));
    const R = Math.max(0.6, g.pie.r * U);
    switch (c.kind) {
      case 'stretch': this.pies.forEach((p) => (p.wobble = 0.6)); if (Math.random() < 0.5) this.particles.emit({ pos: pieWorld.clone().add(new THREE.Vector3(R, 0, 0)), n: 6, color: '#fff8e8', speed: 1.2, up: 1.4, size: 0.05, life: 0.7, g: 1.5, drag: 2 }); break;
      case 'tray': this.shakeCam(0.25); break;
      case 'squeeze': this.bottleSquash = 1; setTimeout(() => this.particles.emit({ pos: pieWorld, n: 24, color: ['#c8311f', '#e04a2a'], speed: 2.2, up: 1.6, size: 0.07, life: 0.8 }), 250); break;
      case 'overflow': this.bottleSquash = 1.4; this.shakeCam(0.5); setTimeout(() => this.particles.emit({ pos: pieWorld, n: 70, color: ['#c8311f', '#e04a2a', '#8a1c10'], speed: 4.5, up: 3, size: 0.09, life: 1.2 }), 250); break;
      case 'cut': this.knifeDrop = 1; this.shakeCam(0.18); this.particles.emit({ pos: this.ropeEnd.position.clone(), n: 16, color: ['#ffe08a', '#f5cf5a'], speed: 2, up: 2.5, size: 0.06, life: 0.7 }); break;
      case 'topping': break;
      case 'bake_start': this.particles.emit({ pos: OVEN_MOUTH.clone(), n: 40, color: ['#ffb347', '#ff7a1a', '#ffd27a'], speed: 1.5, up: 4, size: 0.06, life: 1.4, g: -1, drag: 1.5 }); break;
      case 'bake_done': this.particles.emit({ pos: pieWorld, n: 26, color: ['#f2ede4', '#d8d2c8'], speed: 0.6, up: 2.2, size: 0.18, life: 1.6, g: -0.6, drag: 1.2, grow: 2 }); break;
      case 'serve': {
        this.bellBounce = 1;
        const cust = this.activeCustomers(g);
        const ok = c.values?.outcome !== 'fail';
        cust.forEach((a) => { a.react = 2.2; a.mood = ok ? 'happy' : 'sad'; this.play(a, a.mood); });
        if (c.values?.outcome === 'perfect') setTimeout(() => this.particles.emit({ pos: new THREE.Vector3(PICKUP.x, 5, WALL_Z + 1), n: 120, color: ['#ffcf3a', '#3f8f3a', '#e0482a', '#ffffff', '#7ac0ff'], speed: 5, up: 7, size: 0.09, life: 2.2, g: 7, drag: 0.6 }), 300);
        if (!ok) this.shakeCam(0.35);
        break;
      }
      case 'knead': this.particles.emit({ pos: this.mixGroup.position.clone().add(new THREE.Vector3(0, 1.4, 0)), n: 30, color: '#fffaf0', speed: 1.5, up: 2, size: 0.07, life: 1, g: 1, drag: 2 }); break;
      case 'pour': if (c.values?.what === 'flour') this.particles.emit({ pos: this.mixGroup.position.clone().add(new THREE.Vector3(0, 1.8, 0)), n: 8, color: '#fffaf0', speed: 0.8, up: 1, size: 0.07, life: 0.9, g: 1, drag: 2 }); else this.pourTilt = 1; break;
      case 'tear': case 'crack': this.shakeCam(0.3); this.particles.emit({ pos: pieWorld, n: 25, color: ['#f2dcae', '#fff8e8'], speed: 2, up: 2, size: 0.07, life: 0.9 }); break;
      case 'trash': this.particles.emit({ pos: pieWorld, n: 20, color: ['#f2dcae', '#c8311f'], speed: 3, up: 3, size: 0.08, life: 0.8 }); break;
      case 'level_done': this.particles.emit({ pos: new THREE.Vector3(this.camLook.x, 6, 0), n: 160, color: ['#ffcf3a', '#3f8f3a', '#e0482a', '#ffffff'], speed: 6, up: 8, size: 0.1, life: 2.5, g: 7, drag: 0.5 }); break;
    }
  }

  shakeCam(a: number) { if (!this.reducedMotion) this.shake = Math.max(this.shake, a); }

  private activeCustomers(g: GameState): Actor[] {
    return this.customers[activeTicket(g)?.def.customer ?? 'noa'] ?? [];
  }

  sync(g: GameState, dtRaw: number) {
    const dt = Math.min(0.05, dtRaw);
    this.time += dt;
    this.fpsAcc += dtRaw; this.fpsN++;
    if (this.fpsAcc > 1) { this.fps = Math.round(this.fpsN / this.fpsAcc); this.fpsAcc = 0; this.fpsN = 0; }
    const pie = g.result ? g.result.pie : g.pie;
    const st = g.station;

    // ---- peel position ----
    const peelTarget = HOME.clone();
    let peelY = 0, peelScale = 1;
    if (g.busy?.kind === 'bake') {
      const f = 1 - g.busy.left / g.busy.total;
      const inside = Math.min(1, f * 4) * Math.min(1, (1 - f) * 4);
      peelTarget.lerpVectors(HOME, OVEN_MOUTH, inside);
      peelY = inside * (OVEN_MOUTH.y);
      peelScale = 1 - inside * 0.15;
    }
    if (g.phase === 'result') peelTarget.copy(PICKUP);
    this.peel.position.x = damp(this.peel.position.x, peelTarget.x, 7, dt);
    this.peel.position.z = damp(this.peel.position.z, peelTarget.z, 7, dt);
    this.peel.position.y = damp(this.peel.position.y, peelY, 7, dt);
    this.peel.scale.setScalar(damp(this.peel.scale.x, peelScale, 7, dt));
    const two = pie.count === 2;
    const board = this.peel.userData.board as THREE.Mesh;
    const R = pie.r * U;
    const br = Math.max(1.3, this.pies[0].shownR + 0.35);
    board.scale.set(two ? br * 2.05 : br, 1, br);
    const handle = this.peel.userData.handle as THREE.Mesh;
    handle.position.set(-0.6 * (br + 1.5), PEEL_Y - 0.03, 0.8 * (br + 1.5));

    // ---- pies ----
    this.pies[1].group.visible = two;
    this.pies[0].group.position.x = damp(this.pies[0].group.position.x, two ? R + 0.15 : 0, 10, dt);
    this.pies[1].group.position.x = -(R + 0.15);
    this.pies[0].update(pie, dt, g, 0);
    if (two) this.pies[1].update(pie, dt, g, 1);

    // ---- dough ruler and ghost ----
    const onDough = st === 'dough' && g.phase === 'playing' && !two;
    this.doughRuler.visible = onDough && pie.r > 0 && !pie.baked;
    this.doughRuler.position.set(this.peel.position.x, PIE_Y + 0.14, this.peel.position.z + 0.0);
    this.rulerPin.visible = this.doughRuler.visible;
    if (this.rulerPin.visible) {
      const label = `r = ${pie.r}`;
      if (label !== this.lastPin) { this.lastPin = label; (this.rulerPin.material as THREE.SpriteMaterial).map?.dispose(); (this.rulerPin.material as THREE.SpriteMaterial).map = labelTexture(label); }
      this.rulerPin.position.set(this.peel.position.x + this.pies[0].shownR, PIE_Y + 0.75, this.peel.position.z + 0.05);
    }
    const ghost = g.level.ghost;
    this.ghost.visible = this.ghostLabel.visible = !!ghost && (st === 'dough' || st === 'sauce') && g.phase === 'playing';
    if (ghost) {
      this.ghost.scale.setScalar(ghost.r * U);
      this.ghost.position.set(this.peel.position.x, PIE_Y + 0.16, this.peel.position.z);
      this.ghostLabel.position.set(this.peel.position.x - ghost.r * U * 0.2, PIE_Y + 0.5, this.peel.position.z + ghost.r * U * 0.6);
    }

    // ---- bottle ----
    const onSauce = st === 'sauce' && g.phase === 'playing';
    this.bottleSquash = Math.max(0, this.bottleSquash - dt * 1.4);
    const sq = Math.sin(Math.min(1, this.bottleSquash) * Math.PI);
    this.bottle.visible = true;
    // Tilted nozzle-down over the pie centre while saucing (mockup 02), standing on the counter otherwise.
    const tilt = 2.35;
    const bx = onSauce ? this.peel.position.x + Math.sin(tilt) * 2.2 : 2.4;
    const by = onSauce ? 1.25 - Math.cos(tilt) * 2.2 + 0.4 - sq * 0.35 : 0;
    this.bottle.position.set(damp(this.bottle.position.x, bx, 6, dt), damp(this.bottle.position.y, by, 6, dt), damp(this.bottle.position.z, onSauce ? this.peel.position.z : -1.6, 6, dt));
    this.bottle.rotation.z = damp(this.bottle.rotation.z, onSauce ? tilt : 0, 6, dt);
    this.bottle.scale.set(1 + sq * 0.22, 1 - sq * 0.18, 1 + sq * 0.22);

    // ---- crust station ----
    const reelX = REEL_X;
    const len = Math.max(0.001, pie.rope * U);
    this.rope.scale.set(len, 1, 1);
    this.rope.visible = pie.rope > 0;
    const crustOn = st === 'crust' && g.phase === 'playing';
    this.reel.visible = this.tape.visible = crustOn || pie.rope > 0;
    this.ropeEnd.position.set(reelX - len, 0.14, ROPE_Z);
    this.reel.rotation.z = -pie.rope * 0.05;
    this.knifeDrop = Math.max(0, this.knifeDrop - dt * 2.2);
    const kd = this.knifeDrop > 0.5 ? (1 - this.knifeDrop) * 2 : this.knifeDrop * 2;
    this.knife.visible = st === 'crust' && g.phase === 'playing';
    this.knife.position.set(this.knifeDrop > 0 ? this.knife.position.x : reelX - len, 1.2 - kd * 0.75, ROPE_Z);

    // ---- mix ----
    const mixOn = !!g.level.tickets[0].order.mix;
    this.mixGroup.visible = mixOn;
    if (mixOn) {
      const f = g.mix.flour / 900;
      this.flourMound.visible = !g.mix.kneaded;
      this.flourMound.scale.set(1.25 * Math.cbrt(f), 0.9 * Math.cbrt(f), 1.25 * Math.cbrt(f));
      this.flourMound.position.y = 0.2;
      this.water.visible = !g.mix.kneaded && g.mix.water > 0;
      this.water.position.y = 0.2 + Math.min(1.2, g.mix.water / 600);
      this.mixBall.visible = g.mix.kneaded && pie.r <= 0;
      this.mixBall.position.y = 0.75;
      const kn = g.busy?.kind === 'knead' ? Math.sin(this.time * 18) * 0.15 : 0;
      this.mixBall.scale.set(1 + kn, 0.7 - kn, 1 + kn);
      this.pourTilt = Math.max(0, this.pourTilt - dt * 2.5);
      this.jug.rotation.z = damp(this.jug.rotation.z, this.pourTilt > 0 ? 1.2 : 0, 8, dt);
      this.jug.position.x = damp(this.jug.position.x, this.pourTilt > 0 ? 1.8 : 2.9, 8, dt);
      this.jug.position.y = damp(this.jug.position.y, this.pourTilt > 0 ? 2.2 : 1.0, 8, dt);
      if (this.pourTilt > 0.5 && Math.random() < 0.6) this.particles.emit({ pos: this.mixGroup.position.clone().add(new THREE.Vector3(1.1, 2.1, 0.3)), n: 2, color: ['#8fc6e8', '#cfe6f2'], speed: 0.2, up: -1, size: 0.06, life: 0.5, g: 9 });
    }

    // ---- sponge cleanup ----
    this.sponge.visible = g.busy?.kind === 'cleanup' && g.busy.left < g.busy.total - 500;
    if (this.sponge.visible) {
      const a = this.time * 7;
      const rr = R + 0.45;
      this.sponge.position.set(this.peel.position.x + Math.cos(a) * rr, 0.15, this.peel.position.z + Math.sin(a) * rr);
      this.sponge.rotation.y = -a;
    }

    // ---- bell ----
    this.bellBounce = Math.max(0, this.bellBounce - dt * 2);
    const bb = Math.sin(this.bellBounce * Math.PI * 3) * this.bellBounce;
    this.bell.scale.set(1 + bb * 0.2, 1 - bb * 0.25, 1 + bb * 0.2);

    // ---- oven light flicker ----
    const baking = g.busy?.kind === 'bake' ? 1 : 0;
    this.ovenLight.intensity = (baking ? 120 : 55) + Math.sin(this.time * 13) * 8 + Math.sin(this.time * 7.3) * 6 + (Math.random() - 0.5) * 6;
    if (Math.random() < (baking ? 0.6 : 0.08)) this.particles.emit({ pos: OVEN_MOUTH.clone().add(new THREE.Vector3(Math.random() - 0.5, 0.2, 0.3)), n: 1, color: ['#ffb347', '#ff7a1a'], speed: 0.4, up: 1.8, size: 0.035, life: 1.6, g: -0.5, drag: 0.6 });

    // ---- characters ----
    const tk = activeTicket(g);
    const openCustomers = new Set(g.tickets.filter((t) => !t.done).map((t) => t.def.customer));
    for (const [id, list] of Object.entries(this.customers)) {
      list.forEach((a, i) => {
        const isActive = tk?.def.customer === id && g.phase !== 'levelDone' && g.phase !== 'finished' && g.phase !== 'intro';
        const waiting = openCustomers.has(id as CustomerId) && !isActive && g.phase === 'playing';
        if (isActive) a.target.set(0.2 + (list.length > 1 ? (i - 1) * 2.1 : 0), FLOOR_Y, WALL_Z - 1.5);
        else if (waiting) a.target.set(5.5 + i * 1.6 + Object.keys(this.customers).indexOf(id) * 1.8, FLOOR_Y, WALL_Z - 3.5);
        else a.target.set(16 + i * 2, FLOOR_Y, WALL_Z - 2.5);
        this.animateActor(a, dt);
      });
    }
    if (this.chef) this.animateActor(this.chef, dt);

    // ---- flour dust drift ----
    const p = this.dust.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) + dt * (0.05 + (i % 7) * 0.01);
      if (y > 8) y = 0;
      p.setY(i, y);
      p.setX(i, p.getX(i) + Math.sin(this.time * 0.4 + i) * dt * 0.05);
    }
    p.needsUpdate = true;

    this.particles.update(dt);

    // ---- camera ----
    const look = new THREE.Vector3();
    let width = 18, pitch = 0.64, yaw = 0.16;
    if (g.phase === 'intro' || g.phase === 'levelDone' || g.phase === 'finished' || g.phase === 'shiftOver') { look.set(-0.5, 2.2, -2.5); width = 22; pitch = 0.5; }
    else if (g.phase === 'result') { look.set(PICKUP.x, 3.0, -4.5); width = 13; pitch = 0.36; yaw = 0.15; }
    else if (g.busy?.kind === 'bake' || st === 'oven') { look.set(-4.2, 1.6, -2.4); width = 17; pitch = 0.5; yaw = 0.36; }
    else if (st === 'crust') { look.set(-0.6, 0.4, 0.2); width = 19; pitch = 0.88; yaw = 0.12; }
    else if (st === 'mix') { look.set(MIX_POS.x - 1.4, 1.0, -0.8); width = 15; pitch = 0.7; }
    else { look.set(-0.9, 1.6, -2.4); width = Math.max(18, (pie.r * U) * 2 * (two ? 2.2 : 1) + 13); }
    const portrait = this.camera.aspect < 0.9;
    if (portrait) { width *= 0.62; pitch = Math.min(1.15, pitch + 0.2); look.z += 0.8; yaw *= 0.4; }
    const pos = new THREE.Vector3();
    this.frame(look, width, pitch, yaw, pos);
    if (!Number.isFinite(this.camPos.x + this.camPos.y + this.camPos.z)) this.camPos.copy(pos);
    const k = this.reducedMotion ? 30 : 3.2;
    this.camPos.x = damp(this.camPos.x, pos.x, k, dt); this.camPos.y = damp(this.camPos.y, pos.y, k, dt); this.camPos.z = damp(this.camPos.z, pos.z, k, dt);
    this.camLook.x = damp(this.camLook.x, look.x, k, dt); this.camLook.y = damp(this.camLook.y, look.y, k, dt); this.camLook.z = damp(this.camLook.z, look.z, k, dt);
    this.shake = Math.max(0, this.shake - dt * 1.8);
    const sh = this.shake * this.shake;
    this.camera.position.set(this.camPos.x + (Math.random() - 0.5) * sh, this.camPos.y + (Math.random() - 0.5) * sh, this.camPos.z);
    this.camera.lookAt(this.camLook);
    if (!this.lost) this.renderer.render(this.scene, this.camera);
  }

  private animateActor(a: Actor, dt: number) {
    a.mixer?.update(dt);
    const moving = a.root.position.distanceTo(a.target) > 0.1;
    a.root.position.x = damp(a.root.position.x, a.target.x, 2.2, dt);
    a.root.position.z = damp(a.root.position.z, a.target.z, 2.2, dt);
    a.phase += dt;
    a.react = Math.max(0, a.react - dt);
    const hop = a.mood === 'happy' && a.react > 0 ? Math.abs(Math.sin(a.react * 8)) * 1.2 : 0;
    const bob = moving ? Math.abs(Math.sin(a.phase * 9)) * 0.35 : Math.sin(a.phase * 2) * 0.05;
    a.root.position.y = a.baseY + hop + bob;
    a.root.rotation.z = a.mood === 'sad' && a.react > 0 ? Math.sin(a.react * 14) * 0.08 : damp(a.root.rotation.z, 0, 6, dt);
    a.root.rotation.x = a.mood === 'sad' && a.react > 0 ? -0.12 : damp(a.root.rotation.x, 0, 6, dt);
    if (a.react <= 0 && a.mood !== 'idle') { a.mood = 'idle'; this.play(a, 'idle'); }
    const sq = a.mood === 'happy' && a.react > 0 ? 1 - Math.abs(Math.sin(a.react * 8)) * 0.08 : 1;
    a.root.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
  }

  // ---------- picking ----------
  pickCounter(clientX: number, clientY: number): THREE.Vector3 | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.counterPlane, hit) ? hit : null;
  }
  pickObject(clientX: number, clientY: number): Record<string, unknown> | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects([...this.jars, this.bell, this.oven], true);
    if (!hits.length) return null;
    let o: THREE.Object3D | null = hits[0].object;
    while (o) { if (o.userData.topping || o.userData.bell) return o.userData; if (o === this.oven) return { oven: true }; o = o.parent; }
    return null;
  }
  pieCenter() { return new THREE.Vector3(this.peel.position.x + this.pies[0].group.position.x, PIE_Y, this.peel.position.z); }
  reelX() { return REEL_X; }
}

class RoundedBox extends THREE.BoxGeometry {
  constructor(w: number, h: number, d: number) { super(w, h, d, 2, 2, 2); }
}
