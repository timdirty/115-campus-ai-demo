export type TourStep = {
  id: string;
  tab?: 'home' | 'teacher' | 'robot' | 'library' | 'chat' | 'review';
  targetDataTour?: string;
  title: string;
  body: string;
  demoTip: string;
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
  },
  {
    id: 'capture-panel',
    tab: 'home',
    targetDataTour: 'capture-panel',
    title: '拍照與語音分析',
    body: '用攝影機拍下白板，或錄音後轉成逐字稿，AI 幫你整理課堂重點並找出哪些內容可以擦掉。',
    demoTip: '「老師，我來示範拍白板後讓 AI 分析——選好科目、按拍照，幾秒後就會出現分析結果。」',
    tooltipSide: 'right',
  },
  {
    id: 'status-tiles',
    tab: 'home',
    targetDataTour: 'status-tiles',
    title: '系統狀態',
    body: '這裡顯示硬體連線、Gemini AI、攝影機和課堂紀錄的即時狀態，就算沒有接機器人也能展示。',
    demoTip: '「就算沒有接機器人，AI 分析和課堂紀錄功能都能獨立運作，比賽不怕臨時硬體故障。」',
    tooltipSide: 'bottom',
  },
  {
    id: 'region-panel',
    tab: 'home',
    targetDataTour: 'region-panel',
    title: '白板區塊決策',
    body: 'AI 分析後會把白板分成幾個區塊，一眼看出哪些要保留、哪些可以派機器人去擦除。',
    demoTip: '「這裡是 AI 分析出來的白板區塊，我標記哪些要保留、哪些可清空，然後直接派機器人去執行。」',
    tooltipSide: 'top',
  },
  {
    id: 'class-stats',
    tab: 'teacher',
    targetDataTour: 'class-stats',
    title: '班級學習狀態',
    body: '白板分析彙整後，這裡會顯示全班專心度、需要幫忙和需要休息的比例，老師一眼掌握班級狀態。',
    demoTip: '「老師一眼就能看出現在班上的狀況，不需要一個個點名，可以專心上課。」',
    tooltipSide: 'bottom',
  },
  {
    id: 'board-regions',
    tab: 'teacher',
    targetDataTour: 'board-regions',
    title: '白板區塊決策',
    body: '點選區塊標記保留或清空，按「送機器人」就能直接指派任務，機器人會前往對應位置執行。',
    demoTip: '「我點區塊 B 標記可清空，然後按送機器人——機器人會去那個位置執行擦除任務。」',
    tooltipSide: 'left',
  },
  {
    id: 'robot-commands',
    tab: 'robot',
    targetDataTour: 'robot-commands',
    title: '機器人指令面板',
    body: '這裡可以直接送出指令給板擦機器人，控制 LED 燈、伺服馬達角度、動畫效果等功能。',
    demoTip: '「我按「放煙火」，機器人 LED 矩陣就會播放動畫——這是展示時非常吸睛的效果。」',
    tooltipSide: 'bottom',
  },
  {
    id: 'notes-list',
    tab: 'library',
    targetDataTour: 'notes-list',
    title: '課堂紀錄本',
    body: '每次 AI 分析完的白板內容都會自動保存在這裡，可以搜尋、整理、下載，累積成完整的課堂紀錄。',
    demoTip: '「評審可以看到之前累積的課堂紀錄，每一筆都有科目、時間和 AI 分析結果。」',
    tooltipSide: 'bottom',
  },
  {
    id: 'complete',
    isFullscreen: true,
    title: '你準備好了！',
    body: '所有功能都認識了。比賽時按照主流程介紹：拍白板 → AI 分析 → 選區塊 → 送機器人，清楚又有力。',
    demoTip: '「謝謝評審，這套系統讓老師能即時掌握白板使用狀況，並派遣自動板擦機器人減少課堂中斷。」',
  },
];

export const TOUR_STORAGE_KEY = 'tour-app1:v1';
