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
  museum: {
    width: 34,
    depth: 52,
    height: 9,
    wallThickness: 0.28,
    entranceWidth: 4.8,
    entranceHeight: 3.4,
    zonePadding: 2.2,
    corridorWidth: 5.4,
    placement: {
      side: 'right',
      roadGap: 5,
      zOffset: 0,
      footprintPadding: 2,
    },
  },
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
    showcaseOffset: { x: -30, y: 15, z: 22 },
    showcaseLookAtOffset: { x: 8, y: 0, z: 0 },
  },
  night: {
    minSunIntensity: 0.18,
    minHemiIntensity: 0.34,
    fogNightLift: 0.2,
    streetLightNightBoost: 1.55,
    streetLightRangeBoost: 1.35,
    flashlightFillBoost: 1.2,
  },
  museumInterior: {
    baseFillIntensity: 0.32,
    ceilingLights: {
      enabled: true,
      lightsPerZone: 2,
      color: 0xffe2b5,
      intensity: 1,
      range: 30,
      heightOffset: 0.9,
      zoneInsetX: 1.3,
      zoneInsetZ: 3.4,
      fixtureSize: { width: 1.2, height: 0.16, depth: 0.5 },
      drop: 0.35,
      fixtureColor: 0xe9dec8,
      glowEmissive: 0xffc977,
    },
  },
  materials: {
    ground: { color: 0x8f8d66, roughness: 0.92, metalness: 0.02 },
    road: { color: 0x646056, roughness: 0.9, metalness: 0.03 },
    museumFloor: {
      color: 0xd8d2c7,
      groutColor: 0xb2aa9c,
      roughness: 0.88,
      metalness: 0.02,
    },
    wallRoughness: 0.85,
    wallMetalness: 0.02,
    roofRoughness: 0.8,
    roofMetalness: 0.03,
    doorColor: 0x7f5430,
    doorFrame: {
      color: 0x5e6873,
      roughness: 0.42,
      metalness: 0.34,
    },
    doorGlass: {
      color: 0xd9eef7,
      roughness: 0.08,
      metalness: 0.04,
      opacity: 0.28,
    },
    doorHandle: {
      color: 0xc6b38d,
      roughness: 0.35,
      metalness: 0.7,
    },
  },
};
