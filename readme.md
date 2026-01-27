# about-me: 3D 個人展示 / 博物館

這是一個用 Three.js + Rapier 做的第一人稱 3D 場景：
- WASD 移動，滑鼠旋轉視角，Space 跳躍
- 點擊門可以開關
- 天空會依時間變化（白天 / 夜晚 / 星星 / 月亮）

## 如何在本機跑起來

這個專案是純前端 ES Modules，請用本機靜態伺服器（不要直接雙擊 `index.html`）。

如果你有 Python 3：

```bash
python3 -m http.server 4173
```

然後打開：
- `http://localhost:4173`

## 專案結構（重點）

- 入口：`index.html`, `main.js`
- 場景內容：`src/content.js`
- 世界生成：`src/world/WorldBuilder.js`
- 玩家控制：`src/player/PlayerController.js`
- 物理：`src/physics/Physics.js`, `src/systems/StaticColliderSystem.js`
- 互動：`src/systems/InteractionSystem.js`, `src/systems/DoorSystem.js`
- 天空 / 打光：`src/systems/SkySystem.js`

## 如何改內容（最快）

請直接改：`src/content.js`

- `HOUSE_LAYOUT`：控制房子排版（橫向偏移與每一列的 z 位置）
- `HOUSE_CONFIGS`：每一棟房子的內容
  - `lane`: -1（左側）或 1（右側）
  - `row`: 第幾列（對應 `HOUSE_LAYOUT.zPositions`）
  - `sign`: 外牆招牌
  - `interior`: 內牆內容（back / left / right）
