import * as THREE from 'three';

export class FlashlightSystem {
  constructor(scene, camera, input) {
    this.scene = scene;
    this.camera = camera;
    this.input = input;

    this.isOn = false;
    this._camPos = new THREE.Vector3();
    this._camDir = new THREE.Vector3();

    this.light = new THREE.SpotLight(0xffffff, 2.2, 60, Math.PI / 7, 0.35, 1.2);
    this.light.castShadow = true;
    this.light.visible = this.isOn;

    // 讓光源跟著鏡頭
    this.light.position.set(0, 0, 0);
    this.camera.add(this.light);

    // SpotLight 需要 target 物件來決定方向
    this.target = new THREE.Object3D();
    this.target.position.set(0, 0, -10);
    this.light.target = this.target;

    // target 必須在場景圖中
    this.scene.add(this.target);
  }

  toggle() {
    this.isOn = !this.isOn;
    this.light.visible = this.isOn;
  }

  update() {
    if (this.input.consumeFlashlightToggle()) {
      this.toggle();
    }

    // 讓 target 跟著相機世界方向移動，避免方向失效
    this.camera.getWorldPosition(this._camPos);
    this.camera.getWorldDirection(this._camDir);
    this.target.position.copy(this._camPos).add(this._camDir.multiplyScalar(10));
  }
}
