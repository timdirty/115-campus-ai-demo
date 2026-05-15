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
    title: '歡迎！進入 App 3 展示流程',
    body: '這是國中組的進階 demo：匿名訊號、AI 融合、區域判讀、機器人派遣、學生支持與結案證據要串成同一條線。',
    demoTip: '「我們做的是匿名、非診斷的校園關懷系統，重點是把風險偵測到老師處置完整閉環。」',
  },
  {
    id: 'signal-overview',
    targetDataTour: 'signal-overview',
    title: '指揮中心總覽',
    body: '上台先看這一區：目前最高風險、機器人數量和校園狀態都在第一眼可見範圍內。',
    demoTip: '「我們先看全校狀態，目前有需要觀察的區域，但系統會保持匿名、非診斷。」',
    tooltipSide: 'bottom',
  },
  {
    id: 'demo-loop',
    targetDataTour: 'demo-loop',
    title: '五段閉環流程',
    body: '這是學生上台主線。按「跑完整示範」或右上「開始示範」，系統會從 0/5 跑到 5/5。',
    demoTip: '「評審如果時間短，我們直接跑完整示範，讓五段流程自己留下證據。」',
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
    body: '這裡有四個功能面板：預警、感知、照護、機器人。每個面板都對應閉環裡的一段證據。',
    demoTip: '「我會依序打開預警、感知、照護、機器人，讓評審看到不是單點功能，而是完整流程。」',
    tooltipSide: 'top',
  },
  {
    id: 'complete',
    isFullscreen: true,
    title: '你準備好了！',
    body: '比賽時只要記住三步：開始示範、看五段進度、打開預警/機器人證據。',
    demoTip: '「謝謝評審，這套系統不是取代老師，而是用 AI 幫老師更早看見、低壓處理並留下追蹤紀錄。」',
  },
];

export const TOUR_STORAGE_KEY = 'tour-app3:v1';
