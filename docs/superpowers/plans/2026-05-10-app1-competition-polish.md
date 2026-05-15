# App 1 Competition Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App 1「AI 自動板擦機器人」達到比賽水準：修復切頁狀態丟失、升級 AI 小老師本機品質、強化機器人虛擬回饋、支援跨裝置橋接、新增學生練習卡與 Tour 評審問答。

**Architecture:** 8 個獨立 chunk，從最小改動到最大影響依序執行。Chunk 1-3 是基礎修復，Chunk 4-5 是 UX 強化，Chunk 6-8 是學生體驗材料。全程不動 server 架構（除 Chunk 5 CORS 一行）。

**Tech Stack:** React 18, TypeScript, Vite, TailwindCSS, Motion, localStorage/sessionStorage

---

## File Map

| 動作 | 檔案 | 負責 |
|------|------|------|
| NEW | `src/services/localChatTemplates.ts` | 60 Q&A 模板 + Jaccard matchTemplate |
| MODIFY | `src/services/geminiService.ts` | chatWithAI fallback 改用 matchTemplate |
| MODIFY | `src/services/apiClient.ts` | 加 getBridgeBase() + setBridgeHost() |
| MODIFY | `src/App.tsx` | 用 getBridgeBase() 取代 hardcoded localhost:3201 |
| MODIFY | `src/pages/Home.tsx` | sessionStorage 狀態保留 + 練習卡 checklist |
| MODIFY | `src/pages/TeacherDashboard.tsx` | 虛擬執行 badge（fallback 狀態更清楚） |
| MODIFY | `src/pages/RobotControl.tsx` | D-pad 失敗回饋 + speedTimer unmount 清理 |
| MODIFY | `src/components/SystemSettingsPanel.tsx` | 重置按鈕 + 橋接主機設定 |
| MODIFY | `src/components/tour/tourSteps.ts` | 加 reviewerQ 欄位 |
| MODIFY | `src/components/tour/TourOverlay.tsx` | 顯示 reviewerQ amber 區塊 |

---

## Task 1: localChatTemplates.ts（60 組模板 + Jaccard）

**Files:**
- Create: `src/services/localChatTemplates.ts`

- [ ] **Step 1: 建立新檔案**

