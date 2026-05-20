export type ChatTemplate = {
  keywords: string[];
  answer: string;
};

// ── 白板管理 (15) ──
const BOARD_TEMPLATES: ChatTemplate[] = [
  {
    keywords: ['白板', '辨識', '怎麼', '知道', '哪裡', '區塊', '位置'],
    answer: '我們把白板分成 A、B、C 三個區塊。AI 分析後判斷每個區塊是否可清空，老師在教師看板確認後機器人才動作——AI 只是建議，老師有最終決策權。',
  },
  {
    keywords: ['拍照', '攝影機', '相機', '如何', '輸入', '圖片'],
    answer: '首頁有兩種輸入方式：用攝影機即時拍下白板，或用示範內容練習流程。拍照後 AI 自動分析白板文字與區塊配置，不需手動輸入。',
  },
  {
    keywords: ['OCR', '文字', '辨識', '提取', '讀取'],
    answer: 'OCR（光學文字辨識）從白板圖片提取文字。本系統用本機 EasyOCR 初步辨識，再交 AI 分析語意與重要性，判斷哪些內容可擦。',
  },
  {
    keywords: ['分析', 'AI', '準確', '正確', '判斷', '結果'],
    answer: 'AI 準確度取決於圖片清晰度和光線，白天效果最好。分析不準時老師可在教師看板手動調整區塊決策，AI 只是輔助。',
  },
  {
    keywords: ['保留', '不要擦', '重要', '內容', '標記'],
    answer: '教師看板點選區塊可切換「保留」或「可清空」。標記「保留」的區塊機器人不會碰，例如今天的作業說明或考試重點。',
  },
  {
    keywords: ['清空', '擦掉', '刪除', '移除', '清除'],
    answer: '標記「可清空」的區塊送出任務後，板擦機器人移動到對應位置執行擦除。展示模式（無 Arduino）顯示虛擬執行動畫並記錄任務。',
  },
  {
    keywords: ['紀錄', '歷史', '保存', '儲存', '課堂'],
    answer: '每次 AI 分析結果自動保存在「課堂紀錄本」。可搜尋任何一堂課的白板內容、老師講解和分析結果，方便複習或製作學習單。',
  },
  {
    keywords: ['示範', '範例', '沒有白板', '測試', '練習'],
    answer: '沒有白板或攝影機時，首頁使用「示範內容」按鈕，系統載入範例課堂資料讓你完整走過所有流程。比賽展示非常好用。',
  },
  {
    keywords: ['逐字稿', '語音', '老師講解', '錄音'],
    answer: '首頁麥克風按鈕錄下老師講解，AI 自動轉逐字稿並整合進課堂分析，筆記不只有白板文字也包含老師補充說明。',
  },
  {
    keywords: ['格式', '圖片', 'base64', '大小', '限制'],
    answer: '系統接受攝影機即時拍照和上傳圖片（JPG/PNG）。圖片轉 base64 在本機處理，不上傳外部伺服器，保護課堂隱私。',
  },
  {
    keywords: ['科目', '數學', '國語', '英文', '自然', '社會'],
    answer: '首頁可選科目提示，幫 AI 更準確辨識該科目的專有詞彙。選「數學」AI 會更正確辨識算式和符號。',
  },
  {
    keywords: ['白板', '區塊', 'A', 'B', 'C', '三個', '幾個'],
    answer: '系統把白板分成 A（左）、B（中）、C（右）三個區塊。每個區塊獨立標記，可以只擦中間保留兩側，非常靈活。',
  },
  {
    keywords: ['效率', '時間', '節省', '幫助', '好處'],
    answer: '老師平均每節課花 2–3 分鐘決定擦板，AI 在 30 秒內給出建議。一天六節課累積省下約 15 分鐘，可以用來加強教學互動。',
  },
  {
    keywords: ['誤判', '錯誤', '失誤', '修正', '覆蓋'],
    answer: 'AI 有時判斷不準，例如把重要公式誤標為可清空。老師在教師看板點一下即可手動修正，系統不會自動執行，確保安全。',
  },
  {
    keywords: ['白板', '板書', '課堂', '教學', '老師'],
    answer: '這套系統的核心是讓 AI 輔助老師管理白板，老師專注在教學，機器人負責執行清除任務。每次板書分析結果都會自動存入課堂紀錄。',
  },
];

