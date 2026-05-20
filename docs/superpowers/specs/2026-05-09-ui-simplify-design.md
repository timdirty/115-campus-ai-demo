# UI 簡化設計 — 三 App 做減法

**日期：** 2026-05-09  
**目標：** 取消首頁、直接進重點介面、讓小學生/評審秒懂

---

## App 1 — AI 白板助教

### 問題
首頁塞了說明卡（DEMO_STEPS、主流程、現場可靠性）、5 個 StatusTile、SavedNotePanel、QuickNotePanel，全是說明文字不是操作。

### 改動

**Tab 重命名**
- `home` → `whiteboard`（id 改 `whiteboard`，label 改「白板」）
- 所有引用 `'home'` 的地方一起改：`AppTab` type、`appTabs` 陣列、`getPage` switch、nav buttons、`TourProvider` 預設、`tourSteps`

**Home.tsx 砍掉的區塊**
- `DEMO_STEPS` 三步驟卡片整段
- 主流程說明卡（含「前往教師決策」按鈕的那個 grid）
- 現場可靠性卡（右側 `rounded-3xl border` 區塊）
- `<motion.section>` StatusTile 那一整排（5 個磚）
- `<SavedNotePanel>` 和 `<QuickNotePanel>`

**Home.tsx 保留的區塊**
- `<NoticeBar>`（橋接/攝影機狀態通知，必要）
- `<CapturePanel>`（拍板 + 分析，核心操作）
- `<RegionTaskPanel>`（區塊決策，核心操作）
- OCR result panel（辨識結果，行動相關）

**Nav**
- 手機版：維持 6 格（3×2），首格從「首頁」改「白板」
- 桌面版：左側 WebNav 同步改標籤

**預設 tab**
- `useState<AppTab>('whiteboard')`（原本是 `'home'`）

---

## App 2 — 校園服務機器人

### 問題
Dashboard 是系統總覽頁，評審第一眼看到數字不是機器人在動。

### 改動

**移除 dashboard tab**
- `activeTab` 預設改 `'delivery'`
- `TABS` 陣列刪掉 `dashboard` 項目
- `TourProvider` 的 `onTabChange` 回呼仍保留，但 tour 起點改 `delivery`
- Dashboard 頁內「入口按鈕/task-stats/robot-status/dispatch 入口」搬到 `DeliveryView` 頭部（一個摘要 row）

**Nav 從 4 格改 3 格**
- 手機底部 nav：`grid-cols-4` → `grid-cols-3`
- primary delivery 浮起按鈕：維持中央浮起樣式
- 桌面 sidebar：刪掉 `dashboard` nav item

**AI 狀態指示燈（header）**
- 位置：header 右側頭像左邊
- 3 個狀態：`null` = 灰色轉圈（checking）、`true` = 綠點（AI 連線中）、`false` = 琥珀點（本機模式）
- `proxyOnline` 和 `hwStatus` 分開：左燈 = AI proxy，右燈 = 硬體 bridge（不合并）

**DashboardView 組件**
- 不刪檔案，保留但不再路由到它
- 將其中的「進行中任務數」「已完成數」「指令紀錄數」三個數字搬進 DeliveryView 頂部 summary bar

---

## App 3 — AI 心靈守護者

### 問題
5 個 panel 並排、沒有主角、進去不知從哪開始。

### 改動

**主佈局：雙欄**
- 左 70%：`CampusMapSvg` + `EmotionHeatmap` 常駐顯示（主角）
- 右 30%：永遠顯示（不被 panel 遮住）
  - 最新 top-3 預警列表（`openAlerts.slice(0, 3)`）
  - 派遣機器人快速按鈕（高風險區）
  - 感測器連線狀態 pill

**Panel nav 砍成 3 個**

| 舊 id | 新 id | 說明 |
|---|---|---|
| `alerts` | `alerts` | 預警（保留） |
| `care` | `care` | 照護（保留） |
| `nodes` | `robot` | 改名為「機器人」，內容不變（GuardianControlPanel + GuardianDriveDock 在此） |
| `sensing` | — | 刪除（聲音分析資料移到右 30% sensor pill） |
| `logs` | — | 刪除（移進右上角設定 icon 的底抽屜） |

**型別更新**
- `ActivePanel` type：`'alerts' | 'care' | 'robot' | null`
- `panelNav` 陣列：更新 3 筆
- 所有 `nodes` 引用改 `robot`

**預設 panel**
- 維持 `activePanel = null`（地圖可見）
- 右側 30% top-3 預警讓使用者知道有東西在動，不需要預開抽屜

**手機版**
- 地圖滿版顯示
- 底部 3 個 tab（預警/照護/機器人），點擊展開底部抽屜

---

## 各 App 改動範圍摘要

| App | 主要改動檔案 |
|---|---|
| App 1 | `App.tsx`（tab 重命名）、`pages/Home.tsx`（砍說明區塊）、`tourSteps.ts` |
| App 2 | `App.tsx`（tab/nav/header 指示燈）、`views/DeliveryView.tsx`（加摘要 row） |
| App 3 | `App.tsx`（佈局/panel/型別）、`guardianUi.tsx`（右側 30% 組件） |
