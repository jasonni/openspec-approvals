## Why

當一個 change 包含多個 specs 時，側邊欄導航會將所有 spec 都顯示為 "Requirements"，無法區分不同的 spec。此外，當 spec 數量較多時，導航列表會變得很長，影響使用體驗。需要改善導航結構，讓多個 specs 可以被正確識別並以可折疊的方式呈現。

## What Changes

- 修正多個 specs 的顯示問題，每個 spec 現在會顯示其對應的名稱（如 "Otp Login"、"Password Management"）而非全部顯示 "Requirements"
- 新增可折疊的 "Specs" 導航項目，當有多個 specs 時，會顯示一個 "Specs" 父項目，點擊可展開/收合顯示子項目
- 當只有單一 spec 時，維持原本的平面顯示方式

## Capabilities

### New Capabilities

- `collapsible-specs-nav`: 可折疊的 Specs 導航功能，將多個 specs 群組到一個可展開的 "Specs" 項目下

### Modified Capabilities

（無）

## Impact

- `app/review/[changeId]/ReviewClient.tsx`: 修改導航渲染邏輯，支援折疊展開
- `lib/types.ts`: Artifact 類型已新增 `specId` 欄位
- `lib/openspec.ts`: 已修改 `collectArtifacts` 函數以提取 specId
- `app/globals.css`: 可能需要新增折疊導航的樣式
