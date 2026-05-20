# UI 簡化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 三個 App 取消首頁概念、直接進重點操作介面，讓小學生/評審秒懂。

**Architecture:** App 1 把 Home.tsx 砍掉說明內容只留操作面板，tab id 改 whiteboard；App 2 移除 dashboard tab 預設進 delivery；App 3 把 5 個 panel 砍成 3 個、nodes 改名 robot。

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, motion/react (framer-motion)

---

## 檔案地圖

| 檔案 | 改動性質 |
|---|---|
| `google ai studio/app_1（國小）/AI自動板擦機器人/src/pages/Home.tsx` | 刪除 6 個說明區塊 |
| `google ai studio/app_1（國小）/AI自動板擦機器人/src/App.tsx` | 重命名 tab home→whiteboard |
| `google ai studio/app_1（國小）/AI自動板擦機器人/src/components/tour/tourSteps.ts` | 更新 tab 引用，移除 status-tiles 步驟 |
| `google ai studio/app_2（國小）/校園服務機器人 app/src/App.tsx` | 移除 dashboard tab，nav 4→3 格，加 AI 指示燈 |
| `google ai studio/app_3（國中）/AI校園心靈守護者/src/App.tsx` | ActivePanel 型別、panelNav、PanelDock、DetailDrawer、panelTitle |

---

## Task 1: App 1 — Home.tsx 砍說明區塊

**Files:**
- Modify: `google ai studio/app_1（國小）/AI自動板擦機器人/src/pages/Home.tsx`

- [ ] **Step 1: 刪除 DEMO_STEPS 常數和主流程說明卡**

在 `Home.tsx` 找到並刪除：
```
const DEMO_STEPS = [...]
```
以及整個 `<motion.section variants={itemVariants} className="mb-5 grid grid-cols-1 xl:grid-cols-[1.2fr_.8fr] gap-4">` 的兩欄區塊（從 `<div className="rounded-3xl border border-primary/10 bg-primary-container/50` 到 `</motion.section>`，包含「主流程說明卡」和「現場可靠性卡」）。

- [ ] **Step 2: 刪除 StatusTile section**

找到並刪除：
```tsx
<motion.section variants={itemVariants} className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5" data-tour="status-tiles">
  <StatusTile icon={ShieldCheck} ... />
  <StatusTile icon={Radio} ... />
  <StatusTile icon={Bot} ... />
  <StatusTile icon={Video} ... />
  <StatusTile icon={Database} ... />
</motion.section>
```

- [ ] **Step 3: 刪除 SavedNotePanel 和 QuickNotePanel**

找到並刪除最後一個 `<motion.section>` 區塊：
```tsx
<motion.section variants={itemVariants} className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
  <SavedNotePanel latestNote={latestNote} onNavigate={onNavigate} />
  <QuickNotePanel value={quickNote} busy={busy === 'quick'} onChange={setQuickNote} onSave={saveQuickNote} />
</motion.section>
```

- [ ] **Step 4: 移除因刪除而不再使用的 import 和 state**

移除以下 import（如果確認沒有其他地方用到）：
```tsx
import {SavedNotePanel} from '../components/home/SavedNotePanel';
import {QuickNotePanel} from '../components/home/QuickNotePanel';
import {StatusTile} from '../components/home/StatusTile';
import {ArrowRight} from 'lucide-react'; // 如果主流程卡的按鈕也刪了
```

移除不再使用的 state 和函式：
```tsx
// 刪除這些
const [quickNote, setQuickNote] = useState('');
const saveQuickNote = async () => { ... };
```
（`latestNote`、`setLatestNote` 保留，因為 NoticeBar 和 OCR 可能還參考到 `latestNote`）

- [ ] **Step 5: 執行 TypeScript check**

```bash
cd "google ai studio/app_1（國小）/AI自動板擦機器人"
npm run check:app1
```
預期：無 type error

- [ ] **Step 6: 啟動 dev server 確認頁面正常**

```bash
npm run dev:app1
```
開啟 App 1，確認首頁只剩：NoticeBar + CapturePanel + RegionTaskPanel + OCR result panel