```typescript
// src/services/localChatTemplates.ts

export type ChatTemplate = {
  keywords: string[];
  answer: string;
};

// ── 白板管理 (15) ──────────────────────────────────────────────
const BOARD_TEMPLATES: ChatTemplate[] = [
  {
    keywords: ['白板', '辨識', '怎麼', '知道', '哪裡', '區塊', '位置'],
    answer: '我們把白板分成 A、B、C 三個區塊。AI 分析完畢後，會判斷每個區塊的內容是否已經完整傳達，標記「可清空」或「保留」。老師在教師看板確認後，機器人才會動作——AI 只是建議，老師有最終決策權。',
  },
  {
    keywords: ['拍照', '攝影機', '相機', '如何', '輸入', '圖片'],
    answer: '首頁有兩種輸入方式：用攝影機即時拍下白板，或用示範內容練習流程。拍照後 AI 會自動分析白板文字與區塊配置，不需要手動輸入。',
  },
  {
    keywords: ['OCR', '文字', '辨識', '提取', '讀取'],
    answer: 'OCR（光學文字辨識）是從白板圖片中把文字取出來的技術。本系統使用本機 OCR（EasyOCR）做初步辨識，再交給 AI 分析語意與重要性，判斷哪些內容可以擦掉。',
  },
  {
    keywords: ['分析', 'AI', '準確', '正確', '判斷', '結果'],
    answer: 'AI 的白板分析準確度取決於圖片清晰度和光線。白天自然光下效果最好。若分析結果不準，老師可以直接在教師看板手動調整區塊決策，AI 只是輔助，不會強制執行。',
  },
  {
    keywords: ['保留', '不要擦', '重要', '內容', '標記'],
    answer: '在教師看板，點選區塊可以切換「保留」或「可清空」狀態。標記為「保留」的區塊機器人不會碰，例如今天的作業說明或考試重點。',
  },
  {
    keywords: ['清空', '擦掉', '刪除', '移除', '清除'],
    answer: '標記為「可清空」的區塊，送出機器人任務後，板擦機器人會移動到對應位置執行擦除。在展示模式下（沒有 Arduino），系統會顯示虛擬執行動畫並記錄任務。',
  },
  {
    keywords: ['紀錄', '歷史', '保存', '儲存', '課堂'],
    answer: '每次 AI 分析結果都會自動保存在「課堂紀錄本」。你可以在紀錄本搜尋任何一堂課的白板內容、老師講解和分析結果，方便複習或製作學習單。',
  },
  {
    keywords: ['示範', '範例', '沒有白板', '測試', '練習'],
    answer: '沒有白板或攝影機時，首頁可以使用「示範內容」按鈕，系統會載入一組範例課堂資料，讓你完整走過所有流程。比賽展示時非常好用。',
  },
  {
    keywords: ['逐字稿', '語音', '老師講解', '錄音'],
    answer: '首頁的麥克風按鈕可以錄下老師講解，AI 自動轉成逐字稿並整合進課堂分析。這讓筆記不只有白板文字，也包含老師補充說明。',
  },
  {
    keywords: ['格式', '圖片', 'base64', '大小', '限制'],
    answer: '系統接受攝影機即時拍照和上傳圖片（JPG/PNG）。圖片會轉成 base64 格式在本機處理，不上傳至外部伺服器，保護課堂隱私。',
  },
  {
    keywords: ['科目', '數學', '國語', '英文', '自然', '社會'],
    answer: '首頁可以選擇科目提示，幫助 AI 更準確辨識該科目的專有詞彙。例如選「數學」，AI 會更正確辨識算式和符號。',
  },
  {
    keywords: ['白板', '區塊', 'A', 'B', 'C', '三個', '幾個'],
    answer: '目前系統把白板分成 A、B、C 三個區塊（上中下或左中右）。每個區塊獨立控制，老師可以精確指定哪個部分要擦、哪個要留。',
  },
  {
    keywords: ['備份', '匯出', '還原', '資料'],
    answer: '設定面板有「備份」和「匯出」功能。備份會在本機建立 JSON 檔案，匯出可以下載完整課堂紀錄。萬一資料有問題，可以從備份還原。',
  },
  {
    keywords: ['校正', '校準', '座標', '位置', '對齊'],
    answer: '教師看板的「硬體校準」區段可以設定伺服馬達角度（A/B/C 區對應的角度）。第一次使用時需要實機校準，確保機器人移動到正確位置。',
  },
  {
    keywords: ['多次', '重複', '再次', '連續', '批次'],
    answer: '可以連續送出多個區塊的任務。教師看板有「連續擦除」模式，依序執行 A → B → C，或只擦標記為可清空的區塊。',
  },
];

// ── 課堂節奏 (15) ──────────────────────────────────────────────
const CLASSROOM_TEMPLATES: ChatTemplate[] = [
  {
    keywords: ['孩子', '聽得懂', '簡單', '小學生', '國小', '說法'],
    answer: '要把課堂內容改成孩子聽得懂的說法，可以這樣做：\n1. 把抽象名詞換成生活中看得到的例子（「電流」→「水在水管裡流動」）\n2. 用「就像⋯⋯一樣」開頭引導比喻\n3. 先問孩子「你有沒有看過⋯⋯」，再帶入概念\n4. 每講完一個重點，讓孩子用自己的話複述一遍',
  },
  {
    keywords: ['測驗', '題目', '小考', '練習題', '出題'],
    answer: '設計小測驗的建議：\n1. 先出是非題讓學生建立信心（2題）\n2. 再出填空題考關鍵詞（2題）\n3. 最後一題「請用一句話說明⋯⋯」確認深度理解\n\n也可以直接用「複習」分頁，選擇課堂紀錄後自動產生測驗題目。',
  },
  {
    keywords: ['分組', '活動', '討論', '協作', '小組'],
    answer: '5 分鐘分組活動設計：\n1. 每組 3-4 人，分工：說明員、記錄員、報告員\n2. 給每組白板區塊截圖，讓他們討論「這個區塊今天最重要的是什麼」\n3. 輪流用 30 秒報告\n4. 其他組補充或提問',
  },
  {
    keywords: ['節奏', '速度', '太快', '跟不上', '放慢'],
    answer: 'AI 分析會偵測課堂節奏（正常/放慢/需要複習）。如果系統建議放慢，代表白板內容累積較多、尚未清空，可能表示學生還在抄寫。教師看板會顯示目前建議節奏。',
  },
  {
    keywords: ['時間', '管理', '下課', '課堂', '節省'],
    answer: '這套系統的核心價值之一是節省老師管理白板的時間。傳統上老師每節課約花 3-5 分鐘手動決定擦哪裡，有了 AI 輔助，決策時間縮短到 30 秒以內。',
  },
  {
    keywords: ['複習', '回顧', '重點', '整理', '摘要'],
    answer: '「複習」分頁可以選擇任一堂課的紀錄，自動產生學習摘要或測驗題組。老師可以在下一節課開始前，用這個功能快速帶學生回顧上節課重點。',
  },
  {
    keywords: ['學習單', '作業', '印出', '下載'],
    answer: '「複習」分頁產生的摘要或測驗可以下載成文字檔，老師再複製到 Word 排版即可印出。這讓製作學習單從 20 分鐘縮短到 2 分鐘。',
  },
  {
    keywords: ['注意力', '專心', '分心', '集中'],
    answer: '教師看板顯示的「專心度」是依據課堂節奏推估的參考值，不是真實攝影機監控。它反映的是 AI 分析白板使用效率的結果，幫老師意識到哪個時間段可能需要調整教學節奏。',
  },
  {
    keywords: ['下一節', '下一堂', '準備', '開始上課'],
    answer: '每次上課前可以到教師看板按「重新整理」，載入最新的班級狀態。前一節課的白板決策會保留，可以繼續使用，也可以手動清空重設。',
  },
  {
    keywords: ['效率', '省時', '方便', '好用'],
    answer: '這套系統讓白板管理流程變成：拍照 → AI 分析（10秒）→ 老師確認（30秒）→ 機器人執行（自動）。比傳統手動擦整面白板省時，也讓老師保有完整的決策控制權。',
  },
  {
    keywords: ['隱私', '安全', '資料', '外洩', '保護'],
    answer: '所有課堂資料都儲存在老師電腦的本機 JSON 檔案中，不上傳雲端。使用 Gemini API 時，圖片分析請求會透過 API 傳送，建議在有密碼的校園 WiFi 環境下使用。',
  },
  {
    keywords: ['語言', '中文', '英文', '多語', '支援'],
    answer: '系統介面和 AI 分析都支援繁體中文。白板上的英文、數學符號也能辨識，AI 分析會判斷這些內容的重要性並給出保留或清空建議。',
  },
  {
    keywords: ['老師', '操作', '學習', '難', '簡單'],
    answer: '系統設計目標是讓老師不需要技術背景也能使用。主要流程只有三個步驟：拍照、確認決策、送出機器人。進階功能（硬體校準、橋接設定）只在設定面板中，不影響日常使用。',
  },
  {
    keywords: ['全班', '個別', '差異', '因材施教'],
    answer: '目前版本的 AI 分析是班級層級的（整面白板），不是個別學生追蹤。系統專注在「老師要做什麼」（白板管理決策），而非監控學生。',
  },
  {
    keywords: ['平板', '手機', '行動', '裝置', '手機版'],
    answer: '系統有行動版介面，在平板或手機上也可以操作。老師可以用平板掌握教師看板，學生可以用手機看課堂紀錄本。需要確認設定面板中的橋接主機設定正確。',
  },
];

// ── 機器人操作 (15) ─────────────────────────────────────────────
const ROBOT_TEMPLATES: ChatTemplate[] = [
  {
    keywords: ['機器人', '怎麼', '工作', '運作', '動作'],
    answer: '板擦機器人的工作原理：伺服馬達控制板擦的左右位置（A/B/C 區），另一個馬達控制板擦的前後（接觸白板 / 抬起）。收到指令後，機器人移動到指定位置並執行擦除動作。',
  },
  {
    keywords: ['Arduino', 'UNO', 'R4', 'WiFi', '硬體', '連線'],
    answer: '系統使用 Arduino UNO R4 WiFi 作為機器人控制器。電腦透過 USB Serial 傳送指令（ERASE_REGION_A/B/C 等），Arduino 解析後控制伺服馬達動作。無 Arduino 時系統進入展示模式，所有指令保留在記錄中。',
  },
  {
    keywords: ['展示', '模式', '沒有', '機器人', '硬體'],
    answer: '展示模式是這套系統的重要設計。沒有 Arduino 時，所有機器人指令仍然完整執行流程（AI 分析 → 老師決策 → 送出指令 → 記錄結果），只是最後的機械動作由虛擬動畫代替。評審可以看到完整的軟體決策流程。',
  },
  {
    keywords: ['指令', 'ERASE', 'KEEP', 'command', '送出'],
    answer: '機器人控制頁面可以直接送出指令。常用指令：ERASE_REGION_A/B/C（擦除指定區）、KEEP_REGION_A/B/C（保留指定區）、ERASE_ALL（全板擦除）、PAUSE_TASK（暫停）、FIREWORK（慶祝動畫）。',
  },
  {
    keywords: ['伺服', 'servo', '角度', '校準', '調整'],
    answer: '伺服馬達角度需要依照實際安裝位置校準。在教師看板的「硬體校準」區段，可以分別設定 A/B/C 區的角度值（0-180 度），調整後按「儲存校準」。',
  },
  {
    keywords: ['LED', '燈', '矩陣', '顯示', '燈光'],
    answer: 'Arduino UNO R4 WiFi 內建 12x8 LED 矩陣。機器人執行任務時會顯示對應動畫（箭頭、打勾等），FIREWORK 指令會播放煙火效果。這是展示時很吸引評審注意的功能。',
  },
  {
    keywords: ['速度', '快', '慢', '調整', '馬達'],
    answer: '機器人控制頁面底部有速度滑桿（50-255），調整板擦移動速度。展示時建議設在 120-150，速度夠快又不失穩。比賽前先在白板上測試一次確認不會偏移。',
  },
  {
    keywords: ['失敗', '不動', '沒反應', '錯誤', '問題'],
    answer: '機器人不動的常見原因：\n1. USB 線未插好 → 重新插拔\n2. 序列埠被占用 → 關閉 Arduino IDE，按「重新偵測」\n3. 展示模式 → 右上角顯示「展示模式」badge，這是正常的\n機器人指令頁面顯示「機器人已連線」才是實機模式。',
  },
  {
    keywords: ['自動', '全自動', '手動', '半自動', '人工'],
    answer: '這套系統是「半自動 + 人在迴路」設計。AI 提出建議，老師確認，機器人執行。不是完全自動化，因為課堂中哪些內容要留到下節課，必須由老師判斷。這也是我們刻意的設計選擇。',
  },
  {
    keywords: ['安全', '危險', '碰到', '學生', '受傷'],
    answer: '板擦機器人安裝在白板軌道上，移動範圍限定在白板範圍內。機器人速度慢、力道輕，不會傷到人。教師看板有「緊急暫停」功能，隨時可以停止所有動作。',
  },
  {
    keywords: ['Wi-Fi', '無線', '藍牙', '遠端', '網路'],
    answer: '目前版本使用 USB Serial 連線（最穩定），不依賴 Wi-Fi。Arduino UNO R4 WiFi 的 Wi-Fi 模組保留給未來擴充（例如接 Arduino Cloud 遠端監控），現階段不需要 Wi-Fi 也能完整展示。',
  },
  {
    keywords: ['多個', '同時', '平行', '兩個', '三個'],
    answer: '目前系統一次只控制一個 Arduino（App 1 的板擦機器人）。不同 App 使用不同的 bridge port（App 1: 3200, App 2: 3202, App 3: 3203），彼此獨立不干擾。',
  },
  {
    keywords: ['比賽', '展示', '評審', '上台', '呈現'],
    answer: '比賽展示建議流程：1) 開啟 App，確認系統狀態正常 2) 用示範內容快速走一遍拍照→分析 3) 教師看板確認決策 4) 送出機器人任務（有 Arduino 就實動，沒有就展示模式）5) 到紀錄本展示歷史記錄 6) 最後按 FIREWORK 作為結尾亮點。',
  },
  {
    keywords: ['接線', '接法', '電路', 'L293D', '馬達驅動'],
    answer: 'App 1 的板擦機器人使用 L293D 馬達驅動板，接 M3/M4（兩個伺服馬達：左右位置 + 板擦升降）。接線圖在專案 docs 目錄。焊接或接杜邦線前先確認馬達型號。',
  },
  {
    keywords: ['紀錄', '任務', '歷史', '日誌', 'log'],
    answer: '機器人控制頁面底部有「任務紀錄」，可以展開查看所有送出的指令、時間和結果（實機成功 / 展示備援）。這個紀錄可以給評審看，說明系統的完整動作流程。',
  },
];

// ── 系統說明 (15) ──────────────────────────────────────────────
const SYSTEM_TEMPLATES: ChatTemplate[] = [
  {
    keywords: ['Gemini', 'API', 'key', '金鑰', '設定'],
    answer: 'Gemini API Key 讓系統使用 Google AI 做更精準的白板分析和課堂回答。沒有 Key 時系統改用本機模式（本機 OCR + 預設分析模板）。完整展示流程在本機模式下也能跑完，不會中斷。',
  },
  {
    keywords: ['本機', 'local', 'offline', '離線', '沒有網路'],
    answer: '系統支援完全離線操作。本機模式使用：EasyOCR（Python）辨識白板文字、預設分析模板產生區塊建議、模板比對回答 AI 小老師問題。比賽現場沒有網路也可以正常展示。',
  },
  {
    keywords: ['bridge', '橋接', 'server', '伺服器', '後端'],
    answer: '「Bridge」是在老師電腦上執行的本機伺服器（Node.js），負責管理 Serial 連線和資料儲存。前端網頁透過 /api 請求與 bridge 溝通。dev 模式下 bridge 自動啟動，production 模式需要手動啟動。',
  },
  {
    keywords: ['port', 'port號', '3200', '3201', '連接埠'],
    answer: 'App 1 使用 port 3200（production bridge）和 3201（dev mode bridge）。橋接主機設定可以讓其他裝置（平板）連到老師電腦的 bridge，設定橋接主機後 API 請求會打到指定 IP。',
  },
  {
    keywords: ['安裝', '環境', '設定', 'npm', 'node'],
    answer: '啟動方式：1) `npm install` 安裝依賴 2) `npm run dev` 啟動開發版（前端 + bridge 一起）3) 開啟 http://localhost:3000。或用一鍵啟動腳本（Mac: 啟動.command，Windows: 啟動.bat）',
  },
  {
    keywords: ['錯誤', 'error', '無法', '失敗', '問題'],
    answer: '常見問題：\n- 「無法連接本機硬體服務」→ bridge 未啟動，跑 npm run dev\n- 「Gemini Key 未設定」→ 正常，系統用本機模式\n- 「序列埠找不到」→ Arduino 未插，或被其他程式占用\n- 白板頁面空白 → 切到其他頁再切回來（v1 已修復）',
  },
  {
    keywords: ['typescript', '型別', 'tsc', 'lint', '編譯'],
    answer: '`npm run check` 會執行 TypeScript 型別檢查、build 和 API contract 測試，確認整個系統一致。每次修改後跑一次確認沒有問題。',
  },
  {
    keywords: ['WebSocket', 'ws', '即時', '即時更新', 'socket'],
    answer: 'Bridge 和前端透過 WebSocket 保持即時連線，可以即時收到 Arduino 狀態更新和指令回饋。無法建立 WebSocket 時自動降級到 polling 模式（每 3 秒查詢一次），不影響功能。',
  },
  {
    keywords: ['儲存', '資料夾', '位置', '檔案', 'JSON'],
    answer: '所有資料儲存在 `data/` 目錄下：notes.json（課堂紀錄）、classroom.json（教室狀態）、robot.json（機器人任務記錄）、backup/ 目錄（備份檔案）。',
  },
  {
    keywords: ['多人', '同時', '共用', '多台', '其他人'],
    answer: '多個瀏覽器分頁（或不同裝置）可以同時連到同一個 bridge。狀態變更透過 WebSocket 廣播給所有連線的客戶端。老師用電腦、助理用平板都能同步看到最新狀態。',
  },
  {
    keywords: ['更新', '版本', '升級', '新功能'],
    answer: '這套系統是參賽作品版本，持續改進中。比賽後計畫加入：固定攝影機白板座標校正、機器人位置閉環確認、更精準的區塊定位。',
  },
  {
    keywords: ['比較', '其他', '市面上', '差異', '特色'],
    answer: '相較市面上的白板管理工具，這套系統的特色是：\n1. 硬體整合（真實機器人執行擦除）\n2. 老師保有決策主導權（AI 建議，老師確認）\n3. 完全本機運作（不需要雲端服務）\n4. 針對國小課堂設計（語言、科目分類）',
  },
  {
    keywords: ['成本', '費用', '價格', '多少錢'],
    answer: '硬體成本估算：Arduino UNO R4 WiFi 約 700-900 元，L293D 馬達驅動板約 50 元，伺服馬達 2 個約 200 元，機構材料（軌道、板擦夾具）約 300-500 元。總計約 1,500 元左右，遠低於市售白板清潔設備。',
  },
  {
    keywords: ['程式', '語言', 'React', 'TypeScript', '用什麼'],
    answer: '前端：React + TypeScript + Vite + TailwindCSS。後端 Bridge：Node.js + Express + TypeScript。硬體：Arduino C++（PlatformIO 管理）。AI：Google Gemini API（本機模式下不需要）。',
  },
  {
    keywords: ['擴展', '未來', '計畫', '下一步', '改進'],
    answer: '目前已完成：白板辨識、老師決策、機器人展示。下一階段計畫：加入固定攝影機做白板座標校正、機器人位置回報（閉環控制）、更精準的區塊映射。比賽現階段先展示半自動控制的完整流程。',
  },
];

export const ALL_TEMPLATES: ChatTemplate[] = [
  ...BOARD_TEMPLATES,
  ...CLASSROOM_TEMPLATES,
  ...ROBOT_TEMPLATES,
  ...SYSTEM_TEMPLATES,
];

function tokenize(text: string): string[] {
  const normalized = text.toLowerCase().replace(/[，。！？、：；「」【】『』（）《》〈〉\n\r\t]/g, ' ');
  const words = normalized.split(/\s+/).filter((w) => w.length > 0);
  // Also include individual Chinese characters for CJK
  const chars = text.replace(/[^一-龥㐀-䶿]/g, '').split('');
  return [...words, ...chars];
}

function jaccard(aTokens: string[], bTokens: string[]): number {
  const a = new Set(aTokens);
  const b = new Set(bTokens);
  let intersection = 0;
  for (const t of a) {
    if (b.has(t)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

const FALLBACK_ANSWER = (query: string) =>
  `關於「${query.slice(0, 20)}」這個問題：\n\n這套系統的核心流程是 **拍白板 → AI 分析 → 老師確認 → 機器人執行**。\n\n- 白板分頁：拍照或輸入示範內容，產生 AI 分析\n- 教師看板：確認保留 / 可擦區塊，送出機器人任務\n- 機器人頁面：直接送出指令或查看任務紀錄\n- 紀錄本：搜尋歷史課堂筆記\n- AI 小老師：依據課堂紀錄回答問題\n\n有 Gemini API Key 時我能給更深入的個別化解答。`;

export function matchTemplate(query: string): string {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return FALLBACK_ANSWER(query);

  let bestScore = 0;
  let bestAnswer = '';

  for (const template of ALL_TEMPLATES) {
    const templateTokens = tokenize(template.keywords.join(' '));
    const score = jaccard(queryTokens, templateTokens);
    if (score > bestScore) {
      bestScore = score;
      bestAnswer = template.answer;
    }
  }

  // Threshold: if best score too low, use fallback
  return bestScore >= 0.05 ? bestAnswer : FALLBACK_ANSWER(query);
}
```

