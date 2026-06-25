import * as THREE from 'three';

export function createPropMaterials() {
  return {
    crate: new THREE.MeshStandardMaterial({ color: 0x8f6a47, roughness: 0.86, metalness: 0.02 }),
    crateDark: new THREE.MeshStandardMaterial({ color: 0x6a4a35, roughness: 0.9, metalness: 0.02 }),
    barrel: new THREE.MeshStandardMaterial({ color: 0x636a72, roughness: 0.8, metalness: 0.14 }),
    fence: new THREE.MeshStandardMaterial({ color: 0x5d4a3a, roughness: 0.9, metalness: 0.03 }),
    sign: new THREE.MeshStandardMaterial({ color: 0xb88f4e, roughness: 0.78, metalness: 0.05 }),
    trunk: new THREE.MeshStandardMaterial({ color: 0x5b4430, roughness: 0.92, metalness: 0.01 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x7e9b58, roughness: 0.9, metalness: 0.01 }),
    grass: new THREE.MeshStandardMaterial({ color: 0x92a85a, roughness: 0.95, metalness: 0.0 }),
  };
}
