import * as THREE from 'three';
import { MUSEUM_ZONES } from '../content.js';
import { PLAYER, VISUAL, WORLD } from '../config.js';
import { createCeilingLights, createStreetLights } from './createLights.js';
import { buildPropClusters } from './createProps.js';
import { getBoxGeometry } from './geometryCache.js';

const sharedTextureLoader = new THREE.TextureLoader();

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
    groundTexture = null,
    maxAnisotropy = 8,             // 從 app.renderer.capabilities.getMaxAnisotropy() 傳入
    roadWidth = 6,
    roadLength = 200,

    streetLight = {}               // 路燈參數可覆寫
  } = options;

  const collidableMeshes = [];
  const doors = [];

  // === 地面（貼圖 + 重複 + 各向異性） ===
  {
    const geo = new THREE.PlaneGeometry(groundSize, groundSize);
    const tex = groundTexture
      ? sharedTextureLoader.load(groundTexture, (t) => {
          t.wrapS = t.wrapT = THREE.RepeatWrapping;
          t.repeat.set(groundRepeat, groundRepeat);
          t.anisotropy = maxAnisotropy;              // 直接設，Renderer 會自動 clamp
        })
      : null;
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
  const streetLightResult = createStreetLights({ roadWidth, roadLength, streetLight });
  scene.add(streetLightResult.group);

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

  return { collidableMeshes, doors, museumAnchor, streetLights: streetLightResult.streetLights };
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
  const verticalPart = (depth - corridorWidth) / 2;
  const horizontalPart = (width - corridorWidth) / 2;
  const zoneCenterX = corridorWidth / 2 + (horizontalPart / 2);
  const zoneCenterZ = corridorWidth / 2 + (verticalPart / 2);
  const entranceCenterX = getEntranceCenterX(museumCfg.entranceQuadrant, zoneCenterX);
  const entranceLeft = entranceCenterX - entranceWidth / 2;
  const entranceRight = entranceCenterX + entranceWidth / 2;

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

  const frontSegments = [
    { left: -width / 2, right: entranceLeft },
    { left: entranceRight, right: width / 2 },
  ];
  frontSegments.forEach(({ left, right }) => {
    const segmentW = right - left;
    if (segmentW <= 0.05) return;
    const wall = new THREE.Mesh(getBoxGeometry(segmentW, height, wallThickness), wallMat);
    wall.position.set((left + right) / 2, height / 2, depth / 2 - wallThickness / 2);
    wall.castShadow = wall.receiveShadow = true;
    group.add(wall);
    collidables.push(wall);
  });

  const frontHeaderH = Math.max(0.2, height - entranceHeight);
  const frontHeader = new THREE.Mesh(getBoxGeometry(entranceWidth, frontHeaderH, wallThickness), trimMat);
  frontHeader.position.set(entranceCenterX, entranceHeight + frontHeaderH / 2, depth / 2 - wallThickness / 2);
  frontHeader.castShadow = frontHeader.receiveShadow = true;
  group.add(frontHeader);
  collidables.push(frontHeader);

  frontSegments.forEach(({ left, right }) => {
    const segmentW = right - left;
    if (segmentW < 3.2) return;
    const glassPane = new THREE.Mesh(getBoxGeometry(segmentW * 0.72, height * 0.8, wallThickness * 0.35), glassMat);
    glassPane.position.set((left + right) / 2, height * 0.52, depth / 2 - wallThickness * 0.7);
    group.add(glassPane);
  });

  const interiorFloor = createMuseumFloor({
    width,
    depth,
    wallThickness,
    entranceWidth,
    entranceCenterX,
    materialConfig: museumFloorCfg,
  });
  group.add(interiorFloor);

  const doorGap = 0.18;
  const doorLeafWidth = (entranceWidth - doorGap) / 2;
  const doorZ = depth / 2 - wallThickness / 2;
  const leftDoor = createDoorAssembly({
    width: doorLeafWidth,
    height: entranceHeight,
    thickness: wallThickness * 0.8,
    side: 'left',
  });
  leftDoor.pivot.position.set(entranceLeft, 0, doorZ);
  group.add(leftDoor.pivot);
  collidables.push(leftDoor.mesh);
  doors.push(leftDoor);

  const rightDoor = createDoorAssembly({
    width: doorLeafWidth,
    height: entranceHeight,
    thickness: wallThickness * 0.8,
    side: 'right',
  });
  rightDoor.pivot.position.set(entranceRight, 0, doorZ);
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
  leftJamb.position.set(entranceLeft + frameWidth / 2, entranceHeight / 2, frameInsetZ);
  leftJamb.castShadow = leftJamb.receiveShadow = true;
  group.add(leftJamb);
  const rightJamb = new THREE.Mesh(getBoxGeometry(frameWidth, entranceHeight, frameDepth), frameMat);
  rightJamb.position.set(entranceRight - frameWidth / 2, entranceHeight / 2, frameInsetZ);
  rightJamb.castShadow = rightJamb.receiveShadow = true;
  group.add(rightJamb);
  const transom = new THREE.Mesh(getBoxGeometry(entranceWidth - frameWidth * 2, frameWidth, frameDepth), frameMat);
  transom.position.set(entranceCenterX, entranceHeight - frameWidth / 2, frameInsetZ);
  transom.castShadow = transom.receiveShadow = true;
  group.add(transom);

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
    const zoneGroup = createZoneDisplay(zone, zonePanelW, zonePanelH, zonePanelD, {
      xSign: d.x,
      zSign: d.z,
      horizontalPart,
      verticalPart,
      entranceQuadrant: museumCfg.entranceQuadrant,
    });
    zoneGroup.position.set(cx, 0, cz);
    group.add(zoneGroup);
  });

  const hallFill = new THREE.HemisphereLight(0xfff7eb, 0x5b5f69, VISUAL.museumInterior.baseFillIntensity);
  hallFill.position.set(0, height - 1, 0);
  group.add(hallFill);

  return { group, collidables, doors };
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

