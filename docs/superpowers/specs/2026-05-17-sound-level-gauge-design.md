# Sound Level Gauge — Design Spec

**Date:** 2026-05-17  
**Scope:** App3 Guardian — SensingPanel 聲量感知區塊  
**Status:** Approved for implementation

---

## Problem

`SensingPanel` 目前只顯示三張 MiniMetric 數字卡（音量 / 波動 / 狀態），老師無法直覺判斷「現在距離超標還有多遠」，必須記住 46 / 72 兩個閾值才能解讀數字。

---

## Solution: 三合一視覺量表

用一個 `SoundLevelGauge` 元件取代現有三張 MiniMetric 卡，整合以下三個維度：

1. **弧形儀表（arc gauge）** — 指針位置 = `volumeIndex`（0–100），一眼看出聲量的絕對位置與閾值距離。
2. **指針 / 填色顏色 = 綜合 `level`** — 顏色反映 `analyzeAcousticSignal` 的綜合判斷（同時考慮 `volumeIndex` 與 `volatility`），使音量低但波動高的情境（如突發噪音）仍能正確顯紅。
3. **波動輔助條（volatility bar）** — 在弧形下方顯示 `volatility`（0–100）獨立量表，含閾值線 20（active）/ 34（elevated），讓老師知道「哪個維度在拉警報」。

---

## Layout

```
┌─────────────────────────────────────────┐
│ 本機即時運算        [停止/啟用 button]    │  ← 不動
│ 環境聲量感知                             │
├─────────────────────────────────────────┤
│                                         │
│          ╭──────────────╮               │
│         ╱  volumeIndex  ╲              │  ← 弧形儀表 SVG
│        │   大數字 + 單位  │              │
│         ╲              ╱               │
│                                         │
│  ▓▒░░░░░░░░░░░░░░░░░░░  波動 bar       │  ← volatility 輔助條
│            ↑20      ↑34                 │
│                                         │
│  ● 偏高 — 建議老師到場觀察               │  ← status badge (文字)
├─────────────────────────────────────────┤
│  {currentAcoustic.summary}              │  ← 不動
│  [Sparkline]                            │  ← 不動
│  [位置輸入框]                            │  ← 不動
│  [記錄] [建立提醒] [示範]               │  ← 不動
└─────────────────────────────────────────┘
```

---

## Arc Gauge 規格

| 屬性 | 規格 |
|---|---|
| 形狀 | 180° 半圓弧，左起右終 |
| 指針 | 線段 + 中心圓點，隨 `volumeIndex` 旋轉 |
| 弧背景分區 | 0–46 淺綠、46–72 淺橘、72–100 淺紅（opacity 0.15） |
| 弧填色 | 從左起填到 `volumeIndex%` 位置，顏色 = level 對應色 |
| 指針顏色 | level 對應色（calm=`#16a34a` / active=`#f59e0b` / elevated=`#ef4444`） |
| 閾值標線 | 46 橘色虛線、72 紅色虛線，標籤在弧外側 |
| 中央數字 | `volumeIndex`（大字），下方小字 = level 中文 |
| Scale labels | 0（左端）/ 100（右端） |
| SVG 尺寸 | viewBox `0 0 200 110`，`w-full` 自適應寬度 |

---

## Volatility Bar 規格

| 屬性 | 規格 |
|---|---|
| 高度 | 14px（加大視覺權重） |
| 填色 | level 對應色 |
| 閾值線 | left 20%（橘）/ left 34%（紅），各帶數字標籤 |
| 右側標籤 | 顯示 `volatility / 100`，超標時顯紅色 + ⚠️ |
| 觸發來源標示 | 當 `level === 'elevated'` 且 `volumeIndex < 72`（即波動是觸發原因）時，bar 右側顯示小 badge「波動觸發」以橘/紅底色；解釋「低針位但亮紅」的原因 |
| Responsive | 閾值數字標籤在 <360px 時隱藏，不折行 |

> **設計決策：** Gemini 質疑「低針位亮紅」語意矛盾。此為刻意設計——波動高音量低（尖銳異聲）是需要提示的 edge case，觸發來源標示是解法，不改根本邏輯。

---

## Status Badge

- 圓點 + 文字，背景色為 level 對應淺色（`dcfce7` / `fef3c7` / `fee2e2`）
- 色盲友善：文字永遠顯示（「平穩」/ 「活動」/ 「偏高」），不依賴顏色辨識
- `summary` 文字另一行顯示（不塞進 badge）

