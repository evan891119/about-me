# MUSEUM STORYLINE

## Goal
雖然最初以四棟房子的概念出發，現在已改為「單一大型博物館主館 + 四展區」。
敘事目標仍維持同一條參觀路線：

`認識你 -> 看能力 -> 看作品 -> 聯絡合作`

重點不是四塊獨立看板，而是一段連續的個人品牌敘事。

## Route Map
- Zone A（西北）: `intro`
- Zone B（東北）: `skills`
- Zone C（西南）: `projects`
- Zone D（東南）: `contact`

## Zone Briefs

### Zone A（西北）- 起點 / 世界觀
- Theme: 你是誰、這個 3D 空間在展示什麼。
- Primary message: 一句價值主張 + 一句參觀引導。
- Sign suggestion:
  - `歡迎來到我的 3D 世界`
- Interior wall plan:
  - `back`: 角色簡介（名字、定位、主軸）
  - `left`: 這個場景怎麼逛（動線提示）
  - `right`: 你最在意的設計哲學（可選）

### Zone B（東北）- 技能館
- Theme: 技術能力與專長結構。
- Primary message: 3~5 個核心能力，不做冗長敘述。
- Sign suggestion:
  - `Skills / Tech Stack`
- Interior wall plan:
  - `back`: 技能分類（前端、3D、互動、效能）
  - `left`: 常用工具與技術名單
  - `right`: 實務能力（從需求到落地）

### Zone C（西南）- 作品館
- Theme: 代表作與成果證據。
- Primary message: 問題 -> 做法 -> 結果（每案一句）。
- Sign suggestion:
  - `Selected Works`
- Interior wall plan:
  - `back`: 1~2 個代表作縮圖
  - `left`: 專案中的關鍵挑戰
  - `right`: 你怎麼解與帶來的結果

### Zone D（東南）- 聯絡館 / CTA
- Theme: 合作方式與下一步。
- Primary message: 讓觀眾知道如何找你、你想做什麼類型合作。
- Sign suggestion:
  - `Let's Build Together`
- Interior wall plan:
  - `back`: 聯絡方式（Email / GitHub / 社群）
  - `left`: 可合作項目（例如 Web 互動、3D 展示）
  - `right`: 行動呼籲（歡迎聊專案）

## Content Mapping to src/content.js
對應檔案：`src/content.js` 的 `MUSEUM_ZONES`

- 展區標題：
  - `title`
  - `sign`
- 展牆內容：
  - `back`
  - `left`
  - `right`
- 區域位置：
  - 以 `quadrant` 決定方位（`nw/ne/sw/se`）。

## Copy & Typography Guidelines
- 每面牆建議 1 個核心訊息，避免段落過長。
- 中文建議字數：
  - 標題：8~20 字
  - 牆面說明：20~60 字
- 字級建議：
  - `sign.font`: 32px~56px
  - `interior.font`: 22px~32px

## Do / Don't
- Do:
  - 每區只講一個主題。
  - 保持語氣一致（專業、簡潔、可合作）。
  - 最後一區一定要有明確 CTA。
- Don't:
  - 四區都在重複自我介紹。
  - 文案過長導致展牆難讀。
  - 缺少「下一步」資訊（觀眾看完不知道怎麼聯絡）。

## Iteration Checklist
每次改四展區內容前後，至少確認：
1. 參觀動線仍是「認識你 -> 能力 -> 作品 -> 聯絡」。
2. 四區主題沒有重疊。
3. 至少一區提供可量化成果或作品證據。
4. 最後一區 CTA 明確、可立即行動。

## Related Files
- `docs/ART_DIRECTION.md`
- `docs/SHOTLIST.md`
- `src/content.js`
