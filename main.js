// Import THREE from import map
// Import core Three.js from import map
import * as THREE from 'three';
import { PointerLockControls } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/controls/PointerLockControls.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/loaders/GLTFLoader.js';
// Import WebGL detection helper
// WebGL detection helper (default export)
import WebGL from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/capabilities/WebGL.js';

let camera, scene, renderer, controls;
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let prevTime = performance.now();
let velocity = new THREE.Vector3();

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

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  ['red', 'green', 'blue'].forEach((color, i) => {
    const mat = new THREE.MeshStandardMaterial({ color });
    const mesh = new THREE.Mesh(boxGeo, mat);
    mesh.position.set(i * 2 - 2, 0.5, -5);
    scene.add(mesh);
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

  controls.moveRight(-velocity.x * delta);
  controls.moveForward(-velocity.z * delta);

  prevTime = time;
  renderer.render(scene, camera);
}
