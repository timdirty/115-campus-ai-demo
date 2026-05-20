# App 2 Spotlight 引導導覽 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 為「校園服務機器人」App 加入 10 步 Spotlight 引導導覽，幫助學生練習 demo 話術，第一次進入自動啟動，設定頁可重看。

**Architecture:** 4 個新檔案（tourSteps / useTour / TourProvider / TourOverlay）+ 5 個現有 view 加 `data-tour` 屬性 + App.tsx 包入 Provider 並在設定頁加重看按鈕。Spotlight 用 4 個半透明 div 圍住目標元件，tooltip 根據 `tooltipSide` 定位。

**Tech Stack:** React 18, TypeScript, motion/react (已有), Tailwind CSS (已有)

**App root:** `google ai studio/app_2（國小）/校園服務機器人 app/src`

---

## File Map

| 路徑 | 動作 |
|---|---|
| `src/components/tour/tourSteps.ts` | **新增** — 10 步定義，唯一資料來源 |
| `src/components/tour/useTour.ts` | **新增** — React hook，讀 TourContext |
| `src/components/tour/TourProvider.tsx` | **新增** — Context + state + localStorage |
| `src/components/tour/TourOverlay.tsx` | **新增** — Spotlight + tooltip 渲染 |
| `src/views/DashboardView.tsx` | **修改** — 加 3 個 `data-tour` 屬性 |
| `src/views/TeachView.tsx` | **修改** — 加 2 個 `data-tour` 屬性 |
| `src/views/DeliveryView.tsx` | **修改** — 加 2 個 `data-tour` 屬性 |
| `src/views/LifeView.tsx` | **修改** — 加 1 個 `data-tour` 屬性 |
| `src/App.tsx` | **修改** — 包 TourProvider + 設定頁加按鈕 |

---

### Task 1: 建立 `tourSteps.ts`

**Files:**
- Create: `src/components/tour/tourSteps.ts`

- [ ] **Step 1: 建立目錄與檔案**

```bash
mkdir -p "google ai studio/app_2（國小）/校園服務機器人 app/src/components/tour"
```

- [ ] **Step 2: 寫入 tourSteps.ts**

完整內容：

```ts
export type TourStep = {
  id: string;
  tab?: 'dashboard' | 'teach' | 'delivery' | 'life';
  targetDataTour?: string;
  title: string;
  body: string;
  demoTip: string;
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right';
  isFullscreen?: boolean;
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    isFullscreen: true,
    title: '歡迎！先來認識一下',
    body: '我來帶你認識校園服務機器人的所有功能。大約 2 分鐘，完成後可以從設定重看。',
    demoTip: '「我們開發了一套讓機器人管理校園服務的系統，現在帶大家看看各個功能。」',
  },
  {
    id: 'robot-status',
    tab: 'dashboard',
    targetDataTour: 'robot-status',
    title: '機器人狀態',
    body: '這裡顯示目前有幾台機器人上線、電量和所在區域。點進去可以看詳細診斷。',
    demoTip: '「目前有 4 台機器人上線，分別部署在不同區域，電量都在安全範圍。」',
    tooltipSide: 'bottom',
  },
  {
    id: 'task-stats',
    tab: 'dashboard',
    targetDataTour: 'task-stats',
    title: '今日任務統計',
    body: '一眼看出今天完成幾件、還有幾件待處理。',
    demoTip: '「今天已完成 X 件任務，整體處理速度比人工快很多。」',
    tooltipSide: 'bottom',
  },
  {
    id: 'dispatch-btn',
    tab: 'dashboard',
    targetDataTour: 'dispatch-btn',
    title: '校園派遣',
    body: '點這裡開啟地圖，把機器人指派到特定教室或走廊執行任務。',
    demoTip: '「我來按這個，示範把機器人派去 A 棟 3 樓巡邏。」',
    tooltipSide: 'top',
  },
  {
    id: 'attendance-card',
    tab: 'teach',
    targetDataTour: 'attendance-card',
    title: '智慧出缺席',
    body: '機器人掃描後自動更新出缺席名單，老師不用一個個點名。',
    demoTip: '「機器人 30 秒內完成全班掃描，比傳統點名快 10 倍，而且不會漏人。」',
    tooltipSide: 'bottom',
  },
  {
    id: 'alert-list',
    tab: 'teach',
    targetDataTour: 'alert-list',
    title: '即時告警與訊號',
    body: '同學舉手或分心時這裡會出現提示；點進去 AI 會幫你想回覆內容。',
    demoTip: '「這位同學剛剛舉手，我點進去讓 AI 建議怎麼回應——老師可以同時注意全班。」',
    tooltipSide: 'bottom',
  },
  {
    id: 'order-list',
    tab: 'delivery',
    targetDataTour: 'order-list',
    title: '配送任務追蹤',
    body: '目前在途的配送任務都在這裡，點進去可以看即時位置和預計到達時間。',
    demoTip: '「機器人現在正在送午餐到 3 年甲班，這裡可以看它走到哪了。」',
    tooltipSide: 'bottom',
  },
  {
    id: 'new-order-btn',
    tab: 'delivery',
    targetDataTour: 'new-order-btn',
    title: '新增配送任務',
    body: '點商品右邊的「+」就可以下訂單，選好目的地後機器人自動出發。',
    demoTip: '「我示範新增一筆：把文具組送到辦公室，按確認後機器人幾秒內就出發。」',
    tooltipSide: 'top',
  },
  {
    id: 'life-services',
    tab: 'life',
    targetDataTour: 'life-services',
    title: '廣播與清掃排程',
    body: '在這裡設定校園廣播內容或清掃機器人的巡邏時間，設好後全自動執行。',
    demoTip: '「下課廣播和每天的清掃路線都在這裡管，不需要人去手動操作機器人。」',
    tooltipSide: 'top',
  },
  {
    id: 'complete',
    isFullscreen: true,
    title: '你準備好了！',
    body: '所有功能都看過了。比賽時按照這個順序介紹，評審會有最清楚的印象。',
    demoTip: '「謝謝評審，以上就是我們校園服務機器人系統的完整功能展示。」',
  },
];

export const TOUR_STORAGE_KEY = 'tour-app2:v1';
```

