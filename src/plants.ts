import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TREES, SHRUBS, HEDGE, POTS, wx, wz, groundY, ROAD_Y, TreeKind, ShrubKind } from './plan';
import { leafCanvas, LeafKind, canvasTex, barkCanvas, frondCanvas, palmTrunkCanvas, mulberry32 } from './textures';
import { Collider } from './collision';

const barkMat = new THREE.MeshStandardMaterial({ map: canvasTex(barkCanvas()), roughness: 1 });

const leafMats = new Map<LeafKind, { mat: THREE.MeshStandardMaterial; depth: THREE.MeshDepthMaterial }>();

/** Foliage cards keep the outward "canopy" normal on both faces, so they light like a crown, not like paper. */
function leafMat(kind: LeafKind) {
  let m = leafMats.get(kind);
  if (!m) {
    const tex = canvasTex(leafCanvas(kind));
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.82, vertexColors: true });
    mat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace(
        '#include <normal_fragment_begin>',
        THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''),
      );
    };
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.42, side: THREE.DoubleSide });
    m = { mat, depth };
    leafMats.set(kind, m);
  }
  return m;
}

const coreMats = new Map<string, THREE.MeshStandardMaterial>();
function coreMat(color: string) {
  let m = coreMats.get(color);
  if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness: 1 }); coreMats.set(color, m); }
  return m;
}

function blobGeo(r: number, rnd: () => number, detail = 2): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const f1 = rnd() * 10, f2 = rnd() * 10;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = 1 + 0.16 * Math.sin((v.x * 5) / r + f1) * Math.sin((v.y * 4) / r + f2) * Math.sin((v.z * 6) / r);
    v.multiplyScalar(n);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

interface CardOpts { cy: number; rx: number; ry: number; rz: number; n: number; size: number; upright?: boolean; rnd: () => number }

function cardCluster(o: CardOpts): THREE.BufferGeometry {
  const geos: THREE.BufferGeometry[] = [];
  const e = new THREE.Euler(), q = new THREE.Quaternion(), m4 = new THREE.Matrix4(), one = new THREE.Vector3(1, 1, 1);
  const pos = new THREE.Vector3(), nrm = new THREE.Vector3();
  for (let i = 0; i < o.n; i++) {
    const th = o.rnd() * Math.PI * 2, ph = Math.acos(2 * o.rnd() - 1);
    const rr = 0.45 + 0.55 * Math.cbrt(o.rnd());
    const x = Math.sin(ph) * Math.cos(th) * rr, z = Math.sin(ph) * Math.sin(th) * rr;
    let y = Math.cos(ph) * rr;
    if (y < -0.4) y = -0.4 + (y + 0.4) * 0.5;
    pos.set(x * o.rx, o.cy + y * o.ry, z * o.rz);
    const s = o.size * (0.75 + o.rnd() * 0.5);
    const g = new THREE.PlaneGeometry(s, s);
    if (o.upright) e.set((o.rnd() - 0.5) * 0.5, o.rnd() * Math.PI * 2, (o.rnd() - 0.5) * 0.4);
    else e.set(o.rnd() * Math.PI, o.rnd() * Math.PI * 2, o.rnd() * Math.PI);
    q.setFromEuler(e);
    m4.compose(pos, q, one);
    g.applyMatrix4(m4);
    nrm.set(x, y * 0.7 + 0.35, z).normalize();
    const na = g.getAttribute('normal') as THREE.BufferAttribute;
    for (let k = 0; k < na.count; k++) na.setXYZ(k, nrm.x, nrm.y, nrm.z);
    const b = Math.min(1.15, 0.62 + 0.3 * (y * 0.5 + 0.5) + 0.25 * rr + o.rnd() * 0.12);
    g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(na.count * 3).fill(b), 3));
    geos.push(g);
  }
  return mergeGeometries(geos)!;
}

interface Species { trunkH: number; trunkR: number; canopyR: number; canopyH: number; canopyY: number; leaf: LeafKind; cards: number; card: number; columnar?: boolean; core: string }

const SPECIES: Record<TreeKind, Species> = {
  mango: { trunkH: 1.6, trunkR: 0.17, canopyR: 2.3, canopyH: 3.2, canopyY: 3.5, leaf: 'dark', cards: 160, card: 1.3, core: '#24401d' },
  plumeria: { trunkH: 1.6, trunkR: 0.11, canopyR: 1.35, canopyH: 1.4, canopyY: 2.7, leaf: 'plumeria', cards: 60, card: 1.0, core: '#3a5a28' },
  small: { trunkH: 1.2, trunkR: 0.08, canopyR: 1.0, canopyH: 1.6, canopyY: 2.3, leaf: 'green', cards: 50, card: 0.9, core: '#2f5224' },
  kachnar: { trunkH: 1.9, trunkR: 0.12, canopyR: 1.8, canopyH: 2.2, canopyY: 3.6, leaf: 'kachnar', cards: 95, card: 1.1, core: '#35542a' },
  green: { trunkH: 1.6, trunkR: 0.11, canopyR: 1.4, canopyH: 2.0, canopyY: 3.1, leaf: 'green', cards: 70, card: 1.0, core: '#2f5224' },
  ashoka: { trunkH: 0.8, trunkR: 0.1, canopyR: 0.66, canopyH: 5.6, canopyY: 3.7, leaf: 'ashoka', cards: 170, card: 0.9, columnar: true, core: '#1d371b' },
  neem: { trunkH: 2.2, trunkR: 0.15, canopyR: 1.7, canopyH: 2.4, canopyY: 4.2, leaf: 'light', cards: 105, card: 1.1, core: '#33562a' },
  feature: { trunkH: 2.3, trunkR: 0.19, canopyR: 2.5, canopyH: 2.7, canopyY: 4.4, leaf: 'dark', cards: 175, card: 1.3, core: '#24401d' },
};

