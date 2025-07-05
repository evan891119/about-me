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
 * @returns {{world: CANNON.World, playerBody: CANNON.Body, streetLights: Array<THREE.PointLight>}}
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

  // Add road and street lights
  const roadWidth = 6;
  const roadLength = 200;
  // Road surface
  const roadGeo = new THREE.PlaneGeometry(roadWidth, roadLength);
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.01, 0);
  scene.add(road);

  // Street lights
  const streetLights = [];
  const poleHeight = 5;
  const poleRadius = 0.05;
  const lampRadius = 0.2;
  const spacing = 20;
  const sideOffset = roadWidth / 2 + 1;
  for (let z = -roadLength / 2 + spacing / 2; z <= roadLength / 2; z += spacing) {
    [-1, 1].forEach(side => {
      const x = side * sideOffset;
      // Pole
      const poleGeo = new THREE.CylinderGeometry(poleRadius, poleRadius, poleHeight);
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x, poleHeight / 2, z);
      scene.add(pole);
      // Lamp mesh
      const lampGeo = new THREE.SphereGeometry(lampRadius, 8, 8);
      const lampMat = new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffffee, emissiveIntensity: 1 });
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(x, poleHeight + lampRadius, z);
      scene.add(lamp);
      // Light source
      const light = new THREE.PointLight(0xffffff, 1, 20);
      light.position.copy(lamp.position);
      scene.add(light);
      light.userData.baseIntensity = 1;
      streetLights.push(light);
    });
  }

  return { world, playerBody, streetLights };
}
/**
 * Create a simple house composed of a box (walls) and a pyramid roof.
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
 * @param {object} [options.sign] - Optional signboard content on the front header panel.
 * @param {'text'|'image'} [options.sign.type] - Type of sign content ('text' or 'image').
 * @param {string} [options.sign.text] - Text to display when type is 'text'.
 * @param {string} [options.sign.font] - CSS font style for sign text (e.g. '48px Arial').
 * @param {string} [options.sign.color] - Sign text color (e.g. '#000000').
 * @param {string} [options.sign.backgroundColor] - Background color behind sign text.
 * @param {string} [options.sign.src] - Image source URL when type is 'image'.
 * @param {object} [options.interior] - Optional interior content for house walls.
 * @param {object} [options.interior.left] - Content for the left side interior wall.
 * @param {object} [options.interior.back] - Content for the back interior wall.
 * @param {object} [options.interior.right] - Content for the right side interior wall.
 * @param {'text'|'image'} [options.interior.X.type] - Type of interior content ('text' or 'image') for each wall.
 * @param {string} [options.interior.X.text] - Text to display when type is 'text'.
 * @param {string} [options.interior.X.font] - CSS font style for interior text.
 * @param {string} [options.interior.X.color] - Interior text color.
 * @param {string} [options.interior.X.backgroundColor] - Background color behind interior text.
 * @param {string} [options.interior.X.src] - Image source URL for interior image.
 * @returns {THREE.Group}
 */
