# Spec: AI 掃描快照視覺佐證

**Date:** 2026-05-17  
**App:** App2 校園服務機器人 (`apps/app2-campus-service`)  
**Status:** Approved

---

## 問題

TeachView 的 AI 掃描會用 canvas 拍一幀教室截圖送 Gemini 辨識，但截圖在送出後直接丟棄。
最終顯示給老師的分心/提問訊號只有文字描述，缺乏視覺佐證，demo 時說服力不足。

---

## 設計目標

掃描那一幀截圖存進訊號資料，在 modal 和報表裡顯示出來，讓老師看到「AI 是根據這個畫面做出判斷的」。

---

## 資料模型變更

### `ClassroomSignal`（`src/services/hardwareBridge.ts`）

新增 `snapshot` 欄位：

```ts
export type ClassroomSignal = {
  type: ClassroomSignalType;
  description: string;
  snapshot?: string;       // base64 JPEG data URL ("data:image/jpeg;base64,...")
  capturedAt?: string;     // ISO timestamp of the scan moment
};
```

截圖規格：
- 尺寸：最長邊 320px（已是掃描既有縮放比例）
- 品質：`toDataURL('image/jpeg', 0.5)`（比現有掃描的 0.65 再壓一點）
- 單張估算：約 15–30 KB

---

## 截圖擷取時機

`handleAttendanceScan`（`TeachView.tsx` line 137）在送 API 前已有 canvas 繪圖。
把 `canvas.toDataURL` 的結果另存一份，帶入各 signal：

```ts
const snapshotDataUrl = canvas.toDataURL('image/jpeg', 0.5);
const capturedAt = new Date().toISOString();
// ...after result.ok:
setAiSignals(
  (result.signals ?? []).map(s => ({
    ...s,
    snapshot: snapshotDataUrl,
    capturedAt,
  }))
);
```

所有同一次掃描的 signal 共用同一張截圖（拍攝時機相同）。

---

## Signal 數量上限

React state 最多保留 **5 筆** signal（FIFO），防止 base64 累積撐爆記憶體。  
新 signal 陣列取代舊陣列（不 append），每次掃描刷新全部——符合現有行為。

---

## UI 變更

### 1. 分心警示 Modal（`⚠️ 分心警示 即時互動`）

**頂部加全寬掃描截圖區塊（高度 ~130px）：**

```
┌─────────────────────────────┐
│  ⚠️ 分心警示 即時互動    ✕  │ ← header
├─────────────────────────────┤
│                             │
│   [教室截圖 base64]         │ ← 全寬，130px 高
│   ┌─────┐                  │   紅色虛線框（裝飾，非真實座標）
│   │     │ ⚠ 分心偵測       │   右上角：時間戳 chip
│   └─────┘  10:39 掃描      │
├─────────────────────────────┤
│  注意力提醒 (info card)     │
│  [發送震動] [老師確認]      │
│  [學習報告 ↗]               │
└─────────────────────────────┘
```

- 無截圖時：顯示 `📷 掃描截圖未保存` 灰色佔位符
- 紅框是 `position: absolute` 的裝飾框，固定在中左區域，不依賴真實座標

### 2. 學生提問 Modal（`❓ 學生提問 即時互動`）

與分心警示相同版型，差異：

- 截圖區塊改藍框（`border-blue-500`）
- 底部保留聊天氣泡 + 快速回覆 + 輸入框

```
┌─────────────────────────────┐
│  ❓ 學生提問 即時互動    ✕  │
├─────────────────────────────┤
│   [教室截圖]                │ ← 130px，藍框
│   ❓ 舉手偵測  10:41 掃描   │
├─────────────────────────────┤
│  [聊天氣泡: 一位男學生舉手] │
│  [好問題！] [看黑板]        │
│  [輸入 AI 輔助回覆...]    ➤ │
└─────────────────────────────┘
```

### 3. 即時專注度分析報表

把「分析數據匯總中…」空白 loading 改成掃描時間軸：

```
┌─────────────────────────────┐
│  即時專注度分析報表      ✕  │
├─────────────────────────────┤
│  掃描記錄                   │
│  ┌───┐  10:39  ⚠ 分心偵測  │
│  │截圖│                     │
│  └───┘                     │
│  ┌───┐  10:41  ❓ 舉手偵測  │
│  │截圖│                     │
│  └───┘                     │
│  ┌───┐  10:44  ✓ 專注正常   │
│  │截圖│                     │
│  └───┘                     │
├─────────────────────────────┤
│  [匯出完整 PDF 報告]        │
└─────────────────────────────┘
```

時間軸資料來自 `aiSignals` + 一筆「正常」佔位（若最後一次掃描無 distracted signal）。

### 4. 訊號列表卡片（TeachView 主畫面）

在卡片描述文字下方加一行時間戳：

```
⚠️ 分心警示          [分心中]
第 3 排左側學生頭部未朝向黑板
10:39 掃描 · 點開查看截圖        ← 新增這行
```

不加縮圖，保持列表的輕量感。

---

## 不在範圍內

- 真實 bounding box / object detection 座標（Gemini 不回傳）
- 截圖存後端 / 持久化（頁面重整後清除，demo 可接受）
- Virtual List（demo 場景 signal < 10，不需要）

---

## 風險與緩解

| 風險 | 緩解 |
|------|------|
| base64 記憶體累積 | 每次掃描覆蓋舊 signal，無 append |
| mobile 閃退 | quality 0.5 壓縮，單張 ≤30KB |
| 圖文不匹配 | capture 與 API call 在同一 try block |
| 紅/藍框位置不對應真實學生 | 框為裝飾，視覺暗示而非精確定位，文案說明清楚 |

---

## 受影響檔案

1. `src/services/hardwareBridge.ts` — `ClassroomSignal` 型別加 `snapshot` / `capturedAt`
2. `src/views/TeachView.tsx` — 截圖存入 signal、modal 版面、列表卡片時間戳
3. `src/views/TeachView.tsx` 內的 modal JSX（分心 / 提問 / 報表）