- [ ] **Step 2: 確認檔案建立，無 TS 錯誤**

```bash
cd "apps/app1-whiteboard"
npx tsc --noEmit 2>&1 | head -20
```
Expected: 無 localChatTemplates 相關錯誤

- [ ] **Step 3: Commit**

```bash
git add "apps/app1-whiteboard/src/services/localChatTemplates.ts"
git commit -m "feat(app1): add 60 local chat templates with Jaccard matching"
```

---

## Task 2: geminiService.ts — 升級 chatWithAI fallback

**Files:**
- Modify: `src/services/geminiService.ts`

- [ ] **Step 1: 更新 chatWithAI 的 catch block**

在 `src/services/geminiService.ts` 找到 `export async function chatWithAI` 的 catch block，完整替換：

```typescript
// 在檔案頂部加 import
import {matchTemplate} from './localChatTemplates';
```

找到 chatWithAI 的 catch block（約第 95-131 行），整個替換為：

```typescript
  } catch {
    return matchTemplate(message);
  }
```

- [ ] **Step 2: 確認 TS 正確**

```bash
npx tsc --noEmit 2>&1 | grep -i "gemini\|template" | head -10
```
Expected: 無錯誤

- [ ] **Step 3: 手動測試（dev server 需已起）**

在 AI 小老師頁面輸入：「機器人怎麼知道要擦哪個區塊？」
Expected: 得到完整的、有意義的回答（來自 ROBOT_TEMPLATES），而非「AI 橋接無法連線，以下是本機輔助建議」罐頭訊息

