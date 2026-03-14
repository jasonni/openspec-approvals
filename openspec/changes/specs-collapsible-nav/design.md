## Context

目前 `ReviewClient.tsx` 中的側邊導航會將所有 artifacts 以平面列表方式呈現。當一個 change 包含多個 specs 時，每個 spec 都會獨立顯示在導航列表中。雖然已修復每個 spec 顯示正確名稱的問題，但當 spec 數量較多時，導航列表會過長，影響使用體驗。

現有架構：
- `Artifact` 類型包含 `type`、`path`、`content`、`headings`、`specId`
- `ReviewClient` 使用 `getArtifactKey()` 和 `getArtifactLabel()` 處理 artifact 識別和顯示
- 導航使用 `artifacts.map()` 遍歷所有 artifacts 並渲染按鈕

## Goals / Non-Goals

**Goals:**
- 當有多個 specs 時，將它們群組到一個可折疊的 "Specs" 父項目下
- 點擊 "Specs" 可展開/收合子項目列表
- 當只有單一 spec 時，維持原本的平面顯示（不需要折疊）
- 保持現有的 spec 選擇和內容切換功能

**Non-Goals:**
- 不修改其他 artifact 類型（proposal, design, tasks）的顯示方式
- 不改變 API 或資料結構
- 不處理巢狀的 specs 結構（specs 內還有子資料夾）

## Decisions

### 1. 折疊狀態管理

**決定**: 使用 React `useState` 在 `ReviewClient` 元件內管理折疊狀態

**原因**:
- 折疊狀態是純 UI 狀態，不需要持久化
- 保持在單一元件內管理，避免增加複雜度
- 當選中的是 spec 時，自動展開 Specs 群組

**替代方案考量**:
- URL query param: 過度設計，折疊狀態不需要分享或書籤
- localStorage: 增加複雜度但收益有限

### 2. 導航結構

**決定**: 條件渲染 - 多個 specs 顯示折疊群組，單一 spec 顯示平面項目

```
多個 specs 時:
├── Proposal
├── Design
├── Specs (可折疊)
│   ├── Otp Login
│   ├── Otp Register
│   └── Password Management
└── Tasks

單一 spec 時:
├── Proposal
├── Design
├── User Auth  (直接顯示 spec 名稱)
└── Tasks
```

**原因**:
- 單一 spec 不需要額外層級
- 保持介面簡潔

### 3. 折疊指示器

**決定**: 使用箭頭符號（▶/▼）作為展開/收合指示器

**原因**:
- 簡單且通用的 UI 模式
- 不需要額外的圖標庫

## Risks / Trade-offs

| 風險 | 緩解措施 |
|------|----------|
| 折疊狀態在頁面重新整理後會重置 | 當 activeKey 是 spec 時自動展開，確保使用者不會找不到已選中的項目 |
| 增加程式碼複雜度 | 將折疊邏輯封裝成獨立函數，保持可讀性 |
