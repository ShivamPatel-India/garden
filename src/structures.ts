import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as P from './plan';
import { Collider } from './collision';
import { canvasTex, plasterCanvas, graniteCanvas, stoneCanvas, woodCanvas, roofTileCanvas } from './textures';

export interface Built {
  blockers: THREE.Object3D[];
  lamps: THREE.PointLight[];
  lampGlow: THREE.MeshStandardMaterial;
  windowGlass: THREE.MeshStandardMaterial;
}

const plaster = (base: string, stain: number, seed: number) => {
  const map = canvasTex(plasterCanvas(base, stain, 512, seed));
  return new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: 0.6, roughness: 0.92 });
};

export const M = {
  yellow: plaster('#dcc35a', 0.03, 3),
  houseYellow: plaster('#e0cb62', 0.03, 4),
  grey: plaster('#b3afa6', 0.06, 5),
  neighbour: plaster('#b2a48d', 0.8, 9),
  white: plaster('#efebe2', 0.0, 11),
  stone: plaster('#aaa192', 0.04, 13),
  concrete: plaster('#a7a39b', 0.05, 15),
  coping: new THREE.MeshStandardMaterial({ color: '#aaa394', roughness: 0.95 }),
  granite: new THREE.MeshPhysicalMaterial({ map: canvasTex(graniteCanvas()), roughness: 0.3, clearcoat: 0.5, clearcoatRoughness: 0.25 }),
  steel: new THREE.MeshStandardMaterial({ color: '#dfe3e6', metalness: 1, roughness: 0.22 }),
  darkSteel: new THREE.MeshStandardMaterial({ color: '#3a3f45', metalness: 0.6, roughness: 0.45 }),
  wood: new THREE.MeshStandardMaterial({ map: canvasTex(woodCanvas()), roughness: 0.7 }),
  terracotta: new THREE.MeshStandardMaterial({ color: '#b4643c', roughness: 0.85 }),
  roof: new THREE.MeshStandardMaterial({ map: canvasTex(roofTileCanvas()), roughness: 0.8 }),
  glass: new THREE.MeshStandardMaterial({ color: '#1f2c35', roughness: 0.08, metalness: 0.35, emissive: new THREE.Color('#ffc978'), emissiveIntensity: 0 }),
  poly: new THREE.MeshStandardMaterial({ color: '#cdb88d', transparent: true, opacity: 0.55, roughness: 0.3, side: THREE.DoubleSide, depthWrite: false }),
  stepStone: new THREE.MeshStandardMaterial({ map: canvasTex(stoneCanvas('#bdb5a4')), roughness: 0.85 }),
  soil: new THREE.MeshStandardMaterial({ color: '#3d2e22', roughness: 1 }),
};

/** Box whose texture coordinates are in metres (`tile` metres per texture repeat). */
export function wbox(w: number, h: number, d: number, mat: THREE.Material, tile = 1): THREE.Mesh {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  const dims: Array<[number, number]> = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const j = f * 4 + i;
      uv.setXY(j, (uv.getX(j) * dims[f][0]) / tile, (uv.getY(j) * dims[f][1]) / tile);
    }
  }
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function at<T extends THREE.Object3D>(o: T, x: number, y: number, z: number, parent?: THREE.Object3D): T {
  o.position.set(x, y, z);
  if (parent) parent.add(o);
  return o;
}