- [ ] **Step 3: 確認檔案存在**

```bash
ls "google ai studio/app_2（國小）/校園服務機器人 app/src/components/tour/"
```

Expected: `tourSteps.ts`

- [ ] **Step 4: Commit**

```bash
git add "google ai studio/app_2（國小）/校園服務機器人 app/src/components/tour/tourSteps.ts"
git commit -m "feat(app2-tour): add tour step definitions"
```

---

### Task 2: 建立 `useTour.ts`

**Files:**
- Create: `src/components/tour/useTour.ts`

- [ ] **Step 1: 寫入 useTour.ts**

```ts
import { useContext } from 'react';
import { TourContext, type TourContextValue } from './TourProvider';

export function useTour(): TourContextValue {
  return useContext(TourContext);
}
```

- [ ] **Step 2: Commit**

```bash
git add "google ai studio/app_2（國小）/校園服務機器人 app/src/components/tour/useTour.ts"
git commit -m "feat(app2-tour): add useTour hook"
```

---

### Task 3: 建立 `TourProvider.tsx`

**Files:**
- Create: `src/components/tour/TourProvider.tsx`

- [ ] **Step 1: 寫入 TourProvider.tsx**

```tsx
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { TOUR_STEPS, TOUR_STORAGE_KEY } from './tourSteps';

export type TourContextValue = {
  isActive: boolean;
  currentStepIndex: number;
  totalSteps: number;
  startTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  restartTour: () => void;
};

export const TourContext = createContext<TourContextValue>({
  isActive: false,
  currentStepIndex: 0,
  totalSteps: TOUR_STEPS.length,
  startTour: () => {},
  nextStep: () => {},
  prevStep: () => {},
  skipTour: () => {},
  restartTour: () => {},
});

export function TourProvider({
  children,
  onTabChange,
}: {
  children: React.ReactNode;
  onTabChange: (tab: string) => void;
}) {
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const onTabChangeRef = useRef(onTabChange);
  onTabChangeRef.current = onTabChange;

  const completeTour = useCallback(() => {
    setIsActive(false);
    localStorage.setItem(TOUR_STORAGE_KEY, 'done');
  }, []);

  const startTour = useCallback(() => {
    setCurrentStepIndex(0);
    setIsActive(true);
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStepIndex((prev) => {
      const next = prev + 1;
      if (next >= TOUR_STEPS.length) {
        completeTour();
        return prev;
      }
      const nextStep = TOUR_STEPS[next];
      if (nextStep?.tab) {
        onTabChangeRef.current(nextStep.tab);
      }
      return next;
    });
  }, [completeTour]);

  const prevStep = useCallback(() => {
    setCurrentStepIndex((prev) => {
      const next = Math.max(0, prev - 1);
      const prevStepData = TOUR_STEPS[next];
      if (prevStepData?.tab) {
        onTabChangeRef.current(prevStepData.tab);
      }
      return next;
    });
  }, []);

  const skipTour = useCallback(() => {
    completeTour();
  }, [completeTour]);

  const restartTour = useCallback(() => {
    localStorage.removeItem(TOUR_STORAGE_KEY);
    onTabChangeRef.current('dashboard');
    setCurrentStepIndex(0);
    setIsActive(true);
  }, []);

  // Auto-start on first visit, with 300ms delay to let UI render
  useEffect(() => {
    const seen = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!seen) {
      const timer = setTimeout(() => startTour(), 300);
      return () => clearTimeout(timer);
    }
  }, [startTour]);

  return (
    <TourContext.Provider
      value={{ isActive, currentStepIndex, totalSteps: TOUR_STEPS.length, startTour, nextStep, prevStep, skipTour, restartTour }}
    >
      {children}
    </TourContext.Provider>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "google ai studio/app_2（國小）/校園服務機器人 app/src/components/tour/TourProvider.tsx"
git commit -m "feat(app2-tour): add TourProvider with localStorage auto-start"
```

