import * as THREE from 'three';
import { MUSEUM_ZONES, PROP_LAYOUT } from '../content.js';
import { PLAYER, VISUAL, WORLD } from '../config.js';

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
 *  - museumAnchor：博物館世界位置資訊（給鏡頭與道具避讓）
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
      light.userData.baseDistance = lightRange;
      scene.add(light);
      streetLights.push(light);
    }
  }

  // === 單一大型博物館 ===
  const museum = createMuseumVisual();
  const museumPlacement = getMuseumPlacement(roadWidth);
  applyMuseumPlacement(museum.group, museumPlacement);
  scene.add(museum.group);
  museum.group.updateMatrixWorld(true);
  const museumAnchor = createMuseumAnchor(museum, museumPlacement);
  collidableMeshes.push(...museum.collidables);
  doors.push(...museum.doors);

  if (VISUAL.propsDensity.enabled) {
    const propGroup = buildPropClusters(roadWidth, museumAnchor.footprint);
    scene.add(propGroup);
  }

  return { collidableMeshes, doors, museumAnchor, streetLights };
}

function createMuseumVisual() {
  const group = new THREE.Group();
  const collidables = [];
  const doors = [];
  const museumCfg = WORLD.museum ?? {};
  const width = museumCfg.width ?? 34;
  const depth = museumCfg.depth ?? 52;
  const height = museumCfg.height ?? 9;
  const wallThickness = museumCfg.wallThickness ?? 0.28;
  const entranceWidth = museumCfg.entranceWidth ?? 4.8;
  const minDoorHeight = PLAYER.height + 0.2;
  const entranceHeight = Math.max(museumCfg.entranceHeight ?? 3.4, minDoorHeight);
  const corridorWidth = museumCfg.corridorWidth ?? 5.4;
  const zonePadding = museumCfg.zonePadding ?? 2.2;

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xe7e2d6,
    roughness: VISUAL.materials.wallRoughness,
    metalness: VISUAL.materials.wallMetalness,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0xc9c2b4,
    roughness: 0.78,
    metalness: 0.06,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xd9f0ff,
    roughness: 0.12,
    metalness: 0.08,
    transparent: true,
    opacity: 0.35,
  });
  const museumFloorCfg = VISUAL.materials.museumFloor ?? {};
  const ceilingLightCfg = VISUAL.museumInterior.ceilingLights ?? {};

  const roof = new THREE.Mesh(getBoxGeometry(width, wallThickness, depth), trimMat);
  roof.position.set(0, height + wallThickness / 2, 0);
  roof.castShadow = roof.receiveShadow = true;
  group.add(roof);
  collidables.push(roof);

  const backWall = new THREE.Mesh(getBoxGeometry(width, height, wallThickness), wallMat);
  backWall.position.set(0, height / 2, -depth / 2 + wallThickness / 2);
  backWall.castShadow = backWall.receiveShadow = true;
  group.add(backWall);
  collidables.push(backWall);

  const leftWall = new THREE.Mesh(getBoxGeometry(wallThickness, height, depth), wallMat);
  leftWall.position.set(-width / 2 + wallThickness / 2, height / 2, 0);
  leftWall.castShadow = leftWall.receiveShadow = true;
  group.add(leftWall);
  collidables.push(leftWall);

  const rightWall = new THREE.Mesh(getBoxGeometry(wallThickness, height, depth), wallMat);
  rightWall.position.set(width / 2 - wallThickness / 2, height / 2, 0);
  rightWall.castShadow = rightWall.receiveShadow = true;
  group.add(rightWall);
  collidables.push(rightWall);

  const frontPanelW = (width - entranceWidth) / 2;
  const frontLeft = new THREE.Mesh(getBoxGeometry(frontPanelW, height, wallThickness), wallMat);
  frontLeft.position.set(-entranceWidth / 2 - frontPanelW / 2, height / 2, depth / 2 - wallThickness / 2);
  frontLeft.castShadow = frontLeft.receiveShadow = true;
  group.add(frontLeft);
  collidables.push(frontLeft);

  const frontRight = new THREE.Mesh(getBoxGeometry(frontPanelW, height, wallThickness), wallMat);
  frontRight.position.set(entranceWidth / 2 + frontPanelW / 2, height / 2, depth / 2 - wallThickness / 2);
  frontRight.castShadow = frontRight.receiveShadow = true;
  group.add(frontRight);
  collidables.push(frontRight);

  const frontHeaderH = Math.max(0.2, height - entranceHeight);
  const frontHeader = new THREE.Mesh(getBoxGeometry(entranceWidth, frontHeaderH, wallThickness), trimMat);
  frontHeader.position.set(0, entranceHeight + frontHeaderH / 2, depth / 2 - wallThickness / 2);
  frontHeader.castShadow = frontHeader.receiveShadow = true;
  group.add(frontHeader);
  collidables.push(frontHeader);

  const glassPaneLeft = new THREE.Mesh(getBoxGeometry(frontPanelW * 0.86, height * 0.8, wallThickness * 0.35), glassMat);
  glassPaneLeft.position.set(-entranceWidth / 2 - frontPanelW / 2, height * 0.52, depth / 2 - wallThickness * 0.7);
  group.add(glassPaneLeft);
  const glassPaneRight = new THREE.Mesh(getBoxGeometry(frontPanelW * 0.86, height * 0.8, wallThickness * 0.35), glassMat);
  glassPaneRight.position.set(entranceWidth / 2 + frontPanelW / 2, height * 0.52, depth / 2 - wallThickness * 0.7);
  group.add(glassPaneRight);

  const interiorFloor = createMuseumFloor({
    width,
    depth,
    wallThickness,
    entranceWidth,
    materialConfig: museumFloorCfg,
  });
  group.add(interiorFloor);

  const doorGap = 0.18;
  const doorLeafWidth = (entranceWidth - doorGap) / 2;
  const leftDoor = createDoorAssembly({
    width: doorLeafWidth,
    height: entranceHeight,
    thickness: wallThickness * 0.8,
    side: 'left',
  });
  leftDoor.pivot.position.set(-entranceWidth / 2, 0, depth / 2 - wallThickness);
  group.add(leftDoor.pivot);
  collidables.push(leftDoor.mesh);
  doors.push(leftDoor);

  const rightDoor = createDoorAssembly({
    width: doorLeafWidth,
    height: entranceHeight,
    thickness: wallThickness * 0.8,
    side: 'right',
  });
  rightDoor.pivot.position.set(doorGap / 2, 0, depth / 2 - wallThickness);
  group.add(rightDoor.pivot);
  collidables.push(rightDoor.mesh);
  doors.push(rightDoor);

  const frameDepth = wallThickness * 0.52;
  const frameInsetZ = depth / 2 - wallThickness * 0.9;
  const frameWidth = 0.16;
  const frameMat = new THREE.MeshStandardMaterial({
    color: VISUAL.materials.doorFrame?.color ?? 0x5e6873,
    roughness: VISUAL.materials.doorFrame?.roughness ?? 0.42,
    metalness: VISUAL.materials.doorFrame?.metalness ?? 0.34,
  });
  const leftJamb = new THREE.Mesh(getBoxGeometry(frameWidth, entranceHeight, frameDepth), frameMat);
  leftJamb.position.set(-entranceWidth / 2 + frameWidth / 2, entranceHeight / 2, frameInsetZ);
  leftJamb.castShadow = leftJamb.receiveShadow = true;
  group.add(leftJamb);
  const rightJamb = new THREE.Mesh(getBoxGeometry(frameWidth, entranceHeight, frameDepth), frameMat);
  rightJamb.position.set(entranceWidth / 2 - frameWidth / 2, entranceHeight / 2, frameInsetZ);
  rightJamb.castShadow = rightJamb.receiveShadow = true;
  group.add(rightJamb);
  const transom = new THREE.Mesh(getBoxGeometry(entranceWidth - frameWidth * 2, frameWidth, frameDepth), frameMat);
  transom.position.set(0, entranceHeight - frameWidth / 2, frameInsetZ);
  transom.castShadow = transom.receiveShadow = true;
  group.add(transom);

  const verticalPart = (depth - corridorWidth) / 2;
  const dividerVTop = new THREE.Mesh(getBoxGeometry(wallThickness, height * 0.72, verticalPart), trimMat);
  dividerVTop.position.set(0, (height * 0.72) / 2, -corridorWidth / 2 - verticalPart / 2);
  dividerVTop.castShadow = dividerVTop.receiveShadow = true;
  group.add(dividerVTop);
  collidables.push(dividerVTop);

  const dividerVBottom = new THREE.Mesh(getBoxGeometry(wallThickness, height * 0.72, verticalPart), trimMat);
  dividerVBottom.position.set(0, (height * 0.72) / 2, corridorWidth / 2 + verticalPart / 2);
  dividerVBottom.castShadow = dividerVBottom.receiveShadow = true;
  group.add(dividerVBottom);
  collidables.push(dividerVBottom);

  const horizontalPart = (width - corridorWidth) / 2;
  const dividerHLeft = new THREE.Mesh(getBoxGeometry(horizontalPart, height * 0.72, wallThickness), trimMat);
  dividerHLeft.position.set(-corridorWidth / 2 - horizontalPart / 2, (height * 0.72) / 2, 0);
  dividerHLeft.castShadow = dividerHLeft.receiveShadow = true;
  group.add(dividerHLeft);
  collidables.push(dividerHLeft);

  const dividerHRight = new THREE.Mesh(getBoxGeometry(horizontalPart, height * 0.72, wallThickness), trimMat);
  dividerHRight.position.set(corridorWidth / 2 + horizontalPart / 2, (height * 0.72) / 2, 0);
  dividerHRight.castShadow = dividerHRight.receiveShadow = true;
  group.add(dividerHRight);
  collidables.push(dividerHRight);

  const zoneDefs = [
    { q: 'nw', x: -1, z: -1 },
    { q: 'ne', x:  1, z: -1 },
    { q: 'sw', x: -1, z:  1 },
    { q: 'se', x:  1, z:  1 },
  ];
  const zoneCenterX = corridorWidth / 2 + (horizontalPart / 2);
  const zoneCenterZ = corridorWidth / 2 + (verticalPart / 2);
  const zonePanelW = Math.max(2.6, horizontalPart - zonePadding * 2);
  const zonePanelH = 2.3;
  const zonePanelD = 0.08;

  if (ceilingLightCfg.enabled !== false) {
    const ceilingLights = createCeilingLights({
      zoneDefs,
      zoneCenterX,
      zoneCenterZ,
      height,
      wallThickness,
      entranceHeight,
      config: ceilingLightCfg,
    });
    group.add(ceilingLights);
  }

  zoneDefs.forEach((d) => {
    const zone = MUSEUM_ZONES.find((z) => z.quadrant === d.q);
    if (!zone) return;
    const cx = d.x * zoneCenterX;
    const cz = d.z * zoneCenterZ;
    const zoneGroup = createZoneDisplay(zone, zonePanelW, zonePanelH, zonePanelD);
    zoneGroup.position.set(cx, 0, cz);
    group.add(zoneGroup);
  });

  const hallFill = new THREE.HemisphereLight(0xfff7eb, 0x5b5f69, VISUAL.museumInterior.baseFillIntensity);
  hallFill.position.set(0, height - 1, 0);
  group.add(hallFill);

  return { group, collidables, doors };
}

