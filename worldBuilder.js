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
/**
 * Create a simple house composed of a box (walls) and a cone (roof).
 * @param {object} params
 * @param {THREE.Scene} params.scene
 * @param {Array<THREE.Mesh>} params.collidableMeshes
 * @param {Array<THREE.Box3>} params.collidableBoxes
 * @param {CANNON.World} params.world
 * @param {object} options
 * @param {THREE.Vector3} [options.position=new THREE.Vector3()] - World position of house base
 * @param {number} [options.width=4]
 * @param {number} [options.height=2.5]
 * @param {number} [options.depth=4]
 * @param {string|number} [options.wallColor=0xFFFFFF]
 * @param {string|number} [options.roofColor=0x882200]
 * @returns {THREE.Group}
 */
export function createHouse({ scene, collidableMeshes, collidableBoxes, world }, {
  position = new THREE.Vector3(),
  width = 4,
  height = 2.5,
  depth = 4,
  wallColor = 0xFFFFFF,
  roofColor = 0x882200
} = {}) {
  const house = new THREE.Group();
  // Calculate door dimensions
  const doorWidth = width * 0.4;
  const doorHeight = height * 0.6;
  const doorThickness = 0.05;
  // Walls will be constructed as individual panels (front, back, sides) with a door opening
  // Roof as pyramid (cone with 4 sides)
  const roofHeight = height * 0.6;
  const radius = Math.max(width, depth) * 0.6;
  const roofGeo = new THREE.ConeGeometry(radius, roofHeight, 4);
  const roofMat = new THREE.MeshStandardMaterial({ color: roofColor });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.rotation.y = Math.PI/4; // align square roof
  roof.position.set(0, height + roofHeight/2, 0);
  house.add(roof);
  // Build front wall panels around door opening
  {
    const panelThickness = doorThickness;
    const leftPanelWidth = (width - doorWidth) / 2;
    const panelMat = new THREE.MeshStandardMaterial({ color: wallColor });
    // Front left panel
    const leftGeo = new THREE.BoxGeometry(leftPanelWidth, height, panelThickness);
    const leftPanel = new THREE.Mesh(leftGeo, panelMat);
    leftPanel.position.set(-doorWidth/2 - leftPanelWidth/2, height/2, depth/2 - panelThickness/2);
    house.add(leftPanel);
    collidableMeshes.push(leftPanel);
    collidableBoxes.push(new THREE.Box3().setFromObject(leftPanel));
    const leftBody = new CANNON.Body({ mass: 0 });
    leftBody.addShape(new CANNON.Box(new CANNON.Vec3(leftPanelWidth/2, height/2, panelThickness/2)));
    leftBody.position.set(position.x + leftPanel.position.x, position.y + leftPanel.position.y, position.z + leftPanel.position.z);
    world.addBody(leftBody);
    // Front right panel
    const rightPanel = new THREE.Mesh(new THREE.BoxGeometry(leftPanelWidth, height, panelThickness), panelMat);
    rightPanel.position.set(doorWidth/2 + leftPanelWidth/2, height/2, depth/2 - panelThickness/2);
    house.add(rightPanel);
    collidableMeshes.push(rightPanel);
    collidableBoxes.push(new THREE.Box3().setFromObject(rightPanel));
    const rightBody = new CANNON.Body({ mass: 0 });
    rightBody.addShape(new CANNON.Box(new CANNON.Vec3(leftPanelWidth/2, height/2, panelThickness/2)));
    rightBody.position.set(position.x + rightPanel.position.x, position.y + rightPanel.position.y, position.z + rightPanel.position.z);
    world.addBody(rightBody);
    // Front header panel
    const headerHeight = height - doorHeight;
    const headerGeo = new THREE.BoxGeometry(doorWidth, headerHeight, panelThickness);
    const headerPanel = new THREE.Mesh(headerGeo, panelMat);
    headerPanel.position.set(0, doorHeight + headerHeight/2, depth/2 - panelThickness/2);
    house.add(headerPanel);
    collidableMeshes.push(headerPanel);
    collidableBoxes.push(new THREE.Box3().setFromObject(headerPanel));
    const headerBody = new CANNON.Body({ mass: 0 });
    headerBody.addShape(new CANNON.Box(new CANNON.Vec3(doorWidth/2, headerHeight/2, panelThickness/2)));
    headerBody.position.set(position.x + headerPanel.position.x, position.y + headerPanel.position.y, position.z + headerPanel.position.z);
    world.addBody(headerBody);
    // Back wall panel
    const backGeo = new THREE.BoxGeometry(width, height, panelThickness);
    const backPanel = new THREE.Mesh(backGeo, panelMat);
    backPanel.position.set(0, height/2, -depth/2 + panelThickness/2);
    house.add(backPanel);
    collidableMeshes.push(backPanel);
    collidableBoxes.push(new THREE.Box3().setFromObject(backPanel));
    const backBody = new CANNON.Body({ mass: 0 });
    backBody.addShape(new CANNON.Box(new CANNON.Vec3(width/2, height/2, panelThickness/2)));
    backBody.position.set(position.x + backPanel.position.x, position.y + backPanel.position.y, position.z + backPanel.position.z);
    world.addBody(backBody);
    // Left side wall panel
    const leftSideGeo = new THREE.BoxGeometry(panelThickness, height, depth);
    const leftSide = new THREE.Mesh(leftSideGeo, panelMat);
    leftSide.position.set(-width/2 + panelThickness/2, height/2, 0);
    house.add(leftSide);
    collidableMeshes.push(leftSide);
    collidableBoxes.push(new THREE.Box3().setFromObject(leftSide));
    const leftSideBody = new CANNON.Body({ mass: 0 });
    leftSideBody.addShape(new CANNON.Box(new CANNON.Vec3(panelThickness/2, height/2, depth/2)));
    leftSideBody.position.set(position.x + leftSide.position.x, position.y + leftSide.position.y, position.z + leftSide.position.z);
    world.addBody(leftSideBody);
    // Right side wall panel
    const rightSideGeo = new THREE.BoxGeometry(panelThickness, height, depth);
    const rightSide = new THREE.Mesh(rightSideGeo, panelMat);
    rightSide.position.set(width/2 - panelThickness/2, height/2, 0);
    house.add(rightSide);
    collidableMeshes.push(rightSide);
    collidableBoxes.push(new THREE.Box3().setFromObject(rightSide));
    const rightSideBody = new CANNON.Body({ mass: 0 });
    rightSideBody.addShape(new CANNON.Box(new CANNON.Vec3(panelThickness/2, height/2, depth/2)));
    rightSideBody.position.set(position.x + rightSide.position.x, position.y + rightSide.position.y, position.z + rightSide.position.z);
    world.addBody(rightSideBody);
  }
  // Add a simple door with hinge on the left
  {
    // Pivot at hinge (left side of door)
    const doorPivot = new THREE.Object3D();
    doorPivot.position.set(-doorWidth/2, 0, depth/2);
    house.add(doorPivot);
    // Door mesh
    const doorGeo = new THREE.BoxGeometry(doorWidth, doorHeight, doorThickness);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x663300 });
    const doorMesh = new THREE.Mesh(doorGeo, doorMat);
    // Offset so hinge aligns at pivot
    doorMesh.position.set(doorWidth/2, doorHeight/2, doorThickness/2);
    doorPivot.add(doorMesh);
    // Tag for interaction
    doorMesh.userData.isDoor = true;
    doorMesh.userData.doorPivot = doorPivot;
    // Track open state
    doorPivot.userData.isOpen = false;
    doorPivot.userData.closedRotation = 0;
    doorPivot.userData.openRotation = -Math.PI/2;
    // Register collidable for raycast
    collidableMeshes.push(doorMesh);
    collidableBoxes.push(new THREE.Box3().setFromObject(doorMesh));
    // Create physics body for door to block passage when closed
    const doorShape = new CANNON.Box(new CANNON.Vec3(doorWidth/2, doorHeight/2, doorThickness/2));
    const doorBody = new CANNON.Body({ mass: 0 });
    doorBody.addShape(doorShape);
    // Position body at door center in world coords
    doorBody.position.set(
      position.x,
      position.y + doorHeight/2,
      position.z + depth/2
    );
    world.addBody(doorBody);
    // Link body to mesh for toggling
    doorMesh.userData.doorBody = doorBody;
  }
  // Position group
  house.position.copy(position);
  scene.add(house);
  // Register roof for raycast and add physics body
  collidableMeshes.push(roof);
  collidableBoxes.push(new THREE.Box3().setFromObject(roof));
  const roofSphere = new CANNON.Sphere(radius);
  const roofBody = new CANNON.Body({ mass: 0 });
  roofBody.addShape(roofSphere);
  roofBody.position.set(
    position.x,
    position.y + height + roofHeight/2,
    position.z
  );
  world.addBody(roofBody);
  return house;
}
