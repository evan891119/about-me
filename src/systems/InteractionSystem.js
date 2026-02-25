import * as THREE from 'three';
import { INTERACTION } from '../config.js';

export class InteractionSystem {
  constructor(camera, playerRB, doorSystem, doorMeshes, hud = null) {
    this.camera = camera;
    this.playerRB = playerRB;
    this.doors = doorSystem;
    this.doorMeshes = doorMeshes;
    this.hud = hud;
    this.ray = new THREE.Raycaster();
    this._ndcCenter = new THREE.Vector2(0, 0);
    this._hinge = new THREE.Vector3();
    this._player = new THREE.Vector3();
    this._promptText = 'Click to open';
    window.addEventListener('mousedown', this.onMouseDown);
  }

  update() {
    const doorHit = this._getDoorInSight();
    if (!this.hud) return;
    if (!doorHit) {
      this.hud.setPrompt('');
      return;
    }

    const doorState = this.doors.doors?.find((d) => d.pivot === doorHit.pivot);
    const prompt = doorState?.isOpen ? 'Click to close' : this._promptText;
    this.hud.setPrompt(prompt);
  }

  _getDoorInSight() {
    this.ray.setFromCamera(this._ndcCenter, this.camera);
    const hits = this.ray.intersectObjects(this.doorMeshes, true);
    if (!hits.length) return null;

    let obj = hits[0].object;
    while (obj && !obj.userData?.isDoor) obj = obj.parent;
    if (!(obj && obj.userData?.isDoor)) return null;

    const pivot = obj.userData.doorPivot;
    pivot.getWorldPosition(this._hinge);
    const pp = this.playerRB.translation();
    this._player.set(pp.x, pp.y, pp.z);
    const maxRange = INTERACTION.doorRange;
    if (this._hinge.distanceTo(this._player) > maxRange) return null;

    return { obj, pivot };
  }

  onMouseDown = (e) => {
    if (e.button !== 0) return;
    const doorHit = this._getDoorInSight();
    if (!doorHit) return;
    const { pivot } = doorHit;
    this.doors.toggleDoor(pivot);
  }

  dispose() {
    window.removeEventListener('mousedown', this.onMouseDown);
  }
}
