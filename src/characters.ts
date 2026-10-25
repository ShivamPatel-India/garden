import * as THREE from 'three';
import { Collider } from './collision';
import { groundY } from './plan';

function mat(color: string, rough = 0.8, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
}
function part(geo: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0): THREE.Mesh {
  const me = new THREE.Mesh(geo, m);
  me.position.set(x, y, z);
  me.castShadow = true;
  me.receiveShadow = true;
  parent.add(me);
  return me;
}
function pivot(parent: THREE.Object3D, x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}
const damp = (cur: number, target: number, rate: number, dt: number) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

export interface Animated { root: THREE.Group; update(dt: number, speed: number): void }

/** The walker. Faces +z in local space. About 1.77 m tall. */
export class Man implements Animated {
  root = new THREE.Group();
  private hips: THREE.Group;
  private chest: THREE.Group;
  private head: THREE.Group;
  private legs: Array<{ hip: THREE.Group; knee: THREE.Group }> = [];
  private arms: Array<{ sh: THREE.Group; el: THREE.Group }> = [];
  private phase = 0;
  private amp = 0;
  private t = 0;

  constructor() {
    const skin = mat('#b07a56', 0.62), shirt = mat('#6d93b8', 0.85), pants = mat('#353b45', 0.9);
    const shoe = mat('#3b2a1f', 0.55), hair = mat('#16110e', 0.9), belt = mat('#2a1e16', 0.6), eye = mat('#1a1410', 0.3);
    this.hips = pivot(this.root, 0, 0.95, 0);
    const pelvis = part(new THREE.CapsuleGeometry(0.12, 0.1, 4, 12), pants, this.hips, 0, 0.02, 0);
    pelvis.rotation.z = Math.PI / 2;
    pelvis.scale.set(1, 1, 0.78);
    part(new THREE.CylinderGeometry(0.155, 0.155, 0.05, 18), belt, this.hips, 0, 0.1, 0).scale.set(1, 1, 0.74);
    this.chest = pivot(this.hips, 0, 0.1, 0);
    part(new THREE.CapsuleGeometry(0.16, 0.26, 6, 16), shirt, this.chest, 0, 0.2, 0).scale.set(1.12, 1, 0.7);
    const collar = part(new THREE.TorusGeometry(0.06, 0.015, 6, 16), shirt, this.chest, 0, 0.45, 0.005);
    collar.rotation.x = Math.PI / 2;
    part(new THREE.CylinderGeometry(0.045, 0.05, 0.1, 12), skin, this.chest, 0, 0.47, 0.005);
    this.head = pivot(this.chest, 0, 0.6, 0.01);
    part(new THREE.SphereGeometry(0.105, 22, 18), skin, this.head).scale.set(0.93, 1.1, 1);
    part(new THREE.SphereGeometry(0.112, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), hair, this.head, 0, 0.022, -0.012).scale.set(0.96, 1.05, 1.04);
    for (const s of [-1, 1]) {
      part(new THREE.SphereGeometry(0.013, 8, 6), eye, this.head, s * 0.035, 0.022, 0.094);
      part(new THREE.BoxGeometry(0.04, 0.008, 0.01), hair, this.head, s * 0.036, 0.048, 0.094);
      part(new THREE.SphereGeometry(0.022, 8, 6), skin, this.head, s * 0.098, 0.005, 0).scale.set(0.5, 1, 0.8);
    }
    const nose = part(new THREE.ConeGeometry(0.016, 0.045, 8), skin, this.head, 0, -0.005, 0.105);
    nose.rotation.x = Math.PI / 2;
    part(new THREE.BoxGeometry(0.04, 0.008, 0.01), mat('#7a4a3a', 0.6), this.head, 0, -0.048, 0.094);
    for (const s of [-1, 1]) {
      const sh = pivot(this.chest, s * 0.215, 0.38, 0);
      part(new THREE.SphereGeometry(0.062, 14, 10), shirt, sh);
      part(new THREE.CapsuleGeometry(0.05, 0.16, 4, 10), shirt, sh, 0, -0.12, 0);
      const el = pivot(sh, 0, -0.28, 0);
      part(new THREE.CapsuleGeometry(0.04, 0.18, 4, 10), skin, el, 0, -0.12, 0);
      part(new THREE.SphereGeometry(0.046, 10, 8), skin, el, 0, -0.27, 0.005).scale.set(0.75, 1.15, 0.55);
      this.arms.push({ sh, el });
    }
    for (const s of [-1, 1]) {
      const hip = pivot(this.hips, s * 0.085, -0.02, 0);
      part(new THREE.CapsuleGeometry(0.072, 0.28, 4, 12), pants, hip, 0, -0.2, 0);
      const knee = pivot(hip, 0, -0.42, 0);
      part(new THREE.CapsuleGeometry(0.057, 0.3, 4, 12), pants, knee, 0, -0.19, 0);
      const ankle = pivot(knee, 0, -0.44, 0);
      part(new THREE.BoxGeometry(0.1, 0.07, 0.26), shoe, ankle, 0, -0.03, 0.045);
      this.legs.push({ hip, knee });
    }
  }

