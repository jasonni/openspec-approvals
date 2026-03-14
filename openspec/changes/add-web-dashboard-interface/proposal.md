## Why

目前的 approvals dashboard 已支援核心審查流程，但仍缺少 spec-driven 工作情境所期待的完整 Web Dashboard 體驗（如總覽指標、任務導向進度視圖與儀表板優先導覽）。我們應在此階段補齊這些能力，以提升可視性、降低審查摩擦，並讓本專案與 CLI 團隊常用的 Web Dashboard 介面期待一致。

## What Changes

- 新增以 Web Dashboard 為核心的使用體驗，提供專案層級總覽指標（進行中 spec/change、任務總數、完成進度、近期活動）。
- 新增專用的規格詳情體驗，提供 requirements、design、tasks 的文件導覽。
- 新增任務管理體驗，支援階層式任務顯示、分段進度與可操作任務動作。
- 新增更清晰的儀表板導覽模式（可直達路由與鍵盤可及流程），加速總覽、規格詳情與任務視圖切換。
- 擴充即時更新行為，對外顯示連線狀態與面向使用者的 spec/task/approval 更新通知。
- 新增儀表板客製化與可及性基準需求（主題行為、響應式版面、鍵盤/螢幕閱讀器支援）。

## Capabilities

### New Capabilities

- `web-dashboard-interface`：提供瀏覽器儀表板能力，用於檢視與導覽 spec artifacts、任務進度、核准狀態與專案即時更新。

### Modified Capabilities

- 無。

## Impact

- 影響 `app/` 內的路由與 UI 組成（儀表板總覽、詳情視圖、導覽介面）。
- 需要在 `app/components` 與 `lib/` 增補元件/狀態邏輯，用於進度彙整、任務階層處理與連線/通知狀態。
- 可能需要調整 `app/api/` 的介面，以支援任務導向與即時儀表板資料。
- 需更新共享 CSS/版面資源中的樣式與可及性支援。
