import * as THREE from 'three';
import { INTERACTION } from '../config.js';

export class InteractionSystem {
  constructor(camera, playerRB, doorSystem, collidable) {
    this.camera = camera;
    this.playerRB = playerRB;
    this.doors = doorSystem;
    this.collidable = collidable;
    this.ray = new THREE.Raycaster();
    window.addEventListener('mousedown', this.onMouseDown);
  }

  onMouseDown = (e) => {
    if (e.button !== 0) return;
    this.ray.setFromCamera(new THREE.Vector2(0,0), this.camera);
    const hits = this.ray.intersectObjects(this.collidable, true);
    if (!hits.length) return;

    let obj = hits[0].object;
    while (obj && !obj.userData?.isDoor) obj = obj.parent;
    if (!(obj && obj.userData?.isDoor)) return;

    const pivot = obj.userData.doorPivot;
    const hinge = new THREE.Vector3(); pivot.getWorldPosition(hinge);
    const pp = this.playerRB.translation();
    const player = new THREE.Vector3(pp.x, pp.y, pp.z);
    if (hinge.distanceTo(player) > INTERACTION.doorRange * 2) return;

    this.doors.toggleDoor(pivot);
  }
}