export function makeTree(kind: TreeKind, x: number, z: number, seed: number, y0 = groundY(x, z), scale = 1): THREE.Group {
  const sp = SPECIES[kind];
  const rnd = mulberry32(seed);
  const g = new THREE.Group();
  g.position.set(x, y0, z);
  g.scale.setScalar(scale);
  const th = sp.columnar ? sp.canopyY : sp.canopyY - sp.canopyH * 0.2;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(sp.trunkR * 0.6, sp.trunkR, th, 9, 4), barkMat);
  trunk.position.y = th / 2;
  trunk.rotation.z = (rnd() - 0.5) * 0.06;
  trunk.castShadow = true;
  g.add(trunk);
  const flare = new THREE.Mesh(new THREE.CylinderGeometry(sp.trunkR, sp.trunkR * 1.5, 0.25, 9), barkMat);
  flare.position.y = 0.12;
  g.add(flare);
  if (!sp.columnar) {
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < 4; i++) {
      const len = sp.canopyR * (0.55 + rnd() * 0.3);
      const a = (i / 4) * Math.PI * 2 + rnd();
      const dir = new THREE.Vector3(Math.cos(a) * 0.8, 0.85, Math.sin(a) * 0.8).normalize();
      const b = new THREE.Mesh(new THREE.CylinderGeometry(sp.trunkR * 0.25, sp.trunkR * 0.45, len, 6), barkMat);
      b.quaternion.setFromUnitVectors(up, dir);
      b.position.set(0, th * 0.8, 0).addScaledVector(dir, len / 2);
      b.castShadow = true;
      g.add(b);
    }
  }
  const blobs: THREE.BufferGeometry[] = [];
  const nb = sp.columnar ? 2 : 6;
  for (let i = 0; i < nb; i++) {
    const r = sp.canopyR * (sp.columnar ? 0.85 - i * 0.2 : 0.5 + rnd() * 0.15);
    const bg = blobGeo(r, rnd, 3);
    if (sp.columnar) {
      bg.scale(1, (sp.canopyH * (0.5 - i * 0.12)) / r, 1);
      bg.translate(0, sp.canopyY + i * sp.canopyH * 0.18, 0);
    } else {
      bg.scale(1, (sp.canopyH / sp.canopyR) * 0.55, 1);
      const a = rnd() * Math.PI * 2, d = sp.canopyR * 0.38 * rnd();
      bg.translate(Math.cos(a) * d, sp.canopyY + (rnd() - 0.4) * sp.canopyH * 0.3, Math.sin(a) * d);
    }
    blobs.push(bg);
  }
  const core = new THREE.Mesh(mergeGeometries(blobs)!, coreMat(sp.core));
  core.castShadow = true;
  core.receiveShadow = true;
  g.add(core);
  const lm = leafMat(sp.leaf);
  const cards = new THREE.Mesh(
    cardCluster({ cy: sp.canopyY, rx: sp.canopyR, ry: sp.canopyH / 2, rz: sp.canopyR, n: sp.cards, size: sp.card, upright: sp.columnar, rnd }),
    lm.mat,
  );
  cards.customDepthMaterial = lm.depth;
  cards.castShadow = true;
  cards.receiveShadow = true;
  g.add(cards);
  return g;
}

const SHRUB_LEAF: Record<ShrubKind, LeafKind> = { green: 'green', hibiscus: 'hibiscus', yellow: 'yellow' };

export function makeShrub(x: number, z: number, kind: LeafKind, seed: number, s = 1, y0 = groundY(x, z)): THREE.Group {
  const rnd = mulberry32(seed);
  const g = new THREE.Group();
  g.position.set(x, y0, z);
  const core = new THREE.Mesh(blobGeo(0.33 * s, rnd, 2), coreMat('#2b4a22'));
  core.scale.y = 0.8;
  core.position.y = 0.3 * s;
  core.castShadow = true;
  core.receiveShadow = true;
  g.add(core);
  const lm = leafMat(kind);
  const cards = new THREE.Mesh(cardCluster({ cy: 0.38 * s, rx: 0.5 * s, ry: 0.38 * s, rz: 0.5 * s, n: 26, size: 0.46 * s, rnd }), lm.mat);
  cards.customDepthMaterial = lm.depth;
  cards.castShadow = true;
  cards.receiveShadow = true;
  g.add(cards);
  return g;
}

