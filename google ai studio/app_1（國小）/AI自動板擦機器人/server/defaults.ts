import type {ClassroomSession, RobotCommandInfo, RobotStatus, WhiteboardNote} from './types';

function svgUri(svg: string) { return `data:image/svg+xml,${encodeURIComponent(svg)}`; }

const WHITEBOARD_MATH = svgUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240"><rect width="400" height="240" fill="#d8eaf4"/><rect x="20" y="20" width="360" height="200" rx="6" fill="#fff" stroke="#315f7a" stroke-width="2"/><text x="200" y="75" text-anchor="middle" font-family="sans-serif" font-size="20" fill="#315f7a" font-weight="bold">1/4 + 2/4 = 3/4</text><circle cx="120" cy="155" r="50" fill="none" stroke="#246b5b" stroke-width="2"/><line x1="70" y1="155" x2="170" y2="155" stroke="#246b5b" stroke-width="1.5"/><line x1="120" y1="105" x2="120" y2="205" stroke="#246b5b" stroke-width="1.5"/><path d="M120 105 A50 50 0 0 1 170 155" stroke="#9a5a16" stroke-width="3" fill="none"/><circle cx="285" cy="120" r="12" fill="#315f7a" opacity="0.25"/><text x="285" y="125" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#315f7a">3/4</text><path d="M260 95 L310 95 L310 190 L260 190 Z" fill="none" stroke="#c5d0cc" stroke-width="1"/><text x="285" y="155" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#697570">練習區</text></svg>');
const WHITEBOARD_SCIENCE = svgUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240"><rect width="400" height="240" fill="#d7eee8"/><rect x="20" y="20" width="360" height="200" rx="6" fill="#fff" stroke="#246b5b" stroke-width="2"/><text x="200" y="52" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#246b5b" font-weight="bold">水循環</text><ellipse cx="200" cy="90" rx="50" ry="18" fill="#315f7a" opacity="0.18"/><text x="200" y="95" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#315f7a">蒸發↑</text><path d="M200 108 Q230 60 310 80" stroke="#315f7a" stroke-width="2" fill="none" stroke-dasharray="5 3"/><circle cx="320" cy="82" r="16" fill="#315f7a" opacity="0.25"/><text x="320" y="87" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#315f7a">凝結</text><path d="M310 98 Q260 150 80 170" stroke="#315f7a" stroke-width="2" fill="none" stroke-dasharray="5 3"/><text x="195" y="148" font-family="sans-serif" font-size="11" fill="#246b5b">降水↓</text><ellipse cx="80" cy="180" rx="50" ry="14" fill="#246b5b" opacity="0.2"/><text x="80" y="185" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#246b5b">大海/河流</text></svg>');
const WHITEBOARD_LANGUAGE = svgUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240"><rect width="400" height="240" fill="#f3dfc7"/><rect x="20" y="20" width="360" height="200" rx="6" fill="#fff" stroke="#9a5a16" stroke-width="2"/><text x="200" y="52" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#9a5a16" font-weight="bold">故事六要素</text><rect x="35" y="65" width="155" height="145" rx="4" fill="#fdf4ec"/><text x="45" y="88" font-family="sans-serif" font-size="13" fill="#5a3208">① 角色</text><text x="45" y="111" font-family="sans-serif" font-size="13" fill="#5a3208">② 時間</text><text x="45" y="134" font-family="sans-serif" font-size="13" fill="#5a3208">③ 地點</text><text x="45" y="157" font-family="sans-serif" font-size="13" fill="#5a3208">④ 起因</text><text x="45" y="180" font-family="sans-serif" font-size="13" fill="#5a3208">⑤ 經過</text><text x="45" y="200" font-family="sans-serif" font-size="13" fill="#5a3208">⑥ 結果</text><rect x="215" y="65" width="155" height="145" rx="4" fill="#fdf4ec"/><line x1="225" y1="95" x2="360" y2="95" stroke="#d4a574" stroke-width="1"/><line x1="225" y1="120" x2="360" y2="120" stroke="#d4a574" stroke-width="1"/><line x1="225" y1="145" x2="360" y2="145" stroke="#d4a574" stroke-width="1"/><line x1="225" y1="170" x2="360" y2="170" stroke="#d4a574" stroke-width="1"/><line x1="225" y1="195" x2="360" y2="195" stroke="#d4a574" stroke-width="1"/></svg>');
const WHITEBOARD_DEFAULT = svgUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240"><rect width="400" height="240" fill="#eaf0ee"/><rect x="20" y="20" width="360" height="200" rx="6" fill="#fff" stroke="#697570" stroke-width="2"/><line x1="40" y1="70" x2="360" y2="70" stroke="#c5d0cc" stroke-width="1.5"/><line x1="40" y1="100" x2="360" y2="100" stroke="#c5d0cc" stroke-width="1.5"/><line x1="40" y1="130" x2="360" y2="130" stroke="#c5d0cc" stroke-width="1.5"/><line x1="40" y1="160" x2="200" y2="160" stroke="#c5d0cc" stroke-width="1.5"/><line x1="40" y1="190" x2="150" y2="190" stroke="#c5d0cc" stroke-width="1.5"/><rect x="270" y="75" width="90" height="110" rx="4" fill="#f0f5f3" stroke="#c5d0cc" stroke-width="1"/></svg>');