- [ ] **Step 7: Commit**

```bash
git add "google ai studio/app_1（國小）/AI自動板擦機器人/src/pages/Home.tsx"
git commit -m "feat(app1): strip home page to camera+region panels only"
```

---

## Task 2: App 1 — App.tsx tab 改名 home→whiteboard

**Files:**
- Modify: `google ai studio/app_1（國小）/AI自動板擦機器人/src/App.tsx`

- [ ] **Step 1: 更新 AppTab type 和 appTabs 陣列**

```tsx
// 改前
type AppTab = 'home' | 'teacher' | 'robot' | 'library' | 'chat' | 'review';
const appTabs: AppTab[] = ['home', 'teacher', 'robot', 'library', 'chat', 'review'];

// 改後
type AppTab = 'whiteboard' | 'teacher' | 'robot' | 'library' | 'chat' | 'review';
const appTabs: AppTab[] = ['whiteboard', 'teacher', 'robot', 'library', 'chat', 'review'];
```

- [ ] **Step 2: 更新 useState 預設值**

```tsx
// 改前
const [currentTab, setCurrentTab] = useState<AppTab>('home');

// 改後
const [currentTab, setCurrentTab] = useState<AppTab>('whiteboard');
```

- [ ] **Step 3: 更新 getPage() switch case**

```tsx
// 改前
case 'home': return <Home key="home" onNavigate={navigateTo} />;

// 改後
case 'whiteboard': return <Home key="whiteboard" onNavigate={navigateTo} />;
```

- [ ] **Step 4: 更新 header 的 logo 點擊**

```tsx
// 改前
onClick={() => setCurrentTab('home')}

// 改後
onClick={() => setCurrentTab('whiteboard')}
```

- [ ] **Step 5: 更新手機版 NavButton（首頁→白板）**

```tsx
// 改前
<NavButton icon={HomeIcon} label="首頁" isActive={currentTab === 'home'} onClick={() => setCurrentTab('home')} />

// 改後
<NavButton icon={HomeIcon} label="白板" isActive={currentTab === 'whiteboard'} onClick={() => setCurrentTab('whiteboard')} />
```

- [ ] **Step 6: 更新桌面版 WebNavButton（首頁→白板）**

```tsx
// 改前
<WebNavButton icon={HomeIcon} label="首頁" isActive={currentTab === 'home'} onClick={() => setCurrentTab('home')} />

// 改後
<WebNavButton icon={HomeIcon} label="白板" isActive={currentTab === 'whiteboard'} onClick={() => setCurrentTab('whiteboard')} />
```

- [ ] **Step 7: TypeScript check**

```bash
npm run check:app1
```
預期：0 errors

- [ ] **Step 8: 修正 TourProvider.tsx 中 hardcode 的 'home'**

**Files:**
- Modify: `google ai studio/app_1（國小）/AI自動板擦機器人/src/components/tour/TourProvider.tsx`

找到第 80 行：
```ts
// 改前
onTabChangeRef.current('home');

// 改後
onTabChangeRef.current('whiteboard');
```

- [ ] **Step 9: TypeScript check**

```bash
npm run check:app1
```
預期：0 errors

- [ ] **Step 10: Commit**

```bash
git add "google ai studio/app_1（國小）/AI自動板擦機器人/src/App.tsx" \
        "google ai studio/app_1（國小）/AI自動板擦機器人/src/components/tour/TourProvider.tsx"
git commit -m "feat(app1): rename home tab to whiteboard, fix TourProvider hardcode"
```

---

## Task 3: App 1 — tourSteps.ts 更新 tab 引用

**Files:**
- Modify: `google ai studio/app_1（國小）/AI自動板擦機器人/src/components/tour/tourSteps.ts`

- [ ] **Step 1: 更新 TourStep type 中的 tab 聯合型別**

```ts
// 改前
tab?: 'home' | 'teacher' | 'robot' | 'library' | 'chat' | 'review';

// 改後
tab?: 'whiteboard' | 'teacher' | 'robot' | 'library' | 'chat' | 'review';
```

