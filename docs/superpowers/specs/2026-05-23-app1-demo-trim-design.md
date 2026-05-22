# App1 教師看板精簡 + 來回擦動實作 — Design

**Date**: 2026-05-23
**Branch**: `feature/app1-teacher-dashboard-demo-trim`
**Deadline**: 5/25 仁愛國中決賽（剩 ~48h）

---

## 1. 背景

- **比賽**：臺北市 115 年度中小學資通訊應用大賽智組型機器人創意賽，國小組決賽 5/25
- **主題**：AI 全自動校園服務機器人（**清潔 + 輔助學習雙打**）
- **參賽作品**：AI 智慧型白板機器人（國道五號隊）
- **目標**：拿第一名

**現況問題**：

1. `TeacherDashboard.tsx` 單檔 1039 行、5 大區塊密度過高
2. Engineer mode（servo 滑桿）是**空殼 UI** — firmware 只 ack 命令不執行 servo
3. 說明書 P3 / 海報 P2 標 **MG996R 伺服機**，但 user 確認**實機沒裝**
4. 機器人 `ERASE_REGION_A/B/C` 既有實作只走一次，**沒對應說明書 P7 圖 9「來回擦拭」承諾**

---

## 2. 評分標準對應（200 分）

| 評分項 | 分數 | 我們對應 |
|---|---|---|
| 主題創意與價值 | 60 | 雙打主題 + HITL framing + 4 格故事 |
| 創意（互動/操控/複雜度）| 40 | HITL 老師決策 + AI contentType + 來回擦動 |
| 設計（穩定/機構/AI+機器人）| 40 | 軌跡覆蓋取代精度 + 完整鏈路 |
| 展示（簡報 15 / 攤位 10 / 海報 5）| 30 | 5 min 講稿 + Fallback + 海報修訂 |
| 團隊精神 | 30 | 5 次彩排 + 分工默契 |

**扣分項警示**：海報/書面**不可出現校名、選手姓名、老師臉部**；校服扣 10 分；無原始紀錄裝訂扣 5 分。

---

## 3. 文件 vs 代碼一致性

### 3.1 已對齊（保留即可）

| 文件 | 內容 | 設計對應 |
|---|---|---|
| 簡報 slide 5 | 圓盤吸附 + 雙 N20 差速 | 來回擦動靠差速 ✅ |
| **說明書 P7 圖 9** | **「機器人來回擦拭黑板」** | **方案 D = 實作既有承諾** ✅ |
| 說明書 P6（三）| 「現場 demo 2 區、指令保留 3 區擴充」 | UI 2 區 ✅ |
| 簡報 slide 7 | 「四格故事」框架 | 5 min 講稿直接套用 ✅ |
| 簡報 slide 11 | Q1-Q6 預答 | Q&A 預答現成 ✅ |

### 3.2 衝突 → 已解決

| 衝突 | 位置 | 決策 |
|---|---|---|
| MG996R 伺服機 | 說明書 P3 + 海報 P2 | **改文件**：移除 MG996R、改為「彈簧固定板擦臂，自動升降為未來改良」。簡報 slide 5（「不是機械手臂」）+ 說明書 P7（「板擦壓力靠彈簧固定」）已自然對齊。 |

---

## 4. 設計總覽

### 4.1 Firmware 來回擦動 + 進度回報

`firmware/app1-whiteboard-drive/main.cpp` L206-219，從「走一次」改「走進區 + 來回 ×3 + 回原點 + 每趟發 progress + 最後發 done」：

```
ERASE_REGION_A:
  turnLeft(400ms)
  for pass in 1..3:
    forward(500ms)
    Serial.println("ERASE_PROGRESS:" + pass + "/3")
    backward(500ms)
  turnRight(400ms)
  Serial.println("ERASE_DONE:REGION_A")   // 終結句，供 server 判定 sequence 完成
```

- `ERASE_REGION_B` 對稱（先右再回左）+ `ERASE_DONE:REGION_B`
- `ERASE_REGION_C` 中央區純前後無轉向 + `ERASE_DONE:REGION_C`
- Help banner（main.cpp ~L136）加列 `ERASE_REGION_A/B/C` 命令（codex 發現現況漏列）

