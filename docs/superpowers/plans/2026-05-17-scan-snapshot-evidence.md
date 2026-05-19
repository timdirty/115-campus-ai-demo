# Scan Snapshot Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 AI 掃描那一幀教室截圖存進 `ClassroomSignal`，在分心/提問 modal 頂部顯示全寬快照，並把即時專注報表改成掃描時間軸。

**Architecture:** `ClassroomSignal` 加 `snapshot` (base64 JPEG data URL) 和 `capturedAt` 欄位。`handleAttendanceScan` 在 canvas 繪圖後立即 `toDataURL('image/jpeg', 0.5)` 並帶入所有 signal。TeachView 另開 `activeAiSignal` state 傳給 modal 顯示。

**Tech Stack:** React (useState), Tailwind CSS, TypeScript, hardwareBridge types

---

## File Map

| File | 變更 |
|------|------|
| `apps/app2-campus-service/src/services/hardwareBridge.ts` | `ClassroomSignal` 加 `snapshot?` + `capturedAt?` |
| `apps/app2-campus-service/src/views/TeachView.tsx` | 截圖存入 signal、`activeAiSignal` state、四處 UI 更新 |

---

### Task 1: 擴充 `ClassroomSignal` 型別

**Files:**
- Modify: `apps/app2-campus-service/src/services/hardwareBridge.ts:19-22`

- [ ] **Step 1: 更新型別**

將 `hardwareBridge.ts` 的 `ClassroomSignal` 從：

```ts
export type ClassroomSignal = {
  type: ClassroomSignalType;
  description: string;
};
```

改成：

```ts
export type ClassroomSignal = {
  type: ClassroomSignalType;
  description: string;
  snapshot?: string;     // base64 JPEG data URL
  capturedAt?: string;   // ISO 8601 timestamp
};
```

- [ ] **Step 2: 確認 TypeScript 無報錯**

```bash
cd apps/app2-campus-service && npm run lint
```

Expected: 0 errors（`snapshot` 為 optional，現有使用端不受影響）

- [ ] **Step 3: Commit**

```bash
git add apps/app2-campus-service/src/services/hardwareBridge.ts
git commit -m "feat(app2): extend ClassroomSignal with snapshot + capturedAt fields"
```

---

### Task 2: 掃描時擷取截圖並存入 signals

**Files:**
- Modify: `apps/app2-campus-service/src/views/TeachView.tsx:146-161`

- [ ] **Step 1: 修改 `handleAttendanceScan` 截圖存入 signals**

找到 `handleAttendanceScan`（line ~137），把截圖結果存成 `snapshotDataUrl` 並帶入每個 signal：

```ts
const handleAttendanceScan = async () => {
  if (attendanceScanning) return;
  const video = attendanceVideoRef.current;
  if (!video) return;
  setAttendanceScanning(true);
  setScanResult(null);
  setScanError(null);
  const {signal, token} = scanAbort.begin();
  try {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL('image/jpeg', 0.65).replace(/^data:image\/jpeg;base64,/, '');
      const snapshotDataUrl = canvas.toDataURL('image/jpeg', 0.5); // 存整張 data URL
      const capturedAt = new Date().toISOString();
      const result = await scanClassroom(base64, signal);
      if (signal.aborted) return;
      if (result.ok) {
        setScanResult(result);
        setAiSignals(
          (result.signals ?? []).map(s => ({
            ...s,
            snapshot: snapshotDataUrl,
            capturedAt,
          }))
        );
      } else {
        setScanError(result.error ?? 'AI 辨識失敗，請重試或手動完成');
      }
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return;
    setScanError('無法連接 AI 服務，請手動完成點名');
  } finally {
    scanAbort.end(token);
    setAttendanceScanning(false);
  }
};
```

- [ ] **Step 2: 確認 lint**

```bash
cd apps/app2-campus-service && npm run lint
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/app2-campus-service/src/views/TeachView.tsx
git commit -m "feat(app2): capture scan frame and attach snapshot+capturedAt to each ClassroomSignal"
```

---

### Task 3: 加入 `activeAiSignal` state 並連接 signal card

**Files:**
- Modify: `apps/app2-campus-service/src/views/TeachView.tsx`

- [ ] **Step 1: 加入 `activeAiSignal` state**

在 TeachView 現有 state 區塊（line ~30 附近），加在 `modal` state 附近：

```ts
const [activeAiSignal, setActiveAiSignal] = useState<ClassroomSignal | null>(null);
```

- [ ] **Step 2: 更新 `openStudent` 接受可選 `ClassroomSignal`**

找到現有 `openStudent`（line ~82）：

```ts
const openStudent = (signal: TeachingSignal) => {
```

改成：

```ts
const openStudent = (signal: TeachingSignal, aiSig?: ClassroomSignal) => {
  setActiveAiSignal(aiSig ?? null);
```

