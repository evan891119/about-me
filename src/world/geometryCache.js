import * as THREE from 'three';

const boxGeometryCache = new Map();
const cylinderGeometryCache = new Map();
const coneGeometryCache = new Map();

function keyFrom(values) {
  return values.map((v) => Number(v).toFixed(4)).join('|');
}

export function getBoxGeometry(width, height, depth) {
  const key = keyFrom([width, height, depth]);
  let geo = boxGeometryCache.get(key);
  if (!geo) {
    geo = new THREE.BoxGeometry(width, height, depth);
    boxGeometryCache.set(key, geo);
  }
  return geo;
}

export function getCylinderGeometry(radiusTop, radiusBottom, height, radialSegments = 8) {
  const key = keyFrom([radiusTop, radiusBottom, height, radialSegments]);
  let geo = cylinderGeometryCache.get(key);
  if (!geo) {
    geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments);
    cylinderGeometryCache.set(key, geo);
  }
  return geo;
}

export function getConeGeometry(radius, height, radialSegments = 8) {
  const key = keyFrom([radius, height, radialSegments]);
  let geo = coneGeometryCache.get(key);
  if (!geo) {
    geo = new THREE.ConeGeometry(radius, height, radialSegments);
    coneGeometryCache.set(key, geo);
  }
  return geo;
}