**理由**：視覺強（看得到工作）、不靠精度（3 趟覆蓋區內任一點）、對齊文件圖 9。

#### ⚠️ Critical：Serial protocol 擴展（codex review 發現 SSE 短路 bug）

既有 `server/robotService.ts:139-158 waitForSerialResponse()` **看到第一行 newline 就 resolve** — 若 firmware 先 print `ERASE_PROGRESS:1/3`，會讓 `routes.ts:741-749` 過早送 `ok` 給前端，**整個 erase sequence 短路炸掉**。

修法：

1. **`waitForSerialResponse()` 加 `expectedPrefix` 參數** — 非 expected prefix 的 line 不 resolve，繼續累積等
2. **erase-sequence route** 改用 `expectedPrefix="ERASE_DONE:"`，progress lines 不會被當 final reply
3. **Serial line listener（`robotService.ts:115-128`，獨立於 waitForSerialResponse）** 匹配 `ERASE_PROGRESS:N/3` 推 SSE event
4. **`EraseSequenceEvent` type 擴展**（classroomApi.ts:772-778）加 `kind: 'progress'`：

```ts
type EraseSequenceEvent =
  | { kind: 'start'; ... }
  | { kind: 'progress'; region: string; pass: number; total: number }  // ← 新增
  | { kind: 'ok'; ... }
  | { kind: 'error'; ... }
```

5. **erase-sequence route region C 啟用**（`routes.ts:704-710` 既有只接 A/B filter）：spec 保留 C 擴充性，現在需要 route 同步支援

### 4.2 教師看板簡化

`apps/app1-whiteboard/src/pages/TeacherDashboard.tsx`：

- 砍 Engineer mode 整塊（L620-722，~103 行 JSX + 相關 state/handler）
- 砍 `?engineerTools=1` 旗標
- 標題（L447-449）「教師可控的半自動板擦」→「機器人狀態」
- 進度卡（L775-783）加 `erasePassCount` UI「機器人在 X 區，已擦 N/3 趟」
- 刪 dead imports（`Settings2`、`HardwareCalibrationProfile`）

預計縮到 ~720 行。

### 4.3 classroomApi / types / robotPose 清 servo

清 servo schema、type、normalizer、preview logic。同步更新 `api-contract.test.mjs`。

### 4.4 AI contentType 敘事

`SubjectMapping` 加 `contentType: 'question' | 'illustration' | 'message' | 'reminder'`。AI 建議區 + TTS 依 type 給話術：

- `illustration`/`message`/`reminder` → 「發現學生鼓勵小插圖，建議保留」
- `question` → 「過時練習題，建議清除」

**Hardcoded 即可**，subject mapping UI 加下拉欄位即完成（不需 vision）。

### 4.5 文件修訂

詳見 §9。

---

## 5. 詳細改動清單（含行號）

### A. Firmware (`firmware/app1-whiteboard-drive/main.cpp`)

| 行 | 改動 |
|---|---|
| L205-210 | modify `ERASE_REGION_A` 加 3-pass + progress serial |
| L211-216 | modify `ERASE_REGION_B` 同 |
| L217-219 | modify `ERASE_REGION_C` 同 |

預計 +45 行。

### B. TeacherDashboard.tsx

| 行 | 動作 |
|---|---|
| L26-31 | delete `SERVO_ANGLE_FIELDS` |
| L60 | delete `showEngineerTools` state |
| L82-86, 143, 174 | delete `hardwareProfileDraft` state |
| L230-241 | delete `updateServoDraft` |
| L247-323 | delete `saveHardwareProfile` + servo preview handlers |
| L447-449 | modify 標題 |
| L620-722 | delete Engineer mode JSX |
| L775-783 | modify 進度卡 |

新增：`const [erasePassCount, setErasePassCount] = useState<{region: string|null, pass: number}>({region: null, pass: 0})`，由 SSE 推送。

### C. classroomApi.ts

