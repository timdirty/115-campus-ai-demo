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
