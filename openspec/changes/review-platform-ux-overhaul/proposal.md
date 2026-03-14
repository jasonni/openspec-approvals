## Why

現有的 OpenSpec Review Platform 以 artifact 層級一刀切的 approval 模式（approve/reject 整個 design.md）為核心，缺乏 GitHub PR Review 的本質體驗：**逐段圈選留下 comment、累積後一次 Submit Review、透過對話達成共識**。

這等於讓 reviewer 只能在整本書的封底貼一張便利貼，而不是在每一頁批注。

### 核心問題

1. **無法逐行圈選**：沒有 inline commenting，無法錨定到具體段落
2. **沒有 Review Session**：每次 approval 立即送出，無法累積 comments 再一次 submit
3. **閱讀與操作分離**：Spec 閱讀（`/spec/[id]`）和 Review 操作（`/changes/[id]`）是兩個頁面，打斷 reviewer flow
4. **UI 是 debug tool 而非 review tool**：所有東西都是 `.card` 堆疊，沒有為閱讀文件 + 批注設計

## What Changes

### Critical — 產品核心功能

- **Inline paragraph comment**：選取文字 → popover → 輸入 comment → 錨定到段落
- **Comment threading**：每個 inline comment 可被回覆（巢狀 thread）
- **Review session model**：累積 comments → 一次 Submit Review（draft → submitted）
- **Comment resolution**：Author 可 resolve comment；reviewer 可重新 open
- **段落 anchor system**：每個段落/heading 有穩定 ID，供 comment 錨定

### Important — 工作流完整性

- **Reviewer identity**：設定 reviewer 名稱（取代 hardcoded `local-reviewer`）
- **Multi-reviewer 聚合**：顯示所有 reviewer 的狀態（X approved, Y requested changes）
- **Review 狀態機**：每個 change 有明確狀態（Open / Under Review / Changes Requested / Approved）
- **`proposal.md` 呈現**：proposal 是最重要的 artifact，應是第一個 tab
- **Comment 位置跳轉**：點擊 comment 可跳到文件中對應段落

### Nice-to-have — 提升效率

- Diff view：看文件從上次 review 後的變化
- @mention / 通知
- 批次操作：一次 approve 多個 changes
- Comment 搜尋：跨 changes 搜尋 comment 內容

## Capabilities

### New Capabilities

- `review-inline-commenting`：提供文字選取、段落錨定、comment popover 的 inline commenting 能力
- `review-session-management`：提供 draft → submitted 的 review session 生命週期管理
- `review-comment-threading`：提供 comment 回覆、resolve、reopen 的對話能力

### Modified Capabilities

- `web-dashboard-interface`：Dashboard 改為 Review Hub 導向，以「待 review」為主要 filter

## Impact

- **路由重組**：合併 `/spec/[id]` 和 `/changes/[id]` 為 `/review/[id]`
- **資料模型**：新增 `inline_comments` 和 `review_sessions` 資料表
- **UI 架構**：Review Page 採用三欄 layout（artifact nav / 文件 / panel）
- **API 路由**：新增 `/api/comments`、`/api/review-sessions` endpoints
- **組件新增**：CommentPopover、CommentThread、ReviewPanel 等核心組件
