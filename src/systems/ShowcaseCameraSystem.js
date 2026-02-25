import * as THREE from 'three';
import { VISUAL } from '../config.js';

export class ShowcaseCameraSystem {
  constructor(camera, input) {
    this.camera = camera;
    this.input = input;
    this.isActive = false;

    this._controlsObject = input.controls?.getObject() ?? null;
    this._targetPos = new THREE.Vector3(
      VISUAL.camera.showcasePosition.x,
      VISUAL.camera.showcasePosition.y,
      VISUAL.camera.showcasePosition.z
    );
    this._targetLookAt = new THREE.Vector3(
      VISUAL.camera.showcaseLookAt.x,
      VISUAL.camera.showcaseLookAt.y,
      VISUAL.camera.showcaseLookAt.z
    );
    this._savedPos = new THREE.Vector3();
    this._savedQuat = new THREE.Quaternion();
    this._savedFov = camera.fov;
    this._savedControlsEnabled = true;
  }

  update(dt) {
    if (!this._controlsObject) return;

    if (this.input.consumeShowcaseToggle()) {
      if (this.isActive) this.disable();
      else this.enable();
    }

    if (!this.isActive) return;

    const lerpAlpha = Math.min(1, dt * 3.5);
    this._controlsObject.position.lerp(this._targetPos, lerpAlpha);
    this._controlsObject.lookAt(this._targetLookAt);
    this.camera.rotation.set(0, 0, 0);

    this.camera.fov += (VISUAL.camera.showcaseFov - this.camera.fov) * Math.min(1, dt * 6);
    this.camera.updateProjectionMatrix();
  }

  enable() {
    if (!this._controlsObject || this.isActive) return;

    this._savedPos.copy(this._controlsObject.position);
    this._savedQuat.copy(this._controlsObject.quaternion);
    this._savedFov = this.camera.fov;
    this._savedControlsEnabled = this.input.controls?.enabled ?? true;

    if (this.input.controls) this.input.controls.enabled = false;
    this.isActive = true;
  }

  disable() {
    if (!this._controlsObject || !this.isActive) return;

    this._controlsObject.position.copy(this._savedPos);
    this._controlsObject.quaternion.copy(this._savedQuat);
    this.camera.fov = this._savedFov;
    this.camera.updateProjectionMatrix();

    if (this.input.controls) this.input.controls.enabled = this._savedControlsEnabled;
    this.isActive = false;
  }
}