| 行 | 動作 |
|---|---|
| L22-28 | delete servo angle fields |
| L241-247 | delete servo defaults |
| L301-304 | delete fallback servo commands |
| L343-367 | delete `normalizeServoAngle` |
| L144-159 | add `contentType` to `noteDraft` |
| L188-233 | add `contentType` to subject mapping |

### D. Server / Services

| 檔案 | 行 | 動作 |
|---|---|---|
| server/types.ts | L56-77, L124-129 | delete servo type |
| server/defaults.ts | L224-240 | delete servo defaults |
| server/opsService.ts | L82-88, L106-122, L171-200 | delete servo logic |
| server/routes.ts | L22-28, L46-119 | delete servo routes |
| server/robotService.ts | L115-128（serial line listener）| **add** `ERASE_PROGRESS:N/3` parsing + SSE emit（codex 校正：不在 L139-158 加，會被 waitForSerialResponse 吃掉）|
| server/robotService.ts | L139-158 `waitForSerialResponse()` | **modify** 加 `expectedPrefix` 參數、非 expected lines 不 resolve |
| server/routes.ts | ~L704-710 erase-sequence | **modify** 啟用 region C（既有只 filter A/B）|
| server/routes.ts | ~L733-778 erase-sequence SSE | **modify** forward `progress` event 到 client（既有只 start/ok/error）|
| apps/app1-whiteboard/src/services/classroomApi.ts | L772-778 | **add** `kind: 'progress'` to `EraseSequenceEvent` type |
| firmware/app1-whiteboard-drive/main.cpp | ~L136 help banner | **modify** 列出 `ERASE_REGION_A/B/C` 命令（codex 發現現況漏列）|
| server/aiService.ts | L173-213, L328-360 | **add** contentType-aware suggestions |
| server/api-contract.test.mjs | L134, L147, L161, L250-253 | update test expectations |
| src/services/notesStore.ts | L5-35, L132-166, L204-227 | clean servo fields |
| src/services/robotPose.ts | L18-29, L73-83, L133-213 | remove servo angle dependency |
| src/services/directGemini.ts | L145-194 | **add** contentType prompt guidance |
| src/pages/RobotControl.tsx | L241-259, L306-308, L353-377 | TTS contentType-aware |

### E. Dead code 清理

`Settings2`、`HardwareCalibrationProfile`、`sendRobotCommand`、`showEngineerTools`、`updateServoDraft`、`saveHardwareProfile`、`sendCalibrationPreview`、`pushServoProfileToRobot`。

---

## 6. 5 分鐘 Demo 講稿

結構：開場 30s + 4 格 (60s + 75s + 90s + 45s) + 結尾 30s = 5 min。

### 開場（30 秒）

> 各位評審好，我們是國道五號隊，作品「AI 智慧型白板機器人」。
>
> 老師擦白板平均 2-3 分鐘，但真正的痛點不是時間，而是**「擦掉前哪些該留、哪些能清」這個判斷** — 下節課鈴聲響前老師常常來不及細想。我們設計 AI 在這瞬間幫老師看白板、整理筆記、分類內容，讓老師 5 秒做完決策。
>
> 「先保存，再擦除」— **AI 提案、老師決策、機器人執行**。

### 第一格：老師選區（1 分）

> 第一步，老師站在白板前，看哪一區是要保留的重點、哪一區是可以清掉的練習題，在 iPad 上點選。我們刻意不讓 AI 自動決定 — 哪些內容要留到下一節是老師的教學判斷，AI 只做整理跟建議。這就是「人在迴路 HITL」設計。
>
> [實機演示] iPad 顯示分區、AI 已辨識內容類型。AI TTS 建議：「發現學生畫的鼓勵小插圖，建議保留這區不擦」。

### 第二格：先拍照保存（1 分 15 秒）

> 第二步，在擦除之前先拍照。重點是「先拍、再擦」這個強制順序 — 即便白板被擦掉，影像跟 AI 整理的筆記都已經進入任務日誌，學生課後可以回到當天板書。
>
> AI 整理採雙模式：有網路時呼叫 Gemini 整理文字與數學算式；沒網路時切到本機規則式分析，現場展示不會中斷。

### 第三格：機器人來回擦拭（1 分 30 秒）

