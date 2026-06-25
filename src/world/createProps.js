import * as THREE from 'three';
import { PROP_LAYOUT } from '../content.js';
import { VISUAL } from '../config.js';
import { getBoxGeometry, getConeGeometry, getCylinderGeometry } from './geometryCache.js';
import { createPropMaterials } from './materials.js';

export function buildPropClusters(roadWidth, blockedFootprint = null) {
  const group = new THREE.Group();
  const mul = Math.max(0.2, VISUAL.propsDensity.multiplier ?? 1);
  const palette = createPropMaterials();

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
    const mesh = new THREE.Mesh(getCylinderGeometry(radius, radius, h, 8), m.barrel);
    mesh.position.set((rng() * 2 - 1) * 0.32, h / 2, (rng() * 2 - 1) * 0.32);
    mesh.castShadow = mesh.receiveShadow = true;
    g.add(mesh);
  }
  return g;
}

function createFenceSign(m, rng) {
  const g = new THREE.Group();
  const postH = 1.1 + rng() * 0.4;
  const postA = new THREE.Mesh(getCylinderGeometry(0.04, 0.04, postH, 6), m.fence);
  const postB = new THREE.Mesh(getCylinderGeometry(0.04, 0.04, postH, 6), m.fence);
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
  const trunk = new THREE.Mesh(getCylinderGeometry(0.09, 0.11, trunkH, 7), m.trunk);
  trunk.position.y = trunkH / 2;

  const coneA = new THREE.Mesh(getConeGeometry(0.55, 0.75, 8), m.leaf);
  const coneB = new THREE.Mesh(getConeGeometry(0.42, 0.62, 8), m.leaf);
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