export const defaultNotes: WhiteboardNote[] = [
  {
    id: 1,
    title: '分數加法：披薩切片一起算',
    subject: '國小數學',
    period: '三年級 第二節',
    desc: '用披薩圖理解同分母分數加法，讓孩子能看圖、說想法、寫算式。',
    content: '今日學習目標：看懂同分母分數加法。\n\n板書重點：\n1. 分母代表一個東西被平均分成幾份。\n2. 分子代表拿了其中幾份。\n3. 同分母相加時，分母不變，只把分子加起來。\n4. 例題：1/4 + 2/4 = 3/4。\n\n給孩子的檢核：請畫一個圓形披薩，塗出 3/4，並用一句話說明自己的算法。',
    captureSource: 'seed',
    ocrText: '同分母分數加法、分母不變、分子相加、1/4 + 2/4 = 3/4',
    transcript: '老師用披薩切片說明分母和分子的意思，請孩子先看圖，再把圖轉成算式。',
    imageUrl: WHITEBOARD_MATH,
    audioUrl: '',
    keywords: ['國小', '數學', '分數', '披薩圖', '同分母加法'],
    boardRegions: [
      {id: 'A', label: '披薩圖示區', x: 8, y: 18, width: 34, height: 52, status: 'keep', reason: '孩子還需要看圖理解分母'},
      {id: 'B', label: '右側練習題', x: 54, y: 24, width: 34, height: 44, status: 'erasable', reason: '練習題已保存，可換下一題'},
      {id: 'C', label: '口訣提醒', x: 20, y: 78, width: 56, height: 14, status: 'keep', reason: '保留給孩子回頭檢查'},
    ],
    aiRecommendation: '保留披薩圖和口訣，右側練習題已保存，可清出空間給下一題。',
    linkedTaskIds: [],
    date: '4月29日',
    time: '上午 09:20',
    theme: 'secondary',
    img: WHITEBOARD_MATH,
    createdAt: '2026-04-29T09:20:00+08:00',
  },
  {
    id: 2,
    title: '自然觀察：水循環小旅行',
    subject: '國小自然',
    period: '四年級 第三節',
    desc: '用水滴旅行故事理解蒸發、凝結、降水與流回大海。',
    content: '今日學習目標：說出水循環的四個步驟。\n\n板書重點：\n1. 太陽讓水變成水蒸氣，叫做蒸發。\n2. 水蒸氣遇冷變成小水滴，聚在一起形成雲，叫做凝結。\n3. 雲裡的小水滴變重，就會落下來，叫做降水。\n4. 雨水流到河流、湖泊或大海，水循環又開始。\n\n小組任務：每組畫出一滴水的旅行路線，並標出四個關鍵詞。',
    captureSource: 'seed',
    ocrText: '水循環、蒸發、凝結、降水、流回大海',
    transcript: '老師把水滴想像成小旅人，從大海出發到天空，再變成雨回到地面。',
    imageUrl: WHITEBOARD_SCIENCE,
    audioUrl: '',
    keywords: ['國小', '自然', '水循環', '蒸發', '凝結', '降水'],
    boardRegions: [
      {id: 'A', label: '水滴旅行圖', x: 10, y: 18, width: 42, height: 56, status: 'keep', reason: '圖像能幫助孩子說出流程'},
      {id: 'B', label: '關鍵詞列表', x: 60, y: 18, width: 28, height: 50, status: 'keep', reason: '保留給孩子抄寫與朗讀'},
      {id: 'C', label: '小組任務', x: 20, y: 78, width: 60, height: 15, status: 'erasable', reason: '任務已保存，可換下一輪活動'},
    ],
    aiRecommendation: '保留旅行圖與關鍵詞，小組任務已保存，可清出下方空間。',
    linkedTaskIds: [],
    date: '4月28日',
    time: '下午 01:35',
    theme: 'tertiary',
    img: WHITEBOARD_SCIENCE,
    createdAt: '2026-04-28T13:35:00+08:00',
  },
  {
    id: 3,
    title: '國語閱讀：故事六要素',
    subject: '國小國語',
    period: '五年級 第一節',
    desc: '把故事拆成角色、時間、地點、起因、經過、結果，練習完整表達。',
    content: '今日學習目標：用六要素說清楚一個故事。\n\n板書重點：\n1. 角色：故事中出現的人物或動物。\n2. 時間：事情發生在什麼時候。\n3. 地點：事情發生在哪裡。\n4. 起因：為什麼會發生這件事。\n5. 經過：中間發生了哪些重要事情。\n6. 結果：最後怎麼解決，角色有什麼改變。\n\n口語練習：和同桌互說一個校園小故事，至少說出四個要素。',
    captureSource: 'seed',
    ocrText: '故事六要素、角色、時間、地點、起因、經過、結果',
    transcript: '老師提醒孩子不要只說好玩，要說清楚誰、在哪裡、發生什麼事。',
    imageUrl: WHITEBOARD_LANGUAGE,
    audioUrl: '',
    keywords: ['國小', '國語', '閱讀', '故事六要素', '口語表達'],
    boardRegions: [
      {id: 'A', label: '六要素表格', x: 8, y: 18, width: 42, height: 58, status: 'keep', reason: '表格是孩子整理故事的支架'},
      {id: 'B', label: '範例故事', x: 56, y: 20, width: 34, height: 50, status: 'erasable', reason: '範例已保存，可換孩子自己的故事'},
      {id: 'C', label: '口語練習', x: 20, y: 80, width: 58, height: 13, status: 'keep', reason: '保留活動規則，方便分組'},
    ],
    aiRecommendation: '保留六要素表格與口語練習規則，範例故事可清出空間給孩子上台分享。',
    linkedTaskIds: [],
    date: '4月27日',
    time: '上午 10:10',
    theme: 'primary',
    img: WHITEBOARD_LANGUAGE,
    createdAt: '2026-04-27T10:10:00+08:00',
  },
];