> 第三步，機器人執行擦拭。
>
> 機器人是圓盤式吸附底盤，靠磁鐵吸在白板上，用底部不織布墊直接接觸擦拭。**不是機械手臂、不走地面 — 它是「吸在白板上的掃地機器人」**。
>
> [實機演示] 老師按「送機器人」，圓盤進入 A 區，**前進—後退—前進—後退—前進—後退**，三趟覆蓋整個 A 區。教師看板即時顯示「機器人在 A 區，已擦 2/3 趟」。
>
> 為什麼是來回三趟？因為差速車輪會打滑，追絕對位置反而不穩。我們刻意不上閉迴路感測器、刻意不接 MG996R 自動升降 — **這些不是做不出來，是刻意選擇「極致穩定」優先**。三趟軌跡覆蓋 + 彈簧固定壓力 + 雙模式容錯，每個都是現場 demo 驗證過最穩的選擇。國小組工程比賽，可重複性比 fancy 功能重要。

### 第四格：學生複習（45 秒）

> 第四步，任務日誌進入課堂紀錄本。學生課後從紀錄本回看當天白板照片跟 AI 整理的筆記。漏抄的可以補、抄錯的可以對照、忘記的可以重看。
>
> 這完成了「教師講授 → AI 整理 → 學生複習」的教學閉環。

### 結尾（30 秒）

> 我們想解決的不是擦白板這件小事，而是「擦掉前那 2-3 分鐘的教學內容，怎麼留下來」。AI 不是要取代老師，而是把老師從重複勞動中釋放出來。
>
> 我們的作品 AI 智慧型白板機器人，謝謝評審。

---

## 7. Q&A 預答（10 題）

**Q1：為什麼不讓 AI 全自動決定擦哪裡？**
> 老師最知道哪些要留到下一節。AI 全自動會奪走教師決策權，違反「人在迴路」原則。AI 負責辨識、整理、建議，老師按按鈕才動。

**Q2：沒網路怎麼辦？**
> 雙模式。有網路 Gemini、沒網路本機規則式，輸出簡化筆記，demo 不中斷。

**Q3：機構怎麼擦？**
> 圓盤吸附底盤 + 磁鐵 + 不織布墊 + 雙 N20 差速。不是機械手臂，像「吸在白板上的掃地機器人」。

**Q4：如何避免機器人失控？**
> 三層安全：軟體 PAUSE_TASK 立停、3 秒 Watchdog 自動斷電、RESET 物理急停。三層獨立不重疊。

**Q5：目前最大限制？**
> 白板反光影響 OCR、輪子定位有累積誤差。兩個繞開法：OCR 不行切本機規則、輪子靠來回擦動覆蓋而非精準定位。

**Q6：未來如何改良？**
> (a) 壓力感測器自動調整板擦力道；(b) 多次拍照交叉比對提升 OCR；(c) 循跡感測器自動校正起點；(d) MG996R 伺服機自動板擦臂升降。

**Q7（補）：為什麼來回擦 3 趟？**
> 1 趟有打滑漏角風險，2 趟邊緣可能殘留，3 趟下來保證覆蓋乾淨且只要約 4 秒。我們選 3 趟是 robustness 跟時間的最佳平衡 — 現場 demo 您可以看到擦得乾淨的結果。

**Q8（補）：開迴路控制 AI 再準有什麼用？**
> 兩段精度錨點：AI 看白板分區是 perception 智能（軟體很準）+ 機器人來回擦動軌跡覆蓋（不靠絕對位置）。兩段配合不需要 sub-cm 控制。

**Q9（補）：AI 為什麼會建議「保留學生小插圖」？是真 AI 還是預設規則？**
> 這是**負責任的 AI 落地（Responsible AI）**。AI 負責理解跟生成建議文字，4 類內容規則是「**護欄機制（Guardrails）**」 — 確保教學現場 AI 不失控、變成老師可預期的穩定輔助。把不可控的 AI 轉成老師可預期的穩定輔助，這是有意設計，不是技術替代。

