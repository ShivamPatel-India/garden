import { PLOT_W, PLOT_D, PORCH, CARPORT, CAR } from './plan';

const X0 = -1.4, X1 = PLOT_W + 0.4, Z0 = -0.4, Z1 = PORCH.z1 + 0.6;

export interface Dot { x: number; z: number; yaw?: number }

/** Top-down map of the plan; tap to jump there. */
export class Minimap {
  private ctx: CanvasRenderingContext2D;
  private bg: HTMLCanvasElement;
  private scale = 1;
  private dpr = 1;

  constructor(private canvas: HTMLCanvasElement, private ground: HTMLCanvasElement, onPick: (x: number, z: number) => void) {
    this.ctx = canvas.getContext('2d')!;
    this.bg = document.createElement('canvas');
    this.resize();
    canvas.addEventListener('click', (e) => {
      const r = canvas.getBoundingClientRect();
      const s = r.width / (X1 - X0);
      onPick(X0 + (e.clientX - r.left) / s, Z0 + (e.clientY - r.top) / s);
    });
  }

  resize(): void {
    const w = this.canvas.clientWidth || 120;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.scale = w / (X1 - X0);
    const h = (Z1 - Z0) * this.scale;
    this.canvas.style.height = `${h}px`;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.bg.width = this.canvas.width;
    this.bg.height = this.canvas.height;
    const c = this.bg.getContext('2d')!;
    c.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, -X0 * this.dpr * this.scale, -Z0 * this.dpr * this.scale);
    c.fillStyle = '#6b6f72';
    c.fillRect(X0, Z0, -X0, Z1 - Z0);
    c.drawImage(this.ground, 0, 0, PLOT_W, PLOT_D + 1.5);
    c.fillStyle = '#d6cfbf';
    c.fillRect(0.15, PORCH.z0, PLOT_W - 0.3, Z1 - PORCH.z0);
    c.fillStyle = 'rgba(61,74,85,0.28)';
    c.fillRect(CARPORT.x0, CARPORT.z0, CARPORT.x1 - CARPORT.x0, CARPORT.z1 - CARPORT.z0);
    c.fillStyle = '#f4f5f6';
    c.fillRect(CAR.x - 2.15, CAR.z - 0.9, 4.3, 1.8);
    c.strokeStyle = '#3f3e3c';
    c.lineWidth = 0.22;
    c.strokeRect(0, 0, PLOT_W, PLOT_D + 1.5);
  }

  draw(player: Dot, dog: Dot, cat: Dot): void {
    const c = this.ctx, k = this.dpr * this.scale;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(this.bg, 0, 0);
    c.setTransform(k, 0, 0, k, -X0 * k, -Z0 * k);
    const clampX = (x: number) => Math.max(X0 + 0.3, Math.min(X1 - 0.3, x));
    const clampZ = (z: number) => Math.max(Z0 + 0.3, Math.min(Z1 - 0.3, z));
    const dot = (d: Dot, fill: string, stroke: string, r: number) => {
      c.beginPath();
      c.arc(clampX(d.x), clampZ(d.z), r, 0, Math.PI * 2);
      c.fillStyle = fill;
      c.fill();
      c.lineWidth = 0.12;
      c.strokeStyle = stroke;
      c.stroke();
    };
    dot(cat, '#141414', '#ffffff', 0.32);
    dot(dog, '#d4852f', '#3a2410', 0.36);
    const px = clampX(player.x), pz = clampZ(player.z), yaw = player.yaw ?? 0;
    c.save();
    c.translate(px, pz);
    c.rotate(-yaw);
    c.beginPath();
    c.moveTo(0, 0.95);
    c.lineTo(0.55, -0.45);
    c.lineTo(0, -0.15);
    c.lineTo(-0.55, -0.45);
    c.closePath();
    c.fillStyle = '#ffffff';
    c.fill();
    c.lineWidth = 0.14;
    c.strokeStyle = '#1e2823';
    c.stroke();
    c.restore();
  }
}
