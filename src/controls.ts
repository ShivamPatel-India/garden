/** Keyboard, mouse/touch look, pinch/wheel zoom and an on-screen joystick. */
export class Controls {
  keys = new Set<string>();
  yaw = 0;
  pitch = 0.3;
  dist = 4.6;
  joyX = 0;
  joyY = 0;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinch = 0;

  constructor(dom: HTMLElement, joy: HTMLElement | null, knob: HTMLElement | null) {
    window.addEventListener('keydown', (e) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'SELECT' || t.tagName === 'INPUT')) return;
      this.keys.add(e.code);
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    dom.addEventListener('pointerdown', (e) => {
      dom.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) this.pinch = this.pinchDist();
    });
    dom.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      if (this.pointers.size === 1) {
        this.yaw -= (e.clientX - p.x) * 0.0055;
        this.pitch = Math.max(0.04, Math.min(1.25, this.pitch + (e.clientY - p.y) * 0.0045));
      }
      p.x = e.clientX;
      p.y = e.clientY;
      if (this.pointers.size === 2) {
        const d = this.pinchDist();
        if (this.pinch > 0 && d > 0) this.zoom(this.pinch / d);
        this.pinch = d;
      }
    });
    const up = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      this.pinch = 0;
    };
    dom.addEventListener('pointerup', up);
    dom.addEventListener('pointercancel', up);
    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoom(e.deltaY > 0 ? 1.1 : 0.9);
    }, { passive: false });

    if (joy && knob) {
      let id = -1;
      const setFrom = (e: PointerEvent) => {
        const r = joy.getBoundingClientRect();
        const rad = r.width / 2;
        let x = (e.clientX - (r.left + rad)) / rad, y = (e.clientY - (r.top + rad)) / rad;
        const m = Math.hypot(x, y);
        if (m > 1) { x /= m; y /= m; }
        this.joyX = x;
        this.joyY = -y;
        knob.style.transform = `translate(${x * rad * 0.55}px, ${y * rad * 0.55}px)`;
      };
      joy.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        id = e.pointerId;
        joy.setPointerCapture(id);
        setFrom(e);
      });
      joy.addEventListener('pointermove', (e) => { if (e.pointerId === id) setFrom(e); });
      const release = (e: PointerEvent) => {
        if (e.pointerId !== id) return;
        id = -1;
        this.joyX = 0;
        this.joyY = 0;
        knob.style.transform = '';
      };
      joy.addEventListener('pointerup', release);
      joy.addEventListener('pointercancel', release);
    }
  }

  private pinchDist(): number {
    const ps = [...this.pointers.values()];
    return ps.length < 2 ? 0 : Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
  }

  zoom(f: number): void {
    this.dist = Math.max(1.8, Math.min(14, this.dist * f));
  }

  move(): { x: number; y: number; run: boolean } {
    const k = this.keys;
    let x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let y = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    let run = k.has('ShiftLeft') || k.has('ShiftRight');
    if (x === 0 && y === 0 && (this.joyX !== 0 || this.joyY !== 0)) {
      x = this.joyX;
      y = this.joyY;
      run = Math.hypot(x, y) > 0.92;
    }
    if (k.has('KeyQ')) this.yaw += 0.03;
    if (k.has('KeyE')) this.yaw -= 0.03;
    return { x, y, run };
  }
}
