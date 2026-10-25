import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { N8AOPass } from 'n8ao';
import { cloudCanvas, canvasTex } from './textures';
import './style.css';
import * as P from './plan';
import { Collider } from './collision';
import { buildGround, buildGrass, buildGroundcover, buildMask } from './ground';
import { buildStructures } from './structures';
import { buildPlants } from './plants';
import { buildSurroundings } from './surroundings';
import { Man, Dog, Cat, Trail, Follower } from './characters';
import { Controls } from './controls';
import { Minimap } from './minimap';

// `?test` renders only on request, so slow headless GPUs can take screenshots
const testMode = new URLSearchParams(location.search).has('test');
const isTouch = matchMedia('(pointer: coarse)').matches;
const lowPower = isTouch || (navigator.hardwareConcurrency ?? 8) <= 4;
if (isTouch) document.body.classList.add('touch');

const app = document.getElementById('app')!;
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: testMode });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1.25 : 1.6));
renderer.setSize(app.clientWidth, app.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.id = 'scene';
app.prepend(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(app.clientWidth, app.clientHeight);
labelRenderer.domElement.className = 'labels';
app.insertBefore(labelRenderer.domElement, renderer.domElement.nextSibling);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#cdd6dc', 45, 170);
const camera = new THREE.PerspectiveCamera(55, app.clientWidth / app.clientHeight, 0.05, 420);
/** Phones held upright get a wider lens so the plot doesn't feel cramped. */
function fitLens() {
  camera.aspect = app.clientWidth / Math.max(1, app.clientHeight);
  camera.fov = camera.aspect < 0.8 ? 68 : 55;
  camera.updateProjectionMatrix();
}
fitLens();

// ---------- sky, sun, environment ----------
const sky = new Sky();
sky.scale.setScalar(380);
scene.add(sky);
/** The physical sky is far brighter than the scene; scale it down so it reads blue and the clouds show. */
const skyGain = { value: 0.42 };
for (const s of [sky]) {
  const m = s.material;
  m.uniforms.skyGain = skyGain;
  m.fragmentShader = 'uniform float skyGain;\n' + m.fragmentShader.replace('gl_FragColor = vec4( retColor, 1.0 );', 'gl_FragColor = vec4( retColor * skyGain, 1.0 );');
}
const envSky = new Sky();
envSky.scale.setScalar(380);
const envScene = new THREE.Scene();
envScene.add(envSky);
const pmrem = new THREE.PMREMGenerator(renderer);
let envRT: THREE.WebGLRenderTarget | null = null;

const sun = new THREE.DirectionalLight('#ffffff', 3);
sun.castShadow = true;
sun.shadow.mapSize.set(lowPower ? 2048 : 4096, lowPower ? 2048 : 4096);
const sc = sun.shadow.camera;
sc.left = -19; sc.right = 19; sc.top = 24; sc.bottom = -24; sc.near = 1; sc.far = 110;
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 0.025;
sun.target.position.set(P.PLOT_W / 2, 0, P.PLOT_D / 2 + 1);
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight('#cfe0f5', '#6b5a45', 0.6);
scene.add(hemi);

const starGeo = new THREE.BufferGeometry();
const sp: number[] = [];
for (let i = 0; i < 900; i++) {
  const th = Math.random() * Math.PI * 2, y = 0.08 + Math.random() * 0.92, r = Math.sqrt(1 - y * y);
  sp.push(Math.cos(th) * r * 300, y * 300, Math.sin(th) * r * 300);
}
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }));
stars.visible = false;
scene.add(stars);
const moon = new THREE.Mesh(new THREE.SphereGeometry(5, 24, 16), new THREE.MeshBasicMaterial({ color: '#f1eee3', fog: false }));
moon.visible = false;
scene.add(moon);
// soft cumulus clouds on a dome around the camera
const clouds = new THREE.Mesh(
  new THREE.SphereGeometry(170, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2),
  new THREE.MeshBasicMaterial({ map: canvasTex(cloudCanvas()), transparent: true, depthWrite: false, fog: false, side: THREE.BackSide }),
);
clouds.renderOrder = -1;
scene.add(clouds);

// ---------- world ----------
const col = new Collider();
const time = { value: 0 };
const ground = buildGround(lowPower ? 90 : 120, renderer.capabilities.getMaxAnisotropy());
scene.add(ground.mesh);
const mask = buildMask(40);
scene.add(buildGrass(mask, lowPower ? 15000 : 34000, time));
scene.add(buildGroundcover(mask, lowPower ? 450 : 850));
const built = buildStructures(scene, col);
buildPlants(scene, col);
const surr = buildSurroundings(scene, col);

