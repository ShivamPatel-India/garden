import * as THREE from 'three';
import { PATHS, STRIPS, STEPPING, BENCH_PAD, PLOT_W, PLOT_D, U, terrainY, CESSPIT } from './plan';
import { grassTile, mulchTile, paverTile, makeCanvas, rand } from './textures';

export const GROUND_EXT = 1.5; // metres past the plot edge, in front of the house plinth
const Y1 = 940 + GROUND_EXT / U;

function prep(ppm: number) {
  const k = ppm * U;
  const { c, ctx } = makeCanvas(350 * k, (Y1 - 90) * k);
  ctx.setTransform(k, 0, 0, k, -110 * k, -90 * k);
  const pat = (tile: HTMLCanvasElement): CanvasPattern => {
    const p = ctx.createPattern(tile, 'repeat')!;
    p.setTransform(new DOMMatrix([1 / k, 0, 0, 1 / k, 0, 0]));
    return p;
  };
  return { c, ctx, pat };
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

/** Paint the plan onto a canvas at `ppm` pixels per metre: lawn, beds, pavers, strips, stones. */
export function groundColorCanvas(ppm: number): HTMLCanvasElement {
  const { c, ctx, pat } = prep(ppm);
  const plot = new Path2D(PATHS.plot);
  const paving = new Path2D(PATHS.paving);
  ctx.fillStyle = '#7d6c57';
  ctx.fillRect(100, 80, 370, Y1 - 70);
  ctx.fillStyle = pat(grassTile());
  ctx.fill(plot);

  // mowing stripes, as on a freshly cut lawn
  ctx.save();
  ctx.clip(plot);
  for (let x = 110, k = 0; x < 460; x += 20, k++) {
    ctx.fillStyle = k % 2 ? 'rgba(255,255,210,0.07)' : 'rgba(10,40,0,0.06)';
    ctx.fillRect(x, 90, 20, 900);
  }
  for (let i = 0; i < 170; i++) {
    const x = 110 + rand() * 350, y = 90 + rand() * 850, r = 8 + rand() * 30;
    ctx.fillStyle = rand() < 0.5 ? 'rgba(20,40,0,0.08)' : 'rgba(230,240,160,0.06)';
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.6 + rand() * 0.5), rand() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const pav = pat(paverTile(ppm));
  const mulch = pat(mulchTile());
  ctx.fillStyle = mulch;
  for (const d of [PATHS.beds, PATHS.hedgeBed, PATHS.eastBed]) ctx.fill(new Path2D(d));
  ctx.fillStyle = pav;
  ctx.fill(paving);
  ctx.fillRect(110, 940, 350, Y1 - 940);
  ctx.fillStyle = mulch;
  ctx.fill(new Path2D(PATHS.westBed));

  ctx.strokeStyle = 'rgba(70,52,38,0.55)';
  ctx.lineWidth = 1.4;
  for (const d of [PATHS.beds, PATHS.hedgeBed, PATHS.eastBed, PATHS.westBed]) ctx.stroke(new Path2D(d));

  // weathering on the old pavers
  ctx.save();
  ctx.clip(paving);
  for (let i = 0; i < 90; i++) {
    const x = 110 + rand() * 350, y = 372 + rand() * 570, r = 3 + rand() * 18;
    ctx.fillStyle = rand() < 0.6 ? 'rgba(40,28,18,0.04)' : 'rgba(255,240,220,0.05)';
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.7, rand() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // flush stone strips edging the walkway
  ctx.lineCap = 'butt';
  for (const d of STRIPS) {
    const p = new Path2D(d);
    ctx.strokeStyle = '#86827b';
    ctx.lineWidth = 5;
    ctx.stroke(p);
    ctx.strokeStyle = 'rgba(40,36,32,0.6)';
    ctx.lineWidth = 0.5;
    ctx.stroke(p);
  }

  // stepping stones and bench pad
  for (const [x, y] of STEPPING) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ellipse(ctx, x + 0.7, y + 0.8, 9.6, 6.6);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ellipse(ctx, BENCH_PAD.x + 0.8, BENCH_PAD.y + 0.8, BENCH_PAD.rx + 1, BENCH_PAD.ry + 1);
  ctx.fill();

  // recessed cesspit cover, filled with blocks: only the frame shows
  ctx.strokeStyle = 'rgba(60,60,60,0.85)';
  ctx.lineWidth = 0.9;
  ctx.strokeRect(CESSPIT.x - 9, CESSPIT.y - 9, 18, 18);

  // contact shadows along the walls
  const ao = (x0: number, y0: number, x1: number, y1: number, a: number) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, `rgba(0,0,0,${a})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    return g;
  };
  ctx.fillStyle = ao(110, 0, 122, 0, 0.35);
  ctx.fillRect(110, 200, 12, 160);
  ctx.fillRect(110, 660, 12, Y1 - 660);
  ctx.fillStyle = ao(0, 90, 0, 102, 0.3);
  ctx.fillRect(250, 90, 210, 12);
  ctx.fillStyle = ao(460, 0, 438, 0, 0.45);
  ctx.fillRect(438, 90, 22, Y1 - 90);
  ctx.fillStyle = ao(0, Y1, 0, Y1 - 16, 0.35);
  ctx.fillRect(110, Y1 - 16, 350, 16);
  ctx.save();
  ctx.clip(plot);
  ctx.strokeStyle = 'rgba(0,0,0,0.1)';
  for (const w of [16, 9, 4]) {
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(110, 200);
    ctx.quadraticCurveTo(115, 105, 250, 90);
    ctx.stroke();
  }
  ctx.restore();
  return c;
}

export function groundBumpCanvas(ppm: number): HTMLCanvasElement {
  const { c, ctx, pat } = prep(ppm);
  ctx.fillStyle = '#7a7a7a';
  ctx.fillRect(100, 80, 370, Y1 - 70);
  ctx.fillStyle = pat(paverTile(ppm, true));
  ctx.fill(new Path2D(PATHS.paving));
  ctx.fillRect(110, 940, 350, Y1 - 940);
  ctx.strokeStyle = '#9a9a9a';
  ctx.lineWidth = 5;
  for (const d of STRIPS) ctx.stroke(new Path2D(d));
  return c;
}

export interface GroundMask { at(x: number, z: number): number } // 0 none, 1 lawn, 2 bed

export function buildMask(ppm = 40): GroundMask {
  const { c, ctx } = prep(ppm);
  ctx.fillStyle = '#000';
  ctx.fillRect(100, 80, 370, Y1 - 70);
  ctx.fillStyle = '#f00';
  ctx.fill(new Path2D(PATHS.plot));
  ctx.fillStyle = '#0f0';
  for (const d of [PATHS.beds, PATHS.hedgeBed, PATHS.eastBed]) ctx.fill(new Path2D(d));
  ctx.fillStyle = '#000';
  ctx.fill(new Path2D(PATHS.paving));
  ctx.fillStyle = '#0f0';
  ctx.fill(new Path2D(PATHS.westBed));
  ctx.fillStyle = '#000';
  for (const [x, y] of STEPPING) { ellipse(ctx, x, y, 11, 8); ctx.fill(); }
  ellipse(ctx, BENCH_PAD.x, BENCH_PAD.y, BENCH_PAD.rx + 3, BENCH_PAD.ry + 3);
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 8;
  for (const d of STRIPS) ctx.stroke(new Path2D(d));
  const W = c.width, H = c.height;
  const data = ctx.getImageData(0, 0, W, H).data;
  return {
    at(x: number, z: number) {
      const px = Math.floor(x * ppm), pz = Math.floor(z * ppm);
      if (px < 0 || pz < 0 || px >= W || pz >= H) return 0;
      const i = (pz * W + px) * 4;
      if (data[i] > 128) return 1;
      if (data[i + 1] > 128) return 2;
      return 0;
    },
  };
}

export function buildGround(ppm: number, maxAniso: number) {
  const colorCanvas = groundColorCanvas(ppm);
  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = maxAniso;
  const bump = new THREE.CanvasTexture(groundBumpCanvas(Math.round(ppm / 2)));
  bump.anisotropy = maxAniso;
  const D = PLOT_D + GROUND_EXT;
  const geo = new THREE.PlaneGeometry(PLOT_W, D, 72, 176);
  geo.rotateX(-Math.PI / 2);
  geo.translate(PLOT_W / 2, 0, D / 2);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setY(i, terrainY(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 2.5, roughness: 0.92 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return { mesh, colorCanvas };
}

/** Short, mown lawn blades that sway a little in the wind. */
export function buildGrass(mask: GroundMask, count: number, time: { value: number }): THREE.InstancedMesh {
  const geo = new THREE.BufferGeometry();
  const v = [-0.007, 0, 0, 0.007, 0, 0, -0.0045, 0.5, 0, 0.0045, 0.5, 0, 0, 1, 0];
  geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute([0.45, 0.45, 0.45, 0.45, 0.45, 0.45, 0.75, 0.75, 0.75, 0.75, 0.75, 0.75, 1, 1, 1], 3));
  geo.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4]);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.95 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      float hh = position.y;
      #ifdef USE_INSTANCING
        vec2 ip = vec2(instanceMatrix[3].x, instanceMatrix[3].z);
      #else
        vec2 ip = vec2(0.0);
      #endif
      float w = sin(uTime * 1.6 + ip.x * 1.7 + ip.y * 1.3) + 0.5 * sin(uTime * 2.7 + ip.x * 3.1);
      transformed.x += w * 0.16 * hh * hh;
      transformed.z += w * 0.08 * hh * hh;`,
    );
  };
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
  const col = new THREE.Color();
  // two lawn regions: north garden and east of the walkway
  const regions = [
    { x0: 0, x1: PLOT_W, z0: 0, z1: 8.7, w: 0.45 },
    { x0: 7.0, x1: PLOT_W, z0: 12.8, z1: PLOT_D, w: 0.55 },
  ];
  let n = 0, tries = 0;
  while (n < count && tries < count * 8) {
    tries++;
    const r = rand() < regions[0].w ? regions[0] : regions[1];
    const x = r.x0 + rand() * (r.x1 - r.x0), z = r.z0 + rand() * (r.z1 - r.z0);
    if (mask.at(x, z) !== 1) continue;
    p.set(x, terrainY(x, z), z);
    e.set((rand() - 0.5) * 0.5, rand() * Math.PI * 2, (rand() - 0.5) * 0.5);
    q.setFromEuler(e);
    const h = 0.06 + rand() * 0.08;
    s.set(1 + rand() * 0.8, h, 1);
    m.compose(p, q, s);
    mesh.setMatrixAt(n, m);
    col.setHSL(0.25 + (rand() - 0.5) * 0.05, 0.55 + rand() * 0.2, 0.32 + rand() * 0.14);
    mesh.setColorAt(n, col);
    n++;
  }
  mesh.count = n;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

/** Low leafy ground cover in the planting beds. */
export function buildGroundcover(mask: GroundMask, count: number): THREE.InstancedMesh {
  const geo = new THREE.IcosahedronGeometry(0.11, 1);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: false });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const col = new THREE.Color();
  let n = 0, tries = 0;
  while (n < count && tries < count * 20) {
    tries++;
    const x = rand() * PLOT_W, z = rand() * (PLOT_D + 0.2);
    if (mask.at(x, z) !== 2) continue;
    p.set(x, 0.01, z);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6.28);
    const sc = 0.7 + rand() * 0.8;
    s.set(sc, sc * (0.35 + rand() * 0.25), sc);
    m.compose(p, q, s);
    mesh.setMatrixAt(n, m);
    col.setHSL(0.26 + (rand() - 0.5) * 0.05, 0.4 + rand() * 0.2, 0.18 + rand() * 0.12);
    mesh.setColorAt(n, col);
    n++;
  }
  mesh.count = n;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