- [ ] **Step 4: Commit**

```bash
git add "apps/app1-whiteboard/src/services/geminiService.ts"
git commit -m "feat(app1): upgrade chatWithAI fallback to use Jaccard template matching"
```

---

## Task 3: apiClient.ts + App.tsx — 修復 hardcoded localhost:3201

**Files:**
- Modify: `src/services/apiClient.ts`
- Modify: `src/App.tsx`

**問題背景**：`App.tsx:80` hardcoded `http://localhost:3201`，平板連老師電腦時 WebSocket 和 reset 都會打到平板自己的 localhost，全失效。

- [ ] **Step 1: 在 apiClient.ts 加 bridge host 工具函式**

在 `src/services/apiClient.ts` 最頂端（export class ApiClientError 之前）加入：

```typescript
const BRIDGE_HOST_KEY = 'app1:bridgeHost';

export function getBridgeBase(): string {
  const stored = localStorage.getItem(BRIDGE_HOST_KEY)?.trim();
  if (stored) return `http://${stored}`;
  // Auto-detect: use same hostname as the page (works for tablets connecting to teacher's machine)
  return `http://${window.location.hostname}:3201`;
}

export function setBridgeHost(host: string): void {
  if (host.trim()) {
    localStorage.setItem(BRIDGE_HOST_KEY, host.trim());
  } else {
    localStorage.removeItem(BRIDGE_HOST_KEY);
  }
}