  update(dt: number, speed: number): void {
    this.t += dt;
    const moving = speed > 0.08;
    const run = speed > 2.6;
    this.amp = damp(this.amp, moving ? Math.min(1, speed / 1.6) * (run ? 0.85 : 0.55) : 0, 8, dt);
    if (moving) this.phase += dt * speed * (run ? 2.25 : 3.3);
    const s = Math.sin(this.phase), c = Math.cos(this.phase), a = this.amp;
    this.legs[0].hip.rotation.x = -s * a;
    this.legs[1].hip.rotation.x = s * a;
    this.legs[0].knee.rotation.x = 0.04 + Math.max(0, c) * a * 1.35;
    this.legs[1].knee.rotation.x = 0.04 + Math.max(0, -c) * a * 1.35;
    this.arms[0].sh.rotation.x = s * a * 0.9;
    this.arms[1].sh.rotation.x = -s * a * 0.9;
    const elb = -0.12 - a * (run ? 1.1 : 0.35);
    this.arms[0].el.rotation.x = elb;
    this.arms[1].el.rotation.x = elb;
    this.arms[0].sh.rotation.z = -0.07;
    this.arms[1].sh.rotation.z = 0.07;
    this.hips.position.y = 0.95 - (1 - Math.abs(c)) * 0.03 * a;
    this.hips.rotation.y = s * 0.08 * a;
    this.chest.rotation.y = -s * 0.12 * a;
    this.chest.rotation.x = run ? 0.16 * a : 0.03;
    const idle = 1 - Math.min(1, a / 0.3);
    this.chest.scale.y = 1 + Math.sin(this.t * 2.2) * 0.008 * idle;
    this.head.rotation.y = Math.sin(this.t * 0.45) * 0.35 * idle;
  }
}

/** Orange Indian street dog with a curled tail. */
export class Dog implements Animated {
  root = new THREE.Group();
  private body: THREE.Group;
  private head: THREE.Group;
  private tail: THREE.Group;
  private legs: THREE.Group[] = [];
  private phase = 0;
  private amp = 0;
  private t = 0;