// ── 課堂節奏 (15) ──
const CLASSROOM_TEMPLATES: ChatTemplate[] = [
  {
    keywords: ['班級', '學生', '狀態', '專心', '注意力'],
    answer: '教師看板顯示班級學習狀態指標，包括專心度、需要幫助和需要休息的比例，讓老師一眼掌握全班情況，不需逐一點名。',
  },
  {
    keywords: ['上課', '流程', '步驟', '使用', '操作'],
    answer: '標準流程：①拍白板②AI分析③老師確認區塊④派機器人擦除。整個過程約1分鐘，不打斷正常上課節奏。',
  },
  {
    keywords: ['評審', '比賽', '展示', '說明', '介紹'],
    answer: '比賽展示建議說法：「老師每天浪費課堂時間手動擦板，我們用AI輔助決策、機器人自動執行，解放老師精力專注教學。」',
  },
  {
    keywords: ['課堂', '管理', '教室', '自動化', '智慧'],
    answer: '智慧課堂管理的核心是讓重複性工作自動化。板書擦除是每堂課都要做的事，正好適合AI＋機器人的組合來處理。',
  },
  {
    keywords: ['休息', '換氣', '下課', '緩和', '調節'],
    answer: 'AI 分析白板使用頻率可以推估課堂節奏，若白板長時間未更新，系統提示可能是靜態講解時間，老師可安排互動活動調節節奏。',
  },
  {
    keywords: ['學習', '成效', '提升', '改善', '幫助'],
    answer: '課堂紀錄本累積每節課的板書內容，老師可以回顧哪些主題使用最多白板空間，幫助優化教學設計與時間分配。',
  },
  {
    keywords: ['資料', '累積', '分析', '統計', '報告'],
    answer: '系統自動記錄每次分析的科目、時間、板書內容與決策，累積成可搜尋的課堂資料庫，方便學期末製作教學檔案。',
  },
  {
    keywords: ['學生', '參與', '互動', '問答', '討論'],
    answer: '白板空間管理好，老師才有空間寫下學生的想法。AI協助快速清理不需要的內容，讓白板隨時有新的空白空間給學生互動。',
  },
  {
    keywords: ['老師', '負擔', '減輕', '解放', '輕鬆'],
    answer: '板書管理是老師的隱形負擔——要記得哪邊要保留、哪邊可以擦，常常在說話時分心。AI幫忙做這個判斷，老師可以全心教學。',
  },
  {
    keywords: ['課後', '複習', '回顧', '記憶', '筆記'],
    answer: '課堂紀錄本可以匯出成JSON，配合其他工具製作學習單或課後回顧材料。每筆紀錄包含時間戳記、科目和AI分析的重點。',
  },
  {
    keywords: ['家長', '溝通', '成果', '展示', '記錄'],
    answer: '累積的課堂紀錄可以讓家長看到每堂課的板書內容，了解孩子每天學到什麼，作為親師溝通的客觀記錄。',
  },
  {
    keywords: ['多媒體', '投影', '螢幕', '搭配', '整合'],
    answer: '白板和投影螢幕是不同的教學工具。這套系統專注管理實體白板，因為白板的板書需要人工決策擦除時機，投影內容老師自己控制。',
  },
  {
    keywords: ['課程', '規劃', '設計', '安排', '時間表'],
    answer: '有了課堂紀錄，老師可以分析哪些單元的板書量最大、最複雜，在備課時更準確評估每個單元需要的板書空間和時間。',
  },
  {
    keywords: ['教學', '品質', '改善', '回饋', '反思'],
    answer: '透過分析板書模式，老師可以發現自己的教學習慣，例如某科目總是用C區最多，或特定時段板書密度特別高，從而調整教學策略。',
  },
  {
    keywords: ['學校', '推廣', '其他班', '全校', '普及'],
    answer: '這套系統設計為輕量化部署，只需一台電腦、一台攝影機和一個Arduino機器人就能運行，成本約1500元，適合各班級獨立使用。',
  },
];

