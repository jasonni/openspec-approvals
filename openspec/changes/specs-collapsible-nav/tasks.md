## 1. 折疊狀態管理

- [x] 1.1 在 ReviewClient 中新增 `specsExpanded` 狀態管理展開/收合
- [x] 1.2 實作自動展開邏輯：當 activeKey 是 spec 時自動展開

## 2. 導航渲染邏輯

- [x] 2.1 新增輔助函數判斷是否有多個 specs
- [x] 2.2 將 artifacts 分組：非 spec 類型 + spec 類型
- [x] 2.3 實作條件渲染：多個 specs 顯示折疊群組，單一 spec 平面顯示
- [x] 2.4 確保導航順序：Proposal → Design → Specs → Tasks

## 3. 折疊群組 UI

- [x] 3.1 實作「Specs」父項目按鈕，包含展開/收合指示器（▶/▼）
- [x] 3.2 新增子項目縮排樣式
- [x] 3.3 實作點擊展開/收合行為

## 4. 測試驗證

- [x] 4.1 驗證多個 specs 場景：顯示折疊群組且可展開收合
- [x] 4.2 驗證單一 spec 場景：平面顯示 spec 名稱
- [x] 4.3 驗證選中 spec 時群組自動展開
- [x] 4.4 驗證切換 spec 時內容正確更新