  constructor() {
    const fur = mat('#c47b34', 0.95), cream = mat('#ecd3a8', 0.95), dark = mat('#191311', 0.35);
    this.body = pivot(this.root, 0, 0, 0);
    part(new THREE.CapsuleGeometry(0.115, 0.36, 6, 14), fur, this.body, 0, 0.45, -0.02).rotation.x = Math.PI / 2;
    part(new THREE.SphereGeometry(0.13, 16, 12), fur, this.body, 0, 0.47, 0.17);
    part(new THREE.SphereGeometry(0.1, 14, 10), cream, this.body, 0, 0.42, 0.23).scale.set(0.85, 1.1, 0.7);
    part(new THREE.CapsuleGeometry(0.08, 0.26, 4, 10), cream, this.body, 0, 0.39, -0.02).rotation.x = Math.PI / 2;
    part(new THREE.SphereGeometry(0.12, 14, 10), fur, this.body, 0, 0.46, -0.2);
    part(new THREE.CapsuleGeometry(0.065, 0.12, 4, 10), fur, this.body, 0, 0.56, 0.26).rotation.x = -0.75;
    this.head = pivot(this.body, 0, 0.64, 0.33);
    part(new THREE.SphereGeometry(0.085, 16, 12), fur, this.head).scale.set(0.95, 0.92, 1.05);
    part(new THREE.CapsuleGeometry(0.042, 0.07, 4, 10), cream, this.head, 0, -0.025, 0.09).rotation.x = Math.PI / 2;
    part(new THREE.SphereGeometry(0.021, 8, 6), dark, this.head, 0, -0.012, 0.152);
    for (const s of [-1, 1]) {
      const ear = part(new THREE.ConeGeometry(0.032, 0.09, 4), fur, this.head, s * 0.045, 0.085, -0.015);
      ear.rotation.z = -s * 0.28;
      ear.scale.z = 0.5;
      part(new THREE.SphereGeometry(0.012, 8, 6), dark, this.head, s * 0.038, 0.022, 0.07);
    }
    const lp: Array<[number, number]> = [[-0.07, 0.17], [0.07, 0.17], [-0.07, -0.19], [0.07, -0.19]];
    for (const [x, z] of lp) {
      const g = pivot(this.body, x, 0.42, z);
      part(new THREE.CapsuleGeometry(0.03, 0.3, 4, 8), fur, g, 0, -0.19, 0);
      part(new THREE.SphereGeometry(0.034, 8, 6), cream, g, 0, -0.39, 0.012).scale.set(1, 0.7, 1.35);
      this.legs.push(g);
    }
    for (const s of [-1, 1]) part(new THREE.SphereGeometry(0.07, 10, 8), fur, this.body, s * 0.06, 0.44, -0.18);
    this.tail = pivot(this.body, 0, 0.5, -0.27);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.1, -0.06), new THREE.Vector3(0, 0.19, -0.03), new THREE.Vector3(0, 0.22, 0.05),
    ]);
    part(new THREE.TubeGeometry(curve, 16, 0.026, 8), fur, this.tail);
    part(new THREE.SphereGeometry(0.028, 8, 6), cream, this.tail, 0, 0.22, 0.05);
  }

  update(dt: number, speed: number): void {
    this.t += dt;
    const moving = speed > 0.08;
    this.amp = damp(this.amp, moving ? Math.min(0.6, 0.25 + speed * 0.12) : 0, 8, dt);
    if (moving) this.phase += dt * speed * 6.5;
    const s = Math.sin(this.phase), a = this.amp;
    this.legs[0].rotation.x = s * a;
    this.legs[3].rotation.x = s * a;
    this.legs[1].rotation.x = -s * a;
    this.legs[2].rotation.x = -s * a;
    this.body.position.y = Math.abs(Math.cos(this.phase)) * 0.018 * a;
    this.tail.rotation.z = Math.sin(this.t * (moving ? 7 : 11)) * (moving ? 0.25 : 0.5);
    this.head.rotation.y = moving ? damp(this.head.rotation.y, 0, 6, dt) : Math.sin(this.t * 0.7) * 0.45;
    this.head.rotation.x = moving ? 0.05 : Math.sin(this.t * 0.9) * 0.08;
  }
}

/** Mostly white cat with a black stripe down the back, black ears, cap and tail. Sits when everyone stops. */
export class Cat implements Animated {
  root = new THREE.Group();
  private bodyPivot: THREE.Group;
  private head: THREE.Group;
  private tail: THREE.Group;
  private front: THREE.Group[] = [];
  private back: THREE.Group[] = [];
  private phase = 0;
  private amp = 0;
  private t = 0;
  private idle = 0;
  private sit = 0;