function createCeilingLights({ zoneDefs, zoneCenterX, zoneCenterZ, height, wallThickness, entranceHeight, config }) {
  const group = new THREE.Group();
  const lightsPerZone = Math.max(1, Math.round(config.lightsPerZone ?? 2));
  const ceilingY = Math.max(entranceHeight + 0.8, height - (config.heightOffset ?? 0.9));
  const zoneInsetX = config.zoneInsetX ?? 1.3;
  const zoneInsetZ = config.zoneInsetZ ?? 3.4;
  const fixtureSize = config.fixtureSize ?? {};
  const fixtureWidth = fixtureSize.width ?? 1.2;
  const fixtureHeight = fixtureSize.height ?? 0.16;
  const fixtureDepth = fixtureSize.depth ?? 0.5;
  const stemHeight = 0.28;
  const drop = config.drop ?? 0.35;

  const fixtureMat = new THREE.MeshStandardMaterial({
    color: config.fixtureColor ?? 0xe9dec8,
    emissive: config.glowEmissive ?? 0xffc977,
    emissiveIntensity: 0.35,
    roughness: 0.72,
    metalness: 0.03,
  });
  const stemMat = new THREE.MeshStandardMaterial({
    color: 0xc8ba9e,
    roughness: 0.78,
    metalness: 0.04,
  });

  zoneDefs.forEach((zoneDef) => {
    const cx = zoneDef.x * Math.max(0, zoneCenterX - zoneInsetX);
    const cz = zoneDef.z * zoneCenterZ;
    const zPositions = lightsPerZone === 1
      ? [cz]
      : [cz - zoneInsetZ / 2, cz + zoneInsetZ / 2];

    zPositions.forEach((z) => {
      const fixture = new THREE.Group();

      const stem = new THREE.Mesh(
        getBoxGeometry(0.14, stemHeight, 0.14),
        stemMat
      );
      stem.position.set(cx, ceilingY + fixtureHeight / 2 + stemHeight / 2 - wallThickness * 0.2, z);
      stem.castShadow = stem.receiveShadow = true;
      fixture.add(stem);

      const panel = new THREE.Mesh(
        getBoxGeometry(fixtureWidth, fixtureHeight, fixtureDepth),
        fixtureMat
      );
      panel.position.set(cx, ceilingY, z);
      panel.castShadow = panel.receiveShadow = true;
      fixture.add(panel);

      const light = new THREE.PointLight(
        config.color ?? 0xffe2b5,
        config.intensity ?? 0.32,
        config.range ?? 10
      );
      light.position.set(cx, ceilingY - drop, z);
      fixture.add(light);

      group.add(fixture);
    });
  });

  return group;
}

