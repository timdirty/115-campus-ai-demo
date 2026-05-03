export type TourStep = {
  id: string;
  tab?: 'dashboard' | 'teach' | 'delivery' | 'life';
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
    body: '我來帶你認識校園服務機器人的所有功能。大約 2 分鐘，完成後可以從設定重看。',
    demoTip: '「我們開發了一套讓機器人管理校園服務的系統，現在帶大家看看各個功能。」',
  },
  {
    id: 'robot-status',
    tab: 'dashboard',
    targetDataTour: 'robot-status',
    title: '機器人狀態',
    body: '這裡顯示目前有幾台機器人上線、電量和所在區域。點進去可以看詳細診斷。',
    demoTip: '「目前有 4 台機器人上線，分別部署在不同區域，電量都在安全範圍。」',
    tooltipSide: 'bottom',
  },
  {
    id: 'task-stats',
    tab: 'dashboard',
    targetDataTour: 'task-stats',
    title: '今日任務統計',
    body: '一眼看出今天完成幾件、還有幾件待處理。',
    demoTip: '「今天已完成 X 件任務，整體處理速度比人工快很多。」',
    tooltipSide: 'bottom',
  },
  {
    id: 'dispatch-btn',
    tab: 'dashboard',
    targetDataTour: 'dispatch-btn',
    title: '校園派遣',
    body: '點這裡開啟地圖，把機器人指派到特定教室或走廊執行任務。',
    demoTip: '「我來按這個，示範把機器人派去 A 棟 3 樓巡邏。」',
    tooltipSide: 'top',
  },
  {
    id: 'attendance-card',
    tab: 'teach',
    targetDataTour: 'attendance-card',
    title: '智慧出缺席',
    body: '機器人掃描後自動更新出缺席名單，老師不用一個個點名。',
    demoTip: '「機器人 30 秒內完成全班掃描，比傳統點名快 10 倍，而且不會漏人。」',
    tooltipSide: 'bottom',
  },
  {
    id: 'alert-list',
    tab: 'teach',
    targetDataTour: 'alert-list',
    title: '即時告警與訊號',
    body: '同學舉手或分心時這裡會出現提示；點進去 AI 會幫你想回覆內容。',
    demoTip: '「這位同學剛剛舉手，我點進去讓 AI 建議怎麼回應——老師可以同時注意全班。」',
    tooltipSide: 'bottom',
  },
  {
    id: 'order-list',
    tab: 'delivery',
    targetDataTour: 'order-list',
    title: '配送任務追蹤',
    body: '目前在途的配送任務都在這裡，點進去可以看即時位置和預計到達時間。',
    demoTip: '「機器人現在正在送午餐到 3 年甲班，這裡可以看它走到哪了。」',
    tooltipSide: 'bottom',
  },
  {
    id: 'new-order-btn',
    tab: 'delivery',
    targetDataTour: 'new-order-btn',
    title: '新增配送任務',
    body: '點商品右邊的「+」就可以下訂單，選好目的地後機器人自動出發。',
    demoTip: '「我示範新增一筆：把文具組送到辦公室，按確認後機器人幾秒內就出發。」',
    tooltipSide: 'top',
  },
  {
    id: 'life-services',
    tab: 'life',
    targetDataTour: 'life-services',
    title: '廣播與清掃排程',
    body: '在這裡設定校園廣播內容或清掃機器人的巡邏時間，設好後全自動執行。',
    demoTip: '「下課廣播和每天的清掃路線都在這裡管，不需要人去手動操作機器人。」',
    tooltipSide: 'top',
  },
  {
    id: 'complete',
    isFullscreen: true,
    title: '你準備好了！',
    body: '所有功能都看過了。比賽時按照這個順序介紹，評審會有最清楚的印象。',
    demoTip: '「謝謝評審，以上就是我們校園服務機器人系統的完整功能展示。」',
  },
];

export const TOUR_STORAGE_KEY = 'tour-app2:v1';
