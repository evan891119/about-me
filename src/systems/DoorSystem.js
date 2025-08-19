import * as THREE from 'three';
import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';
import { INTERACTION } from '../config.js';

export class DoorSystem {
  /**
   * @param {import('../physics/Physics.js').Physics} physics
   */
  constructor(physics) {
    this.physics = physics;
    this.world = physics.world;

    this.doors = []; // { mesh, pivot, rb, animTime, animFrom, animTo, isOpen, duration }
    this._pos = new THREE.Vector3();
    this._quat = new THREE.Quaternion();
  }

  /** 批次註冊：接 WorldBuilder 回傳的 [{mesh,pivot}] */
  registerDoors(list) {
    list?.forEach(d => this.registerDoor(d.mesh, d.pivot));
  }

  /** 註冊單扇門：建立 kinematic 剛體 + cuboid collider（跟門板同姿態） */
  registerDoor(mesh, pivot, duration = INTERACTION.doorAnimSec) {
    // 避免重複註冊
    if (this.doors.some(x => x.mesh === mesh)) return;

    mesh.updateWorldMatrix(true, true);
    mesh.getWorldPosition(this._pos);
    mesh.getWorldQuaternion(this._quat);

    const gp = mesh.geometry?.parameters || {};
    const half = {
      x: (gp.width  ?? 0.5) / 2,
      y: (gp.height ?? 1.8) / 2,
      z: (gp.depth  ?? 0.05) / 2,
    };

    const rbDesc = RAPIER.RigidBodyDesc
      .kinematicPositionBased()
      .setTranslation(this._pos.x, this._pos.y, this._pos.z)
      .setRotation({ x:this._quat.x, y:this._quat.y, z:this._quat.z, w:this._quat.w });

    const rb = this.world.createRigidBody(rbDesc);
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z), rb);

    // 讀取初始開關與角度設定（WorldBuilder 已填在 userData）
    const isOpen = !!pivot.userData?.isOpen;
    const closed = pivot.userData?.closedRotation ?? 0;
    const open   = pivot.userData?.openRotation   ?? -Math.PI/2;

    this.doors.push({
      mesh, pivot, rb,
      animTime: 0,
      animFrom: pivot.rotation.y,
      animTo:   isOpen ? open : closed,
      isOpen:   isOpen,
      duration
    });
  }

  toggleDoor(target) {
    const d = this.doors.find(x => x.mesh === target || x.pivot === target);
    if (!d) return;

    d.isOpen = !d.isOpen;
    d.animFrom = d.pivot.rotation.y;

    const closed = d.pivot.userData?.closedRotation ?? 0;
    const open   = d.pivot.userData?.openRotation   ?? -Math.PI/2;
    d.animTo = d.isOpen ? open : closed;

    d.animTime = 0;
  }

  update(dt) {
    for (const d of this.doors) {
      // 平滑旋轉
      if (d.animTime < d.duration) {
        d.animTime = Math.min(d.animTime + dt, d.duration);
        const t = d.animTime / d.duration;
        const tt = t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2)/2;
        d.pivot.rotation.y = d.animFrom + (d.animTo - d.animFrom) * tt;
      }

      // 同步 kinematic 剛體到門板當前世界姿態
      d.pivot.updateMatrixWorld(true);
      d.mesh.updateWorldMatrix(true, true);
      d.mesh.getWorldPosition(this._pos);
      d.mesh.getWorldQuaternion(this._quat);

      d.rb.setNextKinematicTranslation({ x:this._pos.x, y:this._pos.y, z:this._pos.z });
      d.rb.setNextKinematicRotation({ x:this._quat.x, y:this._quat.y, z:this._quat.z, w:this._quat.w });
    }
  }
}
