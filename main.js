// Import THREE from import map
// Import core Three.js from import map
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PointerLockControls } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/controls/PointerLockControls.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/loaders/GLTFLoader.js';
// Import WebGL detection helper
// WebGL detection helper (default export)
import WebGL from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/capabilities/WebGL.js';
// Moon position calculations
import { getMoonPosition, getMoonIllumination } from 'https://cdn.skypack.dev/suncalc';
// Sky shader for dynamic sky
import { Sky } from 'https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/objects/Sky.js';
import { buildWorld, createHouse } from './worldBuilder.js';

// Core components
// Core components
let camera, scene, renderer, controls;
// Dynamic sky and starfield
// Dynamic sky, starfield and moon
let sky, stars, moon;
// Offscreen canvas and drawing function for moon phases
let moonCanvas, moonCtx, moonTexture, drawMoonPhase;
// Flashlight (spotlight) to follow camera
let flashlight, flashlightTarget;
// Light components and colors for day/night cycle
let hemiLight, dirLight;
const daySkyColor = new THREE.Color(0x87CEEB);
const nightSkyColor = new THREE.Color(0x050D2B);
const dayLightColor = new THREE.Color(0xFFFFFF);
const nightLightColor = new THREE.Color(0x666699);
const dayGroundColor = new THREE.Color(0x444444);
const nightGroundColor = new THREE.Color(0x111111);
/**
 * Updates lighting and sky background based on current system time.
 */