function getEntranceCenterX(quadrant, zoneCenterX) {
  return quadrant === 'se' || quadrant === 'ne' ? zoneCenterX : -zoneCenterX;
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

function createZoneDisplay(zone, panelWidth, panelHeight, panelDepth, layout = {}) {
  const g = new THREE.Group();
  const panelMat = new THREE.MeshStandardMaterial({ color: 0xf2ede3, roughness: 0.86, metalness: 0.02 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xa98a62, roughness: 0.8, metalness: 0.05 });
  const xSign = layout.xSign ?? 1;
  const zSign = layout.zSign ?? 1;
  const horizontalPart = layout.horizontalPart ?? panelWidth;
  const verticalPart = layout.verticalPart ?? panelWidth;
  const wallInset = 0.12;
  const mainWallZSign = zone.quadrant === layout.entranceQuadrant ? -zSign : zSign;
  const mainWallZ = mainWallZSign * (verticalPart / 2 - wallInset);
  const mainWallRot = mainWallZSign < 0 ? Math.PI : 0;
  const sideWallX = xSign * (horizontalPart / 2 - wallInset);
  const innerWallX = -xSign * (horizontalPart / 2 - wallInset);
  const sideRot = xSign < 0 ? Math.PI / 2 : -Math.PI / 2;
  const innerRot = xSign < 0 ? -Math.PI / 2 : Math.PI / 2;
  const sideBoardW = Math.max(2.4, verticalPart * 0.34);

  const titleBoard = createTextBoard(zone.title ?? zone.id, panelWidth * 0.72, 0.58, 512, 140, '#1f1e1d', '#efe7d5');
  titleBoard.position.set(0, 2.9, mainWallZ);
  titleBoard.rotation.y = mainWallRot;
  g.add(titleBoard);

  const signBoard = createTextBoard(zone.sign ?? '', panelWidth * 0.9, 0.72, 768, 170, '#111111', '#ffffff');
  signBoard.position.set(0, 2.25, mainWallZ);
  signBoard.rotation.y = mainWallRot;
  g.add(signBoard);

  addWallBoard(g, {
    text: zone.back ?? '',
    width: panelWidth * 0.92,
    height: panelHeight * 0.72,
    position: new THREE.Vector3(0, 1.28, mainWallZ),
    rotationY: mainWallRot,
    panelDepth,
    panelMat,
    textCanvas: { width: 768, height: 360 },
  });

  addWallBoard(g, {
    text: zone.left ?? '',
    width: sideBoardW,
    height: panelHeight * 0.58,
    position: new THREE.Vector3(sideWallX, 1.35, 0),
    rotationY: sideRot,
    panelDepth,
    panelMat: frameMat,
    textCanvas: { width: 512, height: 300 },
  });

  addWallBoard(g, {
    text: zone.right ?? '',
    width: sideBoardW,
    height: panelHeight * 0.58,
    position: new THREE.Vector3(innerWallX, 1.35, 0),
    rotationY: innerRot,
    panelDepth,
    panelMat: frameMat,
    textCanvas: { width: 512, height: 300 },
  });

  return g;
}

function addWallBoard(group, {
  text,
  width,
  height,
  position,
  rotationY,
  panelDepth,
  panelMat,
  textCanvas,
}) {
  const panel = new THREE.Mesh(getBoxGeometry(width, height, panelDepth), panelMat);
  panel.position.copy(position);
  panel.rotation.y = rotationY;
  panel.castShadow = panel.receiveShadow = true;
  group.add(panel);

  const normal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
  const textBoard = createTextBoard(text, width * 0.9, height * 0.76, textCanvas.width, textCanvas.height, '#1d1d1d', '#f8f3e8');
  textBoard.position.copy(position).add(normal.multiplyScalar(panelDepth * 0.65));
  textBoard.rotation.y = rotationY;
  group.add(textBoard);
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

function createMuseumFloor({ width, depth, wallThickness, entranceWidth, entranceCenterX = 0, materialConfig = {} }) {
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
  threshold.position.set(entranceCenterX, 0.013, depth / 2 - wallThickness - 0.45);
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
  const direction = side === 'right' ? -1 : 1;
  const handleOffsetX = direction * (width / 2 - frameWidth * 0.55);
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
  doorMesh.position.set(direction * width / 2, height / 2, 0);
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
    { x: -width / 2 + frameWidth / 2 },
    { x: width / 2 - frameWidth / 2 },
  ];
  stiles.forEach(({ x }) => {
    const stile = new THREE.Mesh(getBoxGeometry(frameWidth, height, thickness * 1.04), frameMat);
    stile.position.set(x, 0, 0);
    stile.castShadow = stile.receiveShadow = true;
    doorMesh.add(stile);
  });

  const rails = [
    { y: -height / 2 + railHeight / 2 },
    { y: height / 2 - railHeight / 2 },
  ];
  rails.forEach(({ y }) => {
    const rail = new THREE.Mesh(getBoxGeometry(width - frameWidth * 2, railHeight, thickness * 1.04), frameMat);
    rail.position.set(0, y, 0);
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
  glassPanel.position.set(0, 0, 0);
  glassPanel.castShadow = glassPanel.receiveShadow = true;
  doorMesh.add(glassPanel);

  const handle = new THREE.Mesh(getBoxGeometry(0.08, height * 0.28, handleDepth), handleMat);
  handle.position.set(handleOffsetX, 0, 0);
  handle.castShadow = handle.receiveShadow = true;
  doorMesh.add(handle);

  pivot.add(doorMesh);

  doorMesh.userData.isDoor = true;
  doorMesh.userData.doorPivot = pivot;
  pivot.userData.isOpen = false;
  pivot.userData.closedRotation = 0;
  pivot.userData.openRotation = direction * Math.PI / 2.2;

  return { mesh: doorMesh, pivot };
}