function cylBetween(a: THREE.Vector3, b: THREE.Vector3, r: number, seg = 8): THREE.BufferGeometry {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(r, r, len, seg, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

/** Stainless-steel railing between two points; base heights may differ (stairs). */
function railing(ax: number, az: number, ya: number, bx: number, bz: number, yb: number, h = 0.95, spacing = 0.13): THREE.Mesh {
  const geos: THREE.BufferGeometry[] = [];
  const len = Math.hypot(bx - ax, bz - az);
  const n = Math.max(2, Math.round(len / spacing));
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = ya + (yb - ya) * t;
    const r = i === 0 || i === n || i % 8 === 0 ? 0.022 : 0.009;
    geos.push(cylBetween(new THREE.Vector3(x, y, z), new THREE.Vector3(x, y + h, z), r, 6));
  }
  geos.push(cylBetween(new THREE.Vector3(ax, ya + h, az), new THREE.Vector3(bx, yb + h, bz), 0.025, 10));
  geos.push(cylBetween(new THREE.Vector3(ax, ya + h * 0.55, az), new THREE.Vector3(bx, yb + h * 0.55, bz), 0.012, 6));
  geos.push(cylBetween(new THREE.Vector3(ax, ya + 0.08, az), new THREE.Vector3(bx, yb + 0.08, bz), 0.012, 6));
  const mesh = new THREE.Mesh(mergeGeometries(geos)!, M.steel);
  mesh.castShadow = true;
  return mesh;
}

function wallSeg(scene: THREE.Scene, col: Collider, blockers: THREE.Object3D[], ax: number, az: number, bx: number, bz: number, top: number, thick: number, mat: THREE.Material, coping = true): THREE.Mesh {
  const len = Math.hypot(bx - ax, bz - az) + 0.04;
  const y0 = P.ROAD_Y - 0.05;
  const h = top - y0;
  const m = wbox(len, h, thick, mat, 2);
  m.position.set((ax + bx) / 2, y0 + h / 2, (az + bz) / 2);
  m.rotation.y = -Math.atan2(bz - az, bx - ax);
  scene.add(m);
  blockers.push(m);
  if (coping) {
    const c = wbox(len, 0.06, thick + 0.06, M.coping);
    c.position.set(m.position.x, top + 0.03, m.position.z);
    c.rotation.y = m.rotation.y;
    scene.add(c);
  }
  col.seg(ax, az, bx, bz, thick / 2);
  return m;
}

function addWindow(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, door = false) {
  const g = new THREE.Group();
  at(wbox(w + 0.14, h + 0.14, 0.05, M.white), 0, 0, 0, g);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.07), M.glass);
  g.add(glass);
  if (!door) {
    const bars: THREE.BufferGeometry[] = [];
    for (let bx = -w / 2 + 0.1; bx < w / 2 - 0.05; bx += 0.13) {
      bars.push(cylBetween(new THREE.Vector3(bx, -h / 2, -0.06), new THREE.Vector3(bx, h / 2, -0.06), 0.009, 5));
    }
    bars.push(cylBetween(new THREE.Vector3(-w / 2, 0, -0.06), new THREE.Vector3(w / 2, 0, -0.06), 0.009, 5));
    const bm = new THREE.Mesh(mergeGeometries(bars)!, M.darkSteel);
    g.add(bm);
    at(wbox(w + 0.3, 0.06, 0.16, M.white), 0, -h / 2 - 0.08, -0.07, g);
  }
  const ch = at(wbox(w + 0.45, 0.06, 0.45, M.white), 0, h / 2 + 0.14, -0.2, g);
  ch.castShadow = true;
  g.position.set(x, y, z);
  parent.add(g);
}

function buildWalls(scene: THREE.Scene, col: Collider, blockers: THREE.Object3D[]) {
  // west boundary (road side) with the two openings
  wallSeg(scene, col, blockers, 0, P.wz(200), 0, P.wz(353), 1.55, 0.22, M.yellow);
  wallSeg(scene, col, blockers, 0, P.wz(666), 0, P.PLOT_D + 12.5, 1.55, 0.22, M.yellow);
  wallSeg(scene, col, blockers, 0, P.MID_WALL.z0 + 0.2, 0, P.MID_WALL.z1 - 0.2, 1.55, 0.22, M.yellow);
  for (const z of P.PILLARS_Z) {
    const h = 1.85 - P.ROAD_Y;
    const p = at(wbox(0.42, h, 0.42, M.yellow, 2), 0, P.ROAD_Y + h / 2, z, scene);
    blockers.push(p);
    at(wbox(0.52, 0.1, 0.52, M.coping), 0, 1.9, z, scene);
    col.box(-0.21, 0.21, z - 0.21, z + 0.21);
  }
  // north boundary: curved corner, then straight
  const pts = P.nwCurve(14).map(([x, y]) => [P.wx(x), P.wz(y)] as [number, number]);
  pts.push([P.PLOT_W + 0.2, 0]);
  for (let i = 0; i < pts.length - 1; i++) {
    wallSeg(scene, col, blockers, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 1.35, 0.2, M.grey);
  }
  // neighbour's tall wall on the east
  wallSeg(scene, col, blockers, P.PLOT_W + 0.16, -0.4, P.PLOT_W + 0.16, P.PLOT_D + 12.5, 4.5, 0.32, M.neighbour, false);
}