（其餘邏輯不變，在原有程式碼後繼續執行 `setActiveStudent` 等）

- [ ] **Step 3: 更新 signal card 的 `onClick` 傳入 `sig`**

找到 signal card 的 `onClick`（line ~268）：

```tsx
onClick={() => openStudent(syntheticSig)}
```

改成：

```tsx
onClick={() => openStudent(syntheticSig, sig)}
```

- [ ] **Step 4: 確認 lint**

```bash
cd apps/app2-campus-service && npm run lint
```

Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add apps/app2-campus-service/src/views/TeachView.tsx
git commit -m "feat(app2): wire activeAiSignal state to signal card click"
```

---

### Task 4: 分心警示 modal 加快照橫幅

**Files:**
- Modify: `apps/app2-campus-service/src/views/TeachView.tsx:402-433`

- [ ] **Step 1: 在 alert modal 頂部加快照區塊**

找到 `activeStudent?.type === 'alert'` 的 modal 分支（line ~402），在 `<div className="p-5 space-y-8 pb-8">` 的**最前面**插入：

```tsx
{/* Scan snapshot banner */}
{activeAiSignal?.snapshot && (
  <div className="relative overflow-hidden rounded-2xl mb-2" style={{height: 130}}>
    <img
      src={activeAiSignal.snapshot}
      alt="掃描當下畫面"
      className="w-full h-full object-cover"
    />
    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
    <span className="absolute top-2 right-2 bg-black/55 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
      {activeAiSignal.capturedAt
        ? new Intl.DateTimeFormat('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(activeAiSignal.capturedAt))
        : ''} 掃描
    </span>
    <span className="absolute bottom-2 left-2 bg-black/55 text-white text-[10px] font-medium px-2.5 py-1 rounded-full">
      掃描當下畫面
    </span>
  </div>
)}
{!activeAiSignal?.snapshot && (
  <div className="flex items-center justify-center rounded-2xl mb-2 bg-surface-container-high border border-outline-variant/30" style={{height: 80}}>
    <span className="text-on-surface-variant/50 text-xs">📷 截圖未保存（舊版掃描）</span>
  </div>
)}
```

注意：插入位置在 `<div className="bg-error/10 ...">` 的**前面**（info card 前）。

- [ ] **Step 2: 確認 lint**

```bash
cd apps/app2-campus-service && npm run lint
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/app2-campus-service/src/views/TeachView.tsx
git commit -m "feat(app2): add scan snapshot banner to distraction alert modal"
```

---

### Task 5: 學生提問 modal 加快照橫幅

**Files:**
- Modify: `apps/app2-campus-service/src/views/TeachView.tsx:316-400`

- [ ] **Step 1: 在 question modal 頂部加快照區塊**

找到 `activeStudent?.type === 'question'` 分支（line ~316），在 `<div className="p-4 flex flex-col h-[65vh] ...">` 的**最前面**、聊天訊息列表 `<div className="flex-1 overflow-y-auto ...">` 的**前面**插入：

```tsx
{/* Scan snapshot banner */}
{activeAiSignal?.snapshot && (
  <div className="relative overflow-hidden rounded-2xl mb-3 flex-shrink-0" style={{height: 120}}>
    <img
      src={activeAiSignal.snapshot}
      alt="掃描當下畫面"
      className="w-full h-full object-cover"
    />
    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
    <span className="absolute top-2 right-2 bg-black/55 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
      {activeAiSignal.capturedAt
        ? new Intl.DateTimeFormat('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(activeAiSignal.capturedAt))
        : ''} 掃描
    </span>
    <span className="absolute bottom-2 left-2 bg-[#2563eb]/80 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
      掃描當下畫面
    </span>
  </div>
)}
```

- [ ] **Step 2: 確認 lint**

```bash
cd apps/app2-campus-service && npm run lint
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/app2-campus-service/src/views/TeachView.tsx
git commit -m "feat(app2): add scan snapshot banner to student question modal"
```

---

### Task 6: 訊號列表卡片加時間戳

**Files:**
- Modify: `apps/app2-campus-service/src/views/TeachView.tsx:281`

- [ ] **Step 1: 在卡片 description 下方加時間戳**

找到 signal card 的描述段落（line ~281）：

```tsx
<p className="text-xs font-medium text-on-surface-variant/90 leading-relaxed truncate">{sig.description}</p>
```

在其**後面**加：

```tsx
{sig.capturedAt && (
  <p className="text-[10px] text-on-surface-variant/50 mt-1 font-mono">
    {new Intl.DateTimeFormat('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(sig.capturedAt))} 掃描 · 點開查看截圖
  </p>
)}
```

- [ ] **Step 2: 確認 lint**

```bash
cd apps/app2-campus-service && npm run lint
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/app2-campus-service/src/views/TeachView.tsx
git commit -m "feat(app2): show capturedAt timestamp on signal list cards"
```

---

### Task 7: 即時專注報表改成掃描時間軸

**Files:**
- Modify: `apps/app2-campus-service/src/views/TeachView.tsx:677-689`

- [ ] **Step 1: 替換 chart modal 內容**

找到 `modal === 'chart'` 的 BottomSheet（line ~677），將 `<div className="p-6 flex flex-col items-center py-10">` 整段替換成：

```tsx
<div className="p-5 space-y-4">
  {aiSignals.length === 0 ? (
    <div className="flex flex-col items-center py-10 gap-4">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
        <Focus size={38} className="text-primary opacity-80" />
      </div>
      <p className="text-base font-headline font-bold text-on-surface">尚無掃描記錄</p>
      <p className="text-sm text-on-surface-variant text-center max-w-xs leading-relaxed">
        使用「AI 掃描」後，此處將顯示每次掃描的截圖與偵測結果。
      </p>
    </div>
  ) : (
    <>
      <h3 className="font-bold text-sm text-on-surface-variant uppercase tracking-widest">掃描記錄</h3>
      <div className="space-y-3">
        {aiSignals.map((sig, idx) => {
          const isAlert = sig.type === 'distracted';
          const timeLabel = sig.capturedAt
            ? new Intl.DateTimeFormat('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(sig.capturedAt))
            : '—';
          return (
            <div key={idx} className="flex items-center gap-3">
              {sig.snapshot ? (
                <img
                  src={sig.snapshot}
                  alt="掃描截圖"
                  className="w-14 h-11 object-cover rounded-xl flex-shrink-0 border border-outline-variant/30"
                />
              ) : (
                <div className="w-14 h-11 rounded-xl flex-shrink-0 bg-surface-container flex items-center justify-center border border-outline-variant/30">
                  <span className="text-lg">📷</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-mono text-on-surface-variant/60">{timeLabel}</p>
                <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5 ${
                  isAlert
                    ? 'bg-error/10 text-error'
                    : 'bg-primary/10 text-primary'
                }`}>
                  {isAlert ? '⚠ 分心偵測' : '❓ 舉手偵測'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  )}
  <p className="text-[10px] text-on-surface-variant/40 text-center pt-2">
    僅供本節課參考，重整頁面後自動清除
  </p>
  <button onClick={downloadReport} className="mt-2 bg-primary hover:bg-primary/95 text-white py-4 px-6 rounded-2xl font-bold text-[15px] tracking-wide active:scale-[0.98] w-full transition-all flex items-center justify-center gap-2">
    匯出完整 PDF 報告
  </button>
</div>
```

- [ ] **Step 2: 確認 lint**

```bash
cd apps/app2-campus-service && npm run lint
```

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/app2-campus-service/src/views/TeachView.tsx
git commit -m "feat(app2): replace report modal loading spinner with scan timeline"
```

---

### Task 8: 手動驗證

- [ ] **Step 1: 確認開發伺服器運行**

```bash
lsof -i :3000 | grep LISTEN && lsof -i :3202 | grep LISTEN
```

Expected: 兩個 port 都有 process

- [ ] **Step 2: 驗證清單**

在瀏覽器開 `http://localhost:3000/`，執行 TeachView 的 AI 場域點名：

1. 點「出缺席場域評估」右側 AI 掃描按鈕 → 允許相機 → 點「AI 辨識」
2. 掃描完成後，訊號列表卡片底部應出現時間戳（「上午 10:39 掃描 · 點開查看截圖」）
3. 點擊分心訊號 → modal 頂部應顯示相機截圖（暗色漸層 + 「掃描當下畫面」badge）
4. 點擊提問訊號 → modal 頂部應顯示相機截圖（藍色 badge）
5. 點擊「班級互動概況」→ 「即時專注度分析報表」→ 若有掃描記錄應顯示時間軸縮圖；若無應顯示「尚無掃描記錄」

- [ ] **Step 3: 無截圖降級驗證**

在未執行掃描時打開任一舊訊號 modal：應顯示「📷 截圖未保存（舊版掃描）」灰色佔位符。

---

### Task 9: 最終 lint + build

- [ ] **Step 1: Lint**

```bash
cd apps/app2-campus-service && npm run lint
```

Expected: 0 errors

- [ ] **Step 2: Build check**

```bash
cd apps/app2-campus-service && npm run build 2>&1 | tail -10
```

Expected: `built in X.Xs` — 無 error

- [ ] **Step 3: 最終 commit（若有未提交變更）**

```bash
git add apps/app2-campus-service/
git commit -m "feat(app2): scan snapshot evidence — complete"
```
