export class Loop {
  constructor() { this.systems = []; this.prev = performance.now(); }
  add(sys) { this.systems.push(sys); }
  tick = () => {
    const now = performance.now();
    const dt = Math.min((now - this.prev)/1000, 0.05);
    this.prev = now;
    for (const s of this.systems) s.update?.(dt);
    requestAnimationFrame(this.tick);
  }
}