- [ ] **Step 2: capture-panel 步驟 tab 改 whiteboard**

```ts
// 改前
{ id: 'capture-panel', tab: 'home', ... }

// 改後
{ id: 'capture-panel', tab: 'whiteboard', ... }
```

- [ ] **Step 3: 移除整個 status-tiles 步驟**

刪除以下整個物件（因為 StatusTile 已在 Task 1 中移除）：
```ts
{
  id: 'status-tiles',
  tab: 'home',
  targetDataTour: 'status-tiles',
  title: '系統狀態',
  body: '這裡顯示硬體連線、Gemini AI、攝影機和課堂紀錄的即時狀態，就算沒有接機器人也能展示。',
  demoTip: '「就算沒有接機器人，AI 分析和課堂紀錄功能都能獨立運作，比賽不怕臨時硬體故障。」',
  tooltipSide: 'bottom',
},
```

- [ ] **Step 4: region-panel 步驟 tab 改 whiteboard**

```ts
// 改前
{ id: 'region-panel', tab: 'home', ... }

// 改後
{ id: 'region-panel', tab: 'whiteboard', ... }
```

- [ ] **Step 5: TypeScript check**

```bash
npm run check:app1
```
預期：0 errors

- [ ] **Step 6: Commit**

```bash
git add "google ai studio/app_1（國小）/AI自動板擦機器人/src/components/tour/tourSteps.ts"
git commit -m "feat(app1): update tour steps to use whiteboard tab, remove status-tiles step"
```

---

## Task 4: App 2 — 移除 dashboard tab，nav 4→3，加 AI 指示燈

**Files:**
- Modify: `google ai studio/app_2（國小）/校園服務機器人 app/src/App.tsx`

- [ ] **Step 1: 移除 dashboard 從 TABS 陣列**

```tsx
// 改前
const TABS = [
  { id: 'dashboard', icon: LayoutDashboard, label: '首頁' },
  { id: 'teach', icon: GraduationCap, label: '教學' },
  { id: 'delivery', icon: Truck, label: '配送', isPrimary: true },
  { id: 'life', icon: Building2, label: '生活' },
];

// 改後
const TABS = [
  { id: 'teach', icon: GraduationCap, label: '教學' },
  { id: 'delivery', icon: Truck, label: '配送', isPrimary: true },
  { id: 'life', icon: Building2, label: '生活' },
];
```

- [ ] **Step 2: 更新 activeTab 預設值**

```tsx
// 改前
const [activeTab, setActiveTab] = useState('dashboard');

// 改後
const [activeTab, setActiveTab] = useState('delivery');
```

- [ ] **Step 3: 移除 desktop sidebar 內的 dashboard 路由渲染**

在 main 區域的 Suspense 中：
```tsx
// 改前（有 dashboard 的 case）
{activeTab === 'dashboard' && <DashboardView showToast={showToast} navigateTo={navigateTo} />}

// 改後（移除此行）
{activeTab === 'teach' && <TeachView showToast={showToast} navigateTo={navigateTo} />}
{activeTab === 'delivery' && <DeliveryView showToast={showToast} navigateTo={navigateTo} />}
{activeTab === 'life' && <LifeView showToast={showToast} navigateTo={navigateTo} />}
```

- [ ] **Step 4: 修改手機版 nav grid-cols-4 → grid-cols-3**

```tsx
// 改前
<div className="grid h-[82px] w-full grid-cols-4 items-end gap-1 px-2 pt-3 mx-auto">

// 改後
<div className="grid h-[82px] w-full grid-cols-3 items-end gap-1 px-2 pt-3 mx-auto">
```

- [ ] **Step 5: 移除 desktop sidebar 的「首頁」nav item**

sidebar `<nav>` 裡的 TABS.map 已會自動反映 TABS 的變動，不需要額外改動。確認 desktop sidebar 不再顯示「首頁」選項。

- [ ] **Step 5.5: 更新 App 2 tourSteps.ts**

**Files:**
- Modify: `google ai studio/app_2（國小）/校園服務機器人 app/src/components/tour/tourSteps.ts`

