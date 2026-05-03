export type TourStep = {
  id: string;
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
    body: '我來帶你認識 AI 校園心靈守護者的所有功能。大約 2 分鐘，完成後可以按「導覽」重看。',
    demoTip: '「我們開發了一套用 AI 和感測器守護校園心理健康的系統，現在帶大家看看各個功能。」',
  },
  {
    id: 'signal-overview',
    targetDataTour: 'signal-overview',
    title: '指揮中心總覽',
    body: '這裡顯示校園即時守護指數、最高風險分數和目前執行中的機器人數量，一眼掌握全校狀態。',
    demoTip: '「這三個數字就是校園現在的心理安全狀況——守護指數越高代表越穩定。」',
    tooltipSide: 'bottom',
  },
  {
    id: 'campus-map',
    targetDataTour: 'campus-map',
    title: '校園地圖',
    body: '地圖上每個區域都有顏色標示風險等級，點選區域可以看詳細感測數據，並直接在那裡派遣機器人介入。',
    demoTip: '「我點這個紅色區域，可以看到它的聲量和風險分數，然後按右上方的派遣按鈕。」',
    tooltipSide: 'bottom',
  },
  {
    id: 'dispatch-robot',
    targetDataTour: 'dispatch-robot',
    title: '最高風險區派遣',
    body: '這裡自動顯示當前風險最高的區域，點「派遣機器人介入」按鈕，機器人會前往該區執行關懷任務。',
    demoTip: '「我現在按派遣，機器人會收到指令、前往現場，老師也會同步收到確認提示。」',
    tooltipSide: 'left',
  },
  {
    id: 'zone-inspector',
    targetDataTour: 'zone-inspector',
    title: '區域詳情',
    body: '點選地圖上任意區域後，這裡會顯示該區的穩定指數、聲量、提醒數，以及機器人任務進度。',
    demoTip: '「這是我剛才點的區域——風險刻度、聲量、提醒數都在這裡，方便老師快速決策。」',
    tooltipSide: 'left',
  },
  {
    id: 'mission-timeline',
    targetDataTour: 'mission-timeline',
    title: '機器人任務紀錄',
    body: '所有派遣任務都會即時顯示在這裡，包含目標區域、任務狀態和進度條，任務完成後留在紀錄中。',
    demoTip: '「評審可以看到之前的派遣紀錄，每一筆都有區域名稱和完成狀態。」',
    tooltipSide: 'left',
  },
  {
    id: 'panel-dock',
    targetDataTour: 'panel-dock',
    title: '工作面板',
    body: '這裡有五個功能面板：預警清單、聲音感知、心理照護、節點管理、任務紀錄，點按鈕就能展開對應面板。',
    demoTip: '「我示範點「照護」，裡面有心情簽到和匿名心情牆——學生可以安全表達感受。」',
    tooltipSide: 'top',
  },
  {
    id: 'complete',
    isFullscreen: true,
    title: '你準備好了！',
    body: '所有功能都看過了。比賽時按照這個順序介紹：地圖 → 風險 → 派遣 → 五大面板，評審會有最清楚的印象。',
    demoTip: '「謝謝評審，這套系統讓老師能即時掌握校園心理動態，並用 AI 機器人主動關懷高風險學生。」',
  },
];

export const TOUR_STORAGE_KEY = 'tour-app3:v1';
