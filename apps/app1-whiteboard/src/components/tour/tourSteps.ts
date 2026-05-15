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
    reviewerQ: '評審常問：「沒有網路怎麼辦？」→ 系統有展示模式，會用白板文字整理與分析範例，完整流程不中斷。',
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
    title: '白板左右區決策',
    body: '點選左區或右區標記保留或清空，按「送機器人」就能直接指派任務，機器人會前往對應位置執行。',
    demoTip: '「我點右區標記可清空，然後按送機器人——機器人會去右邊執行擦除任務。」',
    reviewerQ: '評審常問：「機器人不動怎麼辦？」→ 沒有接實體機器人時系統進入展示模式，任務紀錄完整保存，換上實體機器人後相同流程立即生效。',
    tooltipSide: 'left',
  },
  {
    id: 'robot-commands',
    tab: 'robot',
    targetDataTour: 'robot-commands',
    title: '機器人任務面板',
    body: '這裡可以直接送出任務給板擦機器人，包含清空左區 / 右區、暫停等待、成功動畫等功能。',
    demoTip: '「我按清空可擦區，機器人任務台會顯示任務已建立，展示模式也會留下完整紀錄。」',
    reviewerQ: '評審常問：「這套系統成本多少？」→ 實體材料約 1,500 元，遠低於市售白板清潔設備，且軟體完全自製。',
    tooltipSide: 'bottom',
  },
  {
    id: 'notes-list',
    tab: 'library',
    targetDataTour: 'notes-list',
    title: '課堂紀錄本',
    body: '每次 AI 分析完的白板內容都會自動保存在這裡，可以搜尋、整理、下載，累積成完整的課堂紀錄。',
    demoTip: '「評審可以看到之前累積的課堂紀錄，每一筆都有科目、時間和 AI 分析結果。」',
    reviewerQ: '評審常問：「資料安全嗎？」→ 所有資料保存在老師展示電腦，不會自動上傳雲端，老師完全掌控自己的課堂資料。',
    tooltipSide: 'bottom',
  },
  {
    id: 'ai-teacher',
    tab: 'chat',
    targetDataTour: 'ai-teacher',
    title: 'AI 小老師追問',
    body: '孩子可以用剛剛保存的白板紀錄提問，AI 會改成國小生聽得懂的說法。',
    demoTip: '「我問 AI 小老師：請把最新紀錄改成三年級會懂的說法，系統會直接引用剛才的課堂紀錄回答。」',
    reviewerQ: '評審常問：「這是隨便聊天嗎？」→ 不是，回答會優先使用課堂紀錄本中的白板文字與老師講解，讓課後複習接回同一堂課。',
    tooltipSide: 'left',
  },
  {
    id: 'learning-sheet',
    tab: 'review',
    targetDataTour: 'learning-sheet',
    title: '學習單與小測驗',
    body: '最後把同一筆白板紀錄轉成小測驗或學習單，完成上課、整理、複習的閉環。',
    demoTip: '「最後我按開始生成，孩子可以馬上做小測驗，老師也能知道哪些重點要再講一次。」',
    reviewerQ: '評審常問：「學生能自己操作嗎？」→ 介面只需要選紀錄、按生成、答題，流程短，適合國小生上台示範。',
    tooltipSide: 'top',
  },
  {
    id: 'complete',
    isFullscreen: true,
    title: '你準備好了！',
    body: '所有功能都認識了。比賽時按照主流程介紹：拍白板 → AI 分析 → 選區塊 → 送機器人，清楚又有力。',
    demoTip: '「謝謝評審，這套系統讓老師能即時掌握白板使用狀況，並派遣自動板擦機器人減少課堂中斷。」',
    reviewerQ: '評審最後常問：「下一步計畫？」→ 加入固定拍攝位置與機器人位置確認，讓擦除位置更精準，完成更穩定的閉環控制。',
  },
];

export const TOUR_STORAGE_KEY = 'tour-app1:v1';