// ── 機器人操作 (15) ──
const ROBOT_TEMPLATES: ChatTemplate[] = [
  {
    keywords: ['機器人', '板擦', '怎麼', '知道', '哪裡', '移動', '去'],
    answer: '機器人收到指令後，依據區塊代碼（A/B/C/ALL）移動到對應位置。位置是預先校正好的座標，Arduino透過序列埠接收指令後驅動馬達定位。',
  },
  {
    keywords: ['Arduino', '板子', '微控制器', '硬體', '電路'],
    answer: 'Arduino UNO R4 WiFi是主控板，透過L293D馬達驅動板控制兩個DC馬達。序列埠接收來自電腦的指令字串，執行移動和LED動畫。',
  },
  {
    keywords: ['沒有', 'Arduino', '展示', '模式', '無硬體'],
    answer: '沒有Arduino時系統進入展示模式，所有指令記錄在介面上，顯示虛擬執行動畫。比賽時可以展示完整的軟體流程，之後換上硬體同樣流程立即生效。',
  },
  {
    keywords: ['連線', '橋接', '伺服器', '通訊', 'WebSocket'],
    answer: '電腦端跑一個Node.js橋接伺服器（port 3200），透過serialBridge模組連接Arduino的USB序列埠。前端App透過WebSocket即時顯示機器人狀態。',
  },
  {
    keywords: ['LED', '燈', '矩陣', '動畫', '效果'],
    answer: 'Arduino R4 WiFi內建12×8 LED矩陣，可以顯示表情、進度條、煙火動畫等視覺效果，讓機器人更有互動感，展示時非常吸睛。',
  },
  {
    keywords: ['馬達', '速度', '角度', '伺服', '方向'],
    answer: '機器人使用兩個DC馬達做差速轉向，L293D驅動板控制方向和速度。機器人控制頁面有方向鍵可以手動測試，自動模式下按照區塊座標定位。',
  },
  {
    keywords: ['成本', '費用', '價格', '多少錢', '材料'],
    answer: '硬體成本約1500元台幣：Arduino UNO R4 WiFi（約900元）+ L293D馬達驅動板（約50元）+ 兩個DC馬達（約200元）+ 板擦改裝材料（約350元）。',
  },
  {
    keywords: ['安全', '危險', '撞到', '停止', '防護'],
    answer: '機器人只在白板前運行，行程範圍固定。所有動作都由老師確認後才執行，不會自動啟動。萬一通訊中斷機器人會停止，不會繼續移動。',
  },
  {
    keywords: ['PlatformIO', '韌體', '燒錄', '程式', 'C++'],
    answer: 'Arduino韌體用PlatformIO和C++開發，主要邏輯在commands.cpp負責序列指令解析，app1_whiteboard_drive/main.cpp負責馬達控制和LED動畫。',
  },
  {
    keywords: ['指令', '命令', '格式', '序列', '通訊協定'],
    answer: '所有序列指令採用UPPER_SNAKE_CASE格式，例如MOVE_A（移動到A區）、MOVE_ALL（全板擦除）、FIREWORKS（煙火動畫）。伺服器解析後透過serialport模組傳送。',
  },
  {
    keywords: ['板擦', '擦板', '清潔', '機構', '設計'],
    answer: '機器人用現成的板擦改裝，加上機構讓板擦可以在白板上滑動。馬達驅動輪子移動到指定區塊，高度調整讓板擦剛好接觸白板表面。',
  },
  {
    keywords: ['煙火', '慶祝', 'FIREWORKS', '動畫', '特效'],
    answer: 'FIREWORKS指令讓LED矩陣播放煙火動畫，可以在老師說「下課」或完成任務時觸發，作為視覺上的正向回饋，是展示時最吸睛的功能之一。',
  },
  {
    keywords: ['機器人', '卡住', '故障', '不動', '修復'],
    answer: '若機器人沒有反應，先確認：①USB連接正常②Arduino燈號是否閃爍③橋接伺服器是否顯示「Arduino已連線」。多數情況是USB接觸問題，重新插拔即可。',
  },
  {
    keywords: ['升級', '改進', '未來', '計畫', '擴展'],
    answer: '下一步計畫包括：加入固定攝影機做白板座標自動校正，讓機器人定位更精準；以及支援更多區塊劃分，從三區擴展到九宮格精細控制。',
  },
  {
    keywords: ['遙控', '手動', '控制', '方向鍵', '測試'],
    answer: '機器人控制頁面有方向鍵介面，可以手動前後左右移動和旋轉，方便在展示前確認硬體是否正常運作，也可以讓評審親自體驗操控。',
  },
];

