import { AppState, StudentReport, DispatchTaskType } from '../state/appState';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function generateTeacherReply(question: string) {
  await wait(250);
  if (/達文西|文藝復興|三傑/.test(question)) {
    return '文藝復興三傑是達文西、米開朗基羅與拉斐爾。你可以先記「畫作、雕塑、聖母像」三個關鍵線索。';
  }
  if (/不懂|聽不懂|為什麼/.test(question)) {
    return '我會用更小的步驟再說一次：先看關鍵詞，再看例子，最後用一句話整理成自己的理解。';
  }
  return '收到你的問題，我會先把它標記起來，稍後用全班都能理解的例子補充說明。';
}

export async function generateClassSummary(state: AppState) {
  await wait(200);
  const alerts = state.teachingSignals.filter((signal) => signal.type === 'alert').length;
  const questions = state.teachingSignals.filter((signal) => signal.type === 'question').length;
  const present = state.attendance.scanned ? `${state.attendance.present}/${state.attendance.total}` : '尚未點名';
  return `本堂課目前專注度穩定，仍有 ${alerts} 則分心告警與 ${questions} 則課堂提問待處理。出席狀態：${present}。`;
}

export async function generateStudentInsights(report: StudentReport) {
  await wait(200);
  return [
    `${report.name} 屬於${report.learningStyle}，搭配圖像、流程圖或實體示範時專注度較高。`,
    `平均專注度 ${report.averageFocus}%；建議在課程 20-25 分鐘處加入短問答或視覺提示。`,
    `近期紀錄：${report.events[0] ?? '尚無異常紀錄。'}`,
  ];
}

export async function generateDispatchRecommendation(zone: string, taskType: DispatchTaskType) {
  await wait(200);
  if (taskType === 'broadcast') {
    return `建議派遣 3 號機前往區域 ${zone} 執行疏導廣播，先引導人流往開放走廊移動，再回傳現場狀態。`;
  }
  return `建議派遣 1 號機前往區域 ${zone} 自動巡邏，沿主要通道繞行一圈並回傳熱區人流。`;
}
