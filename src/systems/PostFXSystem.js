import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/postprocessing/ShaderPass.js';
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

    const gradePass = new ShaderPass(ColorGradeShader);
    gradePass.uniforms.contrast.value = VISUAL.postFX.contrast;
    gradePass.uniforms.saturation.value = VISUAL.postFX.saturation;
    gradePass.uniforms.gamma.value = VISUAL.postFX.gamma;
    this.composer.addPass(gradePass);
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

const ColorGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    contrast: { value: 1.0 },
    saturation: { value: 1.0 },
    gamma: { value: 1.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float contrast;
    uniform float saturation;
    uniform float gamma;
    varying vec2 vUv;

    void main() {
      vec4 tex = texture2D(tDiffuse, vUv);
      vec3 color = tex.rgb;

      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      color = mix(vec3(luma), color, saturation);
      color = (color - 0.5) * contrast + 0.5;
      color = pow(max(color, vec3(0.0)), vec3(1.0 / max(gamma, 0.0001)));

      gl_FragColor = vec4(color, tex.a);
    }
  `,
};
