# AGENTS.md

## 1) 專案定位

這是一個以 `Three.js + Rapier` 建立的第一人稱 3D 個人展示/博物館專案。  
型態是純前端 `ES Modules`，使用靜態伺服器啟動，不使用打包器。

## 1.5) 視覺方向

目前視覺目標為：

`Stylized Low-Poly + Diorama + Cinematic Warm Lighting`

最終美術規格與驗收標準請以 `docs/ART_DIRECTION.md` 為準。

## 2) 快速啟動

請在專案根目錄執行：

```bash
python3 -m http.server 4173
```

開啟 `http://localhost:4173`。

## 3) 最小驗收清單

每次變更後至少確認以下行為：

1. 點擊遮罩後可進入 Pointer Lock 視角。
2. `W/A/S/D` 移動、滑鼠轉向、`Space` 跳躍正常。
3. `Shift` 衝刺正常。
4. 左鍵對門可開關，提示文字會切換。
5. `E` 可切換手電筒。
6. 日夜循環與路燈亮度變化正常。
7. 玩家不穿牆，且可通過門洞不被門框卡住。

## 4) 架構地圖（先讀這裡）

- 入口與組裝：`index.html`, `main.js`
- 核心循環與輸入：`src/core/App.js`, `src/core/Loop.js`, `src/core/Input.js`
- 物理：`src/physics/Physics.js`, `src/systems/StaticColliderSystem.js`
- 玩家控制：`src/player/PlayerController.js`
- 世界生成：`src/world/WorldBuilder.js`
- 互動系統：`src/systems/InteractionSystem.js`, `src/systems/DoorSystem.js`, `src/systems/SkySystem.js`, `src/systems/FlashlightSystem.js`, `src/systems/ShowcaseCameraSystem.js`
- 後處理：`src/systems/PostFXSystem.js`
- 內容資料：`src/content.js`
- 參數集中設定：`src/config.js`（含 `VISUAL` 視覺參數）

變更前請先讀 `main.js` 的初始化與 update 順序，再改子模組。

## 5) 變更策略

1. 內容展示需求優先改 `src/content.js`（文字、圖片、房屋配置）。
2. 互動或幾何行為再改 `src/world/WorldBuilder.js` 與 `src/systems/*`。
3. 移動/跳躍/互動距離/動畫時間等數值，優先放在 `src/config.js`，避免魔法數字散落。
4. 優先小步修改，避免一次跨多個子系統大改。
5. 視覺風格調整優先改 `src/config.js` 的 `VISUAL`，避免在系統內硬編碼。
6. 視覺調整建議順序：先光照/霧/PostFX，再調材質參數。

## 6) 不可破壞約束

- 不可破壞 `Input.attach()` 的 pointer lock 流程與 blocker 顯示切換。
- 不可中斷 `InteractionSystem` -> `DoorSystem` 的點門互動鏈。
- 不可任意更改玩家膠囊尺寸與門高邏輯（`PlayerController` / `WorldBuilder`）而不重新驗證通行性。
- 若需調整 `main.js` 的 loop update 順序，必須在回報中說明原因與影響。
- 不可隨意移除或繞過 `PostFXSystem` 渲染鏈；若需停用，必須同步更新說明與驗收基準。
- 視覺修改不可與 `docs/ART_DIRECTION.md` 的目標與驗收標準衝突。
- 不可為追求畫面效果而破壞「最小驗收清單」的互動與通行性。

## 7) 常見任務指引

- 新增或調整展區內容：`src/content.js` 的 `HOUSE_LAYOUT`、`HOUSE_CONFIGS`
- 博物館展區內容（主流程）：`src/content.js` 的 `MUSEUM_ZONES`
- 調整移動手感：`src/config.js` 的 `PLAYER`、`PHYSICS`
- 調整門互動距離或動畫速度：`src/config.js` 的 `INTERACTION` 與 `DoorSystem`
- 調整天空與夜間燈光：`src/systems/SkySystem.js` 及 `buildWorld()` 內路燈參數
- 夜晚太暗時，優先調 `src/config.js` 的 `VISUAL.night`（避免直接硬改系統常數）
- 調整整體視覺風格與色調：`src/config.js` 的 `VISUAL`
- 調整 Bloom/後處理表現：`src/systems/PostFXSystem.js` 與 `VISUAL.postFX`
- 調整日夜色腳本與霧層：`src/systems/SkySystem.js` 與 `VISUAL.fog`

## 8) 代理工作流程

1. 先讀 `readme.md` 與 `main.js`，定位改動點。
2. 只改與需求直接相關的檔案，避免順手重構。
3. 變更後完成「最小驗收清單」。
4. 回報時包含：
   - 修改檔案清單
   - 行為變更摘要
   - 驗收結果
   - 已知風險或未驗證項目
   - 若本次含視覺調整，附上 `docs/SHOTLIST.md` 定義的 3 張對照截圖

## 9) 提交前檢查

1. 頁面可正常載入，主流程無阻斷。
2. 瀏覽器 console 無明顯錯誤。
3. 核心互動（移動、開門、手電筒、日夜）可操作。
4. 沒有明顯未使用程式碼或錯誤匯入。
5. Bloom 不影響 HUD/提示文字可讀性。
6. 白天、黃昏、夜晚三種時段畫面都可視且風格一致。
