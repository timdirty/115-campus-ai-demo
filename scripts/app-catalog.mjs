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
    studentMustShow: [
      '完整走一遍：拍白板 → 看 AI 建議 → 送指令給機器人（全程自己操作，不需要幫忙）',
      '指出像素分析結果，說明 AI 看出了什麼、哪個區塊要擦',
      '示範「保存決策 → 送到機器人」，說明為什麼由老師按最後確認',
      '機器人任務成功後：白板圖出現 ✓ 覆蓋層，頂端出現「區塊 X 板擦完成」橫幅',
      '底部 D-pad 搖桿：測試前進、後退、左轉、右轉、緊急停止；放開後自動停車',
      '說明備案：沒有攝影機、沒有網路、沒有 EV3、沒有 Arduino 都可以正常展示',
    ],
    appEmergency: [
      ['拍照或匯入後，AI 建議沒有出來',
        '① 先換另一張圖，或直接切到教師看板 → ② 告訴評審：「本機像素辨識是離線的，沒有網路也能跑完整流程」→ ③ 指著任何已保存的決策給評審看，說明「建議和決策都已經在這裡了」'],
      ['保存決策後送機器人，任務沒有反應',
        '① 指著畫面上的任務日誌，讓評審看到紀錄有出現 → ② 打開底部 D-pad 搖桿，示範前後左右手動控制 → ③ 說：「接上 Arduino 之後，這裡的指令就會直接控制板擦機器人」'],
      ['白板圖上 ✓ 覆蓋層沒有出現',
        '① 確認是否已按「保存決策」再按「送到機器人」兩個步驟 → ② 往下拉刷新頁面，等 3 秒讓 bridge 回應 → ③ 打開任務日誌，指著有沒有任務紀錄，告訴評審：「指令已送出，覆蓋層確認動作」'],
      ['D-pad 搖桿沒有反應，機器人不動',
        '① 打開右上角⚙設定，確認 Bridge 連線狀態 → ② 指著搖桿旁邊的指令 log 說：「這裡可以看到已送出的指令序列」→ ③ 說：「接上 Arduino 線後就能真的動；現在讓我示範 App 其他功能」'],
      ['評審問「AI 怎麼辨識白板上的字？」',
        '① 打開白板頁，按一次拍照或匯入圖片 → ② 指著右方像素分析結果說：「我們用 canvas 做像素計算，不需要網路或 AI API」→ ③ 說：「辨識出有寫字的區塊後，AI 建議哪裡要擦，老師按確認才送指令」'],
      ['時間快到了（只剩不到 1 分鐘）',
        '① 說話的同學說：「最後讓評審看最完整的一次流程」→ ② 快速走：拍白板 ▸ 教師看板看建議 ▸ 按送指令（只走畫面，不等機器人） → ③ 說：「從拍照到機器人確認，三步全部在 App 裡完成，不超過 30 秒」'],
    ],
    judgeQaExtra: [
      {q: '為什麼不做全自動擦白板？', a: '老師對哪些內容要保留到下節課有最終決定權。我們故意讓 AI 停在輔助判斷位置，先做老師可控的半自動系統；固定攝影機與即時定位是下一階段。'},
      {q: '沒有固定攝影機，功能會受限嗎？', a: '第一階段完成區塊式決策與任務流程，不依賴即時定位。第二階段才加入白板座標校正與機器人位置確認，本次比賽展示的是完整的第一階段。'},
      {q: '機器人擦完後，老師怎麼知道哪個區塊已完成？', a: '白板圖上對應區塊會出現 ✓ 覆蓋層，同時頂端橫幅即時顯示「區塊 X 板擦完成」確認訊息，session 內所有已擦區塊都會累積標記，老師一眼就能看出哪些已執行。'},
      {q: 'AI 辨識錯了怎麼辦？', a: '老師有最終決定權。AI 給的是「建議擦除區塊」，老師保存決策後可以調整，也可以在送機器人前取消。錯誤辨識只影響建議，不影響實際指令，除非老師確認送出。'},
      {q: '這個系統最特別的地方是什麼？', a: '三階段完整閉環：拍白板 → AI 給建議 → 老師決策 → 機器人執行 → 視覺確認（✓ 覆蓋層）。每一步都有人在迴路，避免 AI 全自動造成的風險；整個流程可以在三分鐘內展示完畢。'},
    ],
    judgeHighlights: [
      {headline: '本機像素辨識，零網路也能跑', detail: '白板筆跡辨識用 canvas 像素計算，不需要 AI API，斷網也完整運作。'},
      {headline: '老師握最終決定權，AI 只給建議', detail: '辨識結果只是「建議擦除」，老師按下確認後才送指令給機器人。'},
      {headline: '三步閉環：拍 → 決策 → ✓ 確認', detail: '從拍白板到機器人執行、覆蓋層出現，完整流程在 30 秒內示範完畢。'},
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
    studentMustShow: [
      '完整走一遍：下任務 → 看追蹤 → 匯報表（全程自己操作，不需要幫忙）',
      '下單後：庫存減少、訂單紀錄、任務 log、機器人狀態，四個地方同時更新',
      '配送完成後：任務日誌第 4 步「EV3 手臂收回」出現，並有正確的完成時間戳',
      '打開右下角 FAB 搖桿，示範前進、後退、左右轉和緊急停止',
      '示範庫存不足的訂單：只有錯誤 log，機器人不派遣、不動作',
      '說明備案：沒有 Arduino 時，任務佇列和配送流程照常跑（模擬模式）',
    ],
    appEmergency: [
      ['下單後庫存沒有減少，或訂單沒有出現',
        '① 確認是否已選商品並按「確認下單」→ ② 往下滑到訂單紀錄，找最新的一筆 → ③ 說：「就算沒有 Arduino，訂單流程和庫存管理照常執行；機器人指令只是多送一層」'],
      ['追蹤頁任務卡住，沒有進到第 4 步',
        '① 手動按「確認到達」→ ② 指著第 4 步「EV3 手臂收回」給評審看，確認時間戳出現 → ③ 說：「這個時間戳是任務完成當下自動記錄的，接上 EV3 之後會真的收回手臂」'],
      ['FAB 搖桿打開了，但機器人不動',
        '① 指著搖桿旁邊的指令 log 說：「這裡可以看到已送出的指令序列」→ ② 按緊急停止 STOP，讓評審看 log 出現「STOP 已送出」→ ③ 說：「接上 Arduino 之後搖桿就直接控制底盤；log 有出來代表指令已到達 bridge」'],
      ['報表頁是空白的，沒有任何紀錄',
        '① 先回首頁，按右上角「重置 Demo 資料」→ ② 重新下一筆訂單，走完整追蹤流程到到達確認 → ③ 再開報表頁，紀錄就會出現了；說：「每次展示完可以重置，下次從乾淨狀態開始」'],
      ['評審問「庫存不足時系統怎麼處理？」',
        '① 找一個庫存為 0 的商品（或先把庫存調到 0）→ ② 嘗試下單 → ③ 指著「庫存不足，未派遣機器人」的錯誤 log 說：「只有 log，機器人不派遣、Arduino 不送指令，防止硬體誤動作」'],
      ['時間快到了（只剩不到 1 分鐘）',
        '① 說話的同學說：「讓評審看最完整的一個場景」→ ② 快速走：首頁機器人狀態 → 下一筆訂單 → 追蹤確認到達 → ③ 打開 FAB 搖桿按一下 STOP，說：「這是看門狗自動停車機制，放開按鍵就剎車」'],
    ],
    judgeQaExtra: [
      {q: '虛擬搖桿可以控制真實機器人嗎？', a: '可以。右下角 FAB 按鈕召喚虛擬搖桿，送出 FORWARD／BACKWARD／LEFT／RIGHT／STOP 與 SPEED_SET 指令到本機 bridge，bridge 再走 Serial 送到 UNO R4 底盤韌體。韌體內建 3 秒看門狗，前端每秒送 HEARTBEAT 保持連線；放開搖桿後看門狗倒數自動停車，防止失控。'},
      {q: '庫存不足時機器人會怎樣？', a: '系統只寫入錯誤 log，不派遣機器人也不送 Arduino 指令，確保硬體不會因為軟體錯誤而誤動作。'},
      {q: '配送完成後 EV3 手臂如何收回？', a: '追蹤頁確認到達後自動發送 EV3_ARM_RETRACT 指令，任務日誌出現第四步「EV3 手臂收回」，即時顯示收回中 → 已到位；若 EV3 未連線則顯示備援模式並繼續完成任務，不影響整體配送流程。'},
      {q: '多人同時下訂單，系統會亂掉嗎？', a: '不會。訂單有唯一編號，機器人任務佇列按順序處理；庫存即時扣減，後下的訂單如果庫存不足直接顯示錯誤，不會重複派遣，也不會覆蓋已有任務。'},
      {q: '機器人在校園移動，安全嗎？', a: '底盤韌體有三秒看門狗：前端每秒送 HEARTBEAT 保持連線，訊號中斷後機器人自動停車。軟體層面所有指令必須經過校驗，庫存不足不派遣；速度設定也有上限，防止失控衝撞。'},
    ],
    judgeHighlights: [
      {headline: '下單同時，四個模組即時同步', detail: '訂單、庫存、任務 log、機器人狀態，一次下單四處同步更新，沒有資料不一致。'},
      {headline: '庫存不足自動擋下，硬體不誤動作', detail: '庫存為零時只寫 log，不派遣機器人、不送 Arduino 指令，防止硬體誤動作。'},
      {headline: '看門狗 3 秒保護：放開就自動停車', detail: 'FAB 搖桿每秒送 HEARTBEAT，訊號中斷後韌體倒計時 3 秒自動煞車，防止底盤失控。'},
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
    studentMustShow: [
      '完整走一遍：看總覽 → 處理提醒 → 自我照護（全程自己操作，不需要幫忙）',
      '指出校園地圖上每個區域的風險分數、聲量指數與提醒數量',
      '從高風險區派遣機器人，確認機器人任務 log 有新增紀錄',
      '展開底部遙控列，測試 D-pad 前後左右，說明 3 秒看門狗放開後自動停車',
      '說明系統不做心理診斷、不使用真實姓名、所有展示資料都是匿名的',
      '示範聲量感知：啟用瀏覽器麥克風，說明只在本機運算、不保存錄音、不上傳',
      '示範聲量趨勢圖（按示範按鈕或真實麥克風），指出趨勢箭頭的上升/穩定/下降',
    ],
    appEmergency: [
      ['麥克風按了沒反應，聲量趨勢圖沒動',
        '① 改按「示範」按鈕，用預錄資料跑一次趨勢圖 → ② 說：「剛才可能是瀏覽器麥克風權限沒開，示範按鈕可以看到一樣的聲量分析功能」→ ③ 指著趨勢箭頭說：「這個箭頭反映聲量走向，↑ 上升代表區域需要注意」'],
      ['校園地圖數字沒有載入，全部顯示灰色',
        '① 往下拉重整頁面，等 3 秒 → ② 說：「地圖用的是展示資料，不需要網路也能顯示」→ ③ 如果還是不行，打開⚙設定按「重置展示資料」；風險分數和提醒數字就會回來'],
      ['底部遙控列展不開，或 D-pad 方向鍵沒反應',
        '① 找底部橫條，確認是否已按「▲ 展開」那一列 → ② 說：「這個遙控列可以收折，不佔主畫面；打開後 D-pad 就在這裡」→ ③ 按一次 STOP，讓評審看 log 有沒有「緊急停止」出現'],
      ['評審問「資料是真實學生的資料嗎？」',
        '① 說：「全部是模擬資料，沒有真學生的個人資訊或真實姓名」→ ② 指著地圖說：「區域代號是展示用的標示，不是真實教室位置或班級」→ ③ 說：「就算有真的麥克風聲量，也只在本機運算，不保存錄音、不上傳雲端、不做心理診斷」'],
      ['自我照護頁面聊天沒有回應，或顯示錯誤',
        '① 說：「自我照護對話是一個輔助功能，如果 API 金鑰沒設定就不會回」→ ② 換到感知頁，按示範按鈕繼續展示聲量趨勢圖 → ③ 說：「主要功能是校園地圖、預警提醒和機器人遙控，我讓評審看這三個」'],
      ['從地圖派遣機器人後，任務 log 沒有新增',
        '① 確認是否點了「高風險區」然後按「派遣機器人」→ ② 換到機器人 Tab，往下滑找最新的一筆 log → ③ 說：「接上 Arduino 之後這裡的指令就會送到底盤；現在可以看到任務紀錄有出來，代表派遣成功」'],
      ['時間快到了（只剩不到 1 分鐘）',
        '① 說話的同學說：「最後讓評審看三個最重要的功能」→ ② 快速點：地圖高風險區 ▸ 派遣機器人 ▸ 預警一筆勾選 ▸ D-pad 遙控 → ③ 說：「從感知到行動，我們把整個流程串起來了」'],
    ],
    judgeQaExtra: [
      {q: '底部遙控列是什麼？', a: '巡邏底盤的手動控制入口，常駐可收折。D-pad 控制前後左右，速度可調；韌體看門狗 3 秒保護，放開按鍵自動停車。收折後只顯示連線狀態與緊急停止按鈕，不佔主畫面空間。'},
      {q: '聲量偵測會不會侵犯隱私？', a: '不會。瀏覽器麥克風只做本機即時運算，計算音量指標與波動；不保存原始錄音、不轉文字、不上傳雲端。運算後的匿名訊號才寫入 localStorage。'},
      {q: '這是心理診斷工具嗎？', a: '不是。作品只做匿名關懷提醒和老師低壓確認，不做醫療或心理診斷，也不使用真學生姓名。語氣設計聚焦在「需要觀察」與「安排關懷談話」。'},
      {q: '聲量趨勢圖怎麼運作？歷史資料怎麼保護？', a: '麥克風啟用後每 10 秒採樣一次，最多保留 30 分鐘共 180 筆。SVG 折線圖在前端即時渲染，右上角顯示 ↑ 上升 / → 穩定 / ↓ 下降趨勢方向。所有資料只存在本機 localStorage，頁面關閉後保留、重置後清空，完全不上傳雲端。'},
      {q: '如果偵測到真正的危機訊號，AI 會怎麼處理？', a: '系統設計是讓訊息更快到老師手上，而不是讓 AI 嘗試處理。當文字包含危機關鍵詞時，介面立即顯示全螢幕警告、提示老師介入，同時停止 AI 自動回覆。整個設計的核心是「AI 提早預警、老師最終決策」。'},
      {q: '為什麼要用 AI，而不是直接找輔導老師？', a: '不是取代輔導老師，而是延伸老師的感知範圍。一個輔導老師要照顧全校學生，AI 主動巡查可以更快標記需要關注的區域，讓老師有線索、主動確認，而不是等學生主動求助。'},
    ],
    judgeHighlights: [
      {headline: '聲量只在本機運算，不保存、不上傳', detail: '瀏覽器麥克風只計算音量指標，不保存錄音、不轉文字、不離開裝置。'},
      {headline: 'AI 提早預警，老師最終決策', detail: '系統主動標記高風險區域讓老師確認，不讓 AI 自己判斷或處置學生狀況。'},
      {headline: '派遣到確認，全程三步完成', detail: '從地圖點高風險區、派遣機器人到任務 log 更新，完整流程 30 秒內示範完畢。'},
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