let frondGeos: THREE.BufferGeometry[] | null = null;
function frondGeometry(len: number, width: number, droop: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(width, len, 1, 14);
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  const a0 = 0.65, k = droop / len;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), s = p.getY(i) + len / 2, t = s / len;
    const out = (Math.sin(a0) - Math.sin(a0 - k * s)) / k;
    const up = (Math.cos(a0 - k * s) - Math.cos(a0)) / k;
    p.setXYZ(i, x * (1 - 0.5 * t), up - Math.abs(x) * 0.35, out);
  }
  g.computeVertexNormals();
  return g;
}

let palmMats: { trunk: THREE.MeshStandardMaterial; frond: THREE.MeshStandardMaterial; depth: THREE.MeshDepthMaterial; nut: THREE.MeshStandardMaterial } | null = null;

export function makePalm(x: number, z: number, h: number, seed: number, y0 = ROAD_Y): THREE.Group {
  const rnd = mulberry32(seed);
  if (!palmMats) {
    const ft = canvasTex(frondCanvas());
    ft.wrapS = ft.wrapT = THREE.ClampToEdgeWrapping;
    const tt = canvasTex(palmTrunkCanvas(), [3, 1]);
    palmMats = {
      trunk: new THREE.MeshStandardMaterial({ map: tt, roughness: 1 }),
      frond: new THREE.MeshStandardMaterial({ map: ft, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8 }),
      depth: new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: ft, alphaTest: 0.4, side: THREE.DoubleSide }),
      nut: new THREE.MeshStandardMaterial({ color: '#6b6a2c', roughness: 0.7 }),
    };
  }
  if (!frondGeos) frondGeos = [frondGeometry(3.4, 0.95, 2.2), frondGeometry(3.0, 0.9, 3.0), frondGeometry(3.2, 0.95, 1.4)];
  const g = new THREE.Group();
  g.position.set(x, y0, z);
  const lx = (rnd() - 0.5) * 1.8, lz = (rnd() - 0.5) * 1.8;
  const curve = new THREE.CatmullRomCurve3([0, 0.33, 0.66, 1].map((t) => new THREE.Vector3(lx * t * t, h * t, lz * t * t)));
  const tg = new THREE.TubeGeometry(curve, 24, 0.15, 9);
  const trunk = new THREE.Mesh(tg, palmMats.trunk);
  palmMats.trunk.map!.repeat.set(h * 2.5, 1);
  trunk.castShadow = true;
  g.add(trunk);
  const top = curve.getPoint(1);
  const n = 15;
  for (let i = 0; i < n; i++) {
    const f = new THREE.Mesh(frondGeos[i % 3], palmMats.frond);
    f.customDepthMaterial = palmMats.depth;
    f.castShadow = true;
    f.position.copy(top);
    f.rotation.set(0, (i / n) * Math.PI * 2 + rnd() * 0.3, 0);
    f.rotateX(-0.25 + rnd() * 0.3);
    g.add(f);
  }
  for (let i = 0; i < 5; i++) {
    const a = rnd() * 6.28;
    const nut = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), palmMats.nut);
    nut.position.set(top.x + Math.cos(a) * 0.14, top.y - 0.15, top.z + Math.sin(a) * 0.14);
    g.add(nut);
  }
  return g;
}

export function buildPlants(scene: THREE.Scene, col: Collider) {
  TREES.forEach((t, i) => {
    const x = wx(t.x), z = wz(t.y);
    scene.add(makeTree(t.kind, x, z, 100 + i * 17));
    col.circ(x, z, Math.max(0.16, SPECIES[t.kind].trunkR + 0.08));
  });
  SHRUBS.forEach(([sx, sy, k], i) => {
    const x = wx(sx), z = wz(sy);
    scene.add(makeShrub(x, z, SHRUB_LEAF[k], 500 + i * 13, 0.95 + ((i * 7) % 5) * 0.06));
    col.circ(x, z, 0.3);
  });
  // continuous low hedge behind the carport
  for (let i = 0; i < HEDGE.length - 1; i++) {
    const [ax, ay] = HEDGE[i], [bx, by] = HEDGE[i + 1];
    const a = new THREE.Vector2(wx(ax), wz(ay)), b = new THREE.Vector2(wx(bx), wz(by));
    const steps = Math.max(1, Math.round(a.distanceTo(b) / 0.32));
    for (let s = 0; s < steps; s++) {
      const p = a.clone().lerp(b, s / steps);
      scene.add(makeShrub(p.x, p.y - 0.05, 'dark', 900 + i * 31 + s, 0.85));
      col.circ(p.x, p.y - 0.05, 0.26);
    }
  }
  POTS.forEach(([sx, sy, k], i) => {
    scene.add(makeShrub(wx(sx), wz(sy), SHRUB_LEAF[k], 700 + i * 11, 0.72, 0.42));
  });
}
