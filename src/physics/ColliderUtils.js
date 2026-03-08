import * as THREE from 'three';
import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';

export function addGroundAndRoad(world, {
  groundSize = 200, groundThickness = 0.1, groundY = 0,
  roadWidth = 6, roadLength = 200, roadThickness = 0.02, roadY = 0,
} = {}) {
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(groundSize/2, groundThickness/2, groundSize/2)
      .setTranslation(0, groundY - groundThickness/2, 0)
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(roadWidth/2, roadThickness/2, roadLength/2)
      .setTranslation(0, roadY + roadThickness/2, 0)
  );
}

export function addColliderForBoxMesh(world, mesh) {
  if (!mesh) return null;
  const gp = mesh.geometry?.parameters;
  if (!(gp && gp.width !== undefined && gp.height !== undefined && gp.depth !== undefined)) return null;

  mesh.updateWorldMatrix(true, true);
  const center = mesh.getWorldPosition(new THREE.Vector3());
  const q = mesh.getWorldQuaternion(new THREE.Quaternion());
  const col = world.createCollider(
    RAPIER.ColliderDesc.cuboid(gp.width / 2, gp.height / 2, gp.depth / 2)
      .setTranslation(center.x, center.y, center.z)
      .setRotation({ x:q.x, y:q.y, z:q.z, w:q.w })
  );
  mesh.userData.rapierCollider = col;
  return col;
}
