# about-me: 3D 個人博物館

這是一個用 Three.js + Rapier 做的第一人稱 3D 個人博物館：
- WASD 移動，滑鼠旋轉視角，Space 跳躍
- V 切換展示鏡頭（高機位斜俯視）
- 點擊門可以開關
- 天空會依時間變化（白天 / 夜晚 / 星星 / 月亮）

## 視覺風格目標

目前專案視覺方向為：

`Stylized Low-Poly + Diorama + Cinematic Warm Lighting`

完整美術規格請看：`docs/ART_DIRECTION.md`

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

- `MUSEUM_ZONES`：四展區內容（intro / skills / projects / contact）
  - `quadrant`: `nw/ne/sw/se`
  - `title`: 展區標題
  - `sign`: 區塊主標
  - `back/left/right`: 展牆文案
