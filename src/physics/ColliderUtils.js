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
  mesh.updateWorldMatrix(true, true);
  const bbox = new THREE.Box3().setFromObject(mesh);
  const center = bbox.getCenter(new THREE.Vector3());
  const half = bbox.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const q = new THREE.Quaternion(); mesh.getWorldQuaternion(q);
  const col = world.createCollider(
    RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z)
      .setTranslation(center.x, center.y, center.z)
      .setRotation({ x:q.x, y:q.y, z:q.z, w:q.w })
  );
  mesh.userData.rapierCollider = col;
  return col;
}
