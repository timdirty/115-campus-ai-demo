import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const pagesDir = path.join(rootDir, 'pages-dist');
// Legacy alias kept for back-compat. Each app now declares its own bridgePort below.
export const sharedBridgePort = 3201;

export const apps = [
  {
    id: 'app1',
    team: '國小隊伍 1',
    name: 'AI 自動板擦機器人',
    shortName: 'App 1',
    path: 'google ai studio/app_1（國小）/AI自動板擦機器人',
    guide: 'google ai studio/app_1（國小）/AI自動板擦機器人/STUDENT_DEMO_GUIDE.md',
    desc: '白板 AI 助教、教師決策、課堂紀錄與機器人指令展示。',
    accent: '#246b5b',
    flow: ['拍白板', '看決策', '送指令'],
    devPort: 11501,
    bridgePort: 3201,
    devName: 'App1-Web',
    devColor: 'green',
    pagePhrases: ['AI', '白板'],
    guidePhrases: ['AI 自動板擦機器人', '後續機器人連動計畫', '公開展示網址'],
    checklistItems: [
      '展示白板拍攝或匯入圖片，確認本機像素辨識產生筆跡結果。',
      '進教師看板，看課堂摘要與區塊建議，先保存再送機器人。',
      '確認硬體指令 log 與任務紀錄同步留下。',
      '送出擦除任務後確認白板圖對應區塊出現 ✓ 覆蓋，頂端橫幅顯示「區塊 X 板擦完成」。',
    ],
    simpleSteps: [
      '拍白板照片，讓 AI 分析上面的字',
      '進老師看板，看 AI 建議擦哪裡',
      '確認機器人任務有被記錄下來',
      '送指令給板擦機器人，看白板出現 ✓',
    ],
    stepNavHints: [
      '首頁 → 上傳白板',
      '教師看板',
      '任務紀錄',
      '確認 ✓ 出現',
    ],
    stepNavUrls: [
      './app1/#whiteboard',
      './app1/#teacher',
      './app1/#robot',
      './app1/#whiteboard',
    ],
    scorecardMustShow: [
      'Student performs 拍白板 -> 看決策 -> 送指令 without assistance.',
      'Student points to pixel analysis result and explains what changed.',
      'Student demonstrates "保存決策 then 送到機器人" — teacher controls the final step.',
      'After robot task succeeds: student shows ✓ overlay on whiteboard region and completion banner.',
      'Bottom D-pad drive bar: test FORWARD/LEFT/RIGHT/BACKWARD/STOP; watchdog fires if released.',
      'Student explains fallback: no camera, no network, no EV3, no Arduino still works.',
    ],
    judgeQaExtra: [
      {q: '為什麼不做全自動擦白板？', a: '老師對哪些內容要保留到下節課有最終決定權。我們故意讓 AI 停在輔助判斷位置，先做老師可控的半自動系統；固定攝影機與即時定位是下一階段。'},
      {q: '沒有固定攝影機，功能會受限嗎？', a: '第一階段完成區塊式決策與任務流程，不依賴即時定位。第二階段才加入白板座標校正與機器人位置確認，本次比賽展示的是完整的第一階段。'},
      {q: '機器人擦完後，老師怎麼知道哪個區塊已完成？', a: '白板圖上對應區塊會出現 ✓ 覆蓋層，同時頂端橫幅即時顯示「區塊 X 板擦完成」確認訊息，session 內所有已擦區塊都會累積標記，老師一眼就能看出哪些已執行。'},
    ],
    hardwarePitchNote: '',
    ev3: {
      role: '白板筆臂 / 板擦路徑展示',
      commands: ['EV3_STATUS', 'EV3_CALIBRATE', 'EV3_PEN_DOWN', 'EV3_PEN_UP', 'EV3_DRAW_LINE', 'EV3_HOME', 'EV3_STOP'],
    },
  },
  {
    id: 'app2',
    team: '國小隊伍 2',
    name: '校園服務機器人',
    shortName: 'App 2',
    path: 'google ai studio/app_2（國小）/校園服務機器人 app',
    guide: 'google ai studio/app_2（國小）/校園服務機器人 app/STUDENT_DEMO_GUIDE.md',
    desc: '配送、清潔、教學、生活服務與派遣中控台。',
    accent: '#005bb3',
    flow: ['下任務', '看追蹤', '匯報表'],
    devPort: 11502,
    bridgePort: 3202,
    devName: 'App2',
    devColor: 'blue',
    pagePhrases: ['校園', '服務'],
    guidePhrases: ['校園服務機器人', '後續機器人連動計畫', '公開展示網址'],
    checklistItems: [
      '首頁看任務鏈、機器人狀態與 UNO R4 指令 log。',
      '配送頁下單，確認庫存、訂單、任務、機器人狀態與指令同步更新。',
      '追蹤頁完成送達：確認任務日誌出現第四步「EV3 手臂收回 → 已到位」，完成時間戳正確顯示。',
      '教學頁點名或處理提醒。',
      '右下角 FAB 召喚虛擬搖桿，測試前後左右與緊急停止（韌體看門狗 3 秒保護）。',
      '報表中心確認任務紀錄，最後重置展示資料。',
    ],
    simpleSteps: [
      '打開首頁，看機器人現在在做什麼',
      '幫同學訂一個福利社商品',
      '到追蹤頁，確認東西送達了',
      '到教學頁，幫老師做一次點名',
      '按搖桿按鈕，控制機器人前後左右',
      '到報表頁，讓評審看今天的紀錄',
    ],
    stepNavHints: [
      '首頁',
      '配送頁 → 下單',
      '追蹤頁 → 送達',
      '教學頁 → 點名',
      '首頁 → 遙控搖桿',
      '報表頁',
    ],
    stepNavUrls: [
      './app2/',
      './app2/#delivery',
      './app2/#delivery',
      './app2/#teach',
      './app2/',
      './app2/#life',
    ],
    scorecardMustShow: [
      'Student performs 下任務 -> 看追蹤 -> 匯報表 without assistance.',
      'Student shows inventory decreases and order/task/robot log all update together.',
      'After delivery completes: student shows Step 4 "EV3 手臂收回" row with timestamp in Step 3.',
      'Student opens FAB joystick and demonstrates drive control + emergency stop.',
      'Student demonstrates out-of-stock order: only error log, no hardware dispatch.',
      'Student explains fallback: no Arduino keeps the full task flow via simulation.',
    ],
    judgeQaExtra: [
      {q: '虛擬搖桿可以控制真實機器人嗎？', a: '可以。右下角 FAB 按鈕召喚虛擬搖桿，送出 FORWARD／BACKWARD／LEFT／RIGHT／STOP 與 SPEED_SET 指令到本機 bridge，bridge 再走 Serial 送到 UNO R4 底盤韌體。韌體內建 3 秒看門狗，前端每秒送 HEARTBEAT 保持連線；放開搖桿後看門狗倒數自動停車，防止失控。'},
      {q: '庫存不足時機器人會怎樣？', a: '系統只寫入錯誤 log，不派遣機器人也不送 Arduino 指令，確保硬體不會因為軟體錯誤而誤動作。'},
      {q: '配送完成後 EV3 手臂如何收回？', a: '追蹤頁確認到達後自動發送 EV3_ARM_RETRACT 指令，任務日誌出現第四步「EV3 手臂收回」，即時顯示收回中 → 已到位；若 EV3 未連線則顯示備援模式並繼續完成任務，不影響整體配送流程。'},
    ],
    hardwarePitchNote: 'App 右下角的手動遙控中心可以用虛擬搖桿直接控制底盤方向與滾筒，放開搖桿自動停車。',
    ev3: {
      role: '配送旗標 / 服務機器人手臂展示',
      commands: ['EV3_STATUS', 'EV3_ARM_EXTEND', 'EV3_ARM_RETRACT', 'EV3_SAFE_POSE', 'EV3_STOP'],
    },
  },
  {
    id: 'app3',
    team: '國中隊伍',
    name: 'AI 校園心靈守護者',
    shortName: 'App 3',
    path: 'google ai studio/app_3（國中）/AI校園心靈守護者',
    guide: 'google ai studio/app_3（國中）/AI校園心靈守護者/STUDENT_DEMO_GUIDE.md',
    opsGuide: 'google ai studio/app_3（國中）/AI校園心靈守護者/DEMO_OPERATIONS_GUIDE.md',
    desc: '匿名關懷、預警處理、自我照護、聊天與節點監控。',
    accent: '#0f766e',
    flow: ['看總覽', '處理提醒', '自我照護'],
    devPort: 11503,
    bridgePort: 3203,
    devName: 'App3',
    devColor: 'magenta',
    pagePhrases: ['校園', '心靈'],
    guidePhrases: ['AI 校園心靈守護者', '後續機器人連動計畫', '公開展示網址'],
    checklistItems: [
      '第一屏說明 AI 主動巡查；指出最高風險區的風險、聲量與提醒數。',
      '點選中高風險區，派遣機器人介入，確認機器人任務紀錄產生。',
      '預警抽屜：選一筆提醒，勾選處置清單，佈署關懷。',
      '感知抽屜：按「示範」按鈕，確認折線趨勢圖出現、趨勢箭頭顯示。',
      '感知抽屜：啟用麥克風，等 20 秒以上確認趨勢圖開始累積真實採樣。',
      '底部遙控列展開，測試 D-pad 前後左右與緊急停止。',
      '紀錄抽屜：確認硬體提示有 sent/fallback 狀態留下。',
    ],
    simpleSteps: [
      '打開 App，找地圖上最需要注意的區域',
      '點紅色區域，派機器人去關心同學',
      '點預警頁，選一筆提醒並佈署關懷',
      '點感知頁，按示範看聲量趨勢圖',
      '打開麥克風，等 20 秒看圖有沒有動',
      '展開底部遙控列，測試機器人移動',
      '點機器人頁，確認動作有被記錄',
    ],
    stepNavHints: [
      '校園地圖',
      '點高風險區域',
      '預警 Tab',
      '感知 Tab → 按示範',
      '感知 Tab → 麥克風',
      '底部遙控列',
      '機器人 Tab',
    ],
    stepNavUrls: [
      './app3/',
      './app3/',
      './app3/#alerts',
      './app3/#sensing',
      './app3/#sensing',
      './app3/',
      './app3/#robot',
    ],
    scorecardMustShow: [
      'Student performs 看總覽 -> 處理提醒 -> 自我照護 without assistance.',
      'Student points to the risk/sound/alert count on each campus zone.',
      'Student dispatches robot from a high-risk zone and confirms task log updates.',
      'Student opens bottom drive dock, tests D-pad, explains 3-second watchdog.',
      'Student explains: no diagnosis, no real names, anonymous demo data only.',
      'Student shows acoustic sensing: browser mic, local compute only, no audio saved.',
      'Student shows sound trend sparkline (demo button or live mic) and explains trend arrow.',
    ],
    judgeQaExtra: [
      {q: '底部遙控列是什麼？', a: '巡邏底盤的手動控制入口，常駐可收折。D-pad 控制前後左右，速度可調；韌體看門狗 3 秒保護，放開按鍵自動停車。收折後只顯示連線狀態與緊急停止按鈕，不佔主畫面空間。'},
      {q: '聲量偵測會不會侵犯隱私？', a: '不會。瀏覽器麥克風只做本機即時運算，計算音量指標與波動；不保存原始錄音、不轉文字、不上傳雲端。運算後的匿名訊號才寫入 localStorage。'},
      {q: '這是心理診斷工具嗎？', a: '不是。作品只做匿名關懷提醒和老師低壓確認，不做醫療或心理診斷，也不使用真學生姓名。語氣設計聚焦在「需要觀察」與「安排關懷談話」。'},
      {q: '聲量趨勢圖怎麼運作？歷史資料怎麼保護？', a: '麥克風啟用後每 10 秒採樣一次，最多保留 30 分鐘共 180 筆。SVG 折線圖在前端即時渲染，右上角顯示 ↑ 上升 / → 穩定 / ↓ 下降趨勢方向。所有資料只存在本機 localStorage，頁面關閉後保留、重置後清空，完全不上傳雲端。'},
    ],
    hardwarePitchNote: 'App 底部的可收折遙控列可以直接手動控制巡邏底盤，韌體看門狗 3 秒保護。',
    ev3: {
      role: '關懷提醒 / 實體提示動作展示',
      commands: ['EV3_STATUS', 'EV3_ARM_EXTEND', 'EV3_SAFE_POSE', 'EV3_CANCEL', 'EV3_STOP'],
    },
  },
];

export function appDir(app) {
  return path.join(rootDir, app.path);
}

export function guidePath(app) {
  return path.join(rootDir, app.guide);
}

export function opsGuidePath(app) {
  return app.opsGuide ? path.join(rootDir, app.opsGuide) : null;
}

export function opsGuideUrl(app) {
  return app.opsGuide ? `${app.id}-ops-guide.html` : null;
}

export function appUrl(app) {
  return `${app.id}/`;
}

export function guideUrl(app) {
  return `${app.id}-guide.html`;
}

export function allGuidesUrl() {
  return 'all-guides.html';
}

export function allPublishedRoutes() {
  return [
    '/',
    `/${allGuidesUrl()}`,
    ...apps.map((app) => `/${appUrl(app)}`),
    ...apps.map((app) => `/${guideUrl(app)}`),
    ...apps.flatMap((app) => opsGuideUrl(app) ? [`/${opsGuideUrl(app)}`] : []),
  ];
}
