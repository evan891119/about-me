// Import THREE from import map
// Import core Three.js from import map
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PointerLockControls } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/controls/PointerLockControls.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/loaders/GLTFLoader.js';
// Import WebGL detection helper
// WebGL detection helper (default export)
import WebGL from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/capabilities/WebGL.js';

// Core components
let camera, scene, renderer, controls;
// Coordinate display element
let coordsDiv;
// Movement state
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let prevTime = performance.now();
let velocity = new THREE.Vector3();
// Collision detection: collidable meshes and boxes
const collidableMeshes = [];
const collidableBoxes = [];
// Physics world and player body
let world, playerBody;
// Jump request flag
let jumpRequested = false;
// Player collision sphere parameters
const playerBoundingRadius = 0.3;
const playerHeight = 1.0; // y coordinate to test collisions (approx player waist)
// Jump / gravity variables
let velocityY = 0;
let canJump = false;
const GRAVITY = 30;
const JUMP_SPEED = 10;
// Camera height off ground (m)
const cameraHeight = 1.6;
// Raycaster for optional debug or future use
const raycaster = new THREE.Raycaster();

// Check for WebGL support before initializing
if ( WebGL.isWebGLAvailable() ) {
  init();
  animate();
} else {
  // Add WebGL error message to the page
  const warning = WebGL.getWebGLErrorMessage();
  warning.style.position = 'absolute';
  warning.style.top = '0';
  warning.style.left = '0';
  document.body.appendChild(warning);
}

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xddddff);

  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 1.6, 5);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
  hemiLight.position.set(0, 20, 0);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff);
  dirLight.position.set(-3, 10, -10);
  scene.add(dirLight);

  // Floor with simple checker texture
  const floorGeo = new THREE.PlaneGeometry(200, 200);
  // create a small canvas for checker pattern
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  // draw checker: two colors
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

  // Example collidable objects: three colored cubes
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  ['red', 'green', 'blue'].forEach((color, i) => {
    const mat = new THREE.MeshStandardMaterial({ color });
    const mesh = new THREE.Mesh(boxGeo, mat);
    mesh.position.set(i * 2 - 2, 0.5, -5);
    scene.add(mesh);
    // register for collision
    collidableMeshes.push(mesh);
    // precompute bounding box in world space
    const box = new THREE.Box3().setFromObject(mesh);
    collidableBoxes.push(box);
  });

  // Initialize physics world
  world = new CANNON.World();
  world.gravity.set(0, -30, 0);
  // Initialize default material for friction
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
  playerBody = new CANNON.Body({ mass: 1, material: defaultMat });
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

  // Static boxes from scene
  collidableMeshes.forEach(mesh => {
    const { width, height, depth } = mesh.geometry.parameters;
    const boxShape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2));
    const boxBody = new CANNON.Body({ mass: 0, material: defaultMat });
    boxBody.addShape(boxShape);
    boxBody.position.copy(mesh.position);
    world.addBody(boxBody);
  });

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);
  // Create coordinate display in top-right
  coordsDiv = document.createElement('div');
  coordsDiv.style.position = 'absolute';
  coordsDiv.style.top = '10px';
  coordsDiv.style.right = '10px';
  coordsDiv.style.color = '#fff';
  coordsDiv.style.fontFamily = 'monospace';
  coordsDiv.style.background = 'rgba(0,0,0,0.5)';
  coordsDiv.style.padding = '4px 8px';
  coordsDiv.style.borderRadius = '4px';
  coordsDiv.style.zIndex = '100';
  document.body.appendChild(coordsDiv);

  // PointerLockControls: lock pointer on the document body
  controls = new PointerLockControls(camera, document.body);
  const blocker = document.getElementById('blocker');
  // Click blocker to request pointer lock
  blocker.addEventListener('click', () => {
    console.log('Blocker clicked: requesting pointer lock');
    controls.lock();
  });
  // Hide blocker on lock
  controls.addEventListener('lock', () => {
    console.log('Pointer locked');
    blocker.style.display = 'none';
  });
  // Show blocker on unlock
  controls.addEventListener('unlock', () => {
    console.log('Pointer unlocked');
    blocker.style.display = 'flex';
  });
  // Debug pointer lock errors
  document.addEventListener('pointerlockerror', (event) => {
    console.error('Pointer lock error:', event);
  });
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === null) {
      console.log('Pointer lock released');
    }
  });

  const onKeyDown = (event) => {
    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        moveForward = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        moveLeft = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        moveBackward = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        moveRight = true;
        break;
      case 'Space':
        jumpRequested = true;
        break;
    }
  };

  const onKeyUp = (event) => {
    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        moveForward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        moveLeft = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        moveBackward = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        moveRight = false;
        break;
    }
  };

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  // Physics-driven movement
  const time = performance.now();
  const delta = (time - prevTime) / 1000;
  prevTime = time;
  // Determine if player is grounded (approximate by vertical velocity)
  const isGrounded = Math.abs(playerBody.velocity.y) < 0.05;
  const speedGround = 15;
  const speedAir = speedGround * 0.3; // reduce air movement to simulate friction effect
  const speed = isGrounded ? speedGround : speedAir;
  // Compute horizontal movement direction based on camera orientation
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();
  const right = new THREE.Vector3();
  right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
  const moveDir = new THREE.Vector3();
  if (moveForward) moveDir.add(forward);
  if (moveBackward) moveDir.sub(forward);
  if (moveRight) moveDir.add(right);
  if (moveLeft) moveDir.sub(right);
  // Apply horizontal input
  if (moveDir.length() > 0) {
    moveDir.normalize().multiplyScalar(speed);
    playerBody.velocity.x = moveDir.x;
    playerBody.velocity.z = moveDir.z;
  }
  if (jumpRequested && Math.abs(playerBody.velocity.y) < 0.05) {
    playerBody.velocity.y = JUMP_SPEED;
    jumpRequested = false;
  }
  // Step the physics world with fixed timestep for stability
  world.step(1/60, delta, 3);
  // Sync camera to physics body
  controls.getObject().position.copy(playerBody.position);
  // Update coordinate display
  if (coordsDiv) {
    const p = playerBody.position;
    coordsDiv.innerText = `x:${p.x.toFixed(2)} y:${p.y.toFixed(2)} z:${p.z.toFixed(2)}`;
  }
  renderer.render(scene, camera);
  return;
}
