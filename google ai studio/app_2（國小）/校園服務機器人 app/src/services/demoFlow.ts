import type {AppState} from '../state/appState';

export type DemoStep = {
  id: string;
  label: string;
  detail: string;
  done: boolean;
};

export type DemoHealthStatus = {
  label: string;
  value: string;
  ok: boolean;
};

export function getDemoSteps(state: AppState): DemoStep[] {
  const hasDelivery = state.orders.length > 0;
  const hasCompletedDelivery = state.orders.some((order) => order.status === 'delivered');
  const hasTeachingAction = state.attendance.scanned || Object.values(state.studentReports).some((report) => report.events.length > 1);
  const hasDispatch = state.tasks.some((task) => task.source === 'dispatch');
  const hasReportReady = state.logs.length > 0 && state.robotCommandLogs.length > 1;

  return [
    {id: 'delivery', label: '配送下單', detail: '扣庫存、建訂單、派 Delta-04', done: hasDelivery},
    {id: 'tracking', label: '送達追蹤', detail: '完成取件後機器人回待命', done: hasCompletedDelivery},
    {id: 'teaching', label: '教學互動', detail: '點名、提問、分心提醒入紀錄', done: hasTeachingAction},
    {id: 'dispatch', label: '校園派遣', detail: '巡邏或廣播任務進入機隊', done: hasDispatch},
    {id: 'report', label: '報表收尾', detail: '日誌與 UNO R4 bridge 狀態可說明', done: hasReportReady},
  ];
}

export function getDemoHealth(state: AppState): DemoHealthStatus[] {
  return [
    {label: '本機資料', value: `${state.tasks.length} 任務 / ${state.logs.length} 日誌`, ok: state.tasks.length > 0},
    {label: 'UNO R4 指令', value: `${state.robotCommandLogs.length} 筆紀錄`, ok: state.robotCommandLogs.length > 0},
    {label: '機隊狀態', value: `${state.robots.filter((robot) => robot.isRunning).length} 台執行中`, ok: state.robots.length >= 4},
    {label: 'Bridge 狀態', value: state.hardwareMode === 'serial-ready' ? 'Serial ready' : 'Fallback ready', ok: true},
  ];
}
