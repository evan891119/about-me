// Import THREE from import map
// Import core Three.js from import map
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import RAPIER from 'https://cdn.skypack.dev/@dimforge/rapier3d-compat';
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
let rapierWorld, controller, playerRB, playerCol; // Rapier 物理
const WALK_SPEED   = 6;     // 地面速度（m/s）
const AIR_MULT     = 0.35;  // 空中速度比例
const SPRINT_MULT  = 1.5;   // 衝刺倍數
let sprinting = false;

// Dynamic sky and starfield
// Dynamic sky, starfield and moon
let sky, stars, moon;
// Offscreen canvas and drawing function for moon phases
let moonCanvas, moonCtx, moonTexture, drawMoonPhase;

// 管理所有門（mesh + pivot + 其對應的 Rapier 剛體）
const doorEntries = [];

// 小工具：lerp + 平滑曲線
function lerp(a, b, t) { return a + (b - a) * t; }
function easeInOut(t) { return t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2)/2; }

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
// let world, playerBody;
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
    init().then(() => animate());
} else {
    // Add WebGL error message to the page
    const warning = WebGL.getWebGLErrorMessage();
    warning.style.position = 'absolute';
    warning.style.top = '0';
    warning.style.left = '0';
    document.body.appendChild(warning);
}

async function init() {
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
    await RAPIER.init();                           // 先初始化 WASM
    rapierWorld = new RAPIER.World({ x:0, y:-30, z:0 });
    const worldData = buildWorld({ scene, collidableMeshes, collidableBoxes, cameraHeight, playerBoundingRadius });
    // ⬇️ 取出 world，僅用於 createHouse 內部加 Cannon 靜態 colliders
    const world = worldData.world;

    // 建立 KCC（人物高與半徑沿用 playerHeight / playerBoundingRadius）
    const capHalfHeight = (playerHeight - 2 * playerBoundingRadius) / 2;
    controller = rapierWorld.createCharacterController(0.01); // 最小間隙
    controller.setUp({ x:0, y:1, z:0 });
    controller.enableAutostep(0.35, 0.25, true);
    controller.enableSnapToGround(0.5);
    controller.setMaxSlopeClimbAngle(Math.PI/3);
    controller.setMinSlopeSlideAngle(Math.PI/6);

    // 玩家剛體（Kinematic）
    const rbDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, cameraHeight, 5);
    playerRB  = rapierWorld.createRigidBody(rbDesc);
    // 玩家膠囊碰撞器
    playerCol = rapierWorld.createCollider(
    RAPIER.ColliderDesc.capsule(capHalfHeight, playerBoundingRadius),
    playerRB
    );
    // world = worldData.world;
    // playerBody = worldData.playerBody;
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

    // 地面（對應 200x200 floor）
    rapierWorld.createCollider(
        RAPIER.ColliderDesc.cuboid(200/2, 0.05, 200/2).setTranslation(0, -0.05, 0)
    );
    // 路面（road 長 200、寬 6）
    rapierWorld.createCollider(
        RAPIER.ColliderDesc.cuboid(6/2, 0.01, 200/2).setTranslation(0, 0.005, 0)
    );

    function addColliderForBoxMesh(mesh){
        mesh.updateWorldMatrix(true, true);
        const bbox  = new THREE.Box3().setFromObject(mesh);
        const half  = new THREE.Vector3().subVectors(bbox.max, bbox.min).multiplyScalar(0.5);
        const center= bbox.getCenter(new THREE.Vector3());
        const q = new THREE.Quaternion(); mesh.getWorldQuaternion(q);

        rapierWorld.createCollider(
        RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z)
            .setTranslation(center.x, center.y, center.z)
            .setRotation({ x:q.x, y:q.y, z:q.z, w:q.w })
        );
    }

    function makeKinematicDoorCollider(mesh) {
        const pivot = mesh.userData.doorPivot;
        if (!pivot) return;

        // 由幾何參數取得半尺寸（比 AABB 精準）
        const gp = mesh.geometry?.parameters || {};
        const half = {
            x: (gp.width  ?? 0.5) / 2,
            y: (gp.height ?? 1.8) / 2,
            z: (gp.depth  ?? 0.05) / 2,
        };

        // 讀取門板目前世界姿態
        mesh.updateWorldMatrix(true, true);
        const pos = new THREE.Vector3(); mesh.getWorldPosition(pos);
        const q   = new THREE.Quaternion(); mesh.getWorldQuaternion(q);

        // 建立 kinematic 剛體 + cuboid collider（與門板同姿態）
        const rbDesc = RAPIER.RigidBodyDesc
            .kinematicPositionBased()
            .setTranslation(pos.x, pos.y, pos.z)
            .setRotation({ x:q.x, y:q.y, z:q.z, w:q.w });
        const rb  = rapierWorld.createRigidBody(rbDesc);
        const col = rapierWorld.createCollider(
            RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z),
            rb
        );

        // 存參考，動畫時用
        mesh.userData.doorRB = rb;
        mesh.userData.doorCollider = col;

        // 動畫狀態預設值（若 createHouse 已設 isOpen=false 會沿用）
        pivot.userData.animating = false;
        pivot.userData.animTime = 0;
        pivot.userData.animDuration = 0.6; // 動畫秒數
        // 註冊進門清單，animate() 會每幀同步碰撞器
        doorEntries.push({ mesh, pivot, rb });
    }

    // 1) 一般方塊/牆：轉成 Rapier 靜態 collider（略過門）
    collidableMeshes.forEach(m => {
        if (m.userData?.isDoor) return; // 門另建 collider
        if (m.geometry?.parameters?.width !== undefined) addColliderForBoxMesh(m); // BoxGeometry
    });
    // 2) 門：建立單一 kinematic 碰撞器，之後每幀同步
    collidableMeshes.forEach(m => {
    if (m.userData?.isDoor) makeKinematicDoorCollider(m);
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
    scene.add(controls.getObject());
    const blocker = document.getElementById('blocker');
    if (blocker) {
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
    } else {
        console.warn('#blocker not found — pointer-lock overlay disabled');
        // 沒有 blocker 的備案：第一次點擊畫面就嘗試鎖定
        document.body.addEventListener('click', () => controls.lock(), { once: true });
    }
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
            case 'ShiftLeft':
            case 'ShiftRight':
                sprinting = true; break;

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
            case 'ShiftLeft':
            case 'ShiftRight':
                sprinting = false; break;
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
    if (event.button !== 0) return;

    const mouse = new THREE.Vector2(0, 0);
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(collidableMeshes, true);
    if (hits.length === 0) return;

    // 可能打到子物件 → 往上找 isDoor
    let obj = hits[0].object;
    while (obj && !obj.userData?.isDoor) obj = obj.parent;

    if (!(obj && obj.userData.isDoor && obj.userData.doorPivot)) return;

    const pivot = obj.userData.doorPivot;

    //  距離限制：玩家到門樞軸 ≤ 2m 才能互動
    const hingePos = new THREE.Vector3(); pivot.getWorldPosition(hingePos);
    const pp = playerRB.translation();
    const playerPos = new THREE.Vector3(pp.x, pp.y, pp.z);
    const dist = hingePos.distanceTo(playerPos);
    if (dist > 5.0) {
        console.log(`Too far to open door: ${dist.toFixed(2)}m`);
        return;
    }

    // 啟動平滑動畫：僅設定目標，不立刻瞬移
    const open = !pivot.userData.isOpen;
    pivot.userData.isOpen = open;
    pivot.userData.animFrom = pivot.rotation.y;
    pivot.userData.animTo   = open ? (pivot.userData.openRotation ?? -Math.PI/2)
                                    : (pivot.userData.closedRotation ?? 0);
    pivot.userData.animTime = 0;
    pivot.userData.animating = true;

    console.log(open ? 'Door opening...' : 'Door closing...');
}


function animate() {
    requestAnimationFrame(animate);

    // 尚未完成初始化就先畫一幀避免報錯
    if (!controls || !playerRB || !rapierWorld) {
        renderer.render(scene, camera);
        return;
    }

    // === Rapier KCC 核心 ===
    const time = performance.now();
    const dt = Math.min((time - prevTime) / 1000, 0.05);
    prevTime = time;

    // 方向計算（沿用原本的 forward/right）
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    const moveDir = new THREE.Vector3();
    if (moveForward) moveDir.add(forward);
    if (moveBackward) moveDir.sub(forward);
    if (moveRight) moveDir.add(right);
    if (moveLeft) moveDir.sub(right);
    if (moveDir.lengthSq() > 0) moveDir.normalize();

    // 著地偵測（往下 cast 0.2m）
    const pos = playerRB.translation();
    const ray = new RAPIER.Ray({ x: pos.x, y: pos.y, z: pos.z }, { x: 0, y: -1, z: 0 });
    const hit = rapierWorld.castRay(ray, 0.2, true);
    const grounded = !!hit;

    // 跳躍與重力
    const base = grounded ? WALK_SPEED : WALK_SPEED * AIR_MULT;
    const speed = base * (sprinting ? SPRINT_MULT : 1);

    if (jumpRequested && grounded) {
        velocityY = JUMP_SPEED;
        jumpRequested = false;
    }
    velocityY -= GRAVITY * dt;

    // 期望位移 → KCC 修正
    const desired = {
        x: moveDir.x * speed * dt,
        y: velocityY * dt,
        z: moveDir.z * speed * dt
    };

    controller.computeColliderMovement(playerCol, desired);
    const corrected = controller.computedMovement();

    // 若往下移動被顯著截斷，視為落地，清掉下落速度
    if (desired.y < 0 && corrected.y > desired.y * 0.5) {
    velocityY = 0;
    }

    // 套用到 kinematic 剛體
    playerRB.setNextKinematicTranslation({
        x: pos.x + corrected.x,
        y: pos.y + corrected.y,
        z: pos.z + corrected.z
    });

    // 物理步進（Rapier）
    rapierWorld.step();

    // === 視覺同步 & 其它 ===

    // 相機跟隨玩家
    const p = playerRB.translation();
    controls.getObject().position.set(p.x, p.y, p.z);

    // 更新手電筒位置與目標
    const camPos = new THREE.Vector3();
    camera.getWorldPosition(camPos);
    flashlight.position.copy(camPos);

    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    flashlightTarget.position.copy(camPos).add(dir.multiplyScalar(10));

    // 右上角座標顯示
    if (coordsDiv) {
        coordsDiv.innerText = `x:${p.x.toFixed(2)} y:${p.y.toFixed(2)} z:${p.z.toFixed(2)}`;
    }

    // === 平滑門動畫 & 碰撞器同步 ===
    for (const entry of doorEntries) {
        const { mesh, pivot, rb } = entry;

        if (pivot.userData.animating) {
            pivot.userData.animTime = Math.min(
            pivot.userData.animTime + dt,
            pivot.userData.animDuration
            );
            const t = pivot.userData.animTime / pivot.userData.animDuration;
            const tt = easeInOut(t);                    // 平滑曲線
            const angle = lerp(pivot.userData.animFrom, pivot.userData.animTo, tt);
            pivot.rotation.y = angle;
            if (t >= 1) pivot.userData.animating = false;
        }

        // 同步 kinematic 剛體到門板當前世界姿態
        pivot.updateMatrixWorld(true);
        mesh.updateWorldMatrix(true, true);
        const pos = new THREE.Vector3(); mesh.getWorldPosition(pos);
        const q   = new THREE.Quaternion(); mesh.getWorldQuaternion(q);
        rb.setNextKinematicTranslation({ x: pos.x, y: pos.y, z: pos.z });
        rb.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    }

    // 日夜循環
    updateLighting();

    // 繪製
    renderer.render(scene, camera);
}