export const defaultClassroomSession: ClassroomSession = {
  focusPercent: 82,
  confusedPercent: 12,
  tiredPercent: 6,
  teacherPace: 'normal',
  savedMinutes: 3.1,
  currentRecommendation: '多數孩子已完成右側練習，建議保留左側圖解與下方口訣，先清出右側空間給下一題。',
  boardRegions: [
    {id: 'A', label: '圖解與例題', x: 8, y: 18, width: 38, height: 58, status: 'keep', reason: '孩子還需要看圖說明自己的想法'},
    {id: 'B', label: '練習作答區', x: 54, y: 20, width: 34, height: 50, status: 'erasable', reason: '練習已保存，可換下一題'},
    {id: 'C', label: '口訣提醒區', x: 22, y: 78, width: 58, height: 16, status: 'keep', reason: '保留給孩子回頭檢查'},
  ],
  updatedAt: new Date().toISOString(),
};

export const defaultRobotStatus: RobotStatus = {
  connected: false,
  activePort: '',
  lastCommand: '',
  lastResponse: '尚未送出指令',
  lastUpdatedAt: '',
};

export const commandCatalog: RobotCommandInfo[] = [
  {command: 'SHOW_ON', label: '開始動畫', group: 'display'},
  {command: 'SHOW_OFF', label: '停止動畫', group: 'display'},
  {command: 'FIREWORK', label: '放煙火', group: 'display'},
  {command: 'RESET', label: '重置動畫', group: 'display'},
  {command: 'LED_ON', label: 'LED 開', group: 'hardware'},
  {command: 'LED_OFF', label: 'LED 關', group: 'hardware'},
  {command: 'SERVO_0', label: '伺服 0 度', group: 'hardware'},
  {command: 'SERVO_90', label: '伺服 90 度', group: 'hardware'},
  {command: 'SERVO_180', label: '伺服 180 度', group: 'hardware'},
  {command: 'CLEAN_START', label: '清潔開始', group: 'task'},
  {command: 'CLEAN_STOP', label: '清潔完成', group: 'task'},
  {command: 'ERASE_ALL', label: '一鍵全擦', group: 'task'},
  {command: 'ERASE_REGION_A', label: '擦除區塊 A', group: 'task'},
  {command: 'ERASE_REGION_B', label: '擦除區塊 B', group: 'task'},
  {command: 'ERASE_REGION_C', label: '擦除區塊 C', group: 'task'},
  {command: 'KEEP_REGION_A', label: '保留區塊 A', group: 'task'},
  {command: 'KEEP_REGION_B', label: '保留區塊 B', group: 'task'},
  {command: 'KEEP_REGION_C', label: '保留區塊 C', group: 'task'},
  {command: 'PAUSE_TASK', label: '暫停任務', group: 'task'},
  {command: 'STOP', label: '停止', group: 'task'},
  {command: 'DELIVERY_START', label: '配送開始', group: 'task'},
  {command: 'DELIVERY_DONE', label: '配送完成', group: 'task'},
  {command: 'CLEAN_SCHEDULE', label: '清潔排程', group: 'task'},
  {command: 'BROADCAST_SCHEDULE', label: '廣播排程', group: 'task'},
  {command: 'TEACH_SCAN', label: '教學點名', group: 'task'},
  {command: 'FOCUS_NUDGE', label: '專注提醒', group: 'task'},
  {command: 'QUESTION_ACK', label: '提問確認', group: 'task'},
  {command: 'TEACH_REPLY', label: '教學回覆', group: 'task'},
  {command: 'SAFETY_LOCKDOWN', label: '安全封鎖', group: 'task'},
  {command: 'SAFETY_CLEAR', label: '解除封鎖', group: 'task'},
  {command: 'BELL_REMIND_ON', label: '鐘聲提醒開', group: 'task'},
  {command: 'BELL_REMIND_OFF', label: '鐘聲提醒關', group: 'task'},
  {command: 'BROADCAST_START', label: '啟動廣播', group: 'task'},
  {command: 'PATROL_START', label: '啟動巡邏', group: 'task'},
  {command: 'ROBOT_RESUME', label: '機器人恢復', group: 'task'},
  {command: 'ROBOT_PAUSE', label: '機器人暫停', group: 'task'},
  {command: 'SPEED_SET', label: '速度設定', group: 'task'},
  {command: 'NODE_HEARTBEAT', label: '節點心跳', group: 'task'},
  {command: 'ALERT_SIGNAL', label: '關懷提醒訊號', group: 'task'},
  {command: 'CARE_DEPLOYED', label: '佈署關懷', group: 'task'},
  {command: 'NODE_RESTART', label: '節點重啟', group: 'task'},
];