// ---------- post-processing: ambient occlusion, soft bloom, tone mapping, SMAA ----------
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(app.clientWidth, app.clientHeight, { type: THREE.HalfFloatType }));
composer.setPixelRatio(renderer.getPixelRatio());
composer.setSize(app.clientWidth, app.clientHeight);
const ao = new N8AOPass(scene, camera, app.clientWidth, app.clientHeight);
ao.configuration.gammaCorrection = false;
ao.configuration.aoRadius = 1.2;
ao.configuration.distanceFalloff = 1.0;
ao.configuration.intensity = 3.2;
ao.configuration.color = new THREE.Color('#1a1f14');
if (lowPower) {
  ao.configuration.halfRes = true;
  ao.setQualityMode('Performance');
} else ao.setQualityMode('Medium');
composer.addPass(ao);
const bloom = new UnrealBloomPass(new THREE.Vector2(app.clientWidth, app.clientHeight), 0.18, 0.5, 0.92);
bloom.enabled = !lowPower;
composer.addPass(bloom);
composer.addPass(new OutputPass());
composer.addPass(new SMAAPass(app.clientWidth * renderer.getPixelRatio(), app.clientHeight * renderer.getPixelRatio()));

// ---------- characters ----------
const man = new Man(), dog = new Dog(), cat = new Cat();
scene.add(man.root, dog.root, cat.root);
const player = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0 };
const trail = new Trail();
const fDog = new Follower(dog, 0.85, 0.27, 0.2, 5.4);
const fCat = new Follower(cat, 1.4, -0.26, 0.15, 5.6);
const followers = [fDog, fCat];

const controls = new Controls(renderer.domElement, isTouch ? document.getElementById('joy') : null, document.querySelector('#joy .knob'));
const joyEl = document.getElementById('joy');
if (joyEl) joyEl.hidden = !isTouch;

interface Spot { x: number; z: number; yaw: number; pitch?: number; dist?: number; trailDir?: [number, number] }
const SPOTS: Record<string, Spot> = {
  start: { x: P.STAIR_CX, z: P.PLOT_D - 4.5, yaw: 0 },
  stair: { x: P.STAIR_CX, z: P.PLOT_D - 0.6, yaw: 0, pitch: 0.28 },
  porch: { x: P.STAIR_CX, z: P.PORCH.z0 + 0.55, yaw: 0, pitch: 0.12, dist: 0.8, trailDir: [-1, 0] },
  gate: { x: 1.1, z: (P.GATE.z0 + P.GATE.z1) / 2, yaw: -Math.PI / 2 },
  carentry: { x: -2.6, z: (P.RAMP.z0 + P.RAMP.z1) / 2, yaw: -Math.PI / 2 },
  carport: { x: 3.4, z: P.CAR.z - 0.1, yaw: -Math.PI / 2 + 0.12, dist: 4.4, pitch: 0.3 },
  garden: { x: P.wx(250), z: P.wz(335), yaw: -0.3, pitch: 0.34, dist: 4.4 },
};

let camDist = controls.dist;
const camTarget = new THREE.Vector3();

function placeCompanions(dir: [number, number]) {
  trail.pts = [];
  for (let d = 3.2; d >= 0; d -= 0.2) {
    trail.push(new THREE.Vector3(player.pos.x + dir[0] * d, player.pos.y, player.pos.z + dir[1] * d));
  }
  const tmp = new THREE.Vector3();
  for (const f of followers) {
    trail.behind(f.dist, player.pos, tmp);
    f.place(tmp, Math.atan2(-dir[0], -dir[1]));
  }
}

function teleport(s: Spot) {
  const p = { x: s.x, z: s.z };
  col.resolve(p, 0.27);
  player.pos.set(p.x, P.groundY(p.x, p.z), p.z);
  player.vel.set(0, 0, 0);
  player.yaw = s.yaw + Math.PI;
  controls.yaw = s.yaw;
  if (s.pitch !== undefined) controls.pitch = s.pitch;
  controls.dist = s.dist ?? 4.6;
  camDist = controls.dist;
  // face the way the camera looks
  player.yaw = Math.atan2(-Math.sin(s.yaw), -Math.cos(s.yaw));
  const back: [number, number] = s.trailDir ?? [Math.sin(s.yaw), Math.cos(s.yaw)];
  placeCompanions(back);
  updateCamera(1, true);
}

