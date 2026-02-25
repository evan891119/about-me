import * as THREE from 'three';
import { HOUSE_CONFIGS, HOUSE_LAYOUT, PROP_LAYOUT } from '../content.js';
import { PLAYER, VISUAL } from '../config.js';

const sharedTextureLoader = new THREE.TextureLoader();
const boxGeometryCache = new Map();

function getBoxGeometry(width, height, depth) {
  const key = `${width}|${height}|${depth}`;
  let geo = boxGeometryCache.get(key);
  if (!geo) {
    geo = new THREE.BoxGeometry(width, height, depth);
    boxGeometryCache.set(key, geo);
  }
  return geo;
}

/**
 * 建立場景幾何（純視覺，不含 Rapier），回傳：
 *  - collidableMeshes：可供 raycast / 之後建立靜態碰撞
 *  - doors：{ mesh, pivot }（給 DoorSystem）
 *  - streetLights：THREE.PointLight[]（給 SkySystem 控制日夜亮度）
 */
export async function buildWorld(scene, options = {}) {
  const {
    groundSize = 200,
    groundRepeat = 20,
    groundTexture = 'images/floor_tile.jpg',
    maxAnisotropy = 8,             // 從 app.renderer.capabilities.getMaxAnisotropy() 傳入
    roadWidth = 6,
    roadLength = 200,

    streetLight = {}               // 路燈參數可覆寫
  } = options;

  const {
    spacing = 20,
    sideOffset = roadWidth / 2 + 1,
    poleHeight = 5,
    poleRadius = 0.05,
    lampRadius = 0.2,
    lightRange = 20,
    baseIntensity = 1
  } = streetLight;

  const collidableMeshes = [];
  const doors = [];
  const streetLights = [];

  // === 地面（貼圖 + 重複 + 各向異性） ===
  {
    const geo = new THREE.PlaneGeometry(groundSize, groundSize);
    const tex = sharedTextureLoader.load(groundTexture, (t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(groundRepeat, groundRepeat);
      t.anisotropy = maxAnisotropy;              // 直接設，Renderer 會自動 clamp
    });
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      color: VISUAL.materials.ground.color,
      roughness: VISUAL.materials.ground.roughness,
      metalness: VISUAL.materials.ground.metalness,
    });
    const floor = new THREE.Mesh(geo, mat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
  }

  // === 道路 ===
  {
    const geo = new THREE.PlaneGeometry(roadWidth, roadLength);
    const mat = new THREE.MeshStandardMaterial({
      color: VISUAL.materials.road.color,
      roughness: VISUAL.materials.road.roughness,
      metalness: VISUAL.materials.road.metalness,
    });
    const road = new THREE.Mesh(geo, mat);
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.01;
    road.receiveShadow = true;
    scene.add(road);
  }

  // === 路燈（兩側等距放置） ===
  const poleGeometry = new THREE.CylinderGeometry(poleRadius, poleRadius, poleHeight);
  const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x5f5a56, roughness: 0.86, metalness: 0.1 });
  const lampGeometry = new THREE.SphereGeometry(lampRadius, 8, 8);
  const lampMaterial = new THREE.MeshStandardMaterial({ color: 0xfff2cf, emissive: 0xffd89a, emissiveIntensity: 1.25, roughness: 0.72, metalness: 0.05 });

  for (let z = -roadLength / 2 + spacing / 2; z <= roadLength / 2 - spacing / 2; z += spacing) {
    for (const side of [-1, 1]) {
      const x = side * sideOffset;

      // pole
      const pole = new THREE.Mesh(poleGeometry, poleMaterial);
      pole.position.set(x, poleHeight / 2, z);
      scene.add(pole);

      // lamp mesh
      const lamp = new THREE.Mesh(lampGeometry, lampMaterial);
      lamp.position.set(x, poleHeight + lampRadius, z);
      scene.add(lamp);

      // point light
      const light = new THREE.PointLight(0xffd9a8, baseIntensity, lightRange);
      light.position.copy(lamp.position);
      light.userData.baseIntensity = baseIntensity;  // 給 SkySystem 夜間用
      scene.add(light);
      streetLights.push(light);
    }
  }

  // === 房子們（內容由 content.js 提供） ===
  const houseOffset = HOUSE_LAYOUT.houseOffset ?? 6;
  const zPositions = HOUSE_LAYOUT.zPositions ?? [-15, 5];
  const fallbackZ = zPositions[0] ?? 0;

  const houseConfigs = HOUSE_CONFIGS.map((cfg) => {
    const lane = cfg.lane ?? -1;
    const row = cfg.row ?? 0;
    const x = lane * houseOffset;
    const z = zPositions[row] ?? fallbackZ;

    return {
      ...cfg,
      position: new THREE.Vector3(x, 0, z),
    };
  });

  houseConfigs.forEach(cfg => {
    const { group, collidables, doorPair } = createHouseVisual(cfg, { textureLoader: sharedTextureLoader });
    group.position.copy(cfg.position);
    scene.add(group);

    collidableMeshes.push(...collidables);
    if (doorPair) doors.push(doorPair);
  });

  if (VISUAL.propsDensity.enabled) {
    const propGroup = buildPropClusters(roadWidth);
    scene.add(propGroup);
  }

  return { collidableMeshes, doors, streetLights };
}