function updateLighting() {
  if (!dirLight || !hemiLight || !scene) return;
  // Use actual current date and time for sun and moon calculations
  // Use current date/time for sun and moon calculations
  const now = new Date();
  const hours = now.getHours() + now.getMinutes() / 60;
  const angle = (hours / 24) * Math.PI * 2 - Math.PI / 2;
  const sunX = Math.cos(angle) * 100;
  const sunY = Math.sin(angle) * 100;
  dirLight.position.set(sunX, sunY, -30);
  const sunIntensity = Math.max(Math.sin(angle), 0);
  dirLight.intensity = sunIntensity;
  dirLight.color.lerpColors(nightLightColor, dayLightColor, sunIntensity);
  const hemiIntensity = sunIntensity * 0.5 + 0.2;
  hemiLight.intensity = hemiIntensity;
  hemiLight.color.lerpColors(nightSkyColor, daySkyColor, sunIntensity);
  hemiLight.groundColor.lerpColors(nightGroundColor, dayGroundColor, sunIntensity);
  // Background handled by Sky shader; update its sun position and star visibility
  if (sky) sky.material.uniforms['sunPosition'].value.copy(dirLight.position);
  if (stars) stars.visible = (sunIntensity < 0.2);
  // Update moon position and visibility based on current time and sphere radius
  if (moon) {
    const moonPos = getMoonPosition(now, 25.0330, 121.5654); // latitude and longitude default to 0 if not provided
    const mAz = moonPos.azimuth;
    const mAlt = moonPos.altitude;
    const r = 400;
    const mx = r * Math.cos(mAlt) * Math.sin(mAz);
    const my = r * Math.sin(mAlt);
    const mz = r * Math.cos(mAlt) * Math.cos(mAz);
    moon.position.set(mx, my, mz);
    moon.visible = mAlt > 0;
    // Update moon phase shading based on current date
    const illum = getMoonIllumination(now);
    drawMoonPhase(illum.fraction);
    // Adjust moon scale: base on real angular diameter (~0.5°) but scaled up for visibility
    const angularDiameter = 0.5 * Math.PI / 180;
    const diameter = 2 * r * Math.tan(angularDiameter / 2);
    // scaleFactor tweaks visual size; ~6000 yields a similar size to original default
    const scaleFactor = 6;
    moon.scale.set(diameter * scaleFactor, diameter * scaleFactor, 1);
  }
  // Adjust street lights brightness: on at night, off during day
  streetLights.forEach(light => {
    light.intensity = light.userData.baseIntensity * (1 - sunIntensity);
  });
}
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
// Street lights (collected from worldBuilder)
let streetLights = [];
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
  // Scene and dynamic sky background
  scene = new THREE.Scene();
  // Remove default background color; use Sky shader
  scene.background = null;
  // Add dynamic sky
  sky = new Sky();
  sky.scale.setScalar(450000);
  scene.add(sky);
  const skyUniforms = sky.material.uniforms;
  skyUniforms['turbidity'].value = 10;
  skyUniforms['rayleigh'].value = 2;
  skyUniforms['mieCoefficient'].value = 0.005;
  skyUniforms['mieDirectionalG'].value = 0.8;
  // Starfield: randomly distributed points on a sphere at radius 400
  {
    const starCount = 10000;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 400;
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starPositions[i * 3 + 2] = r * Math.cos(phi);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 1, sizeAttenuation: false });
    stars = new THREE.Points(starGeometry, starMaterial);
    stars.visible = false;
    scene.add(stars);
  }
  // Moon sprite with phase support
  {
    // Offscreen canvas for moon rendering
    moonCanvas = document.createElement('canvas');
    moonCanvas.width = moonCanvas.height = 256;
    moonCtx = moonCanvas.getContext('2d');
    // Create texture and sprite
    moonTexture = new THREE.CanvasTexture(moonCanvas);
    const moonMaterial = new THREE.SpriteMaterial({ map: moonTexture, transparent: true });
    moon = new THREE.Sprite(moonMaterial);
    // Initial scale; will be updated in updateLighting
    moon.scale.set(20000, 20000, 1);
    scene.add(moon);
    // Drawing function for moon phase
    drawMoonPhase = function(fraction) {
      const cx = 128, cy = 128, r = 128;
      moonCtx.clearRect(0, 0, 256, 256);
      // Base glow gradient
      const grad = moonCtx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r);
      grad.addColorStop(0, 'rgba(255,255,220,1)');
      grad.addColorStop(1, 'rgba(255,255,220,0)');
      moonCtx.fillStyle = grad;
      moonCtx.beginPath();
      moonCtx.arc(cx, cy, r, 0, Math.PI * 2);
      moonCtx.fill();
      // Shadow mask (remove illuminated fraction)
      moonCtx.globalCompositeOperation = 'destination-out';
      const offsetX = 2 * r * fraction;
      moonCtx.beginPath();
      moonCtx.arc(cx + offsetX, cy, r, 0, Math.PI * 2);
      moonCtx.fill();
      moonCtx.globalCompositeOperation = 'source-over';
      moonTexture.needsUpdate = true;
    };
    // Initial phase draw
    const illum = getMoonIllumination(new Date());
    drawMoonPhase(illum.fraction);
  }

  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 1.6, 5);

  hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
  hemiLight.position.set(0, 20, 0);
  scene.add(hemiLight);

  dirLight = new THREE.DirectionalLight(0xffffff);
  dirLight.position.set(-3, 10, -10);
  scene.add(dirLight);

  // Initialize lighting based on current time
  updateLighting();
  // Build world geometry and physics bodies
  const worldData = buildWorld({ scene, collidableMeshes, collidableBoxes, cameraHeight, playerBoundingRadius });
  world = worldData.world;
  playerBody = worldData.playerBody;
  // Retrieve street lights created in worldBuilder
  streetLights = worldData.streetLights || [];
  // Create houses with customizable intro content
  const houseOffset = 6; // horizontal distance from center of the road
  // z positions for house rows
  const zPositions = [-15, 5];
  // Define configuration for each house (position, signboard content, and interior content)
  const houseConfigs = [
    {
      position: new THREE.Vector3(-houseOffset, 0, zPositions[0]),
      sign: {
        type: 'text',
        text: '歡迎來到我的3D世界',
        color: '#000000',
        backgroundColor: '#ffffff',
        font: '48px Arial'
      },
      interior: {
        back: { type: 'image', src: 'images/photo1.png' }
      }
    },
    {
      position: new THREE.Vector3(houseOffset, 0, zPositions[0]),
      sign: { type: 'image', src: 'images/photo1.png' },
      interior: {
        back: {
          type: 'text',
          text: '這是房子裡面的文字內容',
          color: '#000000',
          backgroundColor: '#ffffff',
          font: '24px sans-serif'
        }
      }
    },
    {
      position: new THREE.Vector3(-houseOffset, 0, zPositions[1]),
      sign: { type: 'image', src: 'images/photo1.png' },
      interior: { back: { type: 'image', src: 'images/photo1.png' } }
    },
    {
      position: new THREE.Vector3(houseOffset, 0, zPositions[1]),
      sign: {
        type: 'text',
        text: '我是張正誠，熱愛程式設計',
        color: '#ffffff',
        backgroundColor: '#000000',
        font: '36px sans-serif'
      },
      interior: {
        back: {
          type: 'text',
          text: '內部: 這裡是房子裡面',
          color: '#0000ff',
          backgroundColor: '#ffffff',
          font: '24px sans-serif'
        },
        left: {
          type: 'text',
          text: '內部: 這裡是房子左邊牆面',
          color: '#0000ff',
          backgroundColor: '#000000',
          font: '24px sans-serif'
        },
        right: {
          type: 'text',
          text: '內部: 這裡是房子右邊牆面',
          color: '#ffffff',
          backgroundColor: '#000000',
          font: '24px sans-serif'
        }
      }
    }
  ];
  houseConfigs.forEach(cfg => {
    createHouse(
      { scene, collidableMeshes, collidableBoxes, world },
      cfg
    );
  });
  // Setup flashlight (spotlight) to follow the camera
  flashlight = new THREE.SpotLight(0xffffff, 2, 30, Math.PI / 8, 0.5);
  flashlight.castShadow = true;
  scene.add(flashlight);
  flashlightTarget = new THREE.Object3D();
  scene.add(flashlightTarget);
  flashlight.target = flashlightTarget;

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
      case 'KeyE':
        // Toggle flashlight visibility on 'E' key press (once per press)
        if (!event.repeat) flashlight.visible = !flashlight.visible;
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
  // Listen for left-click to interact with objects
  document.addEventListener('mousedown', onMouseDown, false);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
