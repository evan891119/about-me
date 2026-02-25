export class Loop {
  constructor({ fixedTimeStep = 1 / 60, maxSubSteps = 3, maxFrameDelta = 0.05 } = {}) {
    this.fixedSystems = [];
    this.frameSystems = [];
    this.fixedTimeStep = fixedTimeStep;
    this.maxSubSteps = maxSubSteps;
    this.maxFrameDelta = maxFrameDelta;
    this.prev = performance.now();
    this.accumulator = 0;
  }

  addFixed(sys) {
    this.fixedSystems.push(sys);
  }

  addFrame(sys) {
    this.frameSystems.push(sys);
  }

  add(sys) {
    this.addFrame(sys);
  }

  tick = () => {
    const now = performance.now();
    const dt = Math.min((now - this.prev) / 1000, this.maxFrameDelta);
    this.prev = now;
    this.accumulator += dt;

    let subSteps = 0;
    while (this.accumulator >= this.fixedTimeStep && subSteps < this.maxSubSteps) {
      for (const s of this.fixedSystems) s.update?.(this.fixedTimeStep);
      this.accumulator -= this.fixedTimeStep;
      subSteps += 1;
    }

    for (const s of this.frameSystems) s.update?.(dt);
    requestAnimationFrame(this.tick);
  }
}