/** 純視覺版房子，包含門的 userData（isDoor/doorPivot） */
function createHouseVisual({
  width = 4, height = 2.5, depth = 8,
  wallColor = 0xFFFFFF, roofColor = 0x882200,
  sign = null, interior = null
} = {}, { textureLoader = sharedTextureLoader } = {}) {
  const group = new THREE.Group();
  const collidables = [];

  // 尺寸
  const doorWidth = width * 0.4;
  // 門高至少要讓玩家膠囊體能通過（否則會卡在門框）
  const minDoorHeight = PLAYER.height + 0.2;
  const doorHeight = Math.max(height * 0.75, minDoorHeight);
  const doorThickness = 0.05;

  // 屋頂（四面）
  {
    const roofHeight = height * 0.6;
    const apexY = height + roofHeight;
    const halfW = width / 2;
    const halfD = depth / 2;
    const vertices = new Float32Array([
      // front
      0, apexY, 0,   halfW, height, -halfD,   -halfW, height, -halfD,
      // right
      0, apexY, 0,   halfW, height,  halfD,    halfW, height, -halfD,
      // back
      0, apexY, 0,   -halfW, height, halfD,    halfW, height,  halfD,
      // left
      0, apexY, 0,   -halfW, height, -halfD,  -halfW, height,  halfD,
    ]);
    const roofGeo = new THREE.BufferGeometry();
    roofGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    roofGeo.computeVertexNormals();
    const roofMat = new THREE.MeshStandardMaterial({
      color: roofColor,
      side: THREE.DoubleSide,
      roughness: VISUAL.materials.roofRoughness,
      metalness: VISUAL.materials.roofMetalness,
    });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.castShadow = roof.receiveShadow = true;
    group.add(roof);
    collidables.push(roof);
  }

  const panelMat = new THREE.MeshStandardMaterial({
    color: wallColor,
    roughness: VISUAL.materials.wallRoughness,
    metalness: VISUAL.materials.wallMetalness,
  });

  // 前牆（左右 + 上方招牌）
  {
    const panelThickness = doorThickness;
    const leftPanelWidth = (width - doorWidth) / 2;

    const leftPanel = new THREE.Mesh(
      getBoxGeometry(leftPanelWidth, height, panelThickness),
      panelMat
    );
    leftPanel.position.set(-doorWidth/2 - leftPanelWidth/2, height/2, depth/2 - panelThickness/2);
    leftPanel.castShadow = leftPanel.receiveShadow = true;
    group.add(leftPanel);
    collidables.push(leftPanel);

    const rightPanel = new THREE.Mesh(
      getBoxGeometry(leftPanelWidth, height, panelThickness),
      panelMat
    );
    rightPanel.position.set(doorWidth/2 + leftPanelWidth/2, height/2, depth/2 - panelThickness/2);
    rightPanel.castShadow = rightPanel.receiveShadow = true;
    group.add(rightPanel);
    collidables.push(rightPanel);

    const headerHeight = height - doorHeight;
    const headerGeo = getBoxGeometry(doorWidth, headerHeight, panelThickness);
    let headerPanel;
    if (sign) {
      let tex;
      if (sign.type === 'text') {
        const c = document.createElement('canvas'); c.width = 512; c.height = 256;
        const ctx = c.getContext('2d');
        ctx.fillStyle = sign.backgroundColor || '#ffffff'; ctx.fillRect(0,0,c.width,c.height);
        ctx.fillStyle = sign.color || '#000000';
        ctx.font = sign.font || '48px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(sign.text, c.width/2, c.height/2);
        tex = new THREE.CanvasTexture(c); tex.needsUpdate = true;
      } else if (sign.type === 'image') {
        tex = textureLoader.load(sign.src);
      }
      const blank = panelMat;
      const signMat = new THREE.MeshStandardMaterial({
        map: tex,
        side: THREE.FrontSide,
        roughness: 0.8,
        metalness: 0.02,
      });
      const mats = [blank, blank, blank, blank, signMat, blank];
      headerPanel = new THREE.Mesh(headerGeo, mats);
    } else {
      headerPanel = new THREE.Mesh(headerGeo, panelMat);
    }
    headerPanel.position.set(0, doorHeight + headerHeight/2, depth/2 - panelThickness/2);
    headerPanel.castShadow = headerPanel.receiveShadow = true;
    group.add(headerPanel);
    collidables.push(headerPanel);
  }

  // 後牆
  {
    const panelThickness = doorThickness;
    const backGeo = getBoxGeometry(width, height, panelThickness);
    let backPanel;
    if (interior?.back) {
      let tex;
      if (interior.back.type === 'text') {
        const c = document.createElement('canvas'); c.width = 512; c.height = 256;
        const ctx = c.getContext('2d');
        ctx.fillStyle = interior.back.backgroundColor || '#ffffff'; ctx.fillRect(0,0,c.width,c.height);
        ctx.fillStyle = interior.back.color || '#000000';
        ctx.font = interior.back.font || '48px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(interior.back.text, c.width/2, c.height/2);
        tex = new THREE.CanvasTexture(c); tex.needsUpdate = true;
      } else if (interior.back.type === 'image') {
        tex = textureLoader.load(interior.back.src);
      }
      const blank = panelMat;
      const interiorMat = new THREE.MeshStandardMaterial({
        map: tex,
        side: THREE.FrontSide,
        roughness: 0.82,
        metalness: 0.02,
      });
      const mats = [blank, blank, blank, blank, interiorMat, blank];
      backPanel = new THREE.Mesh(backGeo, mats);
    } else {
      backPanel = new THREE.Mesh(backGeo, panelMat);
    }
    backPanel.position.set(0, height/2, -depth/2 + panelThickness/2);
    backPanel.castShadow = backPanel.receiveShadow = true;
    group.add(backPanel);
    collidables.push(backPanel);
  }

  // 左右側牆
  {
    const panelThickness = doorThickness;

    const leftSide = new THREE.Mesh(
      getBoxGeometry(panelThickness, height, depth),
      panelMat
    );
    leftSide.position.set(-width/2 + panelThickness/2, height/2, 0);
    leftSide.castShadow = leftSide.receiveShadow = true;
    group.add(leftSide);
    collidables.push(leftSide);

    const rightSide = new THREE.Mesh(
      getBoxGeometry(panelThickness, height, depth),
      panelMat
    );
    rightSide.position.set(width/2 - panelThickness/2, height/2, 0);
    rightSide.castShadow = rightSide.receiveShadow = true;
    group.add(rightSide);
    collidables.push(rightSide);
  }

  // 門（pivot + mesh + userData）
  let doorPair = null;
  {
    const doorPivot = new THREE.Object3D();
    doorPivot.position.set(-doorWidth/2, 0, depth/2);
    group.add(doorPivot);

    const doorGeo = getBoxGeometry(doorWidth, doorHeight, doorThickness);
    const doorMat = new THREE.MeshStandardMaterial({
      color: VISUAL.materials.doorColor,
      roughness: 0.78,
      metalness: 0.04,
    });
    const doorMesh = new THREE.Mesh(doorGeo, doorMat);
    doorMesh.position.set(doorWidth/2, doorHeight/2, doorThickness/2);
    doorMesh.castShadow = doorMesh.receiveShadow = true;
    doorPivot.add(doorMesh);

    doorMesh.userData.isDoor = true;
    doorMesh.userData.doorPivot = doorPivot;
    doorPivot.userData.isOpen = false;
    doorPivot.userData.closedRotation = 0;
    doorPivot.userData.openRotation = -Math.PI / 2;

    collidables.push(doorMesh);
    doorPair = { mesh: doorMesh, pivot: doorPivot };
  }

  return { group, collidables, doorPair };
}