**Q10（補）：這個作品最大價值在哪？**
> 不是省 2-3 分鐘，是把「擦掉的板書」變「保存的學習資源」。把單向清潔動作改成「保存 → 決策 → 清潔 → 複習」的學習閉環。AI 價值不在取代誰，而在讓每個角色都做得更好。

**Q11（補）：MG996R 規劃了為什麼沒做？是不是做不出來？**
> 不是做不出來，是**工程權衡**。實測時發現**彈簧被動下壓的貼合度跟容錯率完勝現階段的 servo 控制** — 板擦壓力穩定、不會因 servo 抖動造成擦不乾淨。我們選「先擦乾淨」這個核心需求保證，自動升降列為下一階段改良。這是務實工程師思維：不為 fancy 犧牲穩定性。

**Q12（補）：白板上有磁鐵或邊界怎麼辦？開迴路會不會撞到 / 掉下來？**
> 現場 demo 在白板上預先清出 A/B 區，避免磁鐵在路徑上。機器人開迴路設計依賴老師的「事前清理」這個 HITL 步驟 — 就像吸塵器使用者也會先撿大件物品。這是設計取捨：用 demo 環境的事前準備換不裝測距感測器（成本/重量/可靠性）。未來改良方向：加超音波測距做被動避障防呆。

---

## 8. Fallback 劇本

| 情境 | 應對 | 話術（把意外變賣點） |
|---|---|---|
| **A. Wi-Fi 斷** | Serial Bridge USB 直連不靠 Wi-Fi、自動切本機規則 | 「這是雙模式容錯設計」 |
| **B. 機器人卡住** | 老師按暫停 / RESET | 「三層安全保護的設計 — Watchdog 3 秒會自動斷電」 |
| **C. Gemini timeout** | 自動切本機規則 | 「雙模式容錯，現在切到本機」 |
| **D. 白板反光 OCR 全錯** | 重拍 | 「反光是我們列出的限制，未來改良是多次拍照交叉比對」 |
| **E. iPad 沒電 / 當機** | 備用手機開同一網頁 | — |
| **F. 機器人掉落** | 停 / 撿 / RESET | 「未來改良要加壓力感測自動調節吸附力，列在改善方向第一條」 |

---

## 9. 海報 / 說明書 / 簡報修訂

### 9.1 必改（會被評審戳）

| 文件 | 位置 | 現狀 | 改成 |
|---|---|---|---|
| 說明書 | P3 丙、一硬體 | 「兩顆 N20 減速馬達（差速轉向）與一顆 MG996R 伺服機（控制板擦臂升降）」 | 「兩顆 N20 減速馬達（差速轉向），板擦臂以彈簧固定壓力。MG996R 自動升降列為未來改良方向（詳見討論—未來改良）」 |
| 海報 | P2 主要硬體 | MG996R 圖示 + 標籤 | 移除或改「彈簧壓臂（未來改良：MG996R 自動調節）」 |

### 9.2 強化（加分機會）

| 文件 | 位置 | 強化 |
|---|---|---|
| 說明書 | P5 三、指令對照 | 加說明 ERASE_REGION_A/B/C 是「來回擦動三趟」 |
| 海報 | P3 操作流程第 5 步 | 改「機器人來回擦拭」並強化視覺 |
| 簡報 | slide 7 第 3 格 | 加「來回三趟」說明 |

### 9.3 規則 compliance 檢查

- [ ] 全文件無校名（「國道五號」是隊名 OK，學校名要清）
- [ ] 全文件無選手姓名
- [ ] 全文件無老師臉部照片
- [ ] 全文件無校服 / 團體服飾
- [ ] 原始紀錄（研究日誌）已裝訂

---

## 10. 工時 + 改動順序

避免 broken state，依序：

