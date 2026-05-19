# Sound Level Gauge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 App3 Guardian 的聲量感知面板新增三合一視覺量表（弧形儀表 + 波動條 + 狀態徽章），取代原本三張純數字卡。

**Architecture:** 在 `App.tsx` 同檔案新增 `SoundLevelGauge` function component，置於 `SoundSparkline` 之前。`SensingPanel` 內用 `<SoundLevelGauge>` 取代原本三張 `MiniMetric` 卡（lines 2873–2877）。SVG 弧形用 `pathLength="251"` 正規化計算，指針旋轉 `volumeIndex * 1.8 − 90` 度，三色背景分區用 stroke-dasharray 偏移法實現。

**Tech Stack:** React + TypeScript，Tailwind CSS，純 SVG（無外部圖表庫）

---

## File Map

| 動作 | 路徑 | 說明 |
|---|---|---|
| Modify | `apps/app3-guardian/src/App.tsx:2720` | 在此行前插入 `GAUGE_COLORS` 常數 + `SoundLevelGauge` component |
| Modify | `apps/app3-guardian/src/App.tsx:2873–2877` | 用 `<SoundLevelGauge>` 取代三張 MiniMetric 卡 |

---

## Task 1：新增 `GAUGE_COLORS` 常數與 `SoundLevelGauge` 元件

**Files:**
- Modify: `apps/app3-guardian/src/App.tsx` — 在 `const TREND_LS_KEY` 那行（約 line 2704）之前插入新 component

- [ ] **Step 1.1：在 `App.tsx` 中，找到 `const TREND_LS_KEY` 那行（約 line 2704），在它的正上方插入以下程式碼**

