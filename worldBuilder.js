// worldBuilder.js
// Module to construct scene objects and physics world
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/**
 * Build scene geometry and physics bodies.
 * @param {object} params
 * @param {THREE.Scene} params.scene - The Three.js scene
 * @param {Array<THREE.Mesh>} params.collidableMeshes - Array to populate with collidable meshes
 * @param {Array<THREE.Box3>} params.collidableBoxes - Array to populate with bounding boxes
 * @param {number} params.cameraHeight - Initial camera/player height
 * @param {number} params.playerBoundingRadius - Radius for player collision sphere
 * @returns {{world: CANNON.World, playerBody: CANNON.Body}}
 */
export function buildWorld({ scene, collidableMeshes, collidableBoxes, cameraHeight, playerBoundingRadius }) {
  // Floor with checker pattern
  const floorGeo = new THREE.PlaneGeometry(200, 200);
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#888888'; ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#777777'; ctx.fillRect(0, 0, size/2, size/2);
  ctx.fillRect(size/2, size/2, size/2, size/2);
  const floorTexture = new THREE.CanvasTexture(canvas);
  floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
  floorTexture.repeat.set(20, 20);
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTexture });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // Example collidable objects: colored cubes
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  ['red', 'green', 'blue'].forEach((color, i) => {
    const mat = new THREE.MeshStandardMaterial({ color });
    const mesh = new THREE.Mesh(boxGeo, mat);
    mesh.position.set(i * 2 - 2, 0.5, -5);
    scene.add(mesh);
    collidableMeshes.push(mesh);
    const bbox = new THREE.Box3().setFromObject(mesh);
    collidableBoxes.push(bbox);
  });

  // Physics world
  const world = new CANNON.World();
  world.gravity.set(0, -30, 0);
  const defaultMat = new CANNON.Material('default');
  const defaultContact = new CANNON.ContactMaterial(
    defaultMat,
    defaultMat,
    { friction: 0.4, restitution: 0.0 }
  );
  world.addContactMaterial(defaultContact);
  world.defaultContactMaterial = defaultContact;

  // Player physics body
  const playerShape = new CANNON.Sphere(playerBoundingRadius);
  const playerBody = new CANNON.Body({ mass: 1, material: defaultMat });
  playerBody.addShape(playerShape);
  playerBody.position.set(0, cameraHeight, 5);
  playerBody.fixedRotation = true;
  playerBody.updateMassProperties();
  world.addBody(playerBody);

  // Ground plane
  const groundBody = new CANNON.Body({ mass: 0, material: defaultMat });
  groundBody.addShape(new CANNON.Plane());
  groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(groundBody);

  // Static boxes for collidable meshes
  collidableMeshes.forEach(mesh => {
    const { width, height, depth } = mesh.geometry.parameters;
    const halfExtents = new CANNON.Vec3(width/2, height/2, depth/2);
    const boxShape = new CANNON.Box(halfExtents);
    const boxBody = new CANNON.Body({ mass: 0, material: defaultMat });
    boxBody.addShape(boxShape);
    boxBody.position.copy(mesh.position);
    world.addBody(boxBody);
  });

  return { world, playerBody };
}