export const supportedCommands = new Set(commandCatalog.map((item) => item.command));

export const taskActions = {
  erase: {A: 'ERASE_REGION_A', B: 'ERASE_REGION_B', C: 'ERASE_REGION_C', ALL: 'ERASE_ALL'},
  keep: {A: 'KEEP_REGION_A', B: 'KEEP_REGION_B', C: 'KEEP_REGION_C'},
  pause: {DEFAULT: 'PAUSE_TASK'},
  clean_start: {DEFAULT: 'CLEAN_START'},
  clean_stop: {DEFAULT: 'CLEAN_STOP'},
  stop: {DEFAULT: 'STOP'},
} as const;

export function createNote(input: Partial<WhiteboardNote> & Pick<WhiteboardNote, 'title' | 'subject' | 'content'>): WhiteboardNote {
  const now = new Date();
  return {
    id: input.id ?? now.getTime(),
    title: input.title,
    subject: input.subject,
    period: input.period ?? '即時紀錄',
    desc: input.desc ?? input.content.slice(0, 80),
    content: input.content,
    captureSource: input.captureSource ?? 'quick-note',
    ocrText: input.ocrText ?? input.content,
    transcript: input.transcript ?? '尚未匯入老師講解逐字稿。',
    imageUrl: input.imageUrl ?? input.img,
    audioUrl: input.audioUrl ?? '',
    keywords: input.keywords ?? [input.subject, ...input.title.split(/\s+/)].filter(Boolean),
    boardRegions: input.boardRegions ?? [],
    aiRecommendation: input.aiRecommendation ?? '',
    linkedTaskIds: input.linkedTaskIds ?? [],
    date: input.date ?? now.toLocaleDateString('zh-TW', {month: 'long', day: 'numeric'}),
    time: input.time ?? now.toLocaleTimeString('zh-TW', {hour: '2-digit', minute: '2-digit'}),
    theme: input.theme ?? 'primary',
    img: input.img ?? WHITEBOARD_DEFAULT,
    createdAt: input.createdAt ?? now.toISOString(),
  };
}