function buildGate(scene: THREE.Scene, col: Collider) {
  // sliding gate, slid open along the outside of the wall
  const L = 3.6, H = 1.55, z0 = P.wz(668);
  const g = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  for (let z = 0.04; z < L; z += 0.11) geos.push(cylBetween(new THREE.Vector3(0, 0.12, z), new THREE.Vector3(0, H, z), 0.014, 6));
  for (const y of [0.12, 0.85, H]) geos.push(cylBetween(new THREE.Vector3(0, y, 0), new THREE.Vector3(0, y, L), 0.028, 8));
  const gate = new THREE.Mesh(mergeGeometries(geos)!, M.steel);
  gate.castShadow = true;
  g.add(gate);
  for (const z of [0.3, L - 0.3]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 12), M.darkSteel);
    wheel.rotation.z = Math.PI / 2;
    at(wheel, 0, 0.06, z, g);
  }
  g.position.set(-0.34, P.ROAD_Y, z0);
  scene.add(g);
  col.seg(-0.34, z0, -0.34, z0 + L, 0.05);
  // ramp outside the sliding gate, on the road
  const shape = new THREE.Shape();
  shape.moveTo(-1.0, 0);
  shape.lineTo(0, 0);
  shape.lineTo(0, -P.ROAD_Y);
  shape.closePath();
  const depth = P.GATE.z1 - P.GATE.z0 + 0.3;
  const ramp = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false }), M.concrete);
  ramp.position.set(0, P.ROAD_Y, P.GATE.z0 - 0.15);
  ramp.receiveShadow = true;
  scene.add(ramp);
}