export function getStoredBridgeHost(): string {
  return localStorage.getItem(BRIDGE_HOST_KEY) ?? '';
}
```

- [ ] **Step 2: 修改 App.tsx 兩處 hardcoded URL**

在 `src/App.tsx` 頂部加 import：

```typescript
import {getBridgeBase} from './services/apiClient';
```

找到第 80 行（`useHardwareSocket('http://localhost:3201')`），替換為：

```typescript
const hwStatus = useHardwareSocket(getBridgeBase());
```

找到第 92 行（`fetch('http://localhost:3201/api/ops/reset'...)`），替換為：

```typescript
await fetch(`${getBridgeBase()}/api/ops/reset`, {method: 'POST'});
```

- [ ] **Step 3: TS 確認**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: 無錯誤

- [ ] **Step 4: Commit**

```bash
git add "apps/app1-whiteboard/src/services/apiClient.ts" \
        "apps/app1-whiteboard/src/App.tsx"
git commit -m "fix(app1): replace hardcoded localhost:3201 with getBridgeBase() for cross-device support"
```

---

## Task 4: Home.tsx — sessionStorage 狀態保留 + 練習卡

**Files:**
- Modify: `src/pages/Home.tsx`

**問題背景**：`previewImage` / `analysis` / `ocrResult` / `transcript` 切頁時清空。

- [ ] **Step 1: 加 sessionStorage 工具函式（Home.tsx 內，component 定義之前）**

在 `src/pages/Home.tsx` import 區塊後、`const containerVariants` 之前加入：

```typescript
const SS_PREFIX = 'app1:home:';

