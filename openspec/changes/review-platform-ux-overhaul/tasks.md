## 1. 基礎閱讀體驗（Phase 1）

- [ ] 1.1 合併 `/spec/[id]` 和 `/changes/[id]` 為 `/review/[id]`，建立新路由
- [ ] 1.2 實作三欄 layout（左：artifact nav / 中：文件 / 右：panel）
- [ ] 1.3 加入 proposal tab 到 artifact 導覽，更新 `spec-docs.ts` 對應邏輯
- [ ] 1.4 Markdown 閱讀優化：加入 `rehype-slug`（heading anchor）
- [ ] 1.5 Markdown 閱讀優化：加入 `remark-gfm`（表格、checkbox 支援）
- [ ] 1.6 Markdown 閱讀優化：Code block 加 syntax highlighting（shiki）
- [ ] 1.7 設定中欄 `max-width: 720px`，`line-height: 1.8` 閱讀優化樣式
- [ ] 1.8 Dashboard 精簡：主要顯示「待 review」，移除/摺疊 task 進度
- [ ] 1.9 保留舊路由 redirect 以維持向下相容

## 2. Inline Commenting（Phase 2）

- [ ] 2.1 建立 `inline_comments` 資料表 schema
- [ ] 2.2 建立 `review_sessions` 資料表 schema
- [ ] 2.3 實作 `POST /api/comments` 新增 comment API
- [ ] 2.4 實作 `GET /api/comments?changeId=&artifactType=` 取得 comments API
- [ ] 2.5 實作 `PATCH /api/comments/[id]` resolve/reply API
- [ ] 2.6 段落 anchor 系統：自訂 `react-markdown` renderer，為 heading 和 paragraph 加 `id`
- [ ] 2.7 段落 anchor 系統：`Paragraph` component 加 `data-paragraph-id` attribute
- [ ] 2.8 文字選取 UX：實作 `useSelection` hook，監聽 `mouseup`
- [ ] 2.9 文字選取 UX：計算選取文字和所屬 paragraph ID
- [ ] 2.10 實作 `CommentPopover` component，浮現在選取位置
- [ ] 2.11 右欄 Comment Panel：按 paragraph 位置排序顯示所有 comments
- [ ] 2.12 右欄 Comment Panel：點擊 comment 跳到文件對應位置（`scrollIntoView`）
- [ ] 2.13 實作 Comment Thread：Reply 功能
- [ ] 2.14 實作 Comment Thread：Resolve/Reopen 功能

## 3. Review Session 與狀態機（Phase 3）

- [ ] 3.1 實作 Review Session：Draft → Submit flow
- [ ] 3.2 右欄底部：整體 review comment 輸入框 + decision 按鈕
- [ ] 3.3 Submit Review 前顯示 summary（X comments, decision）
- [ ] 3.4 Change 狀態機：定義 Open / Under Review / Changes Requested / Approved 狀態
- [ ] 3.5 Change 狀態機：實作狀態轉換邏輯
- [ ] 3.6 Dashboard 按狀態分組顯示 changes
- [ ] 3.7 Reviewer 設定：首次進入提示設定名稱，存在 localStorage

## 4. 進階功能（Phase 4）

- [ ] 4.1 Comment resolution 即時通知（利用現有 SSE 基礎）
- [ ] 4.2 Multi-reviewer 聚合視圖：顯示所有 reviewer 的狀態
- [ ] 4.3 Diff view：比較兩次 review 之間的文件變化
- [ ] 4.4 Export review as PDF / Markdown