```ts
// 改前（第 3 行 type）
tab?: 'dashboard' | 'teach' | 'delivery' | 'life';

// 改後
tab?: 'teach' | 'delivery' | 'life';
```

找到 tab 為 `'dashboard'` 的三個步驟（第 22、31、40 行左右），全部改成 `'delivery'`：
```ts
// 改前
tab: 'dashboard',

// 改後（共 3 處）
tab: 'delivery',
```

- [ ] **Step 6: 在 header 加 AI 狀態指示燈**

在 header 右側 avatar 按鈕左邊加入兩顆指示燈：

```tsx
{/* AI status indicators — 放在 header 右側 avatar 左邊 */}
<div className="hidden items-center gap-1.5 sm:flex">
  {/* AI proxy 狀態 */}
  <div
    title={proxyOnline === null ? 'AI 連線中…' : proxyOnline ? 'AI 已連線' : 'AI 本機模式'}
    className="flex items-center gap-1.5 rounded-full border border-outline-variant/20 bg-surface-container-low px-2.5 py-1 text-[10px] font-black"
  >
    <span className={`h-2 w-2 rounded-full ${
      proxyOnline === null ? 'bg-slate-300 animate-pulse' :
      proxyOnline ? 'bg-emerald-500' : 'bg-amber-400'
    }`} />
    <span className="text-on-surface-variant">
      {proxyOnline === null ? '連線中' : proxyOnline ? 'AI 就緒' : '本機'}
    </span>
  </div>
  {/* 硬體 bridge 狀態 */}
  <div
    title={hwStatus.ok ? '機器人已連線' : '機器人離線'}
    className="flex items-center gap-1.5 rounded-full border border-outline-variant/20 bg-surface-container-low px-2.5 py-1 text-[10px] font-black"
  >
    <span className={`h-2 w-2 rounded-full ${hwStatus.ok ? 'bg-emerald-500' : 'bg-slate-300'}`} />
    <span className="text-on-surface-variant">{hwStatus.ok ? '機器人' : '離線'}</span>
  </div>
</div>
```

- [ ] **Step 7: 移除 sidebar 底部 dashboard 相關 import（若有）**

確認 `DashboardView` 的 lazy import 仍保留（不刪檔），只是不再路由進去。

- [ ] **Step 8: TypeScript check**

```bash
npm run check:app2
```
預期：0 errors

- [ ] **Step 9: 啟動 dev server 確認**

```bash
npm run dev:app2
```
確認：打開直接在「配送」tab；sidebar 不再有「首頁」；header 有兩顆 AI 指示燈

- [ ] **Step 10: Commit**

```bash
git add "google ai studio/app_2（國小）/校園服務機器人 app/src/App.tsx"
git commit -m "feat(app2): remove dashboard tab, default delivery, add AI status indicators to header"
```

---

## Task 5: App 3 — 砍 panel 5→3，nodes 改名 robot

**Files:**
- Modify: `google ai studio/app_3（國中）/AI校園心靈守護者/src/App.tsx`

- [ ] **Step 1: 更新 ActivePanel 型別**

```ts
// 改前（Line 61）
type ActivePanel = 'alerts' | 'sensing' | 'care' | 'nodes' | 'logs' | null;

// 改後
type ActivePanel = 'alerts' | 'care' | 'robot' | null;
```

- [ ] **Step 2: 更新 panelNav 陣列**

```ts
// 改前（Line 85-91）
const panelNav: Array<{id: Exclude<ActivePanel, null>; label: string; icon: LucideIcon}> = [
  {id: 'alerts', label: '預警', icon: Bell},
  {id: 'sensing', label: '感知', icon: Mic},
  {id: 'care', label: '照護', icon: Leaf},
  {id: 'nodes', label: '節點', icon: Radio},
  {id: 'logs', label: '紀錄', icon: Activity},
];

// 改後
const panelNav: Array<{id: Exclude<ActivePanel, null>; label: string; icon: LucideIcon}> = [
  {id: 'alerts', label: '預警', icon: Bell},
  {id: 'care', label: '照護', icon: Leaf},
  {id: 'robot', label: '機器人', icon: Bot},
];
```

