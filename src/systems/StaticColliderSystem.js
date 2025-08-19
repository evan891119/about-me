import * as THREE from 'three';
import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';
import { WORLD } from '../config.js';

export class StaticColliderSystem {
  /**
   * @param {import('../physics/Physics.js').Physics} physics
   * @param {THREE.Mesh[]} collidableMeshes - 由 WorldBuilder 回傳的靜態可碰撞 Mesh
   * @param {object} [options] - 可覆寫 WORLD 的尺寸設定
   */
  constructor(physics, collidableMeshes, options = {}) {
    this.physics = physics;
    this.world = physics.world;
    this.meshes = collidableMeshes;
    this.opts = { ...WORLD, ...options };

    // 暫存用，避免每幀 new
    this._box = new THREE.Box3();
    this._center = new THREE.Vector3();
    this._half = new THREE.Vector3();
    this._quat = new THREE.Quaternion();
  }

  init() {
    this._addGroundAndRoad();

    // 只把 BoxGeometry（且不是門）轉成靜態碰撞
    this.meshes.forEach(m => {
      if (m.userData?.isDoor) return;
      const gp = m.geometry?.parameters;
      const isBoxGeo = gp && gp.width !== undefined && gp.height !== undefined && gp.depth !== undefined;
      if (isBoxGeo) this._addColliderForBoxMesh(m);
    });
  }

  update() { /* 靜態系統無需每幀處理 */ }

  // -------- helpers --------
  _addGroundAndRoad() {
    const { groundSize, groundThickness, roadWidth, roadLength, roadThickness } = this.opts;

    // 地面：放在 y = -groundThickness/2，厚度向上長
    this.world.createCollider(
      RAPIER.ColliderDesc
        .cuboid(groundSize/2, groundThickness/2, groundSize/2)
        .setTranslation(0, -groundThickness/2, 0)
    );

    // 道路：放在 y = roadThickness/2
    this.world.createCollider(
      RAPIER.ColliderDesc
        .cuboid(roadWidth/2, roadThickness/2, roadLength/2)
        .setTranslation(0, roadThickness/2, 0)
    );
  }

  _addColliderForBoxMesh(mesh) {
    mesh.updateWorldMatrix(true, true);

    this._box.setFromObject(mesh);
    this._half.copy(this._box.max).sub(this._box.min).multiplyScalar(0.5);
    this._center.copy(this._box.getCenter(new THREE.Vector3()));
    mesh.getWorldQuaternion(this._quat);

    this.world.createCollider(
      RAPIER.ColliderDesc
        .cuboid(this._half.x, this._half.y, this._half.z)
        .setTranslation(this._center.x, this._center.y, this._center.z)
        .setRotation({ x:this._quat.x, y:this._quat.y, z:this._quat.z, w:this._quat.w })
    );
  }
}