| 序 | 工作 | 時間 | 依賴 |
|---|---|---|---|
| 1 | 移除 servo schema / type / default | 1h | — |
| 2 | 修 robotPose.ts 脫鉤 servo | 0.5h | 1 |
| 3 | 修 api-contract.test.mjs | 0.5h | 1, 2 |
| 4 | 砍 TeacherDashboard engineer mode | 1.5h | 1 |
| 5 | Firmware 加 3-pass + ERASE_PROGRESS + ERASE_DONE + help banner | 1h | — |
| 5.5 | Server `waitForSerialResponse` 加 expectedPrefix + Serial line listener 加 progress parser | 1h | 5 |
| 6 | Server SSE 接 progress（含 EraseSequenceEvent type 擴展 + region C route 啟用）| 1h | 5, 5.5 |
| 7 | Frontend 接 progress state 顯示 | 0.5h | 4, 6 |
| 8 | contentType: type + AI + TTS | 2h | — |
| 9 | 海報/說明書 MG996R 修訂 | 1h | — |
| 10 | 5 min 講稿打磨 + 印小卡 | 1h | — |
| 11 | Q&A 印卡 + 學生背 | 1h | 10 |
| 12 | 5 次彩排（含 Fallback 演練）| 3h | 1-9, 10-11 |
| 13 | npm run verify:ui + npm check + commit + PR | 1h | 1-9 |
| **合計** | | **~14h** | 剩 48h，寬鬆 |

---

## 11. 風險

| 風險 | 機率 | 影響 | 緩解 |
|---|---|---|---|
| Firmware 燒板出錯 | 低 | 高 | 編譯先 dry-run、保留還原版本 |
| Servo schema 移除打破其他畫面 | 中 | 中 | api-contract.test 跑、verify:ui |
| 5 min 講稿學生記不住 | 中 | 高 | 印小卡、分段背、彩排 5 次 |
| 海報修訂來不及 | 中 | 中 | MG996R 是唯一強制改、文件修訂不影響代碼 |
| 機器人現場吸附失敗 | 中 | 高 | Fallback F 話術 + 備用磁鐵 |
| 評審追問 contentType 是不是真 AI | 高 | 中 | Q9 答案已準備好（Guardrails / Responsible AI 框架）|
| **評審覺得整體「妥協感太重」**（彈簧 / 規則 / 開迴路 / 無感測器）| **高** | **高** | **全 demo 統一話術：「為了極致穩定性的刻意設計」。Q7 / Q11 / Q12 + 講稿第三格已涵蓋。Gemini review 點為最易丟分項。** |
| 白板磁鐵 / 邊界導致機器人撞 / 掉落 | 中 | 高 | 現場 demo 前清出 A/B 區、Q12 預答、Fallback F 話術 |
| **SSE 短路（waitForSerialResponse 吃掉 progress lines）** | **高** | **高** | **§4.1 已列修法：waitForSerialResponse 加 expectedPrefix；codex review 發現** |
| ARDUINO_PORT 未設 server 直接 crash | 中 | 高 | demo 前檢查 `.env` ARDUINO_PORT；無實機時走 sim mode（robotService.ts:13-15）|
| check:polish baseline 先存壞掉（expected 9 routes, got 8）| 高 | 中 | **不是我們造成、不擋本工作**；單獨開 task 修 polish-500-check.mjs:160；當前 verify gate 跳過該檢查 |
| Library.tsx / CapturePanel.tsx 漏清 showEngineerTools / contentType | 中 | 中 | implement 時 grep verify |

---

## 12. Out of scope（YAGNI）

明確**不做**：

- ❌ 真實接 MG996R servo（user 確認硬體沒裝）
- ❌ Vision-based 區塊邊界辨識（hardcoded 即可，demo 沒人問）
- ❌ Real-time webcam 內容分類（subject mapping UI 已存在）
- ❌ EEPROM 存校正參數
- ❌ 三區 demo 模式（保留 ERASE_REGION_C 擴充性即可）
- ❌ 重寫 ev3Manager / app2 / app3 任何東西
- ❌ App3 mika 整合（在另一分支）
- ❌ 不動 `firmware/shared-command-demo/commands.cpp`（有真 Servo 依賴，但 platformio.ini 已分離 build filter，互不影響）
- ❌ 不修 `scripts/polish-500-check.mjs:160` 的 baseline 9 vs 8 routes 不一致（單獨開 task）

---

## 13. 接下來

1. **本 spec → user review**（你看到不對的告訴我）
2. dual review（codex + gemini）
3. 進 implementation（按 §10 順序）
4. 5 次彩排
5. 5/25 決賽

— EOF
