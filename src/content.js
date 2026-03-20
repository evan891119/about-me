// Legacy house config (kept for backward reference, no longer used in main museum flow)
export const HOUSE_LAYOUT = {
  houseOffset: 6,
  zPositions: [-15, 5],
};

export const MUSEUM_ZONES = [
  {
    id: 'intro',
    quadrant: 'nw',
    title: '序章館',
    sign: '歡迎來到我的 3D 博物館',
    back: '我是張正誠，專注在 AI 技術研究。',
    left: '建議動線：序章 -> 技能 -> 作品 -> 聯絡。',
    right: '目標：把技術做成有記憶點、可被感受到的體驗。',
  },
  {
    id: 'skills',
    quadrant: 'ne',
    title: '技能館',
    sign: 'Skills / Tech Stack',
    back: 'Three.js、Rapier、WebGL、互動設計與效能優化。',
    left: '前端工程：架構拆分、可維護模組、可測試流程。',
    right: '3D 實作：場景、光照、互動、物理與內容整合。',
  },
  {
    id: 'projects',
    quadrant: 'sw',
    title: '作品館',
    sign: 'Selected Works',
    back: '代表作聚焦在「體驗敘事 + 技術落地 + 效能穩定」。',
    left: '每個專案都用問題 -> 做法 -> 成果來呈現。',
    right: '重視可操作與可展示，不只做漂亮畫面。',
  },
  {
    id: 'contact',
    quadrant: 'se',
    title: '聯絡館',
    sign: "Let's Build Together",
    back: '歡迎合作：互動官網、3D 展示、品牌體驗空間。',
    left: 'GitHub: github.com/evan891119  Email: sneezycat@sneezycat.dev',
    right: '如果你有想法，我可以幫你把它做成可互動的作品。',
  },
];

export const PROP_LAYOUT = [
  {
    id: 'north-left',
    position: { x: -18, y: 0, z: -34 },
    spread: { x: 6.5, z: 4.8 },
    prefabs: ['crate', 'barrel', 'fence', 'tree'],
    count: 10,
  },
  {
    id: 'north-right',
    position: { x: 18.5, y: 0, z: -33 },
    spread: { x: 6.2, z: 4.8 },
    prefabs: ['crate', 'barrel', 'tree', 'grass'],
    count: 11,
  },
  {
    id: 'center-left',
    position: { x: -24, y: 0, z: -2 },
    spread: { x: 4.8, z: 6.2 },
    prefabs: ['crate', 'fence', 'grass', 'tree'],
    count: 12,
  },
  {
    id: 'center-right',
    position: { x: 24, y: 0, z: -1 },
    spread: { x: 4.8, z: 6.2 },
    prefabs: ['crate', 'barrel', 'grass', 'tree'],
    count: 12,
  },
  {
    id: 'south-left',
    position: { x: -17.5, y: 0, z: 34 },
    spread: { x: 6.2, z: 4.8 },
    prefabs: ['barrel', 'fence', 'tree', 'grass'],
    count: 10,
  },
  {
    id: 'south-right',
    position: { x: 17.5, y: 0, z: 34 },
    spread: { x: 6.2, z: 4.8 },
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
