import * as THREE from 'three';
import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';
import { PHYSICS, PLAYER } from '../config.js';

export class PlayerController {
  constructor(physics, camera, input) {
    this.physics = physics;
    this.camera = camera;
    this.input = input;

    // KCC
    this.controller = physics.world.createCharacterController(0.01);
    this.controller.setUp({ x:0, y:1, z:0 });
    this.controller.enableAutostep(0.35, 0.25, true);
    this.controller.enableSnapToGround(0.5);
    this.controller.setMaxSlopeClimbAngle(Math.PI/3);
    this.controller.setMinSlopeSlideAngle(Math.PI/6);

    const capHalf = (PLAYER.height - 2*PLAYER.radius)/2;
    const rbDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 1.6, 5);
    this.rb  = physics.world.createRigidBody(rbDesc);
    this.col = physics.world.createCollider(RAPIER.ColliderDesc.capsule(capHalf, PLAYER.radius), this.rb);

    this._f = new THREE.Vector3();
    this._r = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._hv = new THREE.Vector3();
    this._targetHv = new THREE.Vector3();
    this.vy = 0;
  }

  _grounded() {
    const pos = this.rb.translation();
    const capHalf = (PLAYER.height - 2*PLAYER.radius)/2;
    const bottomOffset = capHalf + PLAYER.radius; // 中心→腳底
    const rayLen = bottomOffset + 0.06;
    const hit = this.physics.world.castRay(
      new RAPIER.Ray({x:pos.x,y:pos.y,z:pos.z},{x:0,y:-1,z:0}),
      rayLen, true, undefined, undefined, this.col
    );
    return !!hit && (!hit.toi || hit.toi > 1e-3);
  }

  update(dt) {
    // 方向
    this.camera.getWorldDirection(this._f).setY(0).normalize();
    this._r.crossVectors(this._f, new THREE.Vector3(0,1,0)).normalize();
    this._dir.set(0,0,0);
    if (this.input.forward)  this._dir.add(this._f);
    if (this.input.backward) this._dir.sub(this._f);
    if (this.input.right)    this._dir.add(this._r);
    if (this.input.left)     this._dir.sub(this._r);
    if (this._dir.lengthSq() > 0) this._dir.normalize();

    const grounded = this._grounded();
    const speed = PLAYER.walk * (this.input.sprinting ? PLAYER.sprintMult : 1);

    // 保留起跳時的水平慣性，空中再用較弱的控制去調整方向
    if (grounded) {
      this._hv.copy(this._dir).multiplyScalar(speed);
    } else {
      this._targetHv.copy(this._dir).multiplyScalar(speed * PLAYER.airMult);
      const blend = Math.min(1, PLAYER.airControl * dt);
      this._hv.lerp(this._targetHv, blend);
    }

    if (this.input.jump && grounded) { this.vy = PLAYER.jump; this.input.jump = false; }
    this.vy += PHYSICS.gravity.y * dt;

    const desired = { x: this._hv.x*dt, y: this.vy*dt, z: this._hv.z*dt };
    this.controller.computeColliderMovement(this.col, desired);
    const corr = this.controller.computedMovement();
    if (desired.y < 0 && corr.y > desired.y * 0.5) this.vy = 0;

    const p = this.rb.translation();
    this.rb.setNextKinematicTranslation({ x: p.x + corr.x, y: p.y + corr.y, z: p.z + corr.z });

    // ★ 把鏡頭（PointerLockControls 的物件）跟著剛體走
    const t = this.rb.translation();
    this.input.controls.getObject().position.set(t.x, t.y, t.z);
  }
}