export function createHouse({ scene, collidableMeshes, collidableBoxes, world }, {
  position = new THREE.Vector3(),
  width = 4,
  height = 2.5,
  depth = 8,
  wallColor = 0xFFFFFF,
  roofColor = 0x882200,
  sign = null,
  interior = null
} = {}) {
  const house = new THREE.Group();
  // Calculate door dimensions
  const doorWidth = width * 0.4;
  const doorHeight = height * 0.6;
  const doorThickness = 0.05;
  // Walls will be constructed as individual panels (front, back, sides) with a door opening
  // Roof as rectangular pyramid with 4 triangular faces
  const roofHeight = height * 0.6;
  const apexY = height + roofHeight;
  const halfW = width / 2;
  const halfD = depth / 2;
  // vertices for 4 faces: apex + two base corners
  const vertices = new Float32Array([
    // front face
    0, apexY, 0,   halfW, height, -halfD,   -halfW, height, -halfD,
    // right face
    0, apexY, 0,   halfW, height, halfD,    halfW, height, -halfD,
    // back face
    0, apexY, 0,   -halfW, height, halfD,   halfW, height, halfD,
    // left face
    0, apexY, 0,   -halfW, height, -halfD,  -halfW, height, halfD,
  ]);
  const roofGeo = new THREE.BufferGeometry();
  roofGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  roofGeo.computeVertexNormals();
  // Roof material: render both sides so interior roof is visible from inside
  const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, side: THREE.DoubleSide });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  house.add(roof);
  // Register roof for raycast and add physics collision (trimesh)
  collidableMeshes.push(roof);
  collidableBoxes.push(new THREE.Box3().setFromObject(roof));
  // Build physics shape from roof geometry
  // Each 3 vertices form a triangle: indices [0,1,2, 3,4,5, 6,7,8, 9,10,11]
  const roofIndices = Array.from({ length: vertices.length / 3 }, (_, i) => i);
  const roofShape = new CANNON.Trimesh(vertices, roofIndices);
  const roofBody = new CANNON.Body({ mass: 0 });
  roofBody.addShape(roofShape);
  // Position body at house base
  roofBody.position.set(position.x, position.y, position.z);
  world.addBody(roofBody);
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
    // Front header panel (signboard)
    const headerHeight = height - doorHeight;
    const headerGeo = new THREE.BoxGeometry(doorWidth, headerHeight, panelThickness);
    let headerPanel;
    if (sign) {
      let signTex;
      if (sign.type === 'text') {
        const canvas2 = document.createElement('canvas');
        canvas2.width = 512;
        canvas2.height = 256;
        const ctx2 = canvas2.getContext('2d');
        ctx2.fillStyle = sign.backgroundColor || '#ffffff';
        ctx2.fillRect(0, 0, canvas2.width, canvas2.height);
        ctx2.fillStyle = sign.color || '#000000';
        ctx2.font = sign.font || '48px sans-serif';
        ctx2.textAlign = 'center';
        ctx2.textBaseline = 'middle';
        ctx2.fillText(sign.text, canvas2.width / 2, canvas2.height / 2);
        signTex = new THREE.CanvasTexture(canvas2);
        signTex.needsUpdate = true;
      } else if (sign.type === 'image') {
        signTex = new THREE.TextureLoader().load(sign.src);
      }
      const blankMat = panelMat;
      const signMat = new THREE.MeshStandardMaterial({ map: signTex, side: THREE.FrontSide });
      const materials = [blankMat, blankMat, blankMat, blankMat, signMat, blankMat];
      headerPanel = new THREE.Mesh(headerGeo, materials);
    } else {
      headerPanel = new THREE.Mesh(headerGeo, panelMat);
    }
    headerPanel.position.set(0, doorHeight + headerHeight / 2, depth / 2 - panelThickness / 2);
    house.add(headerPanel);
    collidableMeshes.push(headerPanel);
    collidableBoxes.push(new THREE.Box3().setFromObject(headerPanel));
    const headerBody = new CANNON.Body({ mass: 0 });
    headerBody.addShape(new CANNON.Box(new CANNON.Vec3(doorWidth / 2, headerHeight / 2, panelThickness / 2)));
    headerBody.position.set(
      position.x + headerPanel.position.x,
      position.y + headerPanel.position.y,
      position.z + headerPanel.position.z
    );
    world.addBody(headerBody);

    // Back wall panel (interior content)
    const backGeo = new THREE.BoxGeometry(width, height, panelThickness);
    let backPanel;
    if (interior && interior.back) {
      let interiorTex;
      if (interior.back.type === 'text') {
        const canvas3 = document.createElement('canvas');
        canvas3.width = 512;
        canvas3.height = 256;
        const ctx3 = canvas3.getContext('2d');
        ctx3.fillStyle = interior.back.backgroundColor || '#ffffff';
        ctx3.fillRect(0, 0, canvas3.width, canvas3.height);
        ctx3.fillStyle = interior.back.color || '#000000';
        ctx3.font = interior.back.font || '48px sans-serif';
        ctx3.textAlign = 'center';
        ctx3.textBaseline = 'middle';
        ctx3.fillText(interior.back.text, canvas3.width / 2, canvas3.height / 2);
        interiorTex = new THREE.CanvasTexture(canvas3);
        interiorTex.needsUpdate = true;
      } else if (interior.back.type === 'image') {
        interiorTex = new THREE.TextureLoader().load(interior.back.src);
      }
      const blankMat = panelMat;
      const interiorMat = new THREE.MeshStandardMaterial({ map: interiorTex, side: THREE.FrontSide });
      const materials = [blankMat, blankMat, blankMat, blankMat, interiorMat, blankMat];
      backPanel = new THREE.Mesh(backGeo, materials);
    } else {
      backPanel = new THREE.Mesh(backGeo, panelMat);
    }
    backPanel.position.set(0, height / 2, -depth / 2 + panelThickness / 2);
    house.add(backPanel);
    collidableMeshes.push(backPanel);
    collidableBoxes.push(new THREE.Box3().setFromObject(backPanel));
    const backBody = new CANNON.Body({ mass: 0 });
    backBody.addShape(new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, panelThickness / 2)));
    backBody.position.set(
      position.x + backPanel.position.x,
      position.y + backPanel.position.y,
      position.z + backPanel.position.z
    );
    world.addBody(backBody);
    // Left side wall panel (interior content)
    const leftSideGeo = new THREE.BoxGeometry(panelThickness, height, depth);
    let leftSide;
    if (interior && interior.left) {
      let interiorTexLeft;
      if (interior.left.type === 'text') {
        const canvasL = document.createElement('canvas');
        canvasL.width = 512;
        canvasL.height = 256;
        const ctxL = canvasL.getContext('2d');
        ctxL.fillStyle = interior.left.backgroundColor || '#ffffff';
        ctxL.fillRect(0, 0, canvasL.width, canvasL.height);
        ctxL.fillStyle = interior.left.color || '#000000';
        ctxL.font = interior.left.font || '48px sans-serif';
        ctxL.textAlign = 'center';
        ctxL.textBaseline = 'middle';
        ctxL.fillText(interior.left.text, canvasL.width / 2, canvasL.height / 2);
        interiorTexLeft = new THREE.CanvasTexture(canvasL);
        interiorTexLeft.needsUpdate = true;
      } else if (interior.left.type === 'image') {
        interiorTexLeft = new THREE.TextureLoader().load(interior.left.src);
      }
      const blankMat = panelMat;
      const interiorMatL = new THREE.MeshStandardMaterial({ map: interiorTexLeft, side: THREE.FrontSide });
      const matsL = [interiorMatL, blankMat, blankMat, blankMat, blankMat, blankMat];
      leftSide = new THREE.Mesh(leftSideGeo, matsL);
    } else {
      leftSide = new THREE.Mesh(leftSideGeo, panelMat);
    }
    leftSide.position.set(-width/2 + panelThickness/2, height/2, 0);
    house.add(leftSide);
    collidableMeshes.push(leftSide);
    collidableBoxes.push(new THREE.Box3().setFromObject(leftSide));
    const leftSideBody = new CANNON.Body({ mass: 0 });
    leftSideBody.addShape(new CANNON.Box(new CANNON.Vec3(panelThickness/2, height/2, depth/2)));
    leftSideBody.position.set(position.x + leftSide.position.x, position.y + leftSide.position.y, position.z + leftSide.position.z);
    world.addBody(leftSideBody);
    // Right side wall panel (interior content)
    const rightSideGeo = new THREE.BoxGeometry(panelThickness, height, depth);
    let rightSide;
    if (interior && interior.right) {
      let interiorTexR;
      if (interior.right.type === 'text') {
        const canvasR = document.createElement('canvas');
        canvasR.width = 512;
        canvasR.height = 256;
        const ctxR = canvasR.getContext('2d');
        ctxR.fillStyle = interior.right.backgroundColor || '#ffffff';
        ctxR.fillRect(0, 0, canvasR.width, canvasR.height);
        ctxR.fillStyle = interior.right.color || '#000000';
        ctxR.font = interior.right.font || '48px sans-serif';
        ctxR.textAlign = 'center';
        ctxR.textBaseline = 'middle';
        ctxR.fillText(interior.right.text, canvasR.width / 2, canvasR.height / 2);
        interiorTexR = new THREE.CanvasTexture(canvasR);
        interiorTexR.needsUpdate = true;
      } else if (interior.right.type === 'image') {
        interiorTexR = new THREE.TextureLoader().load(interior.right.src);
      }
      const blankMat = panelMat;
      const interiorMatR = new THREE.MeshStandardMaterial({ map: interiorTexR, side: THREE.FrontSide });
      const matsR = [blankMat, interiorMatR, blankMat, blankMat, blankMat, blankMat];
      rightSide = new THREE.Mesh(rightSideGeo, matsR);
    } else {
      rightSide = new THREE.Mesh(rightSideGeo, panelMat);
    }
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
  // (Roof collisions are omitted)
  return house;
}