- [ ] **Step 3: 更新 panelTitle() 函式**

```ts
// 改前（Line 1963-1969）
function panelTitle(panel: Exclude<ActivePanel, null>) {
  if (panel === 'alerts') return '預警與處置';
  if (panel === 'sensing') return '聲量感知';
  if (panel === 'care') return '學生照護';
  if (panel === 'nodes') return '節點與空間';
  return '紀錄與證據';
}

// 改後
function panelTitle(panel: Exclude<ActivePanel, null>) {
  if (panel === 'alerts') return '預警與處置';
  if (panel === 'care') return '學生照護';
  return '機器人派遣';
}
```

- [ ] **Step 4: 更新 PanelDock grid-cols-5 → grid-cols-3**

```tsx
// 改前（PanelDock 函式內）
<div className="grid grid-cols-5 gap-1">

// 改後
<div className="grid grid-cols-3 gap-1">
```

- [ ] **Step 5: 更新 DetailDrawer 的 panel 渲染**

```tsx
// 改前
{panel === 'alerts' && <AlertsPanel {...props} />}
{panel === 'sensing' && <SensingPanel {...props} />}
{panel === 'care' && <CarePanel {...props} />}
{panel === 'nodes' && (
  <GuardianControlPanel
    bridgeOnline={props.bridgeOnline}
    zones={props.zones}
    sensors={props.sensors}
    state={props.state}
    onDispatchRobot={props.onDispatchRobot}
  />
)}
{panel === 'logs' && <LogsPanel {...props} />}

// 改後
{panel === 'alerts' && <AlertsPanel {...props} />}
{panel === 'care' && <CarePanel {...props} />}
{panel === 'robot' && (
  <GuardianControlPanel
    bridgeOnline={props.bridgeOnline}
    zones={props.zones}
    sensors={props.sensors}
    state={props.state}
    onDispatchRobot={props.onDispatchRobot}
  />
)}
```

- [ ] **Step 6: 更新 OperationsBrief 的 sensing 按鈕改為 care**

```tsx
// 改前（OperationsBrief 函式內）
<button onClick={() => onOpenPanel('sensing')} className="...">
  <p className="text-[10px] font-black text-slate-400">聲量</p>
  <p className="mt-1 text-2xl font-black text-slate-950">{viewModel.latestSoundLabel}</p>
</button>

// 改後
<button onClick={() => onOpenPanel('care')} className="...">
  <p className="text-[10px] font-black text-slate-400">照護</p>
  <p className="mt-1 text-2xl font-black text-slate-950">學生關懷</p>
</button>
```

- [ ] **Step 7: 移除不再使用的 import（若有）**

檢查以下是否還有其他地方使用，若無則移除：
- `Activity` icon（logs panel icon）
- `Mic` icon（sensing panel icon，如果 header 其他地方沒用到）

注意：`Radio` icon 被 panelNav 移除，確認 `Radio` 沒有在其他地方被引用後才刪除 import。

- [ ] **Step 8: TypeScript check**

```bash
npm run check:app3
```
預期：0 errors

- [ ] **Step 9: 啟動 dev server 確認**

```bash
npm run dev:app3
```
確認：PanelDock 只有 3 個按鈕（預警/照護/機器人）；點「機器人」開啟 GuardianControlPanel；sensing/logs 不再出現

- [ ] **Step 10: Commit**

```bash
git add "google ai studio/app_3（國中）/AI校園心靈守護者/src/App.tsx"
git commit -m "feat(app3): reduce panels 5→3, rename nodes to robot, remove sensing/logs panels"
```

---

## 最終驗證

- [ ] **全部跑一次 check**

```bash
npm run check:app1 && npm run check:app2 && npm run check:app3
```
預期：全 0 errors

- [ ] **三個 app dev server 同時跑**

```bash
npm run dev
```
確認三個 app 都能正常開啟，nav 和預設 tab 符合設計