function getMuseumPlacement(roadWidth) {
  const museumCfg = WORLD.museum ?? {};
  const placementCfg = museumCfg.placement ?? {};
  const side = placementCfg.side === 'left' ? 'left' : 'right';
  const roadGap = placementCfg.roadGap ?? 5;
  const zOffset = placementCfg.zOffset ?? 0;
  const halfDepth = (museumCfg.depth ?? 52) / 2;
  const xSign = side === 'left' ? -1 : 1;

  return {
    footprintPadding: placementCfg.footprintPadding ?? 2,
    position: new THREE.Vector3(
      xSign * (roadWidth / 2 + roadGap + halfDepth),
      0,
      zOffset
    ),
    rotationY: side === 'left' ? Math.PI / 2 : -Math.PI / 2,
  };
}

function applyMuseumPlacement(group, placement) {
  group.position.copy(placement.position);
  group.rotation.y = placement.rotationY;
}

function createMuseumAnchor(museum, placement) {
  const center = museum.group.getWorldPosition(new THREE.Vector3());
  const entrance = museum.doors[0]?.mesh
    ? museum.doors[0].mesh.getWorldPosition(new THREE.Vector3())
    : center.clone();
  const bounds = new THREE.Box3().setFromObject(museum.group);
  const padding = placement.footprintPadding ?? 0;

  return {
    center,
    entrance,
    footprint: {
      minX: bounds.min.x - padding,
      maxX: bounds.max.x + padding,
      minZ: bounds.min.z - padding,
      maxZ: bounds.max.z + padding,
    },
  };
}

