import * as THREE from 'three';
import { Sky } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/objects/Sky.js';
import { getMoonPosition, getMoonIllumination } from 'https://cdn.skypack.dev/suncalc';

export class SkySystem {
  /**
   * @param {THREE.Scene} scene
   * @param {object} opts
   * @param {number} [opts.lat=25.0330]  // 緯度
   * @param {number} [opts.lon=121.5654] // 經度
   * @param {THREE.Light[]} [opts.streetLights=[]] // 可選，路燈列表
   * @param {number} [opts.skyScale=450000]
   */
  constructor(scene, { lat = 25.0330, lon = 121.5654, streetLights = [], skyScale = 450000 } = {}) {
    this.scene = scene;
    this.lat = lat;
    this.lon = lon;
    this.streetLights = streetLights;

    // 固定色票（別每幀 new）
    this.daySkyColor    = new THREE.Color(0x87CEEB);
    this.nightSkyColor  = new THREE.Color(0x050D2B);
    this.dayLightColor  = new THREE.Color(0xFFFFFF);
    this.nightLightColor= new THREE.Color(0x666699);
    this.dayGroundColor = new THREE.Color(0x444444);
    this.nightGroundColor = new THREE.Color(0x111111);

    // 背景交給 Sky shader
    this.scene.background = null;

    // Sky
    this.sky = new Sky();
    this.sky.scale.setScalar(skyScale);
    scene.add(this.sky);
    const U = this.sky.material.uniforms;
    U.turbidity.value = 10;
    U.rayleigh.value = 2;
    U.mieCoefficient.value = 0.005;
    U.mieDirectionalG.value = 0.8;

    // Stars
    {
      const starCount = 10000;
      const pos = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount; i++) {
        const theta = Math.random() * 2 * Math.PI;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = 400;
        pos[i*3    ] = r * Math.sin(phi) * Math.cos(theta);
        pos[i*3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        pos[i*3 + 2] = r * Math.cos(phi);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const m = new THREE.PointsMaterial({ color: 0xffffff, size: 1, sizeAttenuation: false });
      this.stars = new THREE.Points(g, m);
      this.stars.visible = false;
      scene.add(this.stars);
    }

    // Moon（用 canvas 動態畫月相）
    {
      this.moonCanvas = document.createElement('canvas');
      this.moonCanvas.width = this.moonCanvas.height = 256;
      this.moonCtx = this.moonCanvas.getContext('2d');
      this.moonTexture = new THREE.CanvasTexture(this.moonCanvas);
      const mat = new THREE.SpriteMaterial({ map: this.moonTexture, transparent: true });
      this.moon = new THREE.Sprite(mat);
      this.moon.scale.set(20000, 20000, 1); // 先給個初值，update 會調
      scene.add(this.moon);
      // 先畫一次
      const illum = getMoonIllumination(new Date());
      this._drawMoonPhase(illum.fraction, illum.phase);
    }

    // Lights
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.7);
    this.hemiLight.position.set(0, 20, 0);
    scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    this.dirLight.position.set(-3, 10, -10);
    this.dirLight.castShadow = true;
    scene.add(this.dirLight);

    // 路燈的基礎亮度記錄，夜晚用
    this.streetLights.forEach(l => {
      if (!l.userData) l.userData = {};
      if (l.userData.baseIntensity == null) l.userData.baseIntensity = (l.intensity ?? 1);
    });

    // 立即算一次
    this.update(0);
  }

  /** 可在 buildWorld 之後再補連結路燈 */
  setStreetLights(lights = []) {
    this.streetLights = lights;
    this.streetLights.forEach(l => {
      if (!l.userData) l.userData = {};
      if (l.userData.baseIntensity == null) l.userData.baseIntensity = (l.intensity ?? 1);
    });
  }

  update(/* dt */) {
    const now = new Date();

    // 太陽路徑（簡化：用本地小時做角度）
    const hours = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
    const angle = (hours / 24) * Math.PI * 2 - Math.PI / 2;

    const sunX = Math.cos(angle) * 100;
    const sunY = Math.sin(angle) * 100;
    this.dirLight.position.set(sunX, sunY, -30);

    const sunIntensity = Math.max(Math.sin(angle), 0); // 0~1

    this.dirLight.intensity = sunIntensity;
    this.dirLight.color.lerpColors(this.nightLightColor, this.dayLightColor, sunIntensity);

    const hemiIntensity = sunIntensity * 0.5 + 0.2;
    this.hemiLight.intensity = hemiIntensity;
    this.hemiLight.color.lerpColors(this.nightSkyColor, this.daySkyColor, sunIntensity);
    this.hemiLight.groundColor.lerpColors(this.nightGroundColor, this.dayGroundColor, sunIntensity);

    this.sky.material.uniforms.sunPosition.value.copy(this.dirLight.position);
    this.stars.visible = (sunIntensity < 0.2);

    // 月亮位置 & 月相
    const mp = getMoonPosition(now, this.lat, this.lon);
    const r = 400;
    const mx = r * Math.cos(mp.altitude) * Math.sin(mp.azimuth);
    const my = r * Math.sin(mp.altitude);
    const mz = r * Math.cos(mp.altitude) * Math.cos(mp.azimuth);
    this.moon.position.set(mx, my, mz);
    this.moon.visible = mp.altitude > 0;

    const illum = getMoonIllumination(now);
    this._drawMoonPhase(illum.fraction, illum.phase);

    // 視角大小（放大幾倍讓看得見）
    const angularDiameter = 0.5 * Math.PI / 180;
    const diameter = 2 * r * Math.tan(angularDiameter / 2);
    const scaleFactor = 6;
    this.moon.scale.set(diameter * scaleFactor, diameter * scaleFactor, 1);

    // 路燈：白天關、晚上亮
    if (this.streetLights?.length) {
      this.streetLights.forEach(light => {
        const base = light.userData?.baseIntensity ?? 1;
        light.intensity = base * (1 - sunIntensity);
      });
    }
  }

  _drawMoonPhase(fraction, phase = 0) {
    // fraction: 0（新月）→ 1（滿月）
    // phase: 0~1（決定盈虧方向）
    const ctx = this.moonCtx;
    const size = 256, cx = size/2, cy = size/2, r = size/2;
    const f = Math.min(1, Math.max(0, fraction));
    const waxing = phase < 0.5;

    ctx.clearRect(0, 0, size, size);

    // 畫滿月的亮面底色
    const grad = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
    grad.addColorStop(0, 'rgba(255,255,240,1)');
    grad.addColorStop(0.75, 'rgba(245,245,220,0.98)');
    grad.addColorStop(1, 'rgba(215,215,200,0.92)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.98, 0, Math.PI * 2);
    ctx.fill();

    // 用「重疊圓盤」畫出暗面，避免黑洞與錯誤的橢圓遮罩
    // k 代表終止線偏移量（-1~1），用 fraction 近似即可
    const k = Math.max(-1, Math.min(1, 1 - 2 * f));
    const offset = (waxing ? 1 : -1) * k * r;

    // 把暗面「挖成透明」，讓背景天空顯示出來
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(cx + offset, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    this.moonTexture.needsUpdate = true;
  }
}
