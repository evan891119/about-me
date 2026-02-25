import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/postprocessing/UnrealBloomPass.js';
import * as THREE from 'three';
import { VISUAL } from '../config.js';

export class PostFXSystem {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.enabled = !!VISUAL.postFX.enabled;
    this.composer = null;
  }

  init() {
    if (!this.enabled) return;

    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(window.innerWidth, window.innerHeight);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    const qualityScale = this._getQualityScale(VISUAL.postFX.quality);
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth * qualityScale, window.innerHeight * qualityScale),
      VISUAL.postFX.bloomStrength,
      VISUAL.postFX.bloomRadius,
      VISUAL.postFX.bloomThreshold
    );
    this.composer.addPass(bloom);
  }

  onResize() {
    if (!this.composer) return;
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }

  render() {
    if (!this.composer) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.composer.render();
  }

  _getQualityScale(quality) {
    if (quality === 'low') return 0.8;
    if (quality === 'high') return 1.0;
    return 0.9;
  }
}
