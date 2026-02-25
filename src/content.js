export const HOUSE_LAYOUT = {
  houseOffset: 6,
  zPositions: [-15, 5],
};

export const PROP_LAYOUT = [
  {
    id: 'north-left',
    position: { x: -9, y: 0, z: -24 },
    spread: { x: 4.5, z: 3.6 },
    prefabs: ['crate', 'barrel', 'fence', 'tree'],
    count: 10,
  },
  {
    id: 'north-right',
    position: { x: 9.5, y: 0, z: -22 },
    spread: { x: 4.2, z: 3.8 },
    prefabs: ['crate', 'barrel', 'tree', 'grass'],
    count: 11,
  },
  {
    id: 'center-left',
    position: { x: -10, y: 0, z: -6 },
    spread: { x: 5.2, z: 4.0 },
    prefabs: ['crate', 'fence', 'grass', 'tree'],
    count: 12,
  },
  {
    id: 'center-right',
    position: { x: 10, y: 0, z: -5 },
    spread: { x: 5.2, z: 4.0 },
    prefabs: ['crate', 'barrel', 'grass', 'tree'],
    count: 12,
  },
  {
    id: 'south-left',
    position: { x: -9, y: 0, z: 13 },
    spread: { x: 4.6, z: 3.8 },
    prefabs: ['barrel', 'fence', 'tree', 'grass'],
    count: 10,
  },
  {
    id: 'south-right',
    position: { x: 9, y: 0, z: 14 },
    spread: { x: 4.6, z: 3.8 },
    prefabs: ['crate', 'barrel', 'fence', 'grass'],
    count: 10,
  },
];

export const HOUSE_CONFIGS = [
  {
    lane: -1,
    row: 0,
    sign: {
      type: 'text',
      text: '歡迎來到我的3D世界',
      color: '#000000',
      backgroundColor: '#ffffff',
      font: '48px Arial',
    },
    interior: {
      back: { type: 'image', src: 'images/photo1.png' },
    },
  },
  {
    lane: 1,
    row: 0,
    sign: { type: 'image', src: 'images/photo1.png' },
    interior: {
      back: {
        type: 'text',
        text: '這是房子裡面的文字內容',
        color: '#000000',
        backgroundColor: '#ffffff',
        font: '24px sans-serif',
      },
    },
  },
  {
    lane: -1,
    row: 1,
    sign: { type: 'image', src: 'images/photo1.png' },
    interior: {
      back: { type: 'image', src: 'images/photo1.png' },
    },
  },
  {
    lane: 1,
    row: 1,
    sign: {
      type: 'text',
      text: '我是張正誠，熱愛程式設計',
      color: '#ffffff',
      backgroundColor: '#000000',
      font: '36px sans-serif',
    },
    interior: {
      back: {
        type: 'text',
        text: '內部: 這裡是房子裡面',
        color: '#0000ff',
        backgroundColor: '#ffffff',
        font: '24px sans-serif',
      },
      left: {
        type: 'text',
        text: '內部: 這裡是房子左邊牆面',
        color: '#0000ff',
        backgroundColor: '#000000',
        font: '24px sans-serif',
      },
      right: {
        type: 'text',
        text: '內部: 這裡是房子右邊牆面',
        color: '#ffffff',
        backgroundColor: '#000000',
        font: '24px sans-serif',
      },
    },
  },
];
