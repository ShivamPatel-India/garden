/** Simple 2D (x/z) collision: wall segments, round obstacles and boxes. */
export interface Seg { ax: number; az: number; bx: number; bz: number; t: number }
export interface Circ { x: number; z: number; r: number }
export interface Box { x0: number; x1: number; z0: number; z1: number }
export interface XZ { x: number; z: number }

export class Collider {
  segs: Seg[] = [];
  circs: Circ[] = [];
  boxes: Box[] = [];
  minX = -7.6;
  maxX = 40;
  minZ = -14;
  maxZ = 40;

  seg(ax: number, az: number, bx: number, bz: number, t = 0.1): void {
    this.segs.push({ ax, az, bx, bz, t });
  }
  circ(x: number, z: number, r: number): void {
    this.circs.push({ x, z, r });
  }
  box(x0: number, x1: number, z0: number, z1: number): void {
    this.boxes.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1) });
  }

  resolve(p: XZ, r: number): void {
    for (let it = 0; it < 3; it++) {
      for (const s of this.segs) {
        const dx = s.bx - s.ax, dz = s.bz - s.az;
        const l2 = dx * dx + dz * dz;
        let t = l2 > 0 ? ((p.x - s.ax) * dx + (p.z - s.az) * dz) / l2 : 0;
        t = Math.max(0, Math.min(1, t));
        const qx = s.ax + dx * t, qz = s.az + dz * t;
        let ex = p.x - qx, ez = p.z - qz;
        const d = Math.hypot(ex, ez), m = r + s.t;
        if (d < m) {
          if (d < 1e-6) {
            const l = Math.hypot(dx, dz) || 1;
            ex = -dz / l; ez = dx / l;
          } else { ex /= d; ez /= d; }
          p.x = qx + ex * m; p.z = qz + ez * m;
        }
      }
      for (const c of this.circs) {
        const ex = p.x - c.x, ez = p.z - c.z;
        const d = Math.hypot(ex, ez), m = r + c.r;
        if (d < m) {
          if (d < 1e-6) { p.x = c.x + m; continue; }
          p.x = c.x + (ex / d) * m; p.z = c.z + (ez / d) * m;
        }
      }
      for (const b of this.boxes) {
        const cx = Math.max(b.x0, Math.min(p.x, b.x1)), cz = Math.max(b.z0, Math.min(p.z, b.z1));
        const ex = p.x - cx, ez = p.z - cz;
        const d = Math.hypot(ex, ez);
        if (d < r) {
          if (d > 1e-6) { p.x = cx + (ex / d) * r; p.z = cz + (ez / d) * r; }
          else {
            const dl = p.x - b.x0, dr = b.x1 - p.x, dt = p.z - b.z0, db = b.z1 - p.z;
            const mn = Math.min(dl, dr, dt, db);
            if (mn === dl) p.x = b.x0 - r; else if (mn === dr) p.x = b.x1 + r;
            else if (mn === dt) p.z = b.z0 - r; else p.z = b.z1 + r;
          }
        }
      }
    }
    p.x = Math.max(this.minX, Math.min(this.maxX, p.x));
    p.z = Math.max(this.minZ, Math.min(this.maxZ, p.z));
  }
}
