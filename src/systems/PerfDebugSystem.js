import { DEBUG } from '../config.js';

export class PerfDebugSystem {
  constructor(renderer, camera) {
    this.renderer = renderer;
    this.camera = camera;
    this.enabled = !!DEBUG.perfOverlay;
    this.el = null;
    this.frameCount = 0;
    this.elapsed = 0;
    this.fps = 0;
    this.lastFrame = {
      calls: 0,
      triangles: 0,
      textures: 0,
      geometries: 0,
      programs: 0,
    };
  }

  init() {
    if (!this.enabled) return;

    this.renderer.info.autoReset = false;
    this.el = document.createElement('div');
    this.el.id = 'perf-debug';
    this.el.style.cssText = [
      'position:absolute',
      'top:8px',
      'left:8px',
      'z-index:20',
      'padding:7px 8px',
      'min-width:138px',
      'font:12px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace',
      'color:#f8f3e8',
      'background:rgba(12, 12, 12, 0.68)',
      'border:1px solid rgba(255,255,255,0.18)',
      'border-radius:6px',
      'pointer-events:none',
      'white-space:pre',
    ].join(';');
    document.body.appendChild(this.el);
  }

  update(dt) {
    if (!this.el) return;

    const render = this.renderer.info.render;
    const memory = this.renderer.info.memory;
    this.lastFrame = {
      calls: render.calls,
      triangles: render.triangles,
      textures: memory.textures,
      geometries: memory.geometries,
      programs: this.renderer.info.programs?.length ?? 0,
    };
    this.renderer.info.reset();

    this.elapsed += dt;
    this.frameCount += 1;
    if (this.elapsed < 0.5) return;

    this.fps = Math.round(this.frameCount / this.elapsed);
    this.frameCount = 0;
    this.elapsed = 0;

    this.el.textContent = [
      `FPS ${this.fps}`,
      `DPR ${this.renderer.getPixelRatio().toFixed(2)}`,
      `FOV ${this.camera?.fov ? Math.round(this.camera.fov) : '--'}`,
      `calls ${this.lastFrame.calls}`,
      `tris ${this.lastFrame.triangles}`,
      `tex ${this.lastFrame.textures}`,
      `geo ${this.lastFrame.geometries}`,
      `prog ${this.lastFrame.programs}`,
    ].join('\n');
  }
}