function createZoneDisplay(zone, panelWidth, panelHeight, panelDepth) {
  const g = new THREE.Group();
  const panelMat = new THREE.MeshStandardMaterial({ color: 0xf2ede3, roughness: 0.86, metalness: 0.02 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xa98a62, roughness: 0.8, metalness: 0.05 });

  const titleBoard = createTextBoard(zone.title ?? zone.id, panelWidth * 0.78, 0.8, 512, 160, '#1f1e1d', '#efe7d5');
  titleBoard.position.set(0, 2.7, -panelWidth * 0.22);
  g.add(titleBoard);

  const signBoard = createTextBoard(zone.sign ?? '', panelWidth * 0.96, 0.9, 768, 180, '#111111', '#ffffff');
  signBoard.position.set(0, 1.9, -panelWidth * 0.22);
  g.add(signBoard);

  const backPanel = new THREE.Mesh(getBoxGeometry(panelWidth, panelHeight, panelDepth), panelMat);
  backPanel.position.set(0, 1.25, -panelWidth * 0.22 - 0.22);
  backPanel.rotation.y = Math.PI;
  backPanel.castShadow = backPanel.receiveShadow = true;
  g.add(backPanel);
  const backText = createTextBoard(zone.back ?? '', panelWidth * 0.9, panelHeight * 0.78, 768, 360, '#252423', '#f9f6ef');
  backText.position.set(0, 1.25, -panelWidth * 0.22 - 0.14);
  backText.rotation.y = Math.PI;
  g.add(backText);

  const leftPanel = new THREE.Mesh(getBoxGeometry(panelWidth * 0.56, panelHeight * 0.72, panelDepth), frameMat);
  leftPanel.position.set(-panelWidth * 0.26, 1.05, panelWidth * 0.2);
  leftPanel.rotation.y = Math.PI / 2;
  leftPanel.castShadow = leftPanel.receiveShadow = true;
  g.add(leftPanel);
  const leftText = createTextBoard(zone.left ?? '', panelWidth * 0.5, panelHeight * 0.58, 512, 300, '#1d1d1d', '#f8f3e8');
  leftText.position.set(-panelWidth * 0.2, 1.05, panelWidth * 0.2);
  leftText.rotation.y = Math.PI / 2;
  g.add(leftText);

  const rightPanel = new THREE.Mesh(getBoxGeometry(panelWidth * 0.56, panelHeight * 0.72, panelDepth), frameMat);
  rightPanel.position.set(panelWidth * 0.26, 1.05, panelWidth * 0.2);
  rightPanel.rotation.y = -Math.PI / 2;
  rightPanel.castShadow = rightPanel.receiveShadow = true;
  g.add(rightPanel);
  const rightText = createTextBoard(zone.right ?? '', panelWidth * 0.5, panelHeight * 0.58, 512, 300, '#1d1d1d', '#f8f3e8');
  rightText.position.set(panelWidth * 0.2, 1.05, panelWidth * 0.2);
  rightText.rotation.y = -Math.PI / 2;
  g.add(rightText);

  return g;
}