// ── 系統說明 (15) ──
const SYSTEM_TEMPLATES: ChatTemplate[] = [
  {
    keywords: ['Gemini', 'API', 'Key', '金鑰', '設定'],
    answer: '系統支援Gemini API Key，有金鑰時AI分析品質最好。沒有金鑰也沒關係，本機模式用本地OCR加分析模板，核心流程完整可用，適合展示用途。',
  },
  {
    keywords: ['本機', 'local', '離線', '不需網路', '獨立'],
    answer: '系統設計為本機優先：OCR在本地跑、資料存本機JSON、橋接伺服器在電腦上、不依賴外部服務。有Gemini API Key時才呼叫雲端，完全離線也能完整展示。',
  },
  {
    keywords: ['安裝', '設定', '啟動', '怎麼', '開始'],
    answer: '啟動方式：執行「啟動.command」（Mac）或「啟動.bat」（Win），腳本自動安裝依賴、啟動前後端伺服器、開啟瀏覽器。第一次可能需要2分鐘下載套件。',
  },
  {
    keywords: ['瀏覽器', '網頁', '介面', 'localhost', 'port'],
    answer: '前端App跑在 http://localhost:3200（或3201），用現代瀏覽器（Chrome/Edge/Firefox）開啟。建議用1280×720以上解析度，手機平板也可使用。',
  },
  {
    keywords: ['資料', '備份', '匯出', '還原', 'JSON'],
    answer: '系統設定面板提供資料匯出（JSON格式）、本機備份和還原功能。課堂紀錄、聊天記錄都可以備份，換電腦時可以完整遷移。',
  },
  {
    keywords: ['隱私', '安全', '資料', '不上傳', '保護'],
    answer: '所有資料（板書圖片、課堂紀錄、聊天記錄）儲存在本機，不上傳任何外部伺服器。有Gemini Key時圖片內容傳送給Google API，這是唯一的外部連線。',
  },
  {
    keywords: ['跨裝置', '平板', 'IP', '橋接', '連線'],
    answer: '設定面板可以設定橋接主機IP，例如192.168.1.5:3200，讓平板連接到老師電腦的橋接伺服器。同一WiFi網路下平板可以控制老師電腦上的機器人。',
  },
  {
    keywords: ['重置', '清除', '重新開始', '練習', '重跑'],
    answer: '設定面板有「重置練習資料」按鈕，一鍵清除首頁分析結果、練習打勾進度、tour導覽狀態，讓學生從零重新練習完整流程。課堂紀錄本不受影響。',
  },
  {
    keywords: ['導覽', 'tour', '說明', '新手', '第一次'],
    answer: '第一次開啟App會自動啟動功能導覽，帶你認識6個分頁的所有功能。每步都有「評審問答快答」幫你準備比賽答題。設定面板可以重看導覽。',
  },
  {
    keywords: ['計時', 'DemoTimer', '三分鐘', '練習', '計時器'],
    answer: '首頁有DemoTimer（三分鐘計時器），模擬比賽展示的時間壓力。讓學生在三分鐘內完整走過拍白板→AI分析→確認區塊→送機器人的全流程。',
  },
  {
    keywords: ['Node.js', '伺服器', '後端', '架構', '技術'],
    answer: '後端是Node.js + Express，提供/api路由給前端呼叫，再透過serialport模組與Arduino通訊。WebSocket即時推送硬體狀態。前端是React + TypeScript + Vite。',
  },
  {
    keywords: ['React', 'TypeScript', 'Vite', '前端', '技術'],
    answer: '前端用React + TypeScript + Vite開發，介面採用Tailwind CSS，支援響應式設計。所有AI呼叫都有本機fallback確保離線可用。',
  },
  {
    keywords: ['GitHub', '開源', '程式碼', '版本', 'git'],
    answer: '這個專案用git版本控制，完整的程式碼包含韌體（PlatformIO C++）和前後端（TypeScript/React）。比賽結束後計畫整理成公開的教學資源。',
  },
  {
    keywords: ['Windows', 'Mac', '跨平台', '系統', '相容'],
    answer: '系統支援Windows和macOS。啟動腳本分別是「啟動.bat」（Windows）和「啟動.command」（Mac），Arduino序列埠在Windows是COMx、Mac是/dev/cu.usbmodemxxx。',
  },
  {
    keywords: ['問題', '解決', '幫助', '不知道', '怎麼辦'],
    answer: '遇到問題先檢查：①橋接伺服器是否啟動（看首頁狀態指示燈）②Arduino是否連線③瀏覽器是否有JavaScript錯誤。大多數問題重新整理頁面或重啟橋接伺服器可以解決。',
  },
];