function buildPropClusters(roadWidth) {
  const group = new THREE.Group();
  const mul = Math.max(0.2, VISUAL.propsDensity.multiplier ?? 1);
  const palette = {
    crate: new THREE.MeshStandardMaterial({ color: 0x8f6a47, roughness: 0.86, metalness: 0.02 }),
    crateDark: new THREE.MeshStandardMaterial({ color: 0x6a4a35, roughness: 0.9, metalness: 0.02 }),
    barrel: new THREE.MeshStandardMaterial({ color: 0x636a72, roughness: 0.8, metalness: 0.14 }),
    fence: new THREE.MeshStandardMaterial({ color: 0x5d4a3a, roughness: 0.9, metalness: 0.03 }),
    sign: new THREE.MeshStandardMaterial({ color: 0xb88f4e, roughness: 0.78, metalness: 0.05 }),
    trunk: new THREE.MeshStandardMaterial({ color: 0x5b4430, roughness: 0.92, metalness: 0.01 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x7e9b58, roughness: 0.9, metalness: 0.01 }),
    grass: new THREE.MeshStandardMaterial({ color: 0x92a85a, roughness: 0.95, metalness: 0.0 }),
  };

  PROP_LAYOUT.forEach((zone, zoneIndex) => {
    const rng = mulberry32(hashString(`${zone.id}-${zoneIndex}`));
    const count = Math.max(1, Math.round((zone.count ?? 8) * mul));
    for (let i = 0; i < count; i++) {
      const prefabType = zone.prefabs[Math.floor(rng() * zone.prefabs.length)];
      const prefab = createPropPrefab(prefabType, palette, rng);
      if (!prefab) continue;
      const offX = (rng() * 2 - 1) * (zone.spread?.x ?? 3);
      const offZ = (rng() * 2 - 1) * (zone.spread?.z ?? 3);
      const x = zone.position.x + offX;
      const z = zone.position.z + offZ;
      if (Math.abs(x) < roadWidth * 0.65) continue;
      prefab.position.set(x, 0, z);
      prefab.rotation.y = rng() * Math.PI * 2;
      group.add(prefab);
    }
  });

  return group;
}