function createTextBoard(text, width, height, canvasW, canvasH, fg = '#111111', bg = '#ffffff') {
  const c = document.createElement('canvas');
  c.width = canvasW;
  c.height = canvasH;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvasW, canvasH);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = wrapText(ctx, text, Math.floor(canvasW * 0.86), Math.floor(canvasH * 0.16), Math.floor(canvasH * 0.16));
  const totalH = lines.length * Math.floor(canvasH * 0.16);
  const startY = (canvasH - totalH) / 2 + Math.floor(canvasH * 0.08);
  lines.forEach((line, i) => {
    ctx.font = `${Math.floor(canvasH * 0.14)}px sans-serif`;
    ctx.fillText(line, canvasW / 2, startY + i * Math.floor(canvasH * 0.16));
  });
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.86, metalness: 0.02 });
  const mesh = new THREE.Mesh(getBoxGeometry(width, height, 0.04), mat);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

function wrapText(ctx, text, maxW, fontPx) {
  ctx.font = `${fontPx}px sans-serif`;
  const raw = `${text}`.trim();
  if (!raw) return [''];
  const hasSpaces = /\s/.test(raw);
  const words = hasSpaces ? raw.split(/\s+/).filter(Boolean) : Array.from(raw);
  const lines = [];
  if (!words.length) return [''];
  let current = words[0];
  for (let i = 1; i < words.length; i++) {
    const candidate = hasSpaces ? `${current} ${words[i]}` : `${current}${words[i]}`;
    if (ctx.measureText(candidate).width <= maxW) current = candidate;
    else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  if (lines.length > 4) {
    return hasSpaces
      ? [lines.slice(0, 2).join(' '), lines.slice(2).join(' ')]
      : [lines.slice(0, 2).join(''), lines.slice(2).join('')];
  }
  return lines;
}

function createMuseumFloor({ width, depth, wallThickness, entranceWidth, materialConfig = {} }) {
  const group = new THREE.Group();
  const floorHeight = 0.04;
  const inset = wallThickness + 0.45;
  const floorWidth = width - inset * 2;
  const floorDepth = depth - inset * 2;
  const slabMat = new THREE.MeshStandardMaterial({
    color: materialConfig.color ?? 0xd8d2c7,
    roughness: materialConfig.roughness ?? 0.88,
    metalness: materialConfig.metalness ?? 0.02,
  });
  const groutMat = new THREE.MeshStandardMaterial({
    color: materialConfig.groutColor ?? 0xb2aa9c,
    roughness: 0.92,
    metalness: 0.01,
  });

  const slab = new THREE.Mesh(getBoxGeometry(floorWidth, floorHeight, floorDepth), slabMat);
  slab.position.set(0, floorHeight / 2, -0.3);
  slab.receiveShadow = true;
  group.add(slab);

  const tileCols = 4;
  const tileRows = 6;
  const groutThickness = 0.05;
  for (let i = 1; i < tileCols; i++) {
    const stripe = new THREE.Mesh(getBoxGeometry(groutThickness, floorHeight * 0.65, floorDepth), groutMat);
    stripe.position.set(-floorWidth / 2 + (floorWidth / tileCols) * i, floorHeight + 0.002, -0.3);
    stripe.receiveShadow = true;
    group.add(stripe);
  }
  for (let i = 1; i < tileRows; i++) {
    const stripe = new THREE.Mesh(getBoxGeometry(floorWidth, floorHeight * 0.65, groutThickness), groutMat);
    stripe.position.set(0, floorHeight + 0.002, -floorDepth / 2 - 0.3 + (floorDepth / tileRows) * i);
    stripe.receiveShadow = true;
    group.add(stripe);
  }

  const threshold = new THREE.Mesh(getBoxGeometry(entranceWidth - 0.3, 0.025, 0.55), groutMat);
  threshold.position.set(0, 0.013, depth / 2 - wallThickness - 0.45);
  threshold.receiveShadow = true;
  group.add(threshold);

  return group;
}

function createDoorAssembly({ width, height, thickness, side = 'left' }) {
  const pivot = new THREE.Object3D();
  const frameCfg = VISUAL.materials.doorFrame ?? {};
  const glassCfg = VISUAL.materials.doorGlass ?? {};
  const handleCfg = VISUAL.materials.doorHandle ?? {};
  const frameWidth = Math.max(0.08, width * 0.12);
  const railHeight = Math.max(0.14, height * 0.08);
  const glassWidth = Math.max(0.18, width - frameWidth * 2);
  const glassHeight = Math.max(0.3, height - railHeight * 2);
  const handleOffsetX = side === 'left' ? width - frameWidth * 0.55 : frameWidth * 0.55;
  const handleDepth = thickness * 0.85;

  const doorMesh = new THREE.Mesh(
    getBoxGeometry(width, height, thickness),
    new THREE.MeshStandardMaterial({
      color: glassCfg.color ?? 0xd9eef7,
      roughness: glassCfg.roughness ?? 0.08,
      metalness: glassCfg.metalness ?? 0.04,
      transparent: true,
      opacity: glassCfg.opacity ?? 0.28,
    })
  );
  doorMesh.position.set(width / 2, height / 2, thickness / 2);
  doorMesh.castShadow = doorMesh.receiveShadow = true;
  const frameMat = new THREE.MeshStandardMaterial({
    color: frameCfg.color ?? 0x5e6873,
    roughness: frameCfg.roughness ?? 0.42,
    metalness: frameCfg.metalness ?? 0.34,
  });
  const handleMat = new THREE.MeshStandardMaterial({
    color: handleCfg.color ?? 0xc6b38d,
    roughness: handleCfg.roughness ?? 0.35,
    metalness: handleCfg.metalness ?? 0.7,
  });

  const stiles = [
    { x: frameWidth / 2 },
    { x: width - frameWidth / 2 },
  ];
  stiles.forEach(({ x }) => {
    const stile = new THREE.Mesh(getBoxGeometry(frameWidth, height, thickness * 1.04), frameMat);
    stile.position.set(x, height / 2, thickness / 2);
    stile.castShadow = stile.receiveShadow = true;
    doorMesh.add(stile);
  });

  const rails = [
    { y: railHeight / 2 },
    { y: height - railHeight / 2 },
  ];
  rails.forEach(({ y }) => {
    const rail = new THREE.Mesh(getBoxGeometry(width - frameWidth * 2, railHeight, thickness * 1.04), frameMat);
    rail.position.set(width / 2, y, thickness / 2);
    rail.castShadow = rail.receiveShadow = true;
    doorMesh.add(rail);
  });

  const glassPanel = new THREE.Mesh(
    getBoxGeometry(glassWidth, glassHeight, Math.max(0.02, thickness * 0.28)),
    new THREE.MeshStandardMaterial({
      color: glassCfg.color ?? 0xd9eef7,
      roughness: glassCfg.roughness ?? 0.08,
      metalness: glassCfg.metalness ?? 0.04,
      transparent: true,
      opacity: Math.min(0.5, (glassCfg.opacity ?? 0.28) + 0.08),
    })
  );
  glassPanel.position.set(width / 2, height / 2, thickness / 2);
  glassPanel.castShadow = glassPanel.receiveShadow = true;
  doorMesh.add(glassPanel);

  const handle = new THREE.Mesh(getBoxGeometry(0.08, height * 0.28, handleDepth), handleMat);
  handle.position.set(handleOffsetX, height / 2, thickness / 2);
  handle.castShadow = handle.receiveShadow = true;
  doorMesh.add(handle);

  pivot.add(doorMesh);

  doorMesh.userData.isDoor = true;
  doorMesh.userData.doorPivot = pivot;
  pivot.userData.isOpen = false;
  pivot.userData.closedRotation = 0;
  pivot.userData.openRotation = side === 'right' ? Math.PI / 2.2 : -Math.PI / 2.2;

  return { mesh: doorMesh, pivot };
}

function buildPropClusters(roadWidth, blockedFootprint = null) {
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
      if (isPointInsideFootprint(x, z, blockedFootprint)) continue;
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

function isPointInsideFootprint(x, z, footprint) {
  if (!footprint) return false;
  return (
    x >= footprint.minX &&
    x <= footprint.maxX &&
    z >= footprint.minZ &&
    z <= footprint.maxZ
  );
}