export const ALL_TEMPLATES: ChatTemplate[] = [
  ...BOARD_TEMPLATES,
  ...CLASSROOM_TEMPLATES,
  ...ROBOT_TEMPLATES,
  ...SYSTEM_TEMPLATES,
];

function tokenize(text: string): Set<string> {
  const tokens = new Set<string>();
  // CJK characters: split into individual chars
  const cjkPattern = /[一-鿿㐀-䶿]/g;
  let match;
  while ((match = cjkPattern.exec(text)) !== null) {
    tokens.add(match[0]);
  }
  // ASCII words
  const asciiWords = text.replace(/[一-鿿㐀-䶿]/g, ' ').split(/\W+/);
  for (const w of asciiWords) {
    const lower = w.trim().toLowerCase();
    if (lower.length >= 2) tokens.add(lower);
  }
  return tokens;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

const FALLBACK_ANSWER = (query: string) =>
  `你問的是關於「${query.slice(0, 10)}」。這套系統的核心是：AI 辨識白板 → 老師確認區塊 → 機器人執行擦除。有 Gemini API Key 時我能給更深入的解答。`;

export function matchTemplate(query: string): string {
  if (!query.trim()) return FALLBACK_ANSWER(query);

  const queryTokens = tokenize(query);
  let bestScore = 0;
  let bestAnswer = '';

  for (const template of ALL_TEMPLATES) {
    const keywordTokens = tokenize(template.keywords.join(' '));
    const score = jaccard(queryTokens, keywordTokens);
    if (score > bestScore) {
      bestScore = score;
      bestAnswer = template.answer;
    }
  }

  if (bestScore >= 0.05 && bestAnswer) {
    return bestAnswer;
  }
  return FALLBACK_ANSWER(query);
}
