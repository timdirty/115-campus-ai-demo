# AI 校園心靈守護者 PLAN_TODO

## 作品定位

校園情緒關懷與預警系統：透過節點感測、情緒趨勢、關懷提醒與自我照護工具，協助導師和輔導室更早發現需要支持的學生。

## 現況

- 已改為 local-first demo，不需要 Firebase 登入、不需要 Gemini key，也能完整展示。
- 已拆出 `GuardianState`、`GuardianAlert`、`GuardianNode`、`MoodLog`、`SupportMessage` 與本機 AI 回覆服務。
- 預警中心、自我照護、匿名心情牆、聊天、節點監控與重置都讀寫同一份 localStorage。
- 已加入本機狀態/AI 測試與示範資料 JSON 匯出。
- 文案改為「關懷提醒」與「輔導建議」，避免診斷式語氣。
- 已把共用 UI 小元件抽到 `src/components/guardianUi.tsx`，降低 `App.tsx` 維護負擔。
- 已新增 3 分鐘評審展示模式與 localStorage 壞資料恢復測試。
- 狀態讀取與匯入會逐筆修復 alerts、nodes、messages、posts 與 interventions，並把修復後資料寫回 localStorage。
- 已接上 App 1 共用 Node/Serial bridge，預警處理、佈署關懷與節點重新連線會送出 UNO R4 硬體提示指令。
- 已新增 `hardwareEvents`，總覽可持續顯示硬體提示 sent/fallback 紀錄，匯出 JSON 也會包含該證據。
- 行動版 header 已改為雙列操作區，匯出、匯入、重置在手機上不再互相擠壓；卡片與節點地圖在小螢幕會降低圓角與 padding。

## Demo 腳本

1. 總覽頁說明校園穩定度、匿名展示與待關懷提醒。
2. 預警中心選一筆提醒，勾選處置清單。
3. 按「佈署關懷」，回總覽看支持方案與硬體提示紀錄增加。
4. 自我照護頁做心情簽到，發表匿名心情牆。
5. 安全空間聊天輸入考試壓力或同儕問題，看本機 AI 回覆。
6. 節點頁查看校園節點，重新連線離線節點。
7. 匯出或匯入目前示範資料 JSON，最後重置 demo 回到初始資料。

## Arduino R4 WiFi 對接

- 目前已直接使用 App 1 共用 bridge，預設 URL 為 `http://localhost:3200`，也可用 `VITE_ARDUINO_BRIDGE_URL` 覆蓋。
- 已支援指令：`ALERT_SIGNAL`、`CARE_DEPLOYED`、`NODE_RESTART`；firmware 也保留 `NODE_HEARTBEAT` 給下一階段節點回報。
- 未插 Arduino 時 bridge 回傳 fallback 並寫入硬體提示紀錄，不中斷關懷流程；插上並上傳韌體後同一批指令走 Serial。

## 待辦

- 如果有真 Firebase 專案，再把 local-first state 同步到 Firestore，但仍保留本機 fallback。
- 若要使用 Gemini，改由後端 proxy 呼叫，不在前端暴露 API key。
- 接上實機節點後校準 LED、Matrix 或提示器動作；仍需避免收集真學生個資，展示時只使用匿名代號。
- 比賽前用預警處理、自我照護、聊天、節點重新連線、匯出/重置完整跑一次。
- 手機 UI/UX 後續優先級：關懷工具以安全、清楚、少壓迫為先，不必沿用桌面版大卡片密度。

## 十輪展示驗收

1. 總覽第一眼說清楚匿名、非診斷與關懷支援定位。
2. 預警中心勾選 checklist 後提醒進入處理中。
3. 佈署關懷會新增支持方案並更新相關提醒狀態。
4. 自我照護心情簽到會更新穩定度與最新紀錄。
5. 匿名心情牆投稿與按支持有即時回饋。
6. 安全空間聊天只做支持回覆，不宣稱診斷。
7. 節點頁可重新連線離線節點。
8. 隱私模式、匯出、匯入、重置都有 toast 回饋。
9. localStorage 空資料、壞資料與半壞陣列會自我修復。
10. `npm run check` 通過狀態測試、AI 回覆測試、硬體事件紀錄測試、TypeScript 與 production build。

## 驗收

```zsh
npm install
npm run check
```