function buildHouse(scene: THREE.Scene, col: Collider, blockers: THREE.Object3D[]) {
  const W = P.PLOT_W, z0 = P.PORCH.z0, z1 = P.PORCH.z1, py = P.PORCH_Y, cx = P.STAIR_CX;
  const plinth = at(wbox(W - 0.4, py, 11.8, M.stone, 2), W / 2, py / 2, z0 + 5.9, scene);
  blockers.push(plinth);
  at(wbox(W - 0.4, 0.02, z1 - z0, M.granite, 1.5), W / 2, py + 0.01, (z0 + z1) / 2, scene);
  // main stair: five granite steps
  const sw = P.STAIR.x1 - P.STAIR.x0;
  for (let i = 1; i <= P.STAIR.steps; i++) {
    const d = P.STAIR.tread * (P.STAIR.steps + 1 - i);
    at(wbox(sw, i * P.STAIR.rise, d, M.granite, 1.2), cx, (i * P.STAIR.rise) / 2, P.PLOT_D + (i - 1) * P.STAIR.tread + d / 2, scene);
  }
  scene.add(railing(P.STAIR.x0 + 0.05, P.PLOT_D + 0.12, P.STAIR.rise, P.STAIR.x0 + 0.05, z0, py, 0.9, 0.12));
  scene.add(railing(P.STAIR.x1 - 0.05, P.PLOT_D + 0.12, P.STAIR.rise, P.STAIR.x1 - 0.05, z0, py, 0.9, 0.12));
  // porch railing, open at the stair
  scene.add(railing(0.35, z0 + 0.05, py, P.STAIR.x0 - 0.02, z0 + 0.05, py));
  scene.add(railing(P.STAIR.x1 + 0.02, z0 + 0.05, py, W - 0.35, z0 + 0.05, py));
  // ground floor
  const gf = at(wbox(W - 0.6, 3.1, 9.6, M.houseYellow, 2), W / 2, py + 1.55, z1 + 4.8, scene);
  blockers.push(gf);
  at(wbox(1.32, 2.36, 0.05, M.white), cx, py + 1.18, z1 - 0.01, scene);
  at(wbox(1.1, 2.2, 0.08, M.wood, 1), cx, py + 1.1, z1 - 0.04, scene);
  addWindow(scene, 1.9, py + 1.55, z1, 1.4, 1.3);
  addWindow(scene, W - 1.9, py + 1.55, z1, 1.4, 1.3);
  for (const x of [0.45, P.STAIR.x0 - 0.25, P.STAIR.x1 + 0.25, W - 0.45]) {
    const c = at(wbox(0.3, 3.1, 0.3, M.houseYellow, 2), x, py + 1.55, z0 + 0.2, scene);
    blockers.push(c);
    col.box(x - 0.15, x + 0.15, z0 + 0.05, z0 + 0.35);
  }
  const slabY = py + 3.1;
  const slab = at(wbox(W - 0.3, 0.16, z1 - z0 + 0.55, M.white, 2), W / 2, slabY + 0.08, (z0 + z1) / 2 - 0.02, scene);
  blockers.push(slab);
  // sloped clay-tile canopies either side of the balcony
  for (const [xa, xb] of [[0.15, cx - 2.35], [cx + 2.35, W - 0.15]] as Array<[number, number]>) {
    const t = wbox(xb - xa, 0.05, 1.25, M.roof, 1);
    t.rotation.x = -0.42;
    at(t, (xa + xb) / 2, slabY + 0.42, z0 - 0.05, scene);
  }
  // first floor with balcony
  const ffY = slabY + 0.16;
  const ff = at(wbox(W - 1.0, 3.0, 9.2, M.houseYellow, 2), W / 2, ffY + 1.5, z1 + 0.3 + 4.6, scene);
  blockers.push(ff);
  addWindow(scene, 1.75, ffY + 1.5, z1 + 0.3, 1.3, 1.2);
  addWindow(scene, W - 1.75, ffY + 1.5, z1 + 0.3, 1.3, 1.2);
  addWindow(scene, cx, ffY + 1.1, z1 + 0.3, 1.4, 2.1, true);
  scene.add(railing(cx - 2.3, z0 - 0.15, ffY, cx + 2.3, z0 - 0.15, ffY));
  scene.add(railing(cx - 2.3, z0 - 0.15, ffY, cx - 2.3, z1 + 0.3, ffY));
  scene.add(railing(cx + 2.3, z0 - 0.15, ffY, cx + 2.3, z1 + 0.3, ffY));
  const top = wbox(W - 0.5, 0.05, 1.2, M.roof, 1);
  top.rotation.x = -0.42;
  at(top, W / 2, ffY + 3.0 + 0.3, z1 + 0.3 - 0.35, scene);
  // small room on the terrace with a hipped tile roof
  const sfY = ffY + 3.0;
  const sf = at(wbox(4.6, 2.6, 5.0, M.houseYellow, 2), cx, sfY + 1.3, z1 + 3.2, scene);
  blockers.push(sf);
  addWindow(scene, cx - 0.9, sfY + 1.4, z1 + 0.7, 1.0, 1.0);
  const roofG = new THREE.ConeGeometry(1, 1, 4, 1);
  roofG.rotateY(Math.PI / 4);
  const roof = new THREE.Mesh(roofG, M.roof);
  roof.scale.set(2.75 / 0.707, 1.5, 2.95 / 0.707);
  roof.castShadow = true;
  at(roof, cx, sfY + 2.6 + 0.75, z1 + 3.2, scene);
  at(wbox(W - 1.0, 0.8, 0.14, M.houseYellow, 2), W / 2, sfY + 0.4, z1 + 0.37, scene);

  // collision: plinth/porch front (open at the stair), stair sides, porch ends, house front
  col.seg(0.2, z0, P.STAIR.x0, z0, 0.06);
  col.seg(P.STAIR.x1, z0, W - 0.2, z0, 0.06);
  col.seg(P.STAIR.x0, P.PLOT_D, P.STAIR.x0, z0, 0.06);
  col.seg(P.STAIR.x1, P.PLOT_D, P.STAIR.x1, z0, 0.06);
  col.seg(0.3, z1, W - 0.3, z1, 0.08);
  col.seg(0.3, z0, 0.3, z1, 0.08);
  col.seg(W - 0.3, z0, W - 0.3, z1, 0.08);
}

function buildCarport(scene: THREE.Scene, col: Collider) {
  const { x0, x1, z0, z1 } = P.CARPORT;
  const HS = 2.6, HN = 2.4;
  const slope = Math.atan2(HS - HN, z1 - z0);
  for (const x of [x0 + 0.08, x1 - 0.14]) {
    for (const z of [z0 + 0.06, z1 - 0.06]) {
      const h = z < (z0 + z1) / 2 ? HN : HS;
      at(wbox(0.1, h, 0.1, M.darkSteel), x, h / 2, z, scene);
      col.circ(x, z, 0.09);
    }
  }
  at(wbox(x1 - x0, 0.14, 0.08, M.darkSteel), (x0 + x1) / 2, HN - 0.07, z0 + 0.06, scene);
  at(wbox(x1 - x0, 0.14, 0.08, M.darkSteel), (x0 + x1) / 2, HS - 0.07, z1 - 0.06, scene);
  const len = Math.hypot(z1 - z0, HS - HN);
  for (let x = x0 + 0.08; x <= x1 - 0.1; x += 1.15) {
    const r = wbox(0.06, 0.1, len, M.darkSteel);
    r.rotation.x = -slope;
    at(r, x, (HS + HN) / 2 + 0.02, (z0 + z1) / 2, scene);
  }
  const sheet = wbox(x1 - x0 + 0.3, 0.012, len + 0.4, M.poly);
  sheet.rotation.x = -slope;
  sheet.receiveShadow = false;
  at(sheet, (x0 + x1) / 2, (HS + HN) / 2 + 0.08, (z0 + z1) / 2, scene);
  at(wbox(x1 - x0 + 0.3, 0.09, 0.12, M.darkSteel), (x0 + x1) / 2, HN - 0.04, z0 - 0.16, scene);
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, HN, 10), M.darkSteel);
  pipe.castShadow = true;
  at(pipe, x1 - 0.3, HN / 2, z0 - 0.16, scene);
}