---

## 遲滯（Hysteresis）

直接使用 `analyzeAcousticSignal` 回傳的 `level`，不在 UI 層重新計算。`acousticGuardian.ts` 的計算本身不含遲滯，但 UI 透過 CSS `transition` 讓顏色平滑切換（0.3s ease），視覺上減少抖動感。

> 若 Gemini 發現的閾值抖動在實際使用中仍明顯，可後續在 `acousticGuardian.ts` 加 2 點遲滯（elevated→active 需 volumeIndex < 70，active→calm 需 volumeIndex < 44），但這是獨立後續 task，不在本次範圍。

---

## 元件位置

| 項目 | 位置 |
|---|---|
| 新元件 | `apps/app3-guardian/src/App.tsx` 內新增 `SoundLevelGauge` function component |
| 取代對象 | `SensingPanel` 內 `<div className="mt-4 grid grid-cols-3 gap-2">` 三張 MiniMetric 卡 |
| MiniMetric | 聲量感知區塊不再使用，但 MiniMetric 元件本身保留（視覺感知面板仍使用） |

---

## Props Interface

```ts
interface SoundLevelGaugeProps {
  volumeIndex: number;   // 0–100
  volatility: number;    // 0–100
  level: AcousticLevel;  // 'calm' | 'active' | 'elevated'
}
```

---

## 顏色 Token

| level | 主色 | 淺背景色 | 文字色 |
|---|---|---|---|
| calm | `#16a34a` | `#dcfce7` | `#166534` |
| active | `#f59e0b` | `#fef3c7` | `#92400e` |
| elevated | `#ef4444` | `#fee2e2` | `#991b1b` |

---

## 技術實作規格（補 Codex 審查結論）

### SVG 弧形計算

- 弧線：`<path d="M 20 95 A 80 80 0 0 1 180 95" />`，center=(100,95)，radius=80
- 在 path 上加 `pathLength="251"` attribute，讓所有 stroke-dasharray 固定用 0–251 計算，消除 strokeLinecap 和縮放誤差

**背景三色分區（opacity 0.15）：**

| 區段 | stroke-dasharray | stroke-dashoffset |
|---|---|---|
| 綠（0–46） | `"116 135"` | `"0"` |
| 橘（46–72） | `"65 186"` | `"135"` |
| 紅（72–100） | `"70 181"` | `"70"` |

**填色 arc（active fill）：**
- `stroke-dasharray="${fillPx} ${251 - fillPx}"` where `fillPx = Math.round(volumeIndex / 100 * 251)`
- `stroke-dashoffset="0"`，顏色 = level 對應色，`stroke-linecap="round"`

**閾值線（tick marks，不穿心）：**
- 基礎線：`<line x1="100" y1="4" x2="100" y2="20" />`（在弧外圍）
- 旋轉公式：`rotate(${v * 1.8 - 90}, 100, 95)`（v=46 → rotate(-7.2)；v=72 → rotate(39.6)）
- 標籤：同 rotate，放在 y2 之外（y=0 附近）

**指針：**
- 基礎線：`<line x1="100" y1="95" x2="100" y2="28" />`（朝上 = −90°）
- 旋轉公式：`rotate(${volumeIndex * 1.8 - 90}, 100, 95)`
- volumeIndex=0 → rotate(−90) 指左；50 → rotate(0) 指上；100 → rotate(90) 指右

### Props Clamping

```ts
const vol = Math.max(0, Math.min(100, volumeIndex));
const vlt = Math.max(0, Math.min(100, volatility));
```
組件內部 clamp，不信任外部值。

### 底部空間

- viewBox 改為 `"0 0 200 120"`，center=(100,95) 不動，底部多 10px 避免 stroke/pivot 被裁切
- Scale labels（0 / 100）放在 y=114

### 無障礙

```tsx
<svg aria-label={`聲量 ${vol}，${levelLabel}，波動 ${vlt}`} role="img" ...>
  <title>{`環境聲量量表：${vol}/100，狀態${levelLabel}`}</title>
```

### 數字保留

弧心顯示 `volumeIndex` 大數字（24px bold），volatility bar 右側顯示 `volatility/100`，完整保留精確值。

---

## 不在本次範圍

- `acousticGuardian.ts` 遲滯邏輯（後續獨立 task）
- 波動閾值可調整 UI
- 歷史閾值超標次數統計
