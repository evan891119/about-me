import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';
import { PHYSICS } from '../config.js';

export class Physics {
  constructor() { this.world = null; this.ready = false; }
  async init() {
    await RAPIER.init();
    this.world = new RAPIER.World(PHYSICS.gravity);
    this.ready = true;
  }
  step(dt) {
    if (!this.ready) return;
    if (typeof dt === 'number') {
      this.world.integrationParameters.dt = dt;
    }
    this.world.step();
  }
}