```tsx
const GAUGE_COLORS = {
  calm:     {main: '#16a34a', bg: '#dcfce7', text: '#166534', label: '平穩'},
  active:   {main: '#f59e0b', bg: '#fef3c7', text: '#92400e', label: '活動'},
  elevated: {main: '#ef4444', bg: '#fee2e2', text: '#991b1b', label: '偏高'},
} as const;

function SoundLevelGauge({
  volumeIndex,
  volatility,
  level,
}: {
  volumeIndex: number;
  volatility: number;
  level: AcousticLevel;
}) {
  const vol = Math.max(0, Math.min(100, volumeIndex));
  const vlt = Math.max(0, Math.min(100, volatility));
  const c = GAUGE_COLORS[level];
  // pathLength=251 → all dasharray values are in 0–251 units regardless of SVG scaling
  const fillPx = Math.round((vol / 100) * 251);
  const needleAngle = vol * 1.8 - 90; // −90 at vol=0 (left), 0 at vol=50 (top), +90 at vol=100 (right)
  const isVolatilityTrigger = level === 'elevated' && vol < 72;

  return (
    <div>
      {/* ── Arc gauge ── */}
      <svg
        viewBox="0 0 200 120"
        className="w-full"
        role="img"
        aria-label={`聲量 ${vol}，${c.label}，波動 ${vlt}`}
      >
        <title>{`環境聲量量表：${vol}/100，狀態${c.label}`}</title>

        {/* Background zone bands (opacity 0.15) */}
        {/* Green  0–46:  dasharray 116 135, offset   0 */}
        <path d="M 20 95 A 80 80 0 0 1 180 95" pathLength="251"
          fill="none" stroke="#16a34a" strokeWidth="18" strokeLinecap="butt"
          strokeDasharray="116 135" strokeDashoffset="0" opacity="0.15" />
        {/* Orange 46–72: dasharray  65 186, offset 135 */}
        <path d="M 20 95 A 80 80 0 0 1 180 95" pathLength="251"
          fill="none" stroke="#f59e0b" strokeWidth="18" strokeLinecap="butt"
          strokeDasharray="65 186" strokeDashoffset="135" opacity="0.15" />
        {/* Red    72–100: dasharray  70 181, offset  70 */}
        <path d="M 20 95 A 80 80 0 0 1 180 95" pathLength="251"
          fill="none" stroke="#ef4444" strokeWidth="18" strokeLinecap="butt"
          strokeDasharray="70 181" strokeDashoffset="70" opacity="0.15" />

        {/* Active fill — color = comprehensive level */}
        <path d="M 20 95 A 80 80 0 0 1 180 95" pathLength="251"
          fill="none" stroke={c.main} strokeWidth="18" strokeLinecap="round"
          strokeDasharray={`${fillPx} ${251 - fillPx}`} strokeDashoffset="0" />

        {/* Threshold tick at 46 (rotate −7.2° from top) */}
        <line x1="100" y1="6" x2="100" y2="22"
          stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"
          transform="rotate(-7.2, 100, 95)" />
        <text textAnchor="middle" fontSize="8" fontWeight="800" fill="#f59e0b"
          transform="rotate(-7.2, 100, 95)" x="100" y="3">46</text>

        {/* Threshold tick at 72 (rotate +39.6° from top) */}
        <line x1="100" y1="6" x2="100" y2="22"
          stroke="#ef4444" strokeWidth="2" strokeLinecap="round"
          transform="rotate(39.6, 100, 95)" />
        <text textAnchor="middle" fontSize="8" fontWeight="800" fill="#ef4444"
          transform="rotate(39.6, 100, 95)" x="100" y="3">72</text>

        {/* Needle — wrapped in <g> for CSS transition on transform */}
        <g style={{
          transformOrigin: '100px 95px',
          transform: `rotate(${needleAngle}deg)`,
          transition: 'transform 0.15s ease-out',
        }}>
          <line x1="100" y1="95" x2="100" y2="28"
            stroke={c.main} strokeWidth="3" strokeLinecap="round" />
          <circle cx="100" cy="95" r="5" fill="white" stroke={c.main} strokeWidth="2.5" />
        </g>

        {/* Center value */}
        <text x="100" y="76" textAnchor="middle" fontSize="26" fontWeight="900" fill="#0f172a">
          {vol}
        </text>
        <text x="100" y="89" textAnchor="middle" fontSize="9" fontWeight="800" fill={c.main}>
          {c.label}
        </text>

        {/* Scale ends */}
        <text x="14"  y="114" textAnchor="middle" fontSize="9" fontWeight="700" fill="#94a3b8">0</text>
        <text x="186" y="114" textAnchor="middle" fontSize="9" fontWeight="700" fill="#94a3b8">100</text>
      </svg>

      {/* ── Volatility bar ── */}
      <div className="mt-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-black text-slate-500">波動</span>
          <div className="flex items-center gap-1.5">
            {isVolatilityTrigger && (
              <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-black text-red-700">
                波動觸發
              </span>
            )}
            <span className={`text-[10px] font-black ${vlt >= 34 ? 'text-red-600' : vlt >= 20 ? 'text-amber-600' : 'text-slate-500'}`}>
              {vlt}{vlt >= 34 ? ' ⚠️' : ''}
            </span>
          </div>
        </div>
        <div className="relative h-3.5 overflow-visible rounded-full bg-slate-100">
          <div
            className="h-full rounded-full transition-[width] duration-300"
            style={{width: `${vlt}%`, background: c.main}}
          />
          {/* Tick at volatility threshold 20 (active) */}
          <div className="absolute inset-y-0 w-0.5 rounded-full bg-amber-400" style={{left: '20%'}}>
            <span className="absolute left-1/2 top-full mt-0.5 hidden -translate-x-1/2 whitespace-nowrap text-[8px] font-black text-amber-500 sm:block">
              20
            </span>
          </div>
          {/* Tick at volatility threshold 34 (elevated) */}
          <div className="absolute inset-y-0 w-0.5 rounded-full bg-red-400" style={{left: '34%'}}>
            <span className="absolute left-1/2 top-full mt-0.5 hidden -translate-x-1/2 whitespace-nowrap text-[8px] font-black text-red-500 sm:block">
              34
            </span>
          </div>
        </div>
      </div>

      {/* ── Status badge ── */}
      <div className="mt-3 flex justify-center">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black"
          style={{background: c.bg, color: c.text}}
        >
          <span className="h-2 w-2 rounded-full" style={{background: c.main}} />
          {c.label}
        </span>
      </div>
    </div>
  );
}

```

- [ ] **Step 1.2：確認 TypeScript 無錯誤**

