import * as THREE from 'three';
import { VISUAL } from '../config.js';
import { getBoxGeometry, getCylinderGeometry } from './geometryCache.js';

export function createStreetLights({
  roadWidth,
  roadLength,
  streetLight = {},
}) {
  const {
    spacing = VISUAL.streetLights?.spacing ?? 20,
    sideOffset = roadWidth / 2 + 1,
    poleHeight = 5,
    poleRadius = 0.05,
    lampRadius = 0.2,
    lightRange = VISUAL.streetLights?.lightRange ?? 20,
    baseIntensity = 1,
  } = streetLight;

  const group = new THREE.Group();
  const streetLights = [];
  const poleGeometry = getCylinderGeometry(poleRadius, poleRadius, poleHeight, 8);
  const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x5f5a56, roughness: 0.86, metalness: 0.1 });
  const lampGeometry = new THREE.SphereGeometry(lampRadius, 8, 8);
  const lampMaterial = new THREE.MeshStandardMaterial({
    color: 0xfff2cf,
    emissive: 0xffd89a,
    emissiveIntensity: 1.25,
    roughness: 0.72,
    metalness: 0.05,
  });

  for (let z = -roadLength / 2 + spacing / 2; z <= roadLength / 2 - spacing / 2; z += spacing) {
    for (const side of [-1, 1]) {
      const x = side * sideOffset;

      const pole = new THREE.Mesh(poleGeometry, poleMaterial);
      pole.position.set(x, poleHeight / 2, z);
      group.add(pole);

      const lamp = new THREE.Mesh(lampGeometry, lampMaterial);
      lamp.position.set(x, poleHeight + lampRadius, z);
      group.add(lamp);

      const light = new THREE.PointLight(0xffd9a8, baseIntensity, lightRange);
      light.position.copy(lamp.position);
      light.userData.baseIntensity = baseIntensity;
      light.userData.baseDistance = lightRange;
      group.add(light);
      streetLights.push(light);
    }
  }

  return { group, streetLights };
}

export function createCeilingLights({ zoneDefs, zoneCenterX, zoneCenterZ, height, wallThickness, entranceHeight, config }) {
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

      const stem = new THREE.Mesh(getBoxGeometry(0.14, stemHeight, 0.14), stemMat);
      stem.position.set(cx, ceilingY + fixtureHeight / 2 + stemHeight / 2 - wallThickness * 0.2, z);
      stem.castShadow = stem.receiveShadow = true;
      fixture.add(stem);

      const panel = new THREE.Mesh(getBoxGeometry(fixtureWidth, fixtureHeight, fixtureDepth), fixtureMat);
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
