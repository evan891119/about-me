export const PHYSICS = {
  gravity: { x: 0, y: -18, z: 0 },
  fixedTimeStep: 1 / 60,
  maxSubSteps: 3,
};

export const PLAYER = {
  height: 1.7,
  radius: 0.35,
  walk: 6,
  airMult: 0.35,
  airControl: 6,
  sprintMult: 1.5,
  jump: 8,
};

export const WORLD = {
  groundSize: 200,
  groundThickness: 0.1,
  roadWidth: 6,
  roadLength: 200,
  roadThickness: 0.02,
};

export const INTERACTION = {
  doorRange: 2.0,
  doorAnimSec: 0.6,
};

export const SKY = {
  updateIntervalSec: 0.5,
};

export const VISUAL = {
  pixelRatioMax: 1.5,
  toneMappingExposure: 1.05,
  fog: {
    dayColor: 0xd8c7a8,
    duskColor: 0xc08b68,
    nightColor: 0x182336,
    near: 18,
    far: 140,
  },
  shadows: {
    mapSize: 1024,
    bias: -0.00015,
  },
  postFX: {
    enabled: true,
    quality: 'med',
    bloomStrength: 0.22,
    bloomRadius: 0.35,
    bloomThreshold: 0.78,
    contrast: 1.06,
    saturation: 1.08,
    gamma: 1.0,
  },
  propsDensity: {
    enabled: true,
    multiplier: 1.0,
  },
  camera: {
    showcaseFov: 62,
    showcasePosition: { x: 0, y: 14, z: 22 },
    showcaseLookAt: { x: 0, y: 1.2, z: -4 },
  },
  materials: {
    ground: { color: 0x8f8d66, roughness: 0.92, metalness: 0.02 },
    road: { color: 0x646056, roughness: 0.9, metalness: 0.03 },
    wallRoughness: 0.85,
    wallMetalness: 0.02,
    roofRoughness: 0.8,
    roofMetalness: 0.03,
    doorColor: 0x7f5430,
  },
};
