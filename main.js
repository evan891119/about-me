// Import THREE from import map
// Import core Three.js from import map
import * as THREE from 'three';
import { PointerLockControls } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/controls/PointerLockControls.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/loaders/GLTFLoader.js';
// Import WebGL detection helper
// WebGL detection helper (default export)
import WebGL from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/capabilities/WebGL.js';

// Core components
let camera, scene, renderer, controls;
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

  const floorGeo = new THREE.PlaneGeometry(200, 200);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
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

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

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
        // Jump when on ground
        if (canJump === true) {
          velocityY = JUMP_SPEED;
          canJump = false;
        }
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

  const time = performance.now();
  const delta = (time - prevTime) / 1000;

  velocity.x -= velocity.x * 10.0 * delta;
  velocity.z -= velocity.z * 10.0 * delta;
  const speed = 25.0;

  if (moveForward) velocity.z -= speed * delta;
  if (moveBackward) velocity.z += speed * delta;
  if (moveLeft) velocity.x += speed * delta;
  if (moveRight) velocity.x -= speed * delta;

  // Collision-aware movement: separate axis handling
  const deltaX = -velocity.x * delta;
  const deltaZ = -velocity.z * delta;
  // Move along local X (left/right)
  if (deltaX !== 0) {
    // direction vector for X
    const dirX = new THREE.Vector3(1, 0, 0);
    if (deltaX < 0) dirX.negate();
    // rotate by yaw only (ignore pitch)
    dirX.applyQuaternion(controls.getObject().quaternion).normalize();
    // compute next horizontal position
    const nextPosX = controls.getObject().position.clone().add(dirX.clone().multiplyScalar(Math.abs(deltaX)));
    // collision sphere at player height
    const sphereX = new THREE.Sphere(new THREE.Vector3(nextPosX.x, playerHeight, nextPosX.z), playerBoundingRadius);
    // test against collidable boxes
    let blockedX = false;
    for (let i = 0; i < collidableBoxes.length; i++) {
      if (collidableBoxes[i].intersectsSphere(sphereX)) {
        blockedX = true;
        break;
      }
    }
    if (!blockedX) {
      controls.moveRight(deltaX);
    } else {
      velocity.x = 0;
    }
  }
  // Apply gravity and jumping with vertical collisions
  velocityY -= GRAVITY * delta;
  // previous and next Y positions
  const prevY = controls.getObject().position.y;
  let newY = prevY + velocityY * delta;
  let landed = false;
  // check landing on boxes when falling
  if (velocityY <= 0) {
    const footY = prevY - cameraHeight;
    const nextFootY = newY - cameraHeight;
    for (let i = 0; i < collidableBoxes.length; i++) {
      const box = collidableBoxes[i];
      // horizontal overlap (x,z) within box bounds + radius
      const px = controls.getObject().position.x;
      const pz = controls.getObject().position.z;
      if (px > box.min.x - playerBoundingRadius && px < box.max.x + playerBoundingRadius &&
          pz > box.min.z - playerBoundingRadius && pz < box.max.z + playerBoundingRadius) {
        // crossing box top surface
        if (footY >= box.max.y && nextFootY <= box.max.y) {
          newY = box.max.y + cameraHeight;
          velocityY = 0;
          landed = true;
          canJump = true;
          break;
        }
      }
    }
  }
  if (!landed) {
    // ground check
    if (newY < cameraHeight) {
      newY = cameraHeight;
      velocityY = 0;
      canJump = true;
    }
  }
  controls.getObject().position.y = newY;
  // Move along local Z (forward/backward)
  if (deltaZ !== 0) {
    // direction vector for Z
    const dirZ = new THREE.Vector3(0, 0, -1);
    if (deltaZ < 0) dirZ.negate();
    // rotate by yaw only
    dirZ.applyQuaternion(controls.getObject().quaternion).normalize();
    const nextPosZ = controls.getObject().position.clone().add(dirZ.clone().multiplyScalar(Math.abs(deltaZ)));
    const sphereZ = new THREE.Sphere(new THREE.Vector3(nextPosZ.x, playerHeight, nextPosZ.z), playerBoundingRadius);
    let blockedZ = false;
    for (let i = 0; i < collidableBoxes.length; i++) {
      if (collidableBoxes[i].intersectsSphere(sphereZ)) {
        blockedZ = true;
        break;
      }
    }
    if (!blockedZ) {
      controls.moveForward(deltaZ);
    } else {
      velocity.z = 0;
    }
  }

  prevTime = time;
  renderer.render(scene, camera);
}