  constructor() {
    const black = mat('#151515', 0.85), white = mat('#f2f0ea', 0.95), pink = mat('#d79a9a', 0.6);
    const eye = mat('#9fc43a', 0.25, { emissive: new THREE.Color('#2e3a0e'), emissiveIntensity: 0.6 }), pupil = mat('#050505', 0.3);
    this.bodyPivot = pivot(this.root, 0, 0.2, 0.1);
    part(new THREE.CapsuleGeometry(0.068, 0.2, 6, 12), white, this.bodyPivot, 0, 0.005, -0.12).rotation.x = Math.PI / 2;
    part(new THREE.SphereGeometry(0.07, 14, 10), white, this.bodyPivot, 0, 0.01, 0);
    // the black stripe along the spine, shoulders to tail
    const stripe = part(new THREE.CapsuleGeometry(0.028, 0.25, 4, 10), black, this.bodyPivot, 0, 0.058, -0.11);
    stripe.rotation.x = Math.PI / 2;
    stripe.scale.set(1.5, 1, 0.55);
    part(new THREE.SphereGeometry(0.04, 10, 8), black, this.bodyPivot, 0, 0.05, 0.02).scale.set(1.2, 0.5, 1);
    for (const s of [-1, 1]) {
      const g = pivot(this.bodyPivot, s * 0.04, -0.01, -0.22);
      part(new THREE.CapsuleGeometry(0.024, 0.12, 4, 8), white, g, 0, -0.09, 0);
      part(new THREE.SphereGeometry(0.022, 8, 6), white, g, 0, -0.185, 0.008).scale.set(1, 0.7, 1.3);
      this.back.push(g);
    }
    this.tail = pivot(this.bodyPivot, 0, 0.02, -0.28);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.06, -0.07), new THREE.Vector3(0, 0.17, -0.08), new THREE.Vector3(0, 0.24, -0.03),
    ]);
    part(new THREE.TubeGeometry(curve, 16, 0.017, 8), black, this.tail);
    part(new THREE.SphereGeometry(0.019, 8, 6), white, this.tail, 0, 0.24, -0.03);
    for (const s of [-1, 1]) {
      const g = pivot(this.root, s * 0.04, 0.19, 0.11);
      part(new THREE.CapsuleGeometry(0.022, 0.12, 4, 8), white, g, 0, -0.09, 0);
      part(new THREE.SphereGeometry(0.022, 8, 6), white, g, 0, -0.18, 0.008).scale.set(1, 0.7, 1.3);
      this.front.push(g);
    }
    this.head = pivot(this.root, 0, 0.285, 0.17);
    part(new THREE.SphereGeometry(0.062, 16, 12), white, this.head).scale.set(1, 0.92, 0.95);
    // black cap over the top and back of the head
    part(new THREE.SphereGeometry(0.064, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), black, this.head, 0, 0.004, -0.008).scale.set(1, 0.95, 0.97);
    part(new THREE.SphereGeometry(0.033, 12, 8), white, this.head, 0, -0.022, 0.045).scale.set(1.15, 0.8, 0.8);
    part(new THREE.SphereGeometry(0.009, 6, 4), pink, this.head, 0, -0.006, 0.07);
    for (const s of [-1, 1]) {
      const ear = part(new THREE.ConeGeometry(0.024, 0.055, 4), black, this.head, s * 0.033, 0.056, -0.005);
      ear.rotation.z = -s * 0.2;
      const inner = part(new THREE.ConeGeometry(0.014, 0.035, 4), pink, this.head, s * 0.033, 0.052, 0.004);
      inner.rotation.z = -s * 0.2;
      part(new THREE.SphereGeometry(0.011, 8, 6), eye, this.head, s * 0.024, 0.012, 0.052);
      part(new THREE.SphereGeometry(0.005, 6, 4), pupil, this.head, s * 0.024, 0.012, 0.062).scale.set(0.6, 1.6, 0.6);
    }
  }

  update(dt: number, speed: number): void {
    this.t += dt;
    const moving = speed > 0.08;
    this.amp = damp(this.amp, moving ? 0.6 : 0, 8, dt);
    if (moving) this.phase += dt * speed * 9;
    this.idle = moving ? 0 : this.idle + dt;
    this.sit = damp(this.sit, !moving && this.idle > 1.8 ? 1 : 0, 4, dt);
    const s = Math.sin(this.phase), a = this.amp, sit = this.sit;
    this.front[0].rotation.x = s * a;
    this.back[1].rotation.x = s * a - 1.2 * sit;
    this.front[1].rotation.x = -s * a;
    this.back[0].rotation.x = -s * a - 1.2 * sit;
    this.bodyPivot.rotation.x = -0.55 * sit;
    this.bodyPivot.position.y = 0.2 + Math.abs(Math.cos(this.phase)) * 0.01 * a;
    this.head.position.y = 0.285 + 0.035 * sit;
    this.head.rotation.y = moving ? 0 : Math.sin(this.t * 0.5) * 0.5;
    this.tail.rotation.x = 0.1 + 1.25 * sit + Math.sin(this.t * 3) * 0.05;
    this.tail.rotation.z = Math.sin(this.t * 1.6) * 0.25;
  }
}