function ssGet<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(SS_PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function ssSet(key: string, value: unknown): void {
  try {
    if (value === null || value === undefined || value === '') {
      sessionStorage.removeItem(SS_PREFIX + key);
    } else {
      sessionStorage.setItem(SS_PREFIX + key, JSON.stringify(value));
    }
  } catch {
    // quota exceeded — silently ignore, state will reset on next page load
  }
}
```

- [ ] **Step 2: 替換四個 useState 初始值，改從 sessionStorage 讀取**

找到 Home.tsx 中這四個 useState（約第 37-45 行）：

```typescript
const [transcript, setTranscript] = useState('');
const [previewImage, setPreviewImage] = useState('');
const [analysis, setAnalysis] = useState<BoardAnalysisResponse | null>(null);
const [ocrResult, setOcrResult] = useState<OcrLocalResult | null>(null);
```

替換為：

```typescript
const [transcript, setTranscript] = useState<string>(() => ssGet('transcript', ''));
const [previewImage, setPreviewImage] = useState<string>(() => ssGet('previewImage', ''));
const [analysis, setAnalysis] = useState<BoardAnalysisResponse | null>(() => ssGet<BoardAnalysisResponse | null>('analysis', null));
const [ocrResult, setOcrResult] = useState<OcrLocalResult | null>(() => ssGet<OcrLocalResult | null>('ocrResult', null));
```

- [ ] **Step 3: 在 state 更新時同步寫入 sessionStorage**

在 Home.tsx 中，找到 `const handleToggleCamera` 之前加入四個 useEffect：

```typescript
useEffect(() => { ssSet('transcript', transcript); }, [transcript]);
useEffect(() => { ssSet('previewImage', previewImage); }, [previewImage]);
useEffect(() => { ssSet('analysis', analysis); }, [analysis]);
useEffect(() => { ssSet('ocrResult', ocrResult); }, [ocrResult]);
```

- [ ] **Step 4: 新增練習卡 checklist（Home.tsx return 最底部，在 `</motion.div>` 前）**

在 Home.tsx 的 state 區塊加入：

```typescript
const [practiceChecks, setPracticeChecks] = useState<boolean[]>(() => {
  try {
    const raw = sessionStorage.getItem('app1:practiceChecks');
    return raw ? JSON.parse(raw) : [false, false, false, false, false];
  } catch {
    return [false, false, false, false, false];
  }
});
const [practiceCardOpen, setPracticeCardOpen] = useState(() => {
  return localStorage.getItem('app1:practiceCardCollapsed') !== 'true';
});

const PRACTICE_STEPS = [
  '拍下白板或使用示範內容，產生 AI 分析',
  '到教師看板確認保留 / 可擦區塊',
  '按「套用決策」保存老師判斷',
  '按「送到機器人」展示硬體任務',
  '到紀錄本找到剛才的課堂筆記',
];

const toggleCheck = (i: number) => {
  setPracticeChecks((prev) => {
    const next = [...prev];
    next[i] = !next[i];
    try { sessionStorage.setItem('app1:practiceChecks', JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });
};

const allDone = practiceChecks.every(Boolean);
```

在 Home.tsx return 的最外層 `motion.div` 結尾前加入練習卡 JSX：

```tsx
{/* 學生練習卡 */}
<motion.div variants={itemVariants} className="mt-4 rounded-2xl border border-primary/20 bg-primary-container/20 overflow-hidden">
  <button
    onClick={() => {
      const next = !practiceCardOpen;
      setPracticeCardOpen(next);
      localStorage.setItem('app1:practiceCardCollapsed', next ? 'false' : 'true');
    }}
    className="w-full flex items-center justify-between px-4 py-3 text-left"
  >
    <span className="text-sm font-extrabold text-primary">📋 學生練習卡</span>
    <span className="text-xs text-on-surface-variant">{practiceCardOpen ? '▲' : '▼'}</span>
  </button>
  {practiceCardOpen && (
    <div className="px-4 pb-4 space-y-2">
      {PRACTICE_STEPS.map((step, i) => (
        <button
          key={i}
          onClick={() => toggleCheck(i)}
          className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${practiceChecks[i] ? 'bg-primary/10 text-primary' : 'bg-surface hover:bg-surface-container-high text-on-surface'}`}
        >
          <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-bold transition-colors ${practiceChecks[i] ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant'}`}>
            {practiceChecks[i] ? '✓' : i + 1}
          </span>
          <span className="text-sm font-medium leading-snug">{step}</span>
        </button>
      ))}
      {allDone && (
        <div className="mt-3 rounded-xl bg-primary px-4 py-3 text-center text-sm font-extrabold text-on-primary">
          🎉 你已完成完整流程！準備好上台了。
        </div>
      )}
    </div>
  )}
</motion.div>
```

- [ ] **Step 5: TS 確認 + 手動測試**

```bash
npx tsc --noEmit 2>&1 | grep "Home" | head -10
```

手動測試：
1. 首頁拍照/使用示範內容 → 看到分析結果
2. 點底部導覽切到「教師看板」
3. 再切回「白板」
4. Expected: 分析結果和圖片仍在（非空白）

- [ ] **Step 6: Commit**

```bash
git add "apps/app1-whiteboard/src/pages/Home.tsx"
git commit -m "feat(app1): persist Home state in sessionStorage + add practice checklist card"
```

---

## Task 5: SystemSettingsPanel.tsx — 重置按鈕 + 橋接主機設定

**Files:**
- Modify: `src/components/SystemSettingsPanel.tsx`

- [ ] **Step 1: 加 import**

在 `SystemSettingsPanel.tsx` 頂部加入：

```typescript
import {getStoredBridgeHost, setBridgeHost} from '../services/apiClient';
```

- [ ] **Step 2: 加 state**

在 `export default function SystemSettingsPanel` 的 state 區塊加入：

```typescript
const [bridgeHost, setBridgeHostState] = useState(() => getStoredBridgeHost());
const [bridgeHostSaved, setBridgeHostSaved] = useState(false);
```

- [ ] **Step 3: 加橋接主機 handler**

```typescript
const saveBridgeHost = () => {
  setBridgeHost(bridgeHost);
  setBridgeHostSaved(true);
  setTimeout(() => setBridgeHostSaved(false), 2000);
};

const handleDemoReset = () => {
  if (!window.confirm('確定要清除所有練習資料？這會清空課堂紀錄、聊天記錄和練習進度，並重新整理頁面。')) return;
  // Clear sessionStorage
  sessionStorage.clear();
  // Clear relevant localStorage keys
  const keysToRemove = [
    'whiteboard-notes',
    'whiteboard-chat:elementary:v1',
    'app1:practiceCardCollapsed',
    'tour-app1:v1',
  ];
  keysToRemove.forEach((k) => localStorage.removeItem(k));
  // Call bridge reset (best effort)
  fetch('/api/ops/reset', {method: 'POST'}).catch(() => {});
  setTimeout(() => window.location.reload(), 300);
};
```

- [ ] **Step 4: 在 JSX return 找到最後的 `<div>` 結尾前加入兩個新區塊**

在現有的備份/匯入按鈕區塊之後加入：

```tsx
{/* 橋接主機設定 */}
<div className="rounded-2xl bg-surface p-4 border border-outline-variant/10 space-y-3">
  <div className="flex items-center gap-2 text-sm font-extrabold">
    <Server className="w-4 h-4 text-primary" />
    橋接主機（跨裝置用）
  </div>
  <p className="text-xs text-on-surface-variant">
    平板連老師電腦時填入老師電腦 IP，例如 <code className="bg-surface-container px-1 rounded">192.168.1.5:3201</code>。留空使用自動偵測。
  </p>
  <div className="flex gap-2">
    <input
      type="text"
      value={bridgeHost}
      onChange={(e) => setBridgeHostState(e.target.value)}
      placeholder="留空 = 自動偵測"
      className="flex-1 bg-surface-container rounded-xl px-3 py-2 text-sm border border-outline-variant/20 outline-none focus:border-primary/40"
    />
    <button
      onClick={saveBridgeHost}
      className="px-4 rounded-xl bg-primary text-on-primary text-sm font-bold transition-colors hover:bg-primary/90"
    >
      {bridgeHostSaved ? '✓ 已儲存' : '儲存'}
    </button>
  </div>
</div>

{/* Demo 重置 */}
<div className="rounded-2xl bg-error-container/30 p-4 border border-error/20 space-y-2">
  <div className="flex items-center gap-2 text-sm font-extrabold text-error">
    <RefreshCw className="w-4 h-4" />
    重置練習資料
  </div>
  <p className="text-xs text-on-surface-variant">
    清除所有課堂紀錄、聊天記錄和練習進度，讓下一組學生從頭練習。
  </p>
  <button
    onClick={handleDemoReset}
    disabled={actionBusy !== null}
    className="w-full h-10 rounded-xl bg-error text-on-error text-sm font-bold transition-colors hover:bg-error/90 disabled:opacity-50"
  >
    清除並重新整理
  </button>
</div>
```

注意：`Server` icon 需要從 lucide-react import，確認頂部 import 有加：

```typescript
import {AlertTriangle, CheckCircle2, Database, Download, HardDrive, KeyRound, Loader2, RefreshCw, Server, Upload, X} from 'lucide-react';
```

（`Server` 是新增的，其他已有）

- [ ] **Step 5: TS 確認**

```bash
npx tsc --noEmit 2>&1 | grep "SystemSettings" | head -10
```

- [ ] **Step 6: Commit**

```bash
git add "apps/app1-whiteboard/src/components/SystemSettingsPanel.tsx"
git commit -m "feat(app1): add demo reset button and bridge host configuration to settings panel"
```

---

## Task 6: TeacherDashboard.tsx — 虛擬執行 badge 強化

**Files:**
- Modify: `src/pages/TeacherDashboard.tsx`

**問題背景**：`robotStage === 'fallback'` 時視覺不夠明顯，學生按了不知道有效果。

- [ ] **Step 1: 在 region card 加虛擬執行 badge**

在 `TeacherDashboard.tsx` 找到這段（約第 450-465 行）：

```tsx
{completedRegions.includes(region.id) && (
```

在這個 condition JSX 區塊前加入 fallback badge（同一個 `absolute` region card 內）：

```tsx
{robotStage === 'fallback' && robotTarget === region.id && (
  <span className="absolute top-1 right-1 rounded-full bg-amber-400 text-amber-900 text-[9px] font-black px-1.5 py-0.5 animate-pulse z-10">
    ⚡ 虛擬執行
  </span>
)}
```

- [ ] **Step 2: 強化 fallback 狀態的橫幅訊息**

在 `TeacherDashboard.tsx` 找到 `setRobotStage('fallback')` 的那段（約第 312-326 行），確認 `hardwareNotice` 設定為清楚的訊息：

找到 `robotStage === 'fallback'` 設定後的 notice，若為空或太短，改為：

```typescript
setHardwareNotice(`虛擬機器人已完成${regionId ? `「區塊 ${regionId}」` : '全板'}擦除（展示模式）。指令已記錄，接上 Arduino 後相同流程即生效。`);
```

這一行加在 `setRobotStage('fallback')` 後面。

- [ ] **Step 3: RobotControl.tsx — D-pad 失敗時更新 feedback**

在 `src/pages/RobotControl.tsx` 找到 `handleDriveStart`（約第 133 行）：

```typescript
const handleDriveStart = useCallback((dir: string) => {
  setDriveActive(dir);
  fetch('/api/robot/drive', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({command: dir, port: activePortRef.current || undefined}),
  }).catch(() => {});
}, []);
```

替換為：

```typescript
const handleDriveStart = useCallback((dir: string) => {
  setDriveActive(dir);
  if (!isConnected) {
    setActiveFeedback({title: '展示模式', detail: '未偵測到 Arduino，方向鍵僅供展示用途。', ok: false, working: false});
    return;
  }
  fetch('/api/robot/drive', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({command: dir, port: activePortRef.current || undefined}),
  }).catch(() => {
    setActiveFeedback({title: '驅動指令失敗', detail: '無法送出移動指令，請確認橋接服務已啟動。', ok: false, working: false});
  });
}, [isConnected]);
```

- [ ] **Step 4: RobotControl.tsx — speedTimer unmount 清理**

找到 `RobotControl` 函式中的 useEffect（檢查是否有 unmount cleanup）。在現有的 `useEffect(() => { refreshPorts(); }, []);` 後加入：

```typescript
useEffect(() => {
  return () => {
    if (speedTimer.current) clearTimeout(speedTimer.current);
  };
}, []);
```

- [ ] **Step 5: TS 確認**

```bash
npx tsc --noEmit 2>&1 | grep -i "teacher\|robot" | head -10
```

- [ ] **Step 6: Commit**

```bash
git add "apps/app1-whiteboard/src/pages/TeacherDashboard.tsx" \
        "apps/app1-whiteboard/src/pages/RobotControl.tsx"
git commit -m "feat(app1): add virtual robot badge in fallback mode; fix D-pad feedback and speedTimer cleanup"
```

---

## Task 7: tourSteps.ts + TourOverlay.tsx — 評審問答補強

**Files:**
- Modify: `src/components/tour/tourSteps.ts`
- Modify: `src/components/tour/TourOverlay.tsx`

- [ ] **Step 1: 在 TourStep type 加 reviewerQ 欄位**

在 `src/components/tour/tourSteps.ts` 找到：

```typescript
export type TourStep = {
  id: string;
  tab?: 'whiteboard' | 'teacher' | 'robot' | 'library' | 'chat' | 'review';
  targetDataTour?: string;
  title: string;
  body: string;
  demoTip: string;
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right';
  isFullscreen?: boolean;
};
```

替換為（加 `reviewerQ` 欄位）：

```typescript
export type TourStep = {
  id: string;
  tab?: 'whiteboard' | 'teacher' | 'robot' | 'library' | 'chat' | 'review';
  targetDataTour?: string;
  title: string;
  body: string;
  demoTip: string;
  reviewerQ?: string;
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right';
  isFullscreen?: boolean;
};
```

- [ ] **Step 2: 在每個 TOUR_STEPS 加 reviewerQ**

```typescript
export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    isFullscreen: true,
    title: '歡迎！先來認識一下',
    body: '我來帶你認識 AI 白板助教的所有功能。大約 2 分鐘，完成後可以從設定重看。',
    demoTip: '「我們設計了一套讓 AI 幫老師管理白板並派遣板擦機器人的系統，現在帶大家看看各個功能。」',
    reviewerQ: '評審常問：「這套系統解決什麼問題？」→ 老師每天上課都要花時間手動決定擦哪裡、保留哪裡，我們用 AI 幫老師在 30 秒內做這個判斷，再由機器人自動執行。',
  },
  {
    id: 'capture-panel',
    tab: 'whiteboard',
    targetDataTour: 'capture-panel',
    title: '拍照與語音分析',
    body: '用攝影機拍下白板，或錄音後轉成逐字稿，AI 幫你整理課堂重點並找出哪些內容可以擦掉。',
    demoTip: '「老師，我來示範拍白板後讓 AI 分析——選好科目、按拍照，幾秒後就會出現分析結果。」',
    reviewerQ: '評審常問：「沒有網路或 Gemini Key 怎麼辦？」→ 系統有本機模式，用本機 OCR + 分析模板，完整流程不中斷。',
    tooltipSide: 'right',
  },
  {
    id: 'region-panel',
    tab: 'whiteboard',
    targetDataTour: 'region-panel',
    title: '白板區塊決策',
    body: 'AI 分析後會把白板分成幾個區塊，一眼看出哪些要保留、哪些可以派機器人去擦除。',
    demoTip: '「這裡是 AI 分析出來的白板區塊，我標記哪些要保留、哪些可清空，然後直接派機器人去執行。」',
    reviewerQ: '評審常問：「AI 判斷準確嗎？」→ AI 是建議，老師有最終決策權。點區塊可以手動改保留/可擦，確保不會誤擦重要內容。',
    tooltipSide: 'top',
  },
  {
    id: 'class-stats',
    tab: 'teacher',
    targetDataTour: 'class-stats',
    title: '班級學習狀態',
    body: '白板分析彙整後，這裡會顯示全班專心度、需要幫忙和需要休息的比例，老師一眼掌握班級狀態。',
    demoTip: '「老師一眼就能看出現在班上的狀況，不需要一個個點名，可以專心上課。」',
    reviewerQ: '評審常問：「這個數字從哪來？」→ 這是依據白板使用效率推估的參考值，不是攝影機監控，不涉及學生隱私。',
    tooltipSide: 'bottom',
  },
  {
    id: 'board-regions',
    tab: 'teacher',
    targetDataTour: 'board-regions',
    title: '白板區塊決策',
    body: '點選區塊標記保留或清空，按「送機器人」就能直接指派任務，機器人會前往對應位置執行。',
    demoTip: '「我點區塊 B 標記可清空，然後按送機器人——機器人會去那個位置執行擦除任務。」',
    reviewerQ: '評審常問：「機器人不動怎麼辦？」→ 沒有 Arduino 時系統進入展示模式，指令記錄完整保存，換上硬體後相同流程立即生效。',
    tooltipSide: 'left',
  },
  {
    id: 'robot-commands',
    tab: 'robot',
    targetDataTour: 'robot-commands',
    title: '機器人指令面板',
    body: '這裡可以直接送出指令給板擦機器人，控制 LED 燈、伺服馬達角度、動畫效果等功能。',
    demoTip: '「我按「放煙火」，機器人 LED 矩陣就會播放動畫——這是展示時非常吸睛的效果。」',
    reviewerQ: '評審常問：「這套系統成本多少？」→ 硬體約 1,500 元（Arduino + 馬達 + 材料），遠低於市售白板清潔設備，且軟體完全自製。',
    tooltipSide: 'bottom',
  },
  {
    id: 'notes-list',
    tab: 'library',
    targetDataTour: 'notes-list',
    title: '課堂紀錄本',
    body: '每次 AI 分析完的白板內容都會自動保存在這裡，可以搜尋、整理、下載，累積成完整的課堂紀錄。',
    demoTip: '「評審可以看到之前累積的課堂紀錄，每一筆都有科目、時間和 AI 分析結果。」',
    reviewerQ: '評審常問：「資料安全嗎？」→ 所有資料儲存在本機 JSON 檔案，不上傳雲端，老師完全掌控自己的課堂資料。',
    tooltipSide: 'bottom',
  },
  {
    id: 'complete',
    isFullscreen: true,
    title: '你準備好了！',
    body: '所有功能都認識了。比賽時按照主流程介紹：拍白板 → AI 分析 → 選區塊 → 送機器人，清楚又有力。',
    demoTip: '「謝謝評審，這套系統讓老師能即時掌握白板使用狀況，並派遣自動板擦機器人減少課堂中斷。」',
    reviewerQ: '評審最後常問：「下一步計畫？」→ 加入固定攝影機做白板座標校正，讓機器人定位更精準，實現閉環自動控制。',
  },
];
```

- [ ] **Step 3: TourOverlay.tsx 顯示 reviewerQ**

在 `src/components/tour/TourOverlay.tsx` 找到 `demoTipBox` 相關的 JSX（渲染 demoTip 的地方），在其後加入 reviewerQ 顯示：

找到類似這樣的 JSX（顯示 `step.demoTip` 的地方）：
```tsx
<div style={demoTipBox}>
  <strong>上台說法：</strong> {step.demoTip}