---

### Task 4: 建立 `TourOverlay.tsx`

**Files:**
- Create: `src/components/tour/TourOverlay.tsx`

Spotlight 技術：4 個固定定位 div（top/bottom/left/right）圍住目標元件，留出一個明亮矩形。tooltip 根據 `tooltipSide` 放在矩形的上/下/左/右。全螢幕步驟（isFullscreen）直接渲染置中卡片，不用 spotlight。

- [ ] **Step 1: 寫入 TourOverlay.tsx**

```tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TOUR_STEPS } from './tourSteps';
import { useTour } from './useTour';

const PAD = 10; // spotlight padding around target element

type Rect = { top: number; left: number; width: number; height: number };

function getRect(dataAttr: string): Rect | null {
  const el = document.querySelector(`[data-tour="${dataAttr}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    top: r.top - PAD,
    left: r.left - PAD,
    width: r.width + PAD * 2,
    height: r.height + PAD * 2,
  };
}

export function TourOverlay() {
  const { isActive, currentStepIndex, totalSteps, nextStep, prevStep, skipTour } = useTour();
  const step = TOUR_STEPS[currentStepIndex];
  const [rect, setRect] = useState<Rect | null>(null);
  const rafRef = useRef<number | undefined>(undefined);

  const recalc = useCallback(() => {
    if (!step?.targetDataTour) { setRect(null); return; }
    const r = getRect(step.targetDataTour);
    setRect(r);
  }, [step?.targetDataTour]);

  // Recalculate after step change (wait for tab render)
  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const t = setTimeout(() => {
      rafRef.current = requestAnimationFrame(recalc);
    }, 120);
    return () => { clearTimeout(t); if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [recalc, currentStepIndex]);

  // Recalculate on resize
  useEffect(() => {
    window.addEventListener('resize', recalc);
    return () => window.removeEventListener('resize', recalc);
  }, [recalc]);

  if (!isActive || !step) return null;

  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === totalSteps - 1;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Fullscreen card steps (welcome / complete)
  if (step.isFullscreen) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-6">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.25 }}
          className="w-full max-w-sm rounded-[2.5rem] bg-surface-container-lowest border border-outline-variant/30 shadow-2xl p-8 space-y-6"
        >
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-primary tracking-[0.25em] uppercase">功能導覽 {currentStepIndex + 1}/{totalSteps}</p>
            <h2 className="font-headline text-3xl font-bold tracking-tight">{step.title}</h2>
            <p className="text-base font-bold text-on-surface-variant leading-relaxed">{step.body}</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-1">
            <p className="text-[10px] font-bold text-amber-700 tracking-widest uppercase">🎙 Demo 提示</p>
            <p className="text-sm font-bold text-amber-900 leading-relaxed">{step.demoTip}</p>
          </div>
          <div className="flex gap-3 pt-2">
            {!isFirst && (
              <button
                onClick={prevStep}
                className="flex-1 py-4 rounded-[1.25rem] border border-outline-variant/30 bg-surface-container-low text-sm font-bold text-on-surface active:scale-95 transition-all"
              >
                上一步
              </button>
            )}
            <button
              onClick={isLast ? skipTour : nextStep}
              className="flex-1 py-4 rounded-[1.25rem] bg-primary text-white text-sm font-bold shadow-lg shadow-primary/20 active:scale-95 transition-all"
            >
              {isLast ? '開始使用' : '開始導覽 →'}
            </button>
          </div>
          {!isLast && (
            <button onClick={skipTour} className="w-full text-center text-xs font-bold text-on-surface-variant/60 hover:text-on-surface-variant transition-colors py-1">
              跳過導覽
            </button>
          )}
        </motion.div>
      </div>
    );
  }

  // Spotlight steps
  const r = rect ?? { top: vh / 2 - 40, left: vw / 2 - 80, width: 160, height: 80 };
  const side = step.tooltipSide ?? 'bottom';

  // Tooltip position
  const tooltipStyle: React.CSSProperties = {};
  const arrowStyle: React.CSSProperties = {};
  const TOOLTIP_W = 300;
  const TOOLTIP_H_ESTIMATE = 200;

  if (side === 'bottom') {
    tooltipStyle.top = r.top + r.height + 16;
    tooltipStyle.left = Math.max(8, Math.min(r.left + r.width / 2 - TOOLTIP_W / 2, vw - TOOLTIP_W - 8));
  } else if (side === 'top') {
    tooltipStyle.top = r.top - TOOLTIP_H_ESTIMATE - 16;
    tooltipStyle.left = Math.max(8, Math.min(r.left + r.width / 2 - TOOLTIP_W / 2, vw - TOOLTIP_W - 8));
  } else if (side === 'left') {
    tooltipStyle.top = Math.max(8, r.top + r.height / 2 - TOOLTIP_H_ESTIMATE / 2);
    tooltipStyle.left = Math.max(8, r.left - TOOLTIP_W - 16);
  } else {
    tooltipStyle.top = Math.max(8, r.top + r.height / 2 - TOOLTIP_H_ESTIMATE / 2);
    tooltipStyle.left = r.left + r.width + 16;
  }

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {/* Spotlight: 4 overlay divs */}
      <div className="pointer-events-auto" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: `${r.top}px`, background: 'rgba(0,0,0,0.65)' }} />
      <div className="pointer-events-auto" style={{ position: 'fixed', top: `${r.top + r.height}px`, left: 0, width: '100vw', bottom: 0, background: 'rgba(0,0,0,0.65)' }} />
      <div className="pointer-events-auto" style={{ position: 'fixed', top: `${r.top}px`, left: 0, width: `${r.left}px`, height: `${r.height}px`, background: 'rgba(0,0,0,0.65)' }} />
      <div className="pointer-events-auto" style={{ position: 'fixed', top: `${r.top}px`, left: `${r.left + r.width}px`, right: 0, height: `${r.height}px`, background: 'rgba(0,0,0,0.65)' }} />

      {/* Highlight border ring */}
      <div
        style={{ position: 'fixed', top: `${r.top}px`, left: `${r.left}px`, width: `${r.width}px`, height: `${r.height}px`, borderRadius: 16, boxShadow: '0 0 0 3px rgba(var(--color-primary), 0.8), 0 0 24px rgba(var(--color-primary), 0.3)', pointerEvents: 'none' }}
      />

      {/* Tooltip */}
      <motion.div
        key={step.id}
        initial={{ opacity: 0, y: side === 'bottom' ? -8 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        style={{ ...tooltipStyle, position: 'fixed', width: TOOLTIP_W, pointerEvents: 'auto' }}
        className="bg-surface-container-lowest border border-outline-variant/30 rounded-[1.75rem] shadow-2xl p-6 space-y-4"
      >
        <div className="space-y-1">
          <p className="text-[9px] font-bold text-primary tracking-[0.25em] uppercase">步驟 {currentStepIndex + 1}/{totalSteps}</p>
          <h3 className="font-headline font-bold text-lg tracking-tight">{step.title}</h3>
          <p className="text-sm font-bold text-on-surface-variant leading-relaxed">{step.body}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-0.5">
          <p className="text-[9px] font-bold text-amber-700 tracking-widest uppercase">🎙 Demo 提示</p>
          <p className="text-xs font-bold text-amber-900 leading-relaxed">{step.demoTip}</p>
        </div>
        <div className="flex gap-2">
          {currentStepIndex > 0 && (
            <button onClick={prevStep} className="flex-1 py-3 rounded-[1rem] border border-outline-variant/30 bg-surface-container-low text-xs font-bold text-on-surface active:scale-95 transition-all">
              上一步
            </button>
          )}
          <button onClick={nextStep} className="flex-1 py-3 rounded-[1rem] bg-primary text-white text-xs font-bold shadow-md shadow-primary/20 active:scale-95 transition-all">
            {currentStepIndex === totalSteps - 2 ? '完成 ✓' : '下一步 →'}
          </button>
        </div>
        <button onClick={skipTour} className="w-full text-center text-[10px] font-bold text-on-surface-variant/50 hover:text-on-surface-variant transition-colors">
          跳過導覽
        </button>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "google ai studio/app_2（國小）/校園服務機器人 app/src/components/tour/TourOverlay.tsx"
git commit -m "feat(app2-tour): add TourOverlay spotlight component"
```

---

### Task 5: DashboardView — 加 `data-tour` 屬性

**Files:**
- Modify: `src/views/DashboardView.tsx`

在 DashboardView 的三個元素加 `data-tour` 屬性：
1. **`data-tour="robot-status"`** → 機器人狀態大卡（`motion.div onClick={() => setModal('robot')}`，約在 line 86）
2. **`data-tour="task-stats"`** → demo steps 網格區（`<div className="mt-5 grid gap-3`，約在 line 64）
3. **`data-tour="dispatch-btn"`** → 校園派遣按鈕（`onClick={() => navigateTo('dispatch-map')`，約在 line 68）

- [ ] **Step 1: 加 robot-status**

找到 DashboardView.tsx 中：
```tsx
className="col-span-2 bg-surface-container-low rounded-[2.5rem] p-8 relative overflow-hidden group border border-outline-variant/30 shadow-[0_4px_25px_rgba(0,0,0,0.02)] cursor-pointer hover:bg-surface-container transition-all"
```
改為：
```tsx
data-tour="robot-status"
className="col-span-2 bg-surface-container-low rounded-[2.5rem] p-8 relative overflow-hidden group border border-outline-variant/30 shadow-[0_4px_25px_rgba(0,0,0,0.02)] cursor-pointer hover:bg-surface-container transition-all"
```

- [ ] **Step 2: 加 task-stats 和 dispatch-btn**

找到：
```tsx
<div className="mt-5 grid gap-3 sm:grid-cols-3">
  <button onClick={() => navigateTo('dispatch-map')} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-black text-white shadow-lg shadow-primary/20 active:scale-95">
```
改為：
```tsx
<div data-tour="task-stats" className="mt-5 grid gap-3 sm:grid-cols-3">
  <button data-tour="dispatch-btn" onClick={() => navigateTo('dispatch-map')} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-black text-white shadow-lg shadow-primary/20 active:scale-95">
```

- [ ] **Step 3: Commit**

```bash
git add "google ai studio/app_2（國小）/校園服務機器人 app/src/views/DashboardView.tsx"
git commit -m "feat(app2-tour): add data-tour attrs to DashboardView"
```

---

### Task 6: TeachView — 加 `data-tour` 屬性

**Files:**
- Modify: `src/views/TeachView.tsx`

1. **`data-tour="attendance-card"`** → 出缺席 section（`<section className="bg-surface-container-lowest rounded-[2.5rem]`，約 line 96）
2. **`data-tour="alert-list"`** → 告警標題所在的父 section（包含 h3 `即時告警與訊號`，約 line 158）

- [ ] **Step 1: 加 attendance-card**

找到：
```tsx
<section className="bg-surface-container-lowest rounded-[2.5rem] p-7 border border-outline-variant/30 shadow-md flex items-center justify-between gap-5 relative overflow-hidden group">
```
改為：
```tsx
<section data-tour="attendance-card" className="bg-surface-container-lowest rounded-[2.5rem] p-7 border border-outline-variant/30 shadow-md flex items-center justify-between gap-5 relative overflow-hidden group">
```

- [ ] **Step 2: 加 alert-list**

找到包含 `即時告警與訊號` h3 的父 section（在這之前的 `<section` tag）並加屬性：
```tsx
<section data-tour="alert-list" className="space-y-5">
```
（原本的 className 保持不變，只加 data-tour）

- [ ] **Step 3: Commit**

```bash
git add "google ai studio/app_2（國小）/校園服務機器人 app/src/views/TeachView.tsx"
git commit -m "feat(app2-tour): add data-tour attrs to TeachView"
```

---

### Task 7: DeliveryView — 加 `data-tour` 屬性

**Files:**
- Modify: `src/views/DeliveryView.tsx`

1. **`data-tour="order-list"`** → 在途配送卡片區（`<button onClick={() => navigateTo('delivery-tracking')`，約 line 102）的外層 section
2. **`data-tour="new-order-btn"`** → Products List section（`{/* Products List */}` comment 下的 section，約 line 165）

- [ ] **Step 1: 加 order-list**

找到：
```tsx
<section className="space-y-4">
  <h2 className="text-xl font-headline font-bold tracking-tight px-2 flex items-center gap-2">
```
（包含在途配送追蹤按鈕的那個 section，約 line 97）
改為：
```tsx
<section data-tour="order-list" className="space-y-4">
```

- [ ] **Step 2: 加 new-order-btn**

找到 `{/* Products List */}` 下方的：
```tsx
<section className="space-y-6 min-h-[300px] px-1">
```
改為：
```tsx
<section data-tour="new-order-btn" className="space-y-6 min-h-[300px] px-1">
```

- [ ] **Step 3: Commit**

```bash
git add "google ai studio/app_2（國小）/校園服務機器人 app/src/views/DeliveryView.tsx"
git commit -m "feat(app2-tour): add data-tour attrs to DeliveryView"
```

---

### Task 8: LifeView — 加 `data-tour` 屬性

**Files:**
- Modify: `src/views/LifeView.tsx`

**`data-tour="life-services"`** → 廣播排程與清掃排程的父 section（約 line 127）

- [ ] **Step 1: 加 life-services**

找到 LifeView.tsx 中放廣播清掃兩個功能卡的 section：
```tsx
<section className="grid grid-cols-1 gap-6 px-1">
```
（約 line 127，包含廣播和清掃兩個大卡片）改為：
```tsx
<section data-tour="life-services" className="grid grid-cols-1 gap-6 px-1">
```

- [ ] **Step 2: Commit**

```bash
git add "google ai studio/app_2（國小）/校園服務機器人 app/src/views/LifeView.tsx"
git commit -m "feat(app2-tour): add data-tour attr to LifeView"
```

---

### Task 9: App.tsx — 整合 TourProvider + 設定頁按鈕

**Files:**
- Modify: `src/App.tsx`

兩件事：
1. 用 `<TourProvider onTabChange={setActiveTab}>` 包住整個 App 回傳 JSX
2. 在 BottomSheet settings 最底部（`<button onClick={() => { showToast('帳號已安全登出')` 上方）加「重看導覽」按鈕
3. 在 JSX root 加 `<TourOverlay />`

- [ ] **Step 1: 加 import**

在 App.tsx 現有 import 後加：
```tsx
import { TourProvider } from './components/tour/TourProvider';
import { TourOverlay } from './components/tour/TourOverlay';
```

- [ ] **Step 2: 加 restartTour 參考**

在 `App()` 函式內、`showSettings` state 宣告旁加：
```tsx
const [, setTourRestart] = useState(0); // 用來觸發 TourProvider restart
```

不需要，因為 `restartTour` 來自 TourProvider context，但 TourProvider 包在外層，settings BottomSheet 在裡面可以透過 `useTour()` 取得。

實際做法：在 settings BottomSheet 的「重看導覽」按鈕用 `useTour().restartTour`，所以需要把 BottomSheet 裡的按鈕改為一個獨立小元件或直接用 hook。

最簡單做法：建立 inline component 放在 App.tsx 內部：

在 `export default function App()` 前加：
```tsx
function RestartTourButton({ onClose }: { onClose: () => void }) {
  const { restartTour } = useTour();
  return (
    <button
      onClick={() => { restartTour(); onClose(); }}
      className="w-full flex items-center justify-between text-left font-bold text-base text-primary bg-primary/5 border border-primary/20 hover:bg-primary/10 p-5 rounded-[1.5rem] active:scale-[0.98] transition-all shadow-sm"
    >
      <span>重看功能導覽</span>
      <span className="text-sm opacity-60">再走一遍 10 步</span>
    </button>
  );
}
```

並在 App.tsx 加入 `useTour` import：
```tsx
import { useTour } from './components/tour/useTour';
```

- [ ] **Step 3: 包 TourProvider + 加 TourOverlay**

找到 App() return 的最外層 div（`<div className="relative flex min-h-[100dvh]`），在其外包一層：

```tsx
return (
  <TourProvider onTabChange={setActiveTab}>
    <div className="relative flex min-h-[100dvh] ...">
      {/* 原有內容不動 */}
      <TourOverlay />
    </div>
  </TourProvider>
);
```

`<TourOverlay />` 放在外層 div 的最後一個子元素。

- [ ] **Step 4: 在設定 BottomSheet 加重看按鈕**

找到 BottomSheet 裡的這段（在 `匯出展示資料` 按鈕的上方）：
```tsx
<button onClick={() => { actions.setNotifications(!state.settings.notifications); ...
```

在「匯入展示資料」和「重置展示資料」之間加：
```tsx
<RestartTourButton onClose={() => setShowSettings(false)} />
```

- [ ] **Step 5: 驗證 TypeScript 不報錯**

```bash
cd "google ai studio/app_2（國小）/校園服務機器人 app" && npm run lint
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add "google ai studio/app_2（國小）/校園服務機器人 app/src/App.tsx"
git commit -m "feat(app2-tour): wire TourProvider into App, add restart button in settings"
```

---

### Task 10: 全專案 build 驗證

- [ ] **Step 1: 跑 check**

```bash
cd "google ai studio/app_2（國小）/校園服務機器人 app" && npm run check
```

Expected: TypeScript 0 errors, tests pass, build succeeds.

- [ ] **Step 2: 手動確認導覽啟動**

```bash
cd "google ai studio/app_2（國小）/校園服務機器人 app" && npm run dev
```

開 `http://localhost:11502`（或 3000 如果直接從 app 目錄跑）：
1. 第一次進入 → 自動出現歡迎全螢幕卡 ✓
2. 點「開始導覽 →」→ 切到 dashboard，spotlight 圈住機器人狀態卡 ✓
3. 點「下一步 →」× 幾次 → 自動切 tab（dashboard → teach → delivery → life）✓
4. 完成後 → 「開始使用」關閉導覽 ✓
5. 重新整理 → 不再自動出現 ✓
6. 開設定 → 點「重看功能導覽」→ 從頭開始 ✓

- [ ] **Step 3: 清 localStorage 測試自動啟動**

在 browser DevTools Console：
```js
localStorage.removeItem('tour-app2:v1'); location.reload();
```

Expected: 重新載入後 300ms 出現歡迎卡。

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(app2): spotlight onboarding tour — 10-step demo guide with tab navigation"
```

---

## Self-Review

**Spec coverage:**
- ✅ 10 步 Spotlight 引導（tourSteps.ts 有 10 個步驟）
- ✅ 第一次進入自動啟動（TourProvider useEffect + 300ms delay）
- ✅ 設定頁重看按鈕（RestartTourButton + restartTour()）
- ✅ 每步有 demo 提示（demoTip 欄位，橘色區塊）
- ✅ 跳過功能（skipTour 按鈕）
- ✅ 上一步/下一步（prevStep / nextStep）
- ✅ 自動切 tab（onTabChange callback in TourProvider）
- ✅ Spotlight 4 div 圍住目標 + primary 色邊框
- ✅ 全螢幕步驟（isFullscreen：welcome / complete）
- ✅ 所有 8 個 data-tour 屬性加到對應 view

**Placeholder scan:** 無。

**Type consistency:**
- `TourContextValue` 定義在 TourProvider.tsx，`useTour.ts` 正確 import 並 re-export 型別
- `TourStep` 定義在 tourSteps.ts，TourOverlay 透過 import 取得，型別一致
- `TOUR_STORAGE_KEY` 在 tourSteps.ts 定義，TourProvider 透過 import 使用
