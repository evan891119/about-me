export const HOUSE_LAYOUT = {
  houseOffset: 6,
  zPositions: [-15, 5],
};

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
