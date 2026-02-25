import * as THREE from 'three';
import { HOUSE_CONFIGS, HOUSE_LAYOUT } from '../content.js';
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
