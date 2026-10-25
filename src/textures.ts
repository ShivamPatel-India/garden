import * as THREE from 'three';

/** Small deterministic RNG so the scene looks the same on every load. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rand = mulberry32(20261025);

export function pick<T>(arr: T[], r: () => number = rand): T {
  return arr[Math.floor(r() * arr.length) % arr.length];
}

export function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext('2d')!;
  return { c, ctx };
}

export function canvasTex(c: HTMLCanvasElement, repeat?: [number, number], srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

function wrapped(size: number, x: number, y: number, m: number, fn: (x: number, y: number) => void) {
  for (const dx of [-size, 0, size]) {
    for (const dy of [-size, 0, size]) {
      const xx = x + dx, yy = y + dy;
      if (xx > -m && xx < size + m && yy > -m && yy < size + m) fn(xx, yy);
    }
  }
}

function blot(ctx: CanvasRenderingContext2D, size: number, n: number, colors: string[], rmin: number, rmax: number, alpha: number, r: () => number = rand) {
  for (let i = 0; i < n; i++) {
    const x = r() * size, y = r() * size, rad = rmin + r() * (rmax - rmin);
    ctx.globalAlpha = alpha * (0.4 + r() * 0.6);
    ctx.fillStyle = pick(colors, r);
    wrapped(size, x, y, rad, (xx, yy) => {
      ctx.beginPath();
      ctx.arc(xx, yy, rad, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  ctx.globalAlpha = 1;
}

export function grassTile(size = 256): HTMLCanvasElement {
  const { c, ctx } = makeCanvas(size, size);
  ctx.fillStyle = '#4f8a32';
  ctx.fillRect(0, 0, size, size);
  blot(ctx, size, 60, ['#447a2a', '#5c983c', '#68a444'], 10, 30, 0.3);
  const cols = ['#3f7428', '#55903a', '#62a040', '#72ae4b', '#86bb5a', '#386a24'];
  ctx.lineCap = 'round';
  for (let i = 0; i < 4500; i++) {
    const x = rand() * size, y = rand() * size, l = 2 + rand() * 5, a = -Math.PI / 2 + (rand() - 0.5) * 1.4;
    ctx.strokeStyle = pick(cols);
    ctx.globalAlpha = 0.45 + rand() * 0.5;
    ctx.lineWidth = 0.7 + rand() * 0.8;
    const dx = Math.cos(a) * l, dy = Math.sin(a) * l;
    wrapped(size, x, y, 8, (xx, yy) => {
      ctx.beginPath();
      ctx.moveTo(xx, yy);
      ctx.lineTo(xx + dx, yy + dy);
      ctx.stroke();
    });
  }
  ctx.globalAlpha = 1;
  return c;
}

export function mulchTile(size = 256): HTMLCanvasElement {
  const { c, ctx } = makeCanvas(size, size);
  ctx.fillStyle = '#46372a';
  ctx.fillRect(0, 0, size, size);
  blot(ctx, size, 1400, ['#5a4634', '#3a2c21', '#6b5440', '#2f241b', '#7a6249'], 0.8, 2.6, 0.7);
  blot(ctx, size, 220, ['#3f6a2c', '#4d7a35', '#355c26', '#5a8a3e'], 3, 9, 0.75);
  for (let i = 0; i < 500; i++) {
    const x = rand() * size, y = rand() * size, a = rand() * Math.PI;
    ctx.fillStyle = pick(['#3f6a2c', '#507f36', '#2f5222', '#62923f']);
    ctx.globalAlpha = 0.85;
    wrapped(size, x, y, 6, (xx, yy) => {
      ctx.beginPath();
      ctx.ellipse(xx, yy, 3.4, 1.4, a, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  ctx.globalAlpha = 1;
  return c;
}

/** Interlocking "wave" paver blocks, as in the existing forecourt. */
export function paverTile(ppm: number, bump = false): HTMLCanvasElement {
  const L = 0.225 * ppm, Wd = L / 2, cols = 4, rows = 8;
  const size = Math.max(8, Math.round(cols * L));
  const { c, ctx } = makeCanvas(size, size);
  const k = size / (cols * L);
  ctx.scale(k, k);
  const amp = Wd * 0.2;
  const wave = (x: number) => Math.sin((x / L) * Math.PI * 2) * amp;
  const pal = ['#9c5a47', '#a8654d', '#8d5443', '#b27b5d', '#a68b71', '#917c68', '#9e6b53', '#82594a', '#b3937a'];
  const r = mulberry32(77);
  const colors: number[][] = [];
  for (let i = 0; i < rows; i++) {
    colors.push([]);
    for (let j = 0; j < cols; j++) colors[i].push(Math.floor(r() * pal.length));
  }
  ctx.fillStyle = bump ? '#262626' : '#4c3a2e';
  ctx.fillRect(0, 0, cols * L, rows * Wd);
  const j = Math.max(0.55, ppm * 0.004);
  const N = 12;
  for (let row = -1; row <= rows; row++) {
    const rr = ((row % rows) + rows) % rows;
    const y0 = row * Wd, y1 = y0 + Wd, off = (rr % 2) * (L / 2);
    for (let kx = -1; kx <= cols; kx++) {
      const kk = ((kx % cols) + cols) % cols;
      const x0 = kx * L + off, x1 = x0 + L;
      ctx.beginPath();
      for (let s = 0; s <= N; s++) {
        const x = x0 + j + ((x1 - x0 - 2 * j) * s) / N;
        const yy = y0 + j + wave(x);
        if (s === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      for (let s = N; s >= 0; s--) {
        const x = x0 + j + ((x1 - x0 - 2 * j) * s) / N;
        ctx.lineTo(x, y1 - j + wave(x));
      }
      ctx.closePath();
      if (bump) {
        const v = 175 + ((colors[rr][kk] * 37) % 45);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
      } else ctx.fillStyle = pal[colors[rr][kk]];
      ctx.fill();
    }
  }
  if (!bump) blot(ctx, cols * L, Math.round(size * 6), ['#2a1d16', '#d8c2a8', '#5b4436'], 0.25, 0.9, 0.18);
  return c;
}

export function plasterCanvas(base: string, stain: number, size = 512, seed = 1): HTMLCanvasElement {
  const r = mulberry32(seed);
  const { c, ctx } = makeCanvas(size, size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  blot(ctx, size, 220, ['#ffffff', '#000000'], 8, 40, 0.045, r);
  blot(ctx, size, 3000, ['#000000', '#ffffff'], 0.5, 1.4, 0.09, r);
  for (let i = 0; i < 70 * stain; i++) {
    const x = r() * size, w = 3 + r() * 18, h = 30 + r() * size * 0.7;
    const g = ctx.createLinearGradient(0, size - h, 0, size);
    g.addColorStop(0, 'rgba(40,35,25,0)');
    g.addColorStop(1, `rgba(40,35,25,${0.22 * stain})`);
    ctx.fillStyle = g;
    ctx.fillRect(x, size - h, w, h);
  }
  blot(ctx, size, Math.round(90 * stain), ['#4a4636', '#5c5844', '#3a3a30'], 10, 45, 0.12 * stain, r);
  return c;
}

export function asphaltCanvas(size = 512): HTMLCanvasElement {
  const { c, ctx } = makeCanvas(size, size);
  ctx.fillStyle = '#56565a';
  ctx.fillRect(0, 0, size, size);
  blot(ctx, size, 9000, ['#3a3a3d', '#77777a', '#4a4a4e', '#8a8478'], 0.4, 1.4, 0.45);
  blot(ctx, size, 40, ['#3f3f42', '#6a6a6c'], 20, 70, 0.12);
  return c;
}

export function dirtCanvas(size = 512): HTMLCanvasElement {
  const { c, ctx } = makeCanvas(size, size);
  ctx.fillStyle = '#7a6a52';
  ctx.fillRect(0, 0, size, size);
  blot(ctx, size, 260, ['#6c8a45', '#5d7a3b', '#8a7a5c', '#9a8462', '#6b5a44'], 6, 30, 0.35);
  blot(ctx, size, 6000, ['#4f4232', '#a08b6c', '#5f7b3a'], 0.5, 1.8, 0.4);
  return c;
}

export function graniteCanvas(size = 256): HTMLCanvasElement {
  const { c, ctx } = makeCanvas(size, size);
  ctx.fillStyle = '#74362f';
  ctx.fillRect(0, 0, size, size);
  blot(ctx, size, 3200, ['#2a1a18', '#a05a50', '#c7a39a', '#4d2420', '#111111', '#8a4a40'], 0.5, 2.2, 0.7);
  return c;
}

export function stoneCanvas(base = '#bdb5a4', size = 256): HTMLCanvasElement {
  const { c, ctx } = makeCanvas(size, size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  blot(ctx, size, 70, ['#ffffff', '#6b6458'], 10, 30, 0.08);
  blot(ctx, size, 2200, ['#6f685c', '#e2dccf', '#8f877a'], 0.5, 1.6, 0.35);
  return c;
}

export function woodCanvas(size = 256): HTMLCanvasElement {
  const { c, ctx } = makeCanvas(size, size);
  ctx.fillStyle = '#7a5236';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 90; i++) {
    const y = rand() * size;
    ctx.strokeStyle = pick(['#5e3c26', '#8c6244', '#6b4630', '#9a7050']);
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 0.6 + rand() * 1.6;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= size; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.03 + i) * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return c;
}

export function barkCanvas(): HTMLCanvasElement {
  const { c, ctx } = makeCanvas(128, 256);
  ctx.fillStyle = '#5b4a3c';
  ctx.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 160; i++) {
    const x = rand() * 128;
    ctx.strokeStyle = pick(['#3b2f25', '#7a6656', '#4a3c30', '#8a7766']);
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 1 + rand() * 2.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    for (let y = 0; y <= 256; y += 32) ctx.lineTo(x + (rand() - 0.5) * 5, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return c;
}

export function roofTileCanvas(size = 256): HTMLCanvasElement {
  const { c, ctx } = makeCanvas(size, size);
  ctx.fillStyle = '#6e2c18';
  ctx.fillRect(0, 0, size, size);
  const rows = 8, cols = 8, th = size / rows, tw = size / cols;
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < cols; k++) {
      const x = k * tw + (r % 2) * (tw / 2), y = r * th;
      for (const xx of [x, x - size]) {
        const g = ctx.createLinearGradient(xx, 0, xx + tw, 0);
        const base = pick(['#b6532f', '#a84a2a', '#c05e36', '#9c4426']);
        g.addColorStop(0, '#7a3018');
        g.addColorStop(0.35, base);
        g.addColorStop(0.7, base);
        g.addColorStop(1, '#6e2a16');
        ctx.fillStyle = g;
        ctx.fillRect(xx + 1, y + 1, tw - 2, th - 1);
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, r * th, size, 2);
  }
  blot(ctx, size, 400, ['#2a1a10', '#d8a080'], 0.6, 2, 0.15);
  return c;
}

/** One 3 m x 3 m bay of a neighbouring building: plaster with one window. */
export function facadeCanvas(base: string, size = 256): HTMLCanvasElement {
  const c = plasterCanvas(base, 0.35, size, Math.floor(rand() * 1000));
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#e8e4da';
  ctx.fillRect(62, 66, 132, 118);
  ctx.fillStyle = '#2b3944';
  ctx.fillRect(70, 74, 116, 102);
  ctx.strokeStyle = '#c9ccc9';
  ctx.lineWidth = 3;
  for (let x = 82; x < 186; x += 14) {
    ctx.beginPath();
    ctx.moveTo(x, 74);
    ctx.lineTo(x, 176);
    ctx.stroke();
  }
  ctx.fillStyle = '#d9d4c8';
  ctx.fillRect(54, 184, 148, 8);
  ctx.fillRect(50, 52, 156, 10);
  return c;
}

export type LeafKind = 'green' | 'dark' | 'light' | 'plumeria' | 'kachnar' | 'ashoka' | 'hibiscus' | 'yellow';
const LEAF_PAL: Record<LeafKind, string[]> = {
  green: ['#3f6b2a', '#4d7d33', '#5b8c3b', '#36602a', '#6a9a44'],
  dark: ['#2b4f22', '#335c27', '#3d6a2d', '#264619', '#47753a'],
  light: ['#56873a', '#679845', '#78a64f', '#4c7a31', '#86b25a'],
  plumeria: ['#4a7a30', '#5a8a38', '#3f6a2a', '#67953f'],
  kachnar: ['#4c7a32', '#5b8a3a', '#3f6b2a', '#6a9844'],
  ashoka: ['#1f4a22', '#285a2a', '#306430', '#1a3f1d', '#3a6e36'],
  hibiscus: ['#2f5e26', '#3a6c2c', '#457a33', '#2a5221'],
  yellow: ['#477a30', '#55883a', '#3c6a28', '#629446'],
};

function flower(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, petal: string, center: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rand() * Math.PI);
  ctx.fillStyle = petal;
  for (let k = 0; k < 5; k++) {
    ctx.rotate((Math.PI * 2) / 5);
    ctx.beginPath();
    ctx.ellipse(r * 0.55, 0, r * 0.55, r * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = center;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A cluster of leaves on a transparent card, used for foliage. */
export function leafCanvas(kind: LeafKind, size = 256): HTMLCanvasElement {
  const { c, ctx } = makeCanvas(size, size);
  const pal = LEAF_PAL[kind];
  const cx = size / 2, cy = size / 2, R0 = size * 0.46;
  const n = kind === 'ashoka' ? 80 : 160;
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2, rr = Math.sqrt(rand()) * R0 * 0.94;
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * (kind === 'ashoka' ? 0.8 : 1);
    const sz = size * (kind === 'plumeria' ? 0.065 : 0.04) * (0.7 + rand() * 0.6);
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = pick(pal);
    if (kind === 'ashoka') {
      ctx.rotate(Math.PI / 2 + (rand() - 0.5) * 0.5);
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.1, size * 0.017, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'kachnar') {
      ctx.rotate(rand() * Math.PI * 2);
      ctx.beginPath();
      ctx.ellipse(-sz * 0.45, 0, sz * 0.6, sz * 0.8, 0.3, 0, Math.PI * 2);
      ctx.ellipse(sz * 0.45, 0, sz * 0.6, sz * 0.8, -0.3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.rotate(rand() * Math.PI * 2);
      ctx.beginPath();
      ctx.ellipse(0, 0, sz * 1.7, sz * 0.72, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,220,0.18)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-sz * 1.5, 0);
      ctx.lineTo(sz * 1.5, 0);
      ctx.stroke();
    }
    ctx.restore();
  }
  if (kind === 'plumeria') for (let i = 0; i < 14; i++) flower(ctx, cx + (rand() - 0.5) * size * 0.7, cy + (rand() - 0.6) * size * 0.6, size * 0.05, pick(['#fbf6ea', '#fff3df', '#f6c9d6']), '#f2c23c');
  if (kind === 'kachnar') for (let i = 0; i < 20; i++) flower(ctx, cx + (rand() - 0.5) * size * 0.75, cy + (rand() - 0.5) * size * 0.75, size * 0.045, pick(['#c86fb4', '#d98ac7', '#b25ea8', '#e8a9d8']), '#f4e0f0');
  if (kind === 'hibiscus') for (let i = 0; i < 7; i++) flower(ctx, cx + (rand() - 0.5) * size * 0.7, cy + (rand() - 0.5) * size * 0.7, size * 0.07, pick(['#d22c2a', '#e0403a', '#c41f2a']), '#f6d34a');
  if (kind === 'yellow') for (let i = 0; i < 24; i++) flower(ctx, cx + (rand() - 0.5) * size * 0.75, cy + (rand() - 0.5) * size * 0.75, size * 0.035, pick(['#f2c230', '#f7d54a', '#e9b21e']), '#c9861a');
  return c;
}

export function frondCanvas(): HTMLCanvasElement {
  const w = 128, h = 512;
  const { c, ctx } = makeCanvas(w, h);
  ctx.lineCap = 'round';
  for (let i = 0; i < 70; i++) {
    const t = i / 70;
    const y = h - 10 - t * (h - 20);
    const L = (w / 2 - 6) * (1 - 0.55 * t) * (0.85 + rand() * 0.2);
    for (const s of [-1, 1]) {
      ctx.strokeStyle = pick(['#4f7a2a', '#5d8a33', '#6b9a3c', '#466f25', '#7aa346']);
      ctx.lineWidth = 3.2 + rand() * 1.4;
      ctx.beginPath();
      ctx.moveTo(w / 2, y);
      ctx.quadraticCurveTo(w / 2 + s * L * 0.5, y - 10, w / 2 + s * L, y - 24 + rand() * 6);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = '#8a8a4a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(w / 2, h);
  ctx.lineTo(w / 2, 6);
  ctx.stroke();
  return c;
}

export function palmTrunkCanvas(): HTMLCanvasElement {
  const { c, ctx } = makeCanvas(64, 64);
  ctx.fillStyle = '#7b6a58';
  ctx.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 8) {
    ctx.fillStyle = 'rgba(40,30,20,0.45)';
    ctx.fillRect(0, y, 64, 2);
    ctx.fillStyle = 'rgba(200,190,170,0.15)';
    ctx.fillRect(0, y + 3, 64, 2);
  }
  blot(ctx, 64, 300, ['#4a3f33', '#a29482'], 0.4, 1.2, 0.4);
  return c;
}

/** Soft cumulus clouds for a sky dome: canvas top = zenith, canvas bottom = horizon. */
export function cloudCanvas(w = 2048, h = 1024): HTMLCanvasElement {
  const { c, ctx } = makeCanvas(w, h);
  const r = mulberry32(4242);
  const puff = (x: number, y: number, rad: number, a: number) => {
    for (const dx of [-w, 0, w]) {
      const g = ctx.createRadialGradient(x + dx, y, 0, x + dx, y, rad);
      g.addColorStop(0, `rgba(255,255,255,${a})`);
      g.addColorStop(0.55, `rgba(250,250,252,${a * 0.6})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x + dx, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  for (let i = 0; i < 40; i++) {
    const cx = r() * w;
    const t = Math.pow(r(), 0.7); // more clouds low in the sky
    const cy = h * (0.5 + t * 0.42);
    const scale = 1.5 - t * 0.85;
    const n = 7 + Math.floor(r() * 9);
    for (let k = 0; k < n; k++) {
      const px = cx + (r() - 0.5) * 150 * scale, py = cy + (r() - 0.7) * 34 * scale * (1 - t * 0.5);
      puff(px, py, (20 + r() * 36) * scale * (1 - t * 0.35), 0.7 + r() * 0.3);
    }
    const base = ctx.createLinearGradient(0, cy - 6 * scale, 0, cy + 16 * scale);
    base.addColorStop(0, 'rgba(190,198,212,0)');
    base.addColorStop(1, 'rgba(176,186,202,0.32)');
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 6 * scale, 70 * scale, 11 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  return c;
}
