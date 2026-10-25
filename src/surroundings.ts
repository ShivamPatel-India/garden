import * as THREE from 'three';
import { ROAD_Y, PLOT_W, PLOT_D } from './plan';
import { canvasTex, asphaltCanvas, dirtCanvas, facadeCanvas, plasterCanvas } from './textures';
import { wbox, M } from './structures';
import { makePalm, makeTree } from './plants';
import { Collider } from './collision';

function building(scene: THREE.Scene, x: number, z: number, w: number, d: number, h: number, base: string, roof?: string) {
  const mat = new THREE.MeshStandardMaterial({ map: canvasTex(facadeCanvas(base)), roughness: 0.95 });
  const b = wbox(w, h, d, mat, 3);
  b.position.set(x, ROAD_Y + h / 2, z);
  scene.add(b);
  const parapet = wbox(w + 0.1, 0.5, d + 0.1, new THREE.MeshStandardMaterial({ map: canvasTex(plasterCanvas(base, 0.5, 256, 31)), roughness: 0.95 }), 2);
  parapet.position.set(x, ROAD_Y + h + 0.25, z);
  scene.add(parapet);
  if (roof) {
    const g = new THREE.ConeGeometry(1, 1, 4, 1);
    g.rotateY(Math.PI / 4);
    const r = new THREE.Mesh(g, M.roof);
    r.scale.set((w / 2 + 0.4) / 0.707, 1.8, (d / 2 + 0.4) / 0.707);
    r.position.set(x, ROAD_Y + h + 0.9, z);
    r.castShadow = true;
    scene.add(r);
  }
}

export interface Surroundings { streetLight: THREE.PointLight; streetGlow: THREE.MeshStandardMaterial }

export function buildSurroundings(scene: THREE.Scene, col: Collider): Surroundings {
  const dirt = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 220),
    new THREE.MeshStandardMaterial({ map: canvasTex(dirtCanvas(), [55, 55]), roughness: 1 }),
  );
  dirt.rotation.x = -Math.PI / 2;
  dirt.position.set(0, ROAD_Y - 0.02, 12);
  dirt.receiveShadow = true;
  scene.add(dirt);

  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(7.2, 140),
    new THREE.MeshStandardMaterial({ map: canvasTex(asphaltCanvas(), [2, 38]), roughness: 0.95 }),
  );
  road.rotation.x = -Math.PI / 2;
  road.position.set(-4.4, ROAD_Y + 0.004, 12);
  road.receiveShadow = true;
  scene.add(road);

  // across the road: compound walls and houses
  const wallMat = new THREE.MeshStandardMaterial({ map: canvasTex(plasterCanvas('#d9d2bd', 0.5, 512, 21)), roughness: 0.95 });
  for (const [z0, z1] of [[-30, 4], [7.5, 24], [27, 60]]) {
    const w = wbox(0.2, 1.4, z1 - z0, wallMat, 2);
    w.position.set(-8.6, ROAD_Y + 0.7, (z0 + z1) / 2);
    scene.add(w);
  }
  building(scene, -15.5, -6, 10, 12, 7.5, '#e4e0d6');
  building(scene, -14.5, 15.5, 9, 11, 9.5, '#c9d6e0');
  building(scene, -15, 33, 10, 10, 6.5, '#e6dcc4', '#roof');
  // north of the plot (seen over the north wall): blue house with a tile roof, white block
  building(scene, 4.5, -11, 9, 8, 6.2, '#a9c3dd', '#roof');
  building(scene, -3, -21, 10, 9, 8.5, '#dad6cc');
  // east neighbour behind the tall wall
  building(scene, PLOT_W + 5.6, 9, 10, 18, 8.2, '#d8d2c4');
  building(scene, PLOT_W + 5.6, PLOT_D + 4, 10, 12, 7.0, '#cbd5d8');

  // palms and trees outside
  const palms: Array<[number, number, number]> = [[-10.4, -3, 8.5], [-9.8, 10.5, 9.5], [-10.6, 26, 7.8], [-2.2, -2.6, 9], [2.5, -6.5, 10], [13.5, -5, 8.6]];
  palms.forEach(([x, z, h], i) => scene.add(makePalm(x, z, h, 40 + i * 7)));
  scene.add(makeTree('mango', -11.5, 20.5, 61, ROAD_Y, 1.1));
  scene.add(makeTree('neem', 9.5, -16, 62, ROAD_Y, 1.2));
  scene.add(makeTree('mango', -6.5, -12, 63, ROAD_Y, 1.0));
  scene.add(makeTree('neem', 12.5, -9.5, 64, ROAD_Y, 1.1));

  // electricity poles and wires along the road
  const poleMat = new THREE.MeshStandardMaterial({ color: '#9b978f', roughness: 0.9 });
  const poles: THREE.Vector3[] = [];
  for (const z of [-14, 4.8, 23.5, 42]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, 8.5, 8), poleMat);
    p.position.set(-1.0, ROAD_Y + 4.25, z);
    p.castShadow = true;
    scene.add(p);
    const arm = wbox(0.1, 0.1, 1.4, M.darkSteel);
    arm.position.set(-1.0, ROAD_Y + 7.8, z);
    scene.add(arm);
    poles.push(new THREE.Vector3(-1.0, ROAD_Y + 7.8, z));
    col.circ(-1.0, z, 0.16);
  }
  const wireMat = new THREE.LineBasicMaterial({ color: '#202020' });
  for (const dz of [-0.6, 0, 0.6]) {
    for (let i = 0; i < poles.length - 1; i++) {
      const a = poles[i], b = poles[i + 1];
      const pts: THREE.Vector3[] = [];
      for (let t = 0; t <= 1.0001; t += 0.05) {
        pts.push(new THREE.Vector3(a.x + dz * 0.3, a.y - Math.sin(Math.PI * t) * 0.6 + 0.05, a.z + (b.z - a.z) * t + dz));
      }
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
    }
  }
  // street light on one pole
  const head = wbox(0.5, 0.08, 0.18, M.darkSteel);
  head.position.set(-1.6, ROAD_Y + 6.6, 4.8);
  scene.add(head);
  const streetGlow = new THREE.MeshStandardMaterial({ color: '#fff6e0', emissive: new THREE.Color('#ffd9a0'), emissiveIntensity: 0 });
  const lens = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 0.14), streetGlow);
  lens.position.set(-1.6, ROAD_Y + 6.55, 4.8);
  scene.add(lens);
  const streetLight = new THREE.PointLight('#ffd6a0', 0, 22, 1.6);
  streetLight.position.set(-1.7, ROAD_Y + 6.3, 4.8);
  scene.add(streetLight);

  // keep people on the near half of the road
  col.minX = -7.6;
  col.minZ = -12;
  col.maxZ = PLOT_D + 6;
  return { streetLight, streetGlow };
}
