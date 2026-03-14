## 背景脈絡

現有的 OpenSpec Review Platform 已具備基礎審查流程（專案選擇、變更列表、artifact 詳情、核准送出），但 UX 設計以「debug tool」邏輯堆疊，而非針對「閱讀文件 + 批注」的互動模型。核心問題包括：

- Spec 閱讀和 Review 操作分離在兩個頁面
- 沒有 inline comment 的 UX 預設
- Markdown 在 100% 寬度的 card 裡渲染，缺乏閱讀體驗優化
- Dashboard 是功能堆疊，對 reviewer 沒有意義的 metric cards

## 目標 / 非目標

**目標：**

- 提供 GitHub PR Review 風格的 inline commenting 體驗
- 合併閱讀與審查為單一 Review Page，消除 flow 中斷
- 建立 Review Session 機制，支援 draft → submit 流程
- 優化文件閱讀體驗（max-width、spacing、syntax highlighting）
- Dashboard 轉型為 Review Hub，以「待 review」為核心

**非目標：**

- **不做 real-time 協作編輯**：這是 review 工具，不是 Google Docs
- **不做完整的用戶認證系統**：本地工具，reviewer 名稱用 localStorage 即可；GitHub OAuth 是未來的事
- **不做文件版本管理**：OpenSpec 已經在 git 裡，diff 透過 git log 取得即可
- **不做 AI 輔助 review**：先把人工 review 流程做對

## 設計決策

### 1) 頁面架構：三欄 Review Page

採用三欄 layout 作為核心 Review Page（`/review/[changeId]`）：

```
┌──────────┬────────────────────────────┬──────────────────┐
│ Artifact │                            │  Review Panel    │
│  Nav     │    Document Content        │                  │
│          │    (閱讀體驗優化)           │  • Comments (3)  │
│ proposal │                            │  • Decision:     │
│ design ● │    ## 系統架構             │    [Approve]     │
│ tasks    │    這個設計採用...          │    [Req Changes] │
│          │                            │                  │
│          │    > 💬 [selected text]    │  Submit Review   │
│          │       [Comment popover]    │                  │
└──────────┴────────────────────────────┴──────────────────┘
```

- **左欄（160px）**：Artifact 切換，顯示各 artifact 的 comment 數
- **中欄（max-width: 720px）**：文件內容，支援文字選取 → comment popover
- **右欄（300px）**：Comments panel + Review 決策 + 歷史記錄

**選擇原因：** GitHub PR Review 證明此模式有效，三欄職責清晰分離。
**評估替代方案：** Tab 切換 + 底部評論區。此方案無法同時看文件和評論，flow 較差。

### 2) 路由整合：合併 `/spec` 和 `/changes` 為 `/review`

- 刪除 `/spec/[id]` 和 `/changes/[id]` 分離設計
- 新增 `/review/[changeId]` 作為唯一入口
- 保留舊路由的 redirect 以維持向下相容

**選擇原因：** 消除「先去 spec 頁讀文件，再去 changes 頁提交」的流程中斷。

### 3) 段落 Anchor 系統

Markdown 渲染時為每個 heading/paragraph 生成穩定 ID：

- Heading：slug of text（`## 系統架構` → `id="系統架構"`）
- Paragraph：`p-{index}` 或 content hash 前 8 字元

使用 `rehype-slug` + 自訂 renderer 實作，最小侵入性，與現有 `react-markdown` 相容。

**選擇原因：** Comment 錨定需要穩定 ID，不儲存 offset（文件更新後 offset 失效）。

### 4) Comment 位置儲存：`paragraph_id` + `selected_text`

```sql
inline_comments (
  paragraph_id TEXT NOT NULL,   -- heading slug 或 paragraph hash
  selected_text TEXT NOT NULL,  -- 被圈選的原文（顯示 context）
)
```

**選擇原因：** 段落錨定比字元 offset 更穩定，文件小幅修改後 comment 仍能定位。

### 5) Review Session 獨立資料表

新增 `review_sessions` 表，與現有 `approvals` 表解耦：

