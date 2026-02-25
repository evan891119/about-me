# ART DIRECTION

## Vision Statement
這個專案的最終視覺目標是：

`Stylized Low-Poly + Diorama + Cinematic Warm Lighting`

關鍵氣質：
- 可愛但不是幼稚，偏「玩具戰場/微縮場景」氛圍
- 幾何簡化、輪廓清楚、色塊乾淨
- 暖色主光 + 軟陰影 + 輕度 Bloom，形成電影感

## Visual Pillars
1. Low-Poly:
   - 幾何形體優先，避免過度高頻細節。
2. Diorama:
   - 像桌上模型，空氣透視與霧層有微縮感。
3. Cinematic Warm:
   - 黃昏暖調是預設主語言，夜景維持可視性與局部亮點。

## Color Script
- Day:
  - Sky/Fog: 柔和米黃與淺灰藍，避免刺眼純藍。
  - Ground: 去飽和黃綠/灰棕。
- Dusk (hero):
  - 主調：橙金 + 琥珀。
  - 高光偏暖，陰影偏冷紫藍，形成色溫對比。
- Night:
  - 低飽和深藍灰底色。
  - 路燈與手電筒提供局部焦點與導視。

## Lighting Bible
- DirectionalLight:
  - 由時間驅動角度與強度。
  - 顏色在 day/dusk/night 間平滑插值。
- HemisphereLight:
  - 補環境光，不可讓陰影區塊死黑。
- Street Lights:
  - 夜晚偏暖、範圍控制，避免全場泛白。
- Flashlight:
  - 暖白、邊緣柔和，不用冷白硬邊。

## Material Bible
- 原則：高 roughness、低 metalness，壓低寫實反光。
- 常用範圍：
  - roughness: 0.75 ~ 0.95
  - metalness: 0.00 ~ 0.10
- 看板與內容圖像：
  - 允許少量色偏校正，避免貼圖與世界脫節。

## Prop Density Rules
- 每個區塊使用「小群組」而不是單顆大型物件（2~5 物件為一群）。
- 優先使用：
  - 木箱堆（crate stack）
  - 桶子群（barrel cluster）
  - 圍欄與告示（fence + sign）
  - 低多邊形樹與草叢
- 目標是 360 度視角都能看到前景/中景/後景層次，而非只有建築牆面。

## Camera Composition Rules
- 遊玩模式維持第一人稱。
- 展示模式（`V`）使用固定高機位斜俯角構圖。
- 展示模式 FOV 以 `showcaseFov` 為準（避免過廣角造成玩具感流失）。
- 截圖請優先採用 `docs/SHOTLIST.md` 的三個固定機位。

## Post Process Recipe
- Tone Mapping: ACESFilmic
- Output Color Space: sRGB
- Bloom:
  - strength: 0.22
  - radius: 0.35
  - threshold: 0.78
- 原則：
  - Bloom 要「感覺到」，但不能吃掉 UI 與文字可讀性。

## Performance Budget
- 目標:
  - Desktop: 常態 60 FPS
- 策略:
  - `pixelRatioMax` 控制渲染成本
  - `postFX.quality` 提供 low/med/high 降階
  - 陰影 map size 優先維持在 1024 以下（必要時降到 512）

## Acceptance Checklist
1. 功能不回歸：移動、開門、手電筒、日夜循環、碰撞通行均正常。
2. 白天畫面不刺眼，色調偏柔和暖色。
3. 黃昏畫面有明顯暖色電影感。
4. 夜景仍可導航，路燈與手電筒是主要焦點。
5. Bloom 不讓提示文字與介面糊掉。
6. 場景有穩定道具密度，遠景不空、近景不亂。