// ---------- camera ----------
const ray = new THREE.Raycaster();
const head = new THREE.Vector3(), off = new THREE.Vector3(), desired = new THREE.Vector3();
function updateCamera(dt: number, snap = false) {
  head.set(player.pos.x, player.pos.y + 1.5, player.pos.z);
  const cp = Math.cos(controls.pitch), sn = Math.sin(controls.pitch);
  off.set(Math.sin(controls.yaw) * cp, sn, Math.cos(controls.yaw) * cp);
  let want = controls.dist;
  ray.set(head, off);
  ray.far = want + 0.3;
  const hit = ray.intersectObjects(built.blockers, false)[0];
  if (hit) want = Math.max(0.7, hit.distance - 0.3);
  camDist = snap || want < camDist ? want : camDist + (want - camDist) * (1 - Math.exp(-3 * dt));
  desired.copy(head).addScaledVector(off, camDist);
  const gy = P.groundY(desired.x, desired.z) + 0.3;
  if (desired.y < gy) desired.y = gy;
  if (snap) camera.position.copy(desired);
  else camera.position.lerp(desired, 1 - Math.exp(-14 * dt));
  camTarget.copy(head);
  camera.lookAt(camTarget);
}

// ---------- player ----------
function updatePlayer(dt: number) {
  if (!(dt > 0)) return;
  const mv = controls.move();
  const fx = -Math.sin(controls.yaw), fz = -Math.cos(controls.yaw);
  const rx = Math.cos(controls.yaw), rz = -Math.sin(controls.yaw);
  let dx = fx * mv.y + rx * mv.x, dz = fz * mv.y + rz * mv.x;
  const mag = Math.min(1, Math.hypot(dx, dz));
  if (mag > 0.01) { const n = Math.hypot(dx, dz); dx /= n; dz /= n; }
  const maxS = mv.run ? 4.2 : 1.75;
  const k = 1 - Math.exp(-dt * 10);
  player.vel.x += (dx * mag * maxS - player.vel.x) * k;
  player.vel.z += (dz * mag * maxS - player.vel.z) * k;
  const bx = player.pos.x, bz = player.pos.z;
  player.pos.x += player.vel.x * dt;
  player.pos.z += player.vel.z * dt;
  col.resolve(player.pos, 0.27);
  const mx = (player.pos.x - bx) / dt, mz = (player.pos.z - bz) / dt;
  const actual = Math.hypot(mx, mz);
  player.vel.x = mx;
  player.vel.z = mz;
  player.pos.y += (P.groundY(player.pos.x, player.pos.z) - player.pos.y) * (1 - Math.exp(-16 * dt));
  if (actual > 0.1) {
    let diff = Math.atan2(mx, mz) - player.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    player.yaw += diff * (1 - Math.exp(-12 * dt));
  }
  man.root.position.copy(player.pos);
  man.root.rotation.y = player.yaw;
  man.update(dt, actual);
  trail.push(player.pos);
  for (const f of followers) f.update(dt, trail, player.pos, col, followers);
}

// ---------- labels ----------
const LABELS: Array<[string, number, number, number]> = [
  ['Carport', P.wx(365), 2.95, P.wz(439)],
  ['Block drive', P.wx(200), 0.55, P.wz(445)],
  ['Walkway', P.STAIR_CX, 0.45, P.wz(700)],
  ['Forecourt', P.wx(190), 0.45, P.wz(600)],
  ['Cesspit (approx.)', P.wx(P.CESSPIT.x), 0.35, P.wz(P.CESSPIT.y)],
  ['Lawn', P.wx(384), 0.35, P.wz(760)],
  ['Small garden', P.wx(330), 0.45, P.wz(300)],
  ['Shade tree + bench', P.wx(300), 1.4, P.wz(258)],
  ['Soak pit', P.wx(P.SOAK_PIT.x), 0.55, P.wz(P.SOAK_PIT.y)],
  ['Hedge', P.wx(385), 1.15, P.wz(352)],
  ['Car entry', -0.9, 2.2, (P.RAMP.z0 + P.RAMP.z1) / 2],
  ['Sliding gate', -0.9, 2.2, (P.GATE.z0 + P.GATE.z1) / 2],
  ['Main stair', P.STAIR_CX, 1.5, P.PLOT_D + 0.5],
];
const labelObjs: CSS2DObject[] = [];
for (const [text, x, y, z] of LABELS) {
  const el = document.createElement('div');
  el.className = 'lbl';
  el.textContent = text;
  const o = new CSS2DObject(el);
  o.position.set(x, y, z);
  scene.add(o);
  labelObjs.push(o);
}
/** Show only the labels near the walker (or all of them from high above), so they don't pile up. */
function cullLabels() {
  const high = camera.position.y > 7;
  for (const o of labelObjs) {
    const d = Math.hypot(o.position.x - player.pos.x, o.position.z - player.pos.z);
    o.visible = high || d < 11;
  }
}
function placeSkyBits() {
  stars.position.copy(camera.position);
  clouds.position.set(camera.position.x, camera.position.y - 3, camera.position.z);
  if (moon.visible) moon.position.copy(camera.position).addScaledVector(moon.userData.dir as THREE.Vector3, 300);
  // very close camera (porch, tight corners) becomes a first-person view
  man.root.visible = camDist > 0.95;
}