```bash
cd "apps/app3-guardian" && npx tsc --noEmit 2>&1 | head -30
```

Expected: 無輸出（或只有既有的非相關警告）

- [ ] **Step 1.3：Commit**

```bash
cd "apps/app3-guardian" && git add src/App.tsx && git commit -m "feat(app3): add SoundLevelGauge component — arc gauge + volatility bar + status badge"
```

---

## Task 2：將 `SoundLevelGauge` 接入 `SensingPanel`

**Files:**
- Modify: `apps/app3-guardian/src/App.tsx:2873–2877`

- [ ] **Step 2.1：在 `App.tsx` 找到以下區塊（約 line 2873–2877），整段替換**

**找到（舊）：**
```tsx
        <div className="mt-4 grid grid-cols-3 gap-2">
          <MiniMetric label="音量" value={currentAcoustic.volumeIndex} />
          <MiniMetric label="波動" value={currentAcoustic.volatility} />
          <MiniMetric label="狀態" value={currentAcoustic.level === 'elevated' ? '偏高' : currentAcoustic.level === 'active' ? '活動' : '平穩'} />
        </div>
```

**替換成（新）：**
```tsx
        <div className="mt-4">
          <SoundLevelGauge
            volumeIndex={currentAcoustic.volumeIndex}
            volatility={currentAcoustic.volatility}
            level={currentAcoustic.level}
          />
        </div>
```

- [ ] **Step 2.2：確認 TypeScript 無錯誤**

```bash
cd "apps/app3-guardian" && npx tsc --noEmit 2>&1 | head -30
```

Expected: 無輸出

- [ ] **Step 2.3：Commit**

```bash
cd "apps/app3-guardian" && git add src/App.tsx && git commit -m "feat(app3): wire SoundLevelGauge into SensingPanel — replace MiniMetric cards"
```

---

## Task 3：視覺驗證

- [ ] **Step 3.1：啟動 dev server**

```bash
cd "apps/app3-guardian" && npm run dev
```

- [ ] **Step 3.2：開啟瀏覽器，進入感知中心 → 感知分頁，確認以下清單**

| 檢查項目 | 預期結果 |
|---|---|
| 弧形量表存在 | 顯示半圓儀表，指針在 0 附近（音量未啟動時） |
| 三色背景分區 | 弧形背景隱約可見綠/橘/紅三段 |
| 閾值線 | 46（橘）/ 72（紅）兩條刻度線清晰 |
| 0 / 100 標籤 | 弧形左右兩端各有數字 |
| 波動條顯示 | 「波動」細條，含 20 / 34 刻度 |
| 狀態徽章 | 底色 + 文字「平穩」/ 「活動」/ 「偏高」 |
| MiniMetric 卡已消失 | 原本三張獨立卡不再出現 |

- [ ] **Step 3.3：按「示範」按鈕，確認高聲量下的狀態**

| 檢查項目 | 預期結果 |
|---|---|
| 指針移動 | 指針旋轉至高音量位置（約 78% 弧度） |
| 填色變紅 | 弧形填色切換為紅色 |
| 狀態徽章 | 顯示「偏高」紅色徽章 |
| 波動條 | 波動值超過 34 時顯示 ⚠️ 與「波動觸發」標籤 |

- [ ] **Step 3.4：縮小瀏覽器視窗到 360px 寬，確認 responsive**

| 檢查項目 | 預期結果 |
|---|---|
| 量表不溢出 | SVG 自適應寬度，不超出容器 |
| 刻度標籤 | 波動條 20 / 34 標籤在窄屏下隱藏（`hidden sm:block`），不折行 |
| 閾值線標籤 | 46 / 72 標籤未被裁切 |

- [ ] **Step 3.5：發現任何問題修正後，最終 commit**

```bash
cd "apps/app3-guardian" && git add src/App.tsx && git commit -m "fix(app3): sound gauge visual polish"
```

---

## 注意事項

- `MiniMetric` component 本身不刪除，視覺感知面板（場域風險辨識區）仍在使用。
- `GAUGE_COLORS` 常數直接在 App.tsx 宣告，不需要新建檔案。
- 遲滯邏輯（hysteresis）不在本次範圍，後續獨立 task。
