# Teach View AI Signal Redesign

## 問題
- 頁面初始就顯示假資料（30/32、學習訊號A/B/C），沒有 demo 流程感
- 兩組出席數字（手動 vs AI）同時出現，互相矛盾
- 學習訊號 A/B/C 無意義，看不出學生狀態

## 目標
比賽 demo 流程：學生舉生圖 → 按掃描 → Gemini 分析 → 出席數字 + 學習訊號自動生成

## Demo 流程
1. 開啟 #teach → 空白狀態（出席「—」、訊號「尚未掃描」）
2. 舉生圖到攝影機 → 按「AI 掃描教室」
3. Gemini 回傳：出席人數 + signals（question/distracted，不含 engaged）
4. 訊號卡片自動出現，有圖示 + 具體描述
5. 點訊號 → 派機器人

## 變更範圍

### 類型擴充（hardwareBridge.ts）
```ts
type ClassroomSignal = { type: 'question' | 'distracted'; description: string };
ClassroomScanApiResult.signals?: ClassroomSignal[]
```

### Prompt 擴充（server/aiService.ts + directGemini.ts）
classroom-scan prompt 加上 signals 欄位，type 限 question/distracted，engaged 不回傳。

### TeachView.tsx
- 初始：attendance 顯示「—」，teachingSignals 為空，顯示「尚未掃描」提示
- 掃描完成：用 signals 覆寫 teachingSignals（type→icon，description→訊號內容）
- 按鈕改名「AI 掃描教室」，移到更顯眼位置

### 不動
- 訊號點擊後的 BottomSheet
- 派遣機器人流程
- Live camera