</div>
```

在這個 div 後面加：
```tsx
{step.reviewerQ && (
  <div style={{
    backgroundColor: '#fffbeb',
    border: '1px solid #f59e0b',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 13,
    color: '#92400e',
    marginTop: 8,
    lineHeight: 1.5,
  }}>
    <strong>評審問答：</strong> {step.reviewerQ}
  </div>
)}
```

- [ ] **Step 4: TS 確認**

```bash
npx tsc --noEmit 2>&1 | grep -i "tour" | head -10
```

- [ ] **Step 5: Commit**

```bash
git add "apps/app1-whiteboard/src/components/tour/tourSteps.ts" \
        "apps/app1-whiteboard/src/components/tour/TourOverlay.tsx"
git commit -m "feat(app1): add reviewerQ field to tour steps with examiner Q&A tips"
```

---

## Task 8: 全面驗收

- [ ] **Step 1: 跑 npm run check**

```bash
cd "apps/app1-whiteboard"
npm run check 2>&1
```

Expected output（最後幾行）：
```
boardVision.test.ts: all assertions passed...
✓ built in ...s
api-contract ok
[ev3] connected to ws://127.0.0.1:...
[test] ev3Manager: all 4 assertions passed ✓
hardwareSimulation.test.ts: all assertions passed
```

- [ ] **Step 2: 手動走一遍完整 demo 流程**

1. `npm run dev` 啟動
2. 開啟 http://localhost:3000
3. Tour 自動啟動 → 確認每步有 demoTip 和 reviewerQ（amber 底色）
4. 白板頁 → 使用示範內容 → 看到分析結果 → 切頁再回來 → 分析仍在 ✓
5. 練習卡 → 逐步打勾 → 全打勾出現完成訊息 ✓
6. AI 小老師 → 問「機器人怎麼工作」→ 得到完整回答 ✓
7. 設定面板 → 確認有「橋接主機」和「重置練習資料」按鈕 ✓
8. 教師看板 → 送出機器人任務（無 Arduino）→ 出現虛擬執行 badge ✓

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(app1): complete competition polish — state persist, AI upgrade, virtual robot, student guide, tour Q&A"
```