```sql
CREATE TABLE review_sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  change_id TEXT NOT NULL,
  reviewer TEXT NOT NULL,
  status TEXT NOT NULL,  -- draft | submitted
  decision TEXT,         -- approve | request_changes | reject
  body TEXT NOT NULL DEFAULT '',
  submitted_at TEXT,
  created_at TEXT NOT NULL
);
```

**選擇原因：** Draft → Submit 的生命週期與現有 approval 一次性送出不同，獨立表更清晰。

### 6) 文字選取：原生 `window.getSelection()` API

- `useSelection` hook：監聽 `mouseup`，計算選取文字和所屬 paragraph ID
- `CommentPopover` component：浮現在選取位置，submit 後消失

**選擇原因：** 原生 API，不需額外 library，與各種 markdown 渲染結果相容。

### 7) Design System 調整

**Typography（閱讀體驗）：**
- 中欄 markdown 設 `max-width: 720px`，`line-height: 1.8`，`font-size: 16px`
- Heading 加入 anchor link，支援 URL deep-link
- Code blocks 加 syntax highlighting（`shiki` server-side）

**Color Semantic：**
- `--comment-pending`: `#fef3c7`（黃）— 未解決的 comment 高亮
- `--comment-resolved`: `#f0fdf4`（綠）— 已 resolve
- `--review-draft`: `#eff6ff`（藍）— 正在進行的 review session

**Spacing 系統：**
- 建立 4px 基準：`4 / 8 / 12 / 16 / 24 / 32 / 48`

### 8) 三欄 Layout 實作

採用 CSS Grid + `position: sticky`，右欄 sticky 讓 comments panel 跟著文件滾動。

**選擇原因：** 現代 CSS 方案，無需 JS 計算，效能佳。

## 資料模型擴充

### 新增：`inline_comments` 表

```sql
CREATE TABLE inline_comments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  change_id TEXT NOT NULL,
  artifact_type TEXT NOT NULL,  -- proposal/design/tasks/spec

  -- 位置錨定
  paragraph_id TEXT NOT NULL,
  selected_text TEXT NOT NULL,

  -- 內容
  author TEXT NOT NULL,
  body TEXT NOT NULL,
  parent_id TEXT,               -- NULL = root comment, 有值 = reply

  -- 狀態
  status TEXT NOT NULL DEFAULT 'open',  -- open | resolved
  resolved_by TEXT,
  resolved_at TEXT,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 新增：`review_sessions` 表

```sql
CREATE TABLE review_sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  change_id TEXT NOT NULL,
  reviewer TEXT NOT NULL,
  status TEXT NOT NULL,  -- draft | submitted
  decision TEXT,         -- approve | request_changes | reject
  body TEXT NOT NULL DEFAULT '',
  submitted_at TEXT,
  created_at TEXT NOT NULL
);
```

## 風險 / 取捨

- **[Risk]** 段落 ID 在文件大幅重構後可能失效，導致 comment 錨定失敗。
  **→ Mitigation:** 保留 `selected_text` 作為 fallback context 顯示，並在 UI 標示「此 comment 原始位置已變更」。

- **[Risk]** 三欄 layout 在小螢幕上難以使用。
  **→ Mitigation:** 響應式設計，小螢幕時切換為 tab 模式或 overlay panel。

- **[Risk]** Review Session 的 draft 狀態可能讓使用者忘記 submit。
  **→ Mitigation:** Dashboard 顯示「你有 X 個未送出的 review」提醒。

## 遷移計畫

1. **Phase 1**：基礎閱讀體驗改造，不動功能邏輯
   - 合併頁面、三欄 layout、proposal tab、markdown 優化

2. **Phase 2**：Inline Commenting 完整實作
   - DB 建表、API 路由、文字選取 UX、Comment Panel

3. **Phase 3**：Review Session 與狀態機
   - Draft/Submit flow、Change 狀態機、Dashboard 整合

4. **Phase 4**：進階功能按優先級排
   - 即時通知、Multi-reviewer 聚合、Diff view

## 待確認問題

- 段落 ID 生成策略：使用 index 還是 content hash？Hash 更穩定但需處理更新時的重新計算
- Comment 是否支援 markdown 格式？
- Mobile 體驗的優先級？