/** Breadcrumb trail of the walker, so companions follow the same path (and through the gates). */
export class Trail {
  pts: THREE.Vector3[] = [];
  reset(p: THREE.Vector3): void {
    this.pts = [p.clone()];
  }
  push(p: THREE.Vector3): void {
    const last = this.pts[this.pts.length - 1];
    if (!last || last.distanceTo(p) > 0.1) {
      this.pts.push(p.clone());
      if (this.pts.length > 800) this.pts.shift();
    }
  }
  behind(dist: number, head: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    let remaining = dist;
    let a = head;
    for (let i = this.pts.length - 1; i >= 0; i--) {
      const b = this.pts[i];
      const d = a.distanceTo(b);
      if (d >= remaining && d > 1e-6) return out.copy(a).lerp(b, remaining / d);
      remaining -= d;
      a = b;
    }
    return out.copy(a);
  }
}

const tA = new THREE.Vector3(), tB = new THREE.Vector3();

export class Follower {
  pos = new THREE.Vector3();
  yaw = 0;
  speed = 0;
  constructor(public char: Animated, public dist: number, public side: number, public radius: number, public maxSpeed: number) {}

  place(p: THREE.Vector3, yaw: number): void {
    this.pos.copy(p);
    this.pos.y = groundY(p.x, p.z);
    this.yaw = yaw;
    this.speed = 0;
    this.char.root.position.copy(this.pos);
    this.char.root.rotation.y = yaw;
  }

  update(dt: number, trail: Trail, player: THREE.Vector3, col: Collider, others: Follower[]): void {
    const target = trail.behind(this.dist, player, tA);
    trail.behind(this.dist + 0.35, player, tB);
    const dx0 = target.x - tB.x, dz0 = target.z - tB.z, l0 = Math.hypot(dx0, dz0);
    if (l0 > 1e-4) {
      target.x += (-dz0 / l0) * this.side;
      target.z += (dx0 / l0) * this.side;
    }
    const dx = target.x - this.pos.x, dz = target.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 9) {
      this.pos.x = target.x;
      this.pos.z = target.z;
    }
    const want = d < 0.12 ? 0 : Math.min(this.maxSpeed, d * 2.4);
    this.speed = damp(this.speed, want, 6, dt);
    const before = { x: this.pos.x, z: this.pos.z };
    if (d > 1e-4) {
      this.pos.x += (dx / d) * this.speed * dt;
      this.pos.z += (dz / d) * this.speed * dt;
    }
    // keep a little personal space
    const sep = (ox: number, oz: number, r: number) => {
      const ex = this.pos.x - ox, ez = this.pos.z - oz, e = Math.hypot(ex, ez);
      if (e < r && e > 1e-5) {
        this.pos.x = ox + (ex / e) * r;
        this.pos.z = oz + (ez / e) * r;
      }
    };
    sep(player.x, player.z, 0.45);
    for (const o of others) if (o !== this) sep(o.pos.x, o.pos.z, 0.34);
    col.resolve(this.pos, this.radius);
    const moved = Math.hypot(this.pos.x - before.x, this.pos.z - before.z) / Math.max(dt, 1e-4);
    this.pos.y = damp(this.pos.y, groundY(this.pos.x, this.pos.z), 14, dt);
    if (moved > 0.12 && d > 0.05) {
      const targetYaw = Math.atan2(dx, dz);
      let diff = targetYaw - this.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.yaw += diff * (1 - Math.exp(-8 * dt));
    }
    this.char.root.position.copy(this.pos);
    this.char.root.rotation.y = this.yaw;
    this.char.update(dt, Math.min(moved, this.maxSpeed));
  }
}