/**
 * Handles mouse down events for object interaction via raycasting.
 */
function onMouseDown(event) {
  // 0: left button
  if (event.button !== 0) return;
  // Raycast from camera center
  const mouse = new THREE.Vector2(0, 0);
  raycaster.setFromCamera(mouse, camera);
  // Check intersections against interactable meshes
  const intersects = raycaster.intersectObjects(collidableMeshes, true);
  if (intersects.length > 0) {
    const obj = intersects[0].object;
    // Handle door interaction
    if (obj.userData.isDoor && obj.userData.doorPivot) {
      const pivot = obj.userData.doorPivot;
      const doorBody = obj.userData.doorBody;
      const open = !pivot.userData.isOpen;
      // Rotate door mesh
      pivot.rotation.y = open ? pivot.userData.openRotation : pivot.userData.closedRotation;
      pivot.userData.isOpen = open;
      // Toggle physics collision
      if (doorBody) {
        if (open) {
          world.removeBody(doorBody);
        } else {
          world.addBody(doorBody);
        }
      }
      console.log(open ? 'Door opened' : 'Door closed');
    } else {
      console.log('Clicked object:', obj);
    }
  } else {
    console.log('Clicked nothing');
  }
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
  // Apply movement with constant speed regardless of direction
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
  // Update flashlight position and target to follow camera direction
  // Get camera world position
  const camPos = new THREE.Vector3();
  camera.getWorldPosition(camPos);
  flashlight.position.copy(camPos);
  // Compute camera forward direction and position the flashlight target ahead
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  flashlightTarget.position.copy(camPos).add(dir.multiplyScalar(10));
  // Update coordinate display
  if (coordsDiv) {
    const p = playerBody.position;
    coordsDiv.innerText = `x:${p.x.toFixed(2)} y:${p.y.toFixed(2)} z:${p.z.toFixed(2)}`;
  }
  // Update lighting for day/night cycle
  updateLighting();
  renderer.render(scene, camera);
  return;
}
