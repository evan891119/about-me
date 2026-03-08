import * as THREE from 'three';
import { VISUAL } from '../config.js';

function toVector3(source, fallback = { x: 0, y: 0, z: 0 }) {
  if (source instanceof THREE.Vector3) return source.clone();
  return new THREE.Vector3(
    source?.x ?? fallback.x,
    source?.y ?? fallback.y,
    source?.z ?? fallback.z
  );
}

export class ShowcaseCameraSystem {
  constructor(camera, input, museumAnchor = {}) {
    this.camera = camera;
    this.input = input;
    this.isActive = false;

    this._controlsObject = input.controls?.getObject() ?? null;
    const center = toVector3(museumAnchor.center);
    const entrance = toVector3(museumAnchor.entrance, center);
    const posOffset = VISUAL.camera.showcaseOffset ?? {};
    const lookAtOffset = VISUAL.camera.showcaseLookAtOffset ?? {};

    this._targetPos = center.add(toVector3(posOffset));
    this._targetLookAt = entrance.add(toVector3(lookAtOffset));
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
