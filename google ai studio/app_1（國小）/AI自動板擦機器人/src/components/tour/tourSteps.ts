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

export const TOUR_STORAGE_KEY = 'tour-app1:v1';
