## ADDED Requirements

### Requirement: 多個 Specs 顯示為可折疊群組

當一個 change 包含兩個或更多 specs 時，系統 SHALL 將這些 specs 群組到一個名為「Specs」的可折疊導航項目下。

#### Scenario: 顯示折疊的 Specs 群組
- **WHEN** change 包含 2 個或更多 specs
- **THEN** 導航列表顯示一個「Specs」父項目
- **AND** 「Specs」項目顯示折疊/展開指示器（箭頭符號）

#### Scenario: 展開 Specs 群組
- **WHEN** 使用者點擊「Specs」項目
- **THEN** 該群組展開，顯示所有子 spec 項目
- **AND** 每個子 spec 顯示其對應名稱（如「Otp Login」）

#### Scenario: 收合 Specs 群組
- **WHEN** Specs 群組已展開
- **AND** 使用者再次點擊「Specs」項目
- **THEN** 該群組收合，隱藏所有子 spec 項目

### Requirement: 單一 Spec 維持平面顯示

當 change 只包含一個 spec 時，系統 SHALL 直接顯示該 spec 項目，不使用折疊群組。

#### Scenario: 單一 spec 平面顯示
- **WHEN** change 只包含 1 個 spec
- **THEN** 該 spec 直接顯示在導航列表中（與 Proposal、Design、Tasks 同層級）
- **AND** 顯示其對應名稱而非「Specs」

### Requirement: 選中 Spec 時自動展開群組

當使用者選中的項目是某個 spec 時，系統 SHALL 自動展開 Specs 群組。

#### Scenario: 進入頁面時已選中 spec
- **WHEN** 頁面載入時 activeKey 對應某個 spec
- **THEN** Specs 群組自動展開
- **AND** 該 spec 項目顯示為選中狀態

#### Scenario: 從其他 artifact 切換到 spec
- **WHEN** 使用者點擊某個子 spec 項目
- **THEN** Specs 群組保持展開
- **AND** 該 spec 內容顯示在主內容區域

### Requirement: Specs 群組顯示位置

Specs 群組（或單一 spec）SHALL 顯示在 Design 和 Tasks 之間。

#### Scenario: 導航項目排序
- **WHEN** 導航列表渲染時
- **THEN** 項目順序為：Proposal → Design → Specs（或單一 spec）→ Tasks