function buildCar(scene: THREE.Scene, col: Collider) {
  const g = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color: '#e9e7e2', metalness: 0.3, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.08 });
  const black = new THREE.MeshStandardMaterial({ color: '#1b1d20', roughness: 0.7 });
  const glass = new THREE.MeshStandardMaterial({ color: '#141a20', roughness: 0.05, metalness: 0.5 });
  const chrome = new THREE.MeshStandardMaterial({ color: '#c9ccd0', metalness: 1, roughness: 0.25 });
  const lamp = new THREE.MeshStandardMaterial({ color: '#eef3f6', emissive: '#cfe3ff', emissiveIntensity: 0.25, roughness: 0.1 });
  const tail = new THREE.MeshStandardMaterial({ color: '#8a0d12', emissive: '#5a0004', emissiveIntensity: 0.4, roughness: 0.2 });
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
    const me = new THREE.Mesh(geo, m);
    me.position.set(x, y, z);
    me.castShadow = true;
    me.receiveShadow = true;
    g.add(me);
    return me;
  };
  add(new RoundedBoxGeometry(4.31, 0.62, 1.79, 4, 0.14), paint, 0, 0.6, 0);
  add(new THREE.BoxGeometry(4.33, 0.2, 1.81), black, 0, 0.38, 0);
  add(new RoundedBoxGeometry(2.6, 0.7, 1.64, 4, 0.14), paint, -0.25, 1.18, 0);
  add(new THREE.BoxGeometry(2.25, 0.4, 1.66), glass, -0.25, 1.22, 0);
  add(new THREE.BoxGeometry(0.1, 0.44, 1.67), paint, -0.25, 1.22, 0);
  const ws = add(new THREE.BoxGeometry(0.05, 0.62, 1.48), glass, 0.98, 1.17, 0);
  ws.rotation.z = -0.62;
  const rs = add(new THREE.BoxGeometry(0.05, 0.5, 1.44), glass, -1.48, 1.2, 0);
  rs.rotation.z = 0.35;
  for (const z of [-0.6, 0.6]) {
    add(new THREE.BoxGeometry(2.2, 0.035, 0.05), chrome, -0.3, 1.56, z);
    add(new THREE.BoxGeometry(0.06, 0.07, 0.34), lamp, 2.15, 0.78, z);
    add(new THREE.BoxGeometry(0.06, 0.08, 0.36), tail, -2.15, 0.82, z);
  }
  add(new THREE.BoxGeometry(0.05, 0.22, 1.0), black, 2.16, 0.6, 0);
  add(new THREE.BoxGeometry(0.03, 0.03, 1.2), tail, -2.16, 0.86, 0);
  const tire = new THREE.CylinderGeometry(0.34, 0.34, 0.22, 28);
  tire.rotateX(Math.PI / 2);
  const rim = new THREE.CylinderGeometry(0.21, 0.21, 0.23, 16);
  rim.rotateX(Math.PI / 2);
  for (const x of [-1.33, 1.33]) {
    for (const z of [-0.79, 0.79]) {
      add(tire, black, x, 0.34, z);
      add(rim, chrome, x, 0.34, z);
    }
  }
  g.position.set(P.CAR.x, 0, P.CAR.z);
  scene.add(g);
  col.box(P.CAR.x - 2.2, P.CAR.x + 2.2, P.CAR.z - 0.93, P.CAR.z + 0.93);
}

