# App 2 — Spotlight 引導導覽設計 Spec

**Date:** 2026-05-03
**Status:** Approved

## Goal

為「校園服務機器人」App 加入 10 步 Spotlight 引導導覽。幫助學生在比賽 demo 前快速熟悉所有功能，以及練習對評審說明的話術。第一次進入 App 自動啟動，設定頁可重看。

---

## 使用者體驗流程

1. 第一次進 App → 自動啟動導覽（localStorage `tour-app2:v1` 不存在時）
2. 每步顯示：聚光圈框住目標元件 + 說明泡泡 + 🎙 demo 提示
3. 右上角「跳過」隨時結束；下方「上一步 / 下一步」
4. 最後一步按「開始使用」→ 寫入 localStorage、關閉導覽
5. 設定頁「重看導覽」按鈕 → 清除 localStorage → 重新啟動

---

## 10 步導覽內容

| # | Tab | `data-tour` 目標 | 標題 | 說明 | 🎙 Demo 提示 |
|---|---|---|---|---|---|
| 0 | — | 無（全螢幕歡迎卡） | 歡迎！ | 我來帶你認識校園服務機器人的所有功能。大約 2 分鐘，完成後可以隨時從設定重看。 | 「我們開發了一套讓機器人管理校園服務的系統...」 |
| 1 | dashboard | `robot-status` | 機器人狀態 | 這裡顯示目前有幾台機器人上線、電量和所在區域。 | 「目前有 4 台機器人上線，分別部署在不同區域。」 |
| 2 | dashboard | `task-stats` | 今日任務統計 | 一眼看出今天完成幾件、還有幾件待處理。 | 「今天已完成 X 件任務，處理速度提升了 Y%。」 |
| 3 | dashboard | `dispatch-btn` | 校園派遣 | 點這裡開啟地圖，把機器人指派到特定教室或走廊執行任務。 | 「按這個按鈕，我來示範派遣機器人去 A 棟巡邏。」 |
| 4 | teach | `attendance-card` | 智慧出缺席 | 機器人掃描後自動更新出缺席，老師不用一個個點名。 | 「機器人 30 秒內就能完成全班掃描，比傳統點名快 10 倍。」 |
| 5 | teach | `alert-list` | 即時告警 | 同學舉手或分心時這裡會出現提示；點進去 AI 會幫你想回覆內容。 | 「這位同學剛剛舉手，我點進去讓 AI 建議怎麼回應...」 |
| 6 | delivery | `order-list` | 配送任務列表 | 所有配送任務都在這裡，可以看進度或點進去查詳情。 | 「目前有 3 筆配送任務，午餐配送已完成、文具還在途中。」 |
| 7 | delivery | `new-order-btn` | 新增配送任務 | 點這裡填寫目的地和物品，機器人會自動安排最佳路線。 | 「我來示範新增一筆：把 3 年甲班的作業本送到辦公室。」 |
| 8 | life | `life-services` | 廣播與清掃 | 在這裡安排校園廣播內容或清掃機器人的巡邏時間表。 | 「下課廣播和清掃排程都可以提前設定，機器人全自動執行。」 |
| 9 | — | 無（全螢幕完成卡） | 你準備好了！ | 所有功能你都看過了。比賽時按照這個順序介紹效果最好。 | 「謝謝評審，我們的系統可以讓校園服務機器人…（總結一句）」 |

---

## 架構

### 新增檔案

| 檔案 | 職責 |
|---|---|
| `src/components/tour/tourSteps.ts` | 步驟設定陣列（唯一 source of truth） |
| `src/components/tour/TourProvider.tsx` | Context + localStorage 讀寫 + tab 切換觸發 |
| `src/components/tour/TourOverlay.tsx` | Spotlight 渲染（4 個半透明 div 圍住目標 + 說明泡泡） |
| `src/components/tour/useTour.ts` | `useTour()` hook，供各 view 讀取 `isActive` / `currentStep` |

### 修改檔案

| 檔案 | 修改內容 |
|---|---|
| `src/App.tsx` | 包入 `<TourProvider>`；傳 `setActiveTab` 給 Provider；設定頁加「重看導覽」按鈕 |
| `src/views/DashboardView.tsx` | 加 `data-tour` 屬性到：機器人狀態列、任務統計、派遣按鈕 |
| `src/views/TeachView.tsx` | 加 `data-tour` 屬性到：出缺席卡片、告警列表 |
| `src/views/DeliveryView.tsx` | 加 `data-tour` 屬性到：訂單列表、新增訂單按鈕 |
| `src/views/LifeView.tsx` | 加 `data-tour` 屬性到：廣播/清掃區塊 |

---

## TourStep 型別

```ts
type TourStep = {
  id: string;
  tab?: 'dashboard' | 'teach' | 'delivery' | 'life'; // 自動切換到這個 tab
  targetDataTour?: string;   // data-tour 屬性值；undefined = 全螢幕卡
  title: string;
  body: string;
  demoTip: string;           // 🎙 橘色區塊顯示
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right'; // 泡泡偏好方向，預設 bottom
};
```

---

## Spotlight 渲染邏輯（TourOverlay）

```
1. 用 document.querySelector(`[data-tour="${step.targetDataTour}"]`) 找目標元件
2. getBoundingClientRect() 取得位置
3. 渲染 4 個固定定位半透明 div：
   - top:    (0,0) → (fullW, rect.top)
   - bottom: (0, rect.bottom) → (fullW, fullH)
   - left:   (0, rect.top) → (rect.left, rect.bottom)
   - right:  (rect.right, rect.top) → (fullW, rect.bottom)
4. 說明泡泡：絕對定位，根據 tooltipSide 放在目標上下左右
5. ResizeObserver 監聽視窗變化，重新計算位置
```

全螢幕卡（step 0 / step 9）：不渲染 spotlight，直接居中顯示完整卡片。

---

## TourProvider State

```ts
type TourState = {
  isActive: boolean;
  currentStepIndex: number;
};
```

動作：
- `startTour()` — 設 isActive=true, index=0
- `nextStep()` — index+1；超出最後步驟時呼叫 `completeTour()`
- `prevStep()` — index-1
- `skipTour()` — 呼叫 `completeTour()`
- `completeTour()` — isActive=false, localStorage.setItem('tour-app2:v1', 'done')
- `restartTour()` — localStorage.removeItem, 然後 startTour()

Tab 切換：`nextStep()` 時若新步驟有 `tab` 欄位，呼叫 `onTabChange(tab)` callback（由 App.tsx 注入）。

---

## localStorage Key

`tour-app2:v1` — 值為 `'done'`。不存在時 App 掛載後 300ms delay 啟動導覽（讓 UI 先 render 完成）。

---

## 設定頁整合

在 `App.tsx` 的 BottomSheet 設定面板最底部加一個按鈕：

```
┌─────────────────────────────────────┐
│  重看功能導覽                    ▶  │
│  再次走一遍 10 步引導               │
└─────────────────────────────────────┘
```

點擊 → `restartTour()` → 關閉 settings BottomSheet → 導覽從步驟 0 開始。

---

## 動畫

- 步驟切換：泡泡 fade in（100ms）
- Spotlight 4 個 div 用 CSS transition（150ms ease）跟著目標位置移動
- 全螢幕卡：`motion/react` slide-up 進場

---

## 不在此 Spec 範圍內

- 修復 TeachView / DispatchMapView 的模擬資料（另立 issue）
- 多語言支援
- 鍵盤快捷鍵（左右方向鍵切步驟）