function createPropPrefab(type, m, rng) {
  if (type === 'crate') return createCrateStack(m, rng);
  if (type === 'barrel') return createBarrelCluster(m, rng);
  if (type === 'fence') return createFenceSign(m, rng);
  if (type === 'tree') return createTree(m, rng);
  if (type === 'grass') return createGrassPatch(m, rng);
  return null;
}

function createCrateStack(m, rng) {
  const g = new THREE.Group();
  const count = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < count; i++) {
    const w = 0.45 + rng() * 0.35;
    const h = 0.38 + rng() * 0.28;
    const d = 0.45 + rng() * 0.35;
    const mesh = new THREE.Mesh(getBoxGeometry(w, h, d), i % 2 === 0 ? m.crate : m.crateDark);
    mesh.position.set((rng() * 2 - 1) * 0.35, h / 2 + i * (h * 0.78), (rng() * 2 - 1) * 0.35);
    mesh.castShadow = mesh.receiveShadow = true;
    g.add(mesh);
  }
  return g;
}

function createBarrelCluster(m, rng) {
  const g = new THREE.Group();
  const count = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < count; i++) {
    const radius = 0.18 + rng() * 0.05;
    const h = 0.48 + rng() * 0.16;
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, h, 8), m.barrel);
    mesh.position.set((rng() * 2 - 1) * 0.32, h / 2, (rng() * 2 - 1) * 0.32);
    mesh.castShadow = mesh.receiveShadow = true;
    g.add(mesh);
  }
  return g;
}

function createFenceSign(m, rng) {
  const g = new THREE.Group();
  const postH = 1.1 + rng() * 0.4;
  const postA = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, postH, 6), m.fence);
  const postB = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, postH, 6), m.fence);
  postA.position.set(-0.42, postH / 2, 0);
  postB.position.set(0.42, postH / 2, 0);
  const board = new THREE.Mesh(getBoxGeometry(0.9, 0.32, 0.08), m.sign);
  board.position.set(0, postH * 0.72, 0);
  [postA, postB, board].forEach((x) => {
    x.castShadow = x.receiveShadow = true;
    g.add(x);
  });
  return g;
}

function createTree(m, rng) {
  const g = new THREE.Group();
  const trunkH = 0.75 + rng() * 0.35;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, trunkH, 7), m.trunk);
  trunk.position.y = trunkH / 2;

  const coneA = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.75, 8), m.leaf);
  const coneB = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.62, 8), m.leaf);
  coneA.position.y = trunkH + 0.28;
  coneB.position.y = trunkH + 0.72;

  [trunk, coneA, coneB].forEach((x) => {
    x.castShadow = x.receiveShadow = true;
    g.add(x);
  });
  return g;
}

function createGrassPatch(m, rng) {
  const g = new THREE.Group();
  const blades = 4 + Math.floor(rng() * 4);
  for (let i = 0; i < blades; i++) {
    const h = 0.28 + rng() * 0.22;
    const blade = new THREE.Mesh(getBoxGeometry(0.05, h, 0.01), m.grass);
    blade.position.set((rng() * 2 - 1) * 0.35, h / 2, (rng() * 2 - 1) * 0.35);
    blade.rotation.y = rng() * Math.PI;
    blade.castShadow = blade.receiveShadow = true;
    g.add(blade);
  }
  return g;
}

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  return function next() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