function buildBench(scene: THREE.Scene, col: Collider) {
  const g = new THREE.Group();
  for (const x of [-0.7, 0.7]) at(wbox(0.12, 0.42, 0.42, M.concrete), x, 0.21, 0, g);
  for (const z of [-0.15, -0.05, 0.05, 0.15]) at(wbox(1.7, 0.04, 0.085, M.wood, 1), 0, 0.44, z, g);
  for (const y of [0.62, 0.74, 0.86]) {
    const s = wbox(1.7, 0.085, 0.035, M.wood, 1);
    s.rotation.x = -0.15;
    at(s, 0, y, -0.25 - (y - 0.62) * 0.15, g);
  }
  for (const x of [-0.7, 0.7]) {
    const b = wbox(0.06, 0.5, 0.05, M.concrete);
    b.rotation.x = -0.15;
    at(b, x, 0.68, -0.27, g);
  }
  const x = P.wx(P.BENCH_PAD.x), z = P.wz(P.BENCH_PAD.y) - 0.05;
  g.position.set(x, 0.02, z);
  scene.add(g);
  col.box(x - 0.88, x + 0.88, z - 0.32, z + 0.24);
}

function buildLamps(scene: THREE.Scene, col: Collider) {
  const glow = new THREE.MeshStandardMaterial({ color: '#fff3dc', emissive: new THREE.Color('#ffc874'), emissiveIntensity: 0, roughness: 0.4 });
  const lamps: THREE.PointLight[] = [];
  for (const [sx, sy] of P.BOLLARDS) {
    const x = P.wx(sx), z = P.wz(sy);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.62, 16), M.darkSteel);
    body.castShadow = true;
    at(body, x, 0.31, z, scene);
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 16), glow), x, 0.67, z, scene);
    at(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 16), M.darkSteel), x, 0.735, z, scene);
    const l = new THREE.PointLight('#ffc98a', 0, 9, 2);
    at(l, x, 0.66, z, scene);
    lamps.push(l);
    col.circ(x, z, 0.12);
  }
  for (const [, sy] of P.WALL_LIGHTS) {
    const z = P.wz(sy);
    at(wbox(0.1, 0.24, 0.16, M.darkSteel), 0.16, 1.2, z, scene);
    at(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.11), glow), 0.215, 1.2, z, scene);
    const l = new THREE.PointLight('#ffc98a', 0, 10, 2);
    at(l, 0.4, 1.2, z, scene);
    lamps.push(l);
  }
  return { lamps, glow };
}

function buildSmallThings(scene: THREE.Scene, col: Collider) {
  // terracotta pots (plants are added in plants.ts)
  const prof = [[0, 0], [0.17, 0], [0.2, 0.04], [0.26, 0.42], [0.31, 0.46], [0.3, 0.5], [0.26, 0.5], [0.24, 0.47], [0, 0.47]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const potGeo = new THREE.LatheGeometry(prof, 28);
  for (const [sx, sy] of P.POTS) {
    const x = P.wx(sx), z = P.wz(sy);
    const pot = new THREE.Mesh(potGeo, M.terracotta);
    pot.castShadow = true;
    pot.receiveShadow = true;
    at(pot, x, 0, z, scene);
    const soil = new THREE.Mesh(new THREE.CircleGeometry(0.24, 20), M.soil);
    soil.rotation.x = -Math.PI / 2;
    at(soil, x, 0.465, z, scene);
    col.circ(x, z, 0.32);
  }
  // stepping stones and bench pad
  for (const [sx, sy] of P.STEPPING) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.03, 22), M.stepStone);
    s.scale.set(9 * P.U, 1, 6 * P.U);
    s.receiveShadow = true;
    at(s, P.wx(sx), 0.012, P.wz(sy), scene);
  }
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.025, 36), M.stepStone);
  pad.scale.set(P.BENCH_PAD.rx * P.U, 1, P.BENCH_PAD.ry * P.U);
  pad.receiveShadow = true;
  at(pad, P.wx(P.BENCH_PAD.x), 0.01, P.wz(P.BENCH_PAD.y), scene);
  // soak pit lid in the north bed
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.06, 28), M.concrete);
  lid.receiveShadow = true;
  at(lid, P.wx(P.SOAK_PIT.x), 0.03, P.wz(P.SOAK_PIT.y), scene);
}

export function buildStructures(scene: THREE.Scene, col: Collider): Built {
  const blockers: THREE.Object3D[] = [];
  buildWalls(scene, col, blockers);
  buildGate(scene, col);
  buildHouse(scene, col, blockers);
  buildCarport(scene, col);
  buildCar(scene, col);
  buildBench(scene, col);
  buildSmallThings(scene, col);
  const { lamps, glow } = buildLamps(scene, col);
  return { blockers, lamps, lampGlow: glow, windowGlass: M.glass };
}