// ---------- time of day ----------
type TOD = 'morning' | 'noon' | 'evening' | 'night';
interface TodCfg { el: number; az: number; lightEl?: number; lightAz?: number; sun: string; sunI: number; sky: string; gnd: string; hemiI: number; exp: number; env: number; lamps: number; fog: string; turb: number; ray: number }
const TODS: Record<TOD, TodCfg> = {
  morning: { el: 26, az: 112, sun: '#ffe2bd', sunI: 3.0, sky: '#cfe0f5', gnd: '#6b5a45', hemiI: 0.6, exp: 0.95, env: 0.8, lamps: 0, fog: '#c8d4df', turb: 3.2, ray: 2.0 },
  noon: { el: 63, az: 168, sun: '#fff6e8', sunI: 3.3, sky: '#d6e6f7', gnd: '#6e604c', hemiI: 0.7, exp: 0.85, env: 0.9, lamps: 0, fog: '#c9d6e2', turb: 2.4, ray: 2.3 },
  evening: { el: 5, az: 258, sun: '#ffa760', sunI: 2.3, sky: '#ffc9a3', gnd: '#4b3b2e', hemiI: 0.45, exp: 1.0, env: 0.55, lamps: 0.55, fog: '#cfa587', turb: 8, ray: 2.6 },
  night: { el: -8, az: 250, lightEl: 48, lightAz: 140, sun: '#a9c1ff', sunI: 0.32, sky: '#2b3d66', gnd: '#14110e', hemiI: 0.35, exp: 1.25, env: 0.1, lamps: 1, fog: '#0b1220', turb: 2, ray: 0.5 },
};
const dirFrom = (el: number, az: number) => {
  const e = THREE.MathUtils.degToRad(el), a = THREE.MathUtils.degToRad(az);
  return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
};
let todName: TOD = 'morning';
function setTime(name: TOD) {
  todName = name;
  const c = TODS[name];
  const skyDir = dirFrom(c.el, c.az);
  for (const s of [sky, envSky]) {
    const u = s.material.uniforms;
    u.sunPosition.value.copy(skyDir);
    u.turbidity.value = c.turb;
    u.rayleigh.value = c.ray;
    u.mieCoefficient.value = 0.005;
    u.mieDirectionalG.value = 0.8;
  }
  const night = name === 'night';
  sky.visible = !night;
  scene.background = night ? new THREE.Color('#060a13') : null;
  stars.visible = night;
  moon.visible = night;
  const lightDir = dirFrom(c.lightEl ?? c.el, c.lightAz ?? c.az);
  sun.position.copy(sun.target.position).addScaledVector(lightDir, 60);
  sun.color.set(c.sun);
  sun.intensity = c.sunI;
  hemi.color.set(c.sky);
  hemi.groundColor.set(c.gnd);
  hemi.intensity = c.hemiI;
  renderer.toneMappingExposure = c.exp;
  (scene.fog as THREE.Fog).color.set(c.fog);
  if (!night) {
    envRT?.dispose();
    envRT = pmrem.fromScene(envScene, 0, 0.1, 1000);
    scene.environment = envRT.texture;
  }
  scene.environmentIntensity = c.env;
  const cm = clouds.material as THREE.MeshBasicMaterial;
  clouds.visible = !night;
  cm.color.set(name === 'evening' ? '#ffc7a6' : '#ffffff');
  cm.opacity = name === 'evening' ? 0.75 : 0.95;
  bloom.strength = night ? 0.55 : name === 'evening' ? 0.3 : 0.16;
  built.lamps.forEach((l, i) => { l.intensity = c.lamps * (i < 2 ? 5 : 7); });
  built.lampGlow.emissiveIntensity = c.lamps * 3;
  built.windowGlass.emissiveIntensity = c.lamps * 0.9;
  surr.streetLight.intensity = c.lamps * 70;
  surr.streetGlow.emissiveIntensity = c.lamps * 4;
  document.querySelectorAll<HTMLButtonElement>('[data-time]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.time === name)));
  const ts = document.getElementById('timesel') as HTMLSelectElement | null;
  if (ts) ts.value = name;
  moon.userData.dir = dirFrom(c.lightEl ?? 40, c.lightAz ?? 140);
}

// ---------- UI ----------
const minimap = new Minimap(document.getElementById('minimap') as HTMLCanvasElement, ground.colorCanvas, (x, z) => {
  let zz = z;
  if (zz > P.PORCH.z1 - 0.4) zz = P.PORCH.z1 - 0.4;
  if (zz > P.PLOT_D && zz < P.PORCH.z0 && (x < P.STAIR.x0 || x > P.STAIR.x1)) zz = P.PLOT_D - 0.3;
  teleport({ x, z: zz, yaw: controls.yaw, pitch: controls.pitch, dist: controls.dist });
});

const help = document.getElementById('help');
if (help && isTouch) help.textContent = 'Joystick to walk, push to the edge to run · drag to look · pinch to zoom';

const goto = document.getElementById('goto') as HTMLSelectElement | null;
goto?.addEventListener('change', () => {
  const s = SPOTS[goto.value];
  if (s) teleport(s);
  goto.blur();
});
document.querySelectorAll<HTMLButtonElement>('[data-time]').forEach((b) =>
  b.addEventListener('click', () => { setTime(b.dataset.time as TOD); b.blur(); }),
);
const timeSel = document.getElementById('timesel') as HTMLSelectElement | null;
timeSel?.addEventListener('change', () => {
  setTime(timeSel.value as TOD);
  timeSel.blur();
});
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
const labelsBtn = document.getElementById('labels');
labelsBtn?.addEventListener('click', () => {
  const on = labelsBtn.getAttribute('aria-pressed') !== 'true';
  labelsBtn.setAttribute('aria-pressed', String(on));
  labelRenderer.domElement.hidden = !on;
  labelsBtn.blur();
});

function onResize() {
  const w = app.clientWidth, h = app.clientHeight;
  renderer.setSize(w, h);
  composer.setSize(w, h);
  labelRenderer.setSize(w, h);
  fitLens();
  minimap.resize();
}
window.addEventListener('resize', onResize);

// ---------- loop ----------
setTime('morning');
teleport(SPOTS.start);
const clock = new THREE.Clock();
let frame = 0;
function loop() {
  const dt = Math.min(0.05, Math.max(0.001, clock.getDelta()));
  time.value += dt;
  updatePlayer(dt);
  updateCamera(dt);
  placeSkyBits();
  composer.render(dt);
  if (!labelRenderer.domElement.hidden) {
    cullLabels();
    labelRenderer.render(scene, camera);
  }
  if (frame % 2 === 0) {
    minimap.draw({ x: player.pos.x, z: player.pos.z, yaw: player.yaw }, { x: fDog.pos.x, z: fDog.pos.z }, { x: fCat.pos.x, z: fCat.pos.z });
  }
  if (frame === 1) document.getElementById('loading')?.classList.add('done');
  frame++;
  if (!testMode) requestAnimationFrame(loop);
}
loop();

// small hook for scripted tours and tests
(window as unknown as { frontPlot: unknown }).frontPlot = {
  go: (name: string) => SPOTS[name] && teleport(SPOTS[name]),
  setTime: (name: TOD) => setTime(name),
  view: (yaw: number, pitch: number, dist: number) => { controls.yaw = yaw; controls.pitch = pitch; controls.dist = dist; updateCamera(1, true); },
  time: () => todName,
  state: () => ({ p: player.pos.toArray(), v: player.vel.toArray(), yaw: player.yaw, cam: camera.position.toArray(), dog: fDog.pos.toArray(), cat: fCat.pos.toArray(), cy: controls.yaw }),
  step: (n: number, keys: string[] = []) => {
    for (const k of keys) controls.keys.add(k);
    for (let i = 0; i < n; i++) {
      time.value += 1 / 30;
      updatePlayer(1 / 30);
      updateCamera(1 / 30);
    }
    for (const k of keys) controls.keys.delete(k);
    const ld = document.getElementById('loading');
    if (ld) ld.hidden = true;
    placeSkyBits();
    cullLabels();
    composer.render(1 / 30);
    labelRenderer.render(scene, camera);
    minimap.draw({ x: player.pos.x, z: player.pos.z, yaw: player.yaw }, { x: fDog.pos.x, z: fDog.pos.z }, { x: fCat.pos.x, z: fCat.pos.z });
  },
};
