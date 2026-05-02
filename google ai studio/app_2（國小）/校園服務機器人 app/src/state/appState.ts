export const STORAGE_KEY = 'campus-service-robot:v1';

export type RobotStatus = '待命' | '充電' | '導診' | '清掃' | '配送' | '巡邏' | '疏導';
export type OrderStatus = 'in_transit' | 'delivered';
export type TaskStatus = 'pending' | 'in_progress' | 'completed';
export type TaskSource = 'delivery' | 'schedule' | 'dispatch' | 'teaching' | 'life';
export type TeachingSignalType = 'question' | 'alert';
export type DispatchTaskType = 'patrol' | 'broadcast';
export type HardwareMode = 'demo' | 'serial-ready';
export type RobotCommandStatus = 'demo-only' | 'queued' | 'sent' | 'failed';

export interface Robot {
  id: string;
  serial: string;
  status: RobotStatus;
  position: string;
  battery: number;
  task: string;
  eta: string;
  phase: string;
  isRunning: boolean;
  speed: number;
}

export interface Product {
  id: number;
  name: string;
  price: number;
  desc: string;
  img: string;
  category: 'snacks' | 'stationery' | 'drinks';
  stock: number;
}

export interface Order {
  id: string;
  productId: number;
  productName: string;
  quantity: number;
  destination: string;
  status: OrderStatus;
  robotId: string;
  createdAt: string;
  deliveredAt?: string;
}

export interface CampusTask {
  id: string;
  title: string;
  area: string;
  status: TaskStatus;
  source: TaskSource;
  robotId?: string;
  createdAt: string;
  completedAt?: string;
  detail?: string;
}

export interface Schedule {
  id: string;
  title: string;
  time: string;
  area: string;
  kind: 'cleaning' | 'broadcast';
}

export interface TeachingSignal {
  id: string;
  type: TeachingSignalType;
  name: string;
  studentId: string;
  message: string;
  createdAt: string;
}

export interface StudentReport {
  studentId: string;
  name: string;
  averageFocus: number;
  distractRate: number;
  learningStyle: string;
  events: string[];
}

export interface AttendanceState {
  scanned: boolean;
  present: number;
  absent: number;
  total: number;
  absentNames: string[];
}

export interface SensorsState {
  temp: number;
  hum: number;
  aqi: number;
}

export interface SettingsState {
  notifications: boolean;
  remindWarning: boolean;
}

export interface CampusStatus {
  isEmergency: boolean;
  safetyMode: 'normal' | 'lockdown';
  activeZone?: string;
}

export interface SystemLog {
  id: string;
  time: string;
  message: string;
  type: 'info' | 'warn' | 'error';
}

export interface RobotCommandLog {
  id: string;
  time: string;
  command: string;
  label: string;
  target: string;
  source: TaskSource | 'system';
  mode: HardwareMode;
  status: RobotCommandStatus;
  note: string;
}

export interface AppState {
  robots: Robot[];
  products: Product[];
  orders: Order[];
  tasks: CampusTask[];
  schedules: Schedule[];
  teachingSignals: TeachingSignal[];
  studentReports: Record<string, StudentReport>;
  attendance: AttendanceState;
  sensors: SensorsState;
  settings: SettingsState;
  campusStatus: CampusStatus;
  hardwareMode: HardwareMode;
  robotCommandLogs: RobotCommandLog[];
  logs: SystemLog[];
  lastUpdated: string;
}

type CreateDeliveryOrderPayload = {
  productId: number;
  quantity: number;
  destination: string;
};

type SaveSchedulePayload = {
  id: string;
  time: string;
  area: string;
};

type ResolveTeachingSignalPayload = {
  signalId: string;
  action: string;
};

export type AppAction =
  | { type: 'CREATE_DELIVERY_ORDER'; payload: CreateDeliveryOrderPayload; now?: string }
  | { type: 'COMPLETE_ORDER'; payload: { orderId: string }; now?: string }
  | { type: 'SAVE_SCHEDULE'; payload: SaveSchedulePayload; now?: string }
  | { type: 'SET_ATTENDANCE_SCANNED'; now?: string }
  | { type: 'RESOLVE_TEACHING_SIGNAL'; payload: ResolveTeachingSignalPayload; now?: string }
  | { type: 'ADD_TEACHER_REPLY'; payload: { signalId: string; reply: string }; now?: string }
  | { type: 'SET_EMERGENCY'; payload: { enabled: boolean }; now?: string }
  | { type: 'SET_NOTIFICATIONS'; payload: { enabled: boolean }; now?: string }
  | { type: 'SET_REMIND_WARNING'; payload: { enabled: boolean }; now?: string }
  | { type: 'ADD_DISPATCH_TASK'; payload: { zone: string; taskType: DispatchTaskType }; now?: string }
  | { type: 'COMPLETE_DISPATCH_TASK'; payload: { zone: string; taskType: DispatchTaskType }; now?: string }
  | { type: 'SET_ROBOT_RUNNING'; payload: { robotId: string; running: boolean }; now?: string }
  | { type: 'SET_ROBOT_SPEED'; payload: { robotId: string; speed: number }; now?: string }
  | { type: 'TICK_SENSORS'; payload: SensorsState; now?: string }
  | { type: 'CLEAR_LOCAL_CACHE'; now?: string }
  | { type: 'MARK_HARDWARE_COMMAND'; payload: { id: string; ok: boolean; message: string }; now?: string }
  | { type: 'RESTORE_DEMO_STATE'; payload: { state: AppState }; now?: string }
  | { type: 'AUTO_COMPLETE_IN_TRANSIT'; now?: string }
  | { type: 'RESET_DEMO'; now?: string };

const svgUri = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`;

const productImages = {
  toast: svgUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#FEF3C7"/><rect x="35" y="50" width="130" height="110" rx="22" fill="#D97706"/><rect x="45" y="60" width="110" height="90" rx="16" fill="#FCD34D"/><rect x="62" y="90" width="76" height="10" rx="5" fill="#D97706" opacity="0.5"/><rect x="62" y="110" width="56" height="10" rx="5" fill="#D97706" opacity="0.35"/></svg>`,
  ),
  egg: svgUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#FFFBEB"/><ellipse cx="100" cy="108" rx="58" ry="72" fill="#F9FAFB" stroke="#E5E7EB" stroke-width="2"/><ellipse cx="100" cy="115" rx="26" ry="28" fill="#FCD34D"/><ellipse cx="88" cy="76" rx="18" ry="8" fill="rgba(255,255,255,0.55)"/></svg>`,
  ),
  pizza: svgUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#FFF1F2"/><circle cx="100" cy="100" r="74" fill="#FDE68A"/><circle cx="100" cy="100" r="62" fill="#EF4444"/><circle cx="100" cy="100" r="48" fill="#FBBF24" opacity="0.45"/><circle cx="82" cy="88" r="9" fill="#7F1D1D"/><circle cx="116" cy="92" r="9" fill="#7F1D1D"/><circle cx="98" cy="116" r="9" fill="#7F1D1D"/></svg>`,
  ),
};

const nowIso = () => new Date().toISOString();
const stampTime = (iso = nowIso()) =>
  new Intl.DateTimeFormat('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(iso));

const uid = (prefix: string, iso: string) =>
  `${prefix}-${new Date(iso).getTime().toString(36)}-${Math.floor(Math.random() * 900 + 100)}`;

const addLog = (state: AppState, message: string, type: SystemLog['type'], now: string): SystemLog[] => [
  { id: uid('log', now), time: stampTime(now), message, type },
  ...state.logs,
].slice(0, 80);

const addRobotCommandLog = (
  state: AppState,
  now: string,
  entry: Omit<RobotCommandLog, 'id' | 'time' | 'mode' | 'status'>,
): RobotCommandLog[] => [
  {
    id: uid('cmd', now),
    time: stampTime(now),
    mode: state.hardwareMode,
    status: 'queued' as const,
    ...entry,
  },
  ...state.robotCommandLogs,
].slice(0, 80);

const withRobotCommandLog = (
  nextState: AppState,
  previousState: AppState,
  now: string,
  entry: Omit<RobotCommandLog, 'id' | 'time' | 'mode' | 'status'>,
): AppState => ({
  ...nextState,
  robotCommandLogs: addRobotCommandLog(previousState, now, entry),
});

export function createInitialAppState(): AppState {
  const createdAt = '2026-04-29T08:00:00.000+08:00';

  return {
    robots: [
      {
        id: '1號',
        serial: 'RBT-ALPHA-01',
        status: '待命',
        position: '總控制中心基地',
        battery: 100,
        task: '無',
        eta: '--',
        phase: 'IDLE',
        isRunning: false,
        speed: 1.1,
      },
      {
        id: '2號',
        serial: 'RBT-BETA-02',
        status: '充電',
        position: 'B棟充電站',
        battery: 20,
        task: '充電中',
        eta: '--',
        phase: 'CHARGING',
        isRunning: false,
        speed: 0.8,
      },
      {
        id: '3號',
        serial: 'RBT-GAMMA-03',
        status: '導診',
        position: '保健中心前',
        battery: 55,
        task: '引導至保健中心',
        eta: '5 MINS',
        phase: 'GUIDING',
        isRunning: true,
        speed: 1.0,
      },
      {
        id: '4號',
        serial: 'RBT-DELTA-04',
        status: '清掃',
        position: '五年級走廊',
        battery: 82,
        task: '打掃 507 教室',
        eta: '12 MINS',
        phase: 'PHASE_2',
        isRunning: true,
        speed: 1.2,
      },
    ],
    products: [
      {
        id: 1,
        name: '特級厚片土司',
        price: 28,
        desc: '現烤厚片土司，外酥內軟，香氣撲鼻。',
        img: productImages.toast,
        category: 'snacks',
        stock: 12,
      },
      {
        id: 2,
        name: '現煮茶葉蛋',
        price: 16,
        desc: '秘方滷製，香嫩入味，補充蛋白好幫手。',
        img: productImages.egg,
        category: 'snacks',
        stock: 0,
      },
      {
        id: 3,
        name: '義式小披薩',
        price: 40,
        desc: '個人份現烤披薩，濃郁起司即刻享用。',
        img: productImages.pizza,
        category: 'snacks',
        stock: 5,
      },
      {
        id: 4,
        name: '2B 考試鉛筆組',
        price: 22,
        desc: '含橡皮擦與削筆器，臨時考試用品快速配送。',
        img: productImages.toast,
        category: 'stationery',
        stock: 18,
      },
      {
        id: 5,
        name: '無糖麥茶',
        price: 20,
        desc: '低溫補給飲品，適合體育課後配送。',
        img: productImages.egg,
        category: 'drinks',
        stock: 9,
      },
    ],
    orders: [
      {
        id: 'order-demo-001',
        productId: 1,
        productName: '特級厚片土司',
        quantity: 2,
        destination: '五年級 501 教室',
        status: 'delivered',
        robotId: '1號',
        createdAt: '2026-04-29T07:00:00.000+08:00',
        deliveredAt: '2026-04-29T07:10:00.000+08:00',
      },
      {
        id: 'order-demo-002',
        productId: 3,
        productName: '義式小披薩',
        quantity: 1,
        destination: '六年級 602 教室',
        status: 'delivered',
        robotId: '2號',
        createdAt: '2026-04-29T06:00:00.000+08:00',
        deliveredAt: '2026-04-29T06:12:00.000+08:00',
      },
    ],
    tasks: [
      {
        id: 'task-clean-507',
        title: '打掃 507 教室',
        area: '五年級走廊',
        status: 'in_progress',
        source: 'schedule',
        robotId: '4號',
        createdAt,
        detail: '例行清掃任務進行中，進度約 64%。',
      },
    ],
    schedules: [
      { id: 'schedule1', title: '校區深度清掃', time: '16:30', area: '所有走廊與公共區', kind: 'cleaning' },
      { id: 'schedule2', title: '晨間活力廣播', time: '08:00', area: '全校範圍同步', kind: 'broadcast' },
    ],
    teachingSignals: [
      {
        id: 'sig-12',
        type: 'question',
        name: '學習訊號 A',
        studentId: '12',
        message: '老師，我想再聽一次這段...',
        createdAt,
      },
      {
        id: 'sig-05',
        type: 'alert',
        name: '學習訊號 B',
        studentId: '05',
        message: '座位狀態待老師確認',
        createdAt,
      },
      {
        id: 'sig-08',
        type: 'alert',
        name: '學習訊號 C',
        studentId: '08',
        message: '學習狀態需要關注',
        createdAt,
      },
    ],
    studentReports: {
      '05': {
        studentId: '05',
        name: '學習訊號 B',
        averageFocus: 78,
        distractRate: 3.2,
        learningStyle: '視覺型學習者',
        events: ['10:16 系統提示：座位狀態待確認。'],
      },
      '08': {
        studentId: '08',
        name: '學習訊號 C',
        averageFocus: 74,
        distractRate: 2.7,
        learningStyle: '互動型學習者',
        events: ['10:21 系統提示：學習狀態需要關注。'],
      },
      '12': {
        studentId: '12',
        name: '學習訊號 A',
        averageFocus: 86,
        distractRate: 0.8,
        learningStyle: '提問型學習者',
        events: ['10:41 收到課程提問訊號。'],
      },
    },
    attendance: {
      scanned: false,
      present: 0,
      absent: 0,
      total: 32,
      absentNames: [],
    },
    sensors: { temp: 24.5, hum: 48, aqi: 32 },
    settings: { notifications: true, remindWarning: true },
    campusStatus: { isEmergency: false, safetyMode: 'normal' },
    hardwareMode: 'demo',
    robotCommandLogs: [
      {
        id: 'cmd-ready',
        time: '04:12',
        command: 'SYSTEM_READY',
        label: '本機硬體模式啟動',
        target: '本機展示',
        source: 'system',
        mode: 'demo',
        status: 'demo-only',
        note: '已啟用本機展示服務；未接實體設備時保留示範紀錄，接上後沿用同一任務流程。',
      },
    ],
    logs: [
      { id: 'log-1', time: '04:12', message: '系統：網路介面 eth0 已啟動', type: 'info' },
      { id: 'log-2', time: '04:12', message: 'AI引擎：視覺子系統初始化完成', type: 'info' },
      { id: 'log-3', time: '04:14', message: '警告：區域 B-4 偵測到高人流', type: 'warn' },
      { id: 'log-4', time: '04:15', message: '指令：Delta 機器人已派遣至 5 樓', type: 'info' },
    ],
    lastUpdated: createdAt,
  };
}

export function createDeliveryOrder(payload: CreateDeliveryOrderPayload): AppAction {
  return { type: 'CREATE_DELIVERY_ORDER', payload };
}

export function completeOrder(orderId: string): AppAction {
  return { type: 'COMPLETE_ORDER', payload: { orderId } };
}

export function saveSchedule(payload: SaveSchedulePayload): AppAction {
  return { type: 'SAVE_SCHEDULE', payload };
}

export function resolveTeachingSignal(payload: ResolveTeachingSignalPayload): AppAction {
  return { type: 'RESOLVE_TEACHING_SIGNAL', payload };
}

export function resetDemoState(): AppAction {
  return { type: 'RESET_DEMO' };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  const now = action.now ?? nowIso();

  switch (action.type) {
    case 'CREATE_DELIVERY_ORDER': {
      const product = state.products.find((item) => item.id === action.payload.productId);
      if (!product || action.payload.quantity <= 0 || product.stock < action.payload.quantity || !action.payload.destination?.trim()) {
        return {
          ...state,
          logs: addLog(state, '配送中心：訂單建立失敗，庫存不足或商品不存在，硬體未派遣', 'error', now),
          lastUpdated: now,
        };
      }

      const robotId = '4號';
      const orderId = uid('order', now);
      const taskId = uid('task-delivery', now);
      const order: Order = {
        id: orderId,
        productId: product.id,
        productName: product.name,
        quantity: action.payload.quantity,
        destination: action.payload.destination,
        status: 'in_transit',
        robotId,
        createdAt: now,
      };
      const task: CampusTask = {
        id: taskId,
        title: `配送 ${product.name} x${action.payload.quantity}`,
        area: action.payload.destination,
        status: 'in_progress',
        source: 'delivery',
        robotId,
        createdAt: now,
        detail: `前往 ${action.payload.destination}`,
      };

      return withRobotCommandLog(
        {
          ...state,
          products: state.products.map((item) =>
            item.id === product.id ? { ...item, stock: item.stock - action.payload.quantity } : item,
          ),
          orders: [order, ...state.orders],
          tasks: [task, ...state.tasks],
          robots: state.robots.map((robot) =>
            robot.id === robotId
              ? {
                  ...robot,
                  status: '配送',
                  position: '配送中心出發',
                  task: task.title,
                  eta: '4 MINS',
                  phase: 'DELIVERY',
                  isRunning: true,
                }
              : robot,
          ),
          logs: addLog(state, `配送中心：${robotId} 前往 ${action.payload.destination}`, 'info', now),
          lastUpdated: now,
        },
        state,
        now,
        {
          command: 'DELIVERY_START',
          label: `配送 ${product.name} x${action.payload.quantity}`,
          target: action.payload.destination,
          source: 'delivery',
          note: `${robotId} 進入配送流程，橋接服務會嘗試送到 UNO R4。`,
        },
      );
    }

    case 'COMPLETE_ORDER': {
      const order = state.orders.find((item) => item.id === action.payload.orderId);
      if (!order) return state;
      const linkedTaskTitle = `配送 ${order.productName} x${order.quantity}`;

      return withRobotCommandLog(
        {
          ...state,
          orders: state.orders.map((item) =>
            item.id === order.id ? { ...item, status: 'delivered', deliveredAt: now } : item,
          ),
          tasks: state.tasks.map((task) =>
            task.robotId === order.robotId && task.title === linkedTaskTitle
              ? { ...task, status: 'completed', completedAt: now, detail: '已送達並完成取件確認' }
              : task,
          ),
          robots: state.robots.map((robot) =>
            robot.id === order.robotId
              ? {
                  ...robot,
                  status: '待命',
                  position: order.destination,
                  task: '等待下一個任務',
                  eta: '--',
                  phase: 'READY',
                  isRunning: false,
                }
              : robot,
          ),
          logs: addLog(state, `配送完成：${order.productName} 已送達 ${order.destination}`, 'info', now),
          lastUpdated: now,
        },
        state,
        now,
        {
          command: 'DELIVERY_DONE',
          label: `送達 ${order.productName}`,
          target: order.destination,
          source: 'delivery',
          note: `${order.robotId} 完成取件確認，回到待命狀態。`,
        },
      );
    }

    case 'AUTO_COMPLETE_IN_TRANSIT': {
      const transitOrder = state.orders.find((item) => item.status === 'in_transit');
      if (!transitOrder) return state;
      const linkedTaskTitle = `配送 ${transitOrder.productName} x${transitOrder.quantity}`;

      return withRobotCommandLog(
        {
          ...state,
          orders: state.orders.map((item) =>
            item.id === transitOrder.id ? { ...item, status: 'delivered', deliveredAt: now } : item,
          ),
          tasks: state.tasks.map((task) =>
            task.robotId === transitOrder.robotId && task.title === linkedTaskTitle
              ? { ...task, status: 'completed', completedAt: now, detail: '已送達並完成取件確認' }
              : task,
          ),
          robots: state.robots.map((robot) =>
            robot.id === transitOrder.robotId
              ? {
                  ...robot,
                  status: '待命',
                  position: transitOrder.destination,
                  task: '等待下一個任務',
                  eta: '--',
                  phase: 'READY',
                  isRunning: false,
                }
              : robot,
          ),
          logs: addLog(state, `配送完成：${transitOrder.productName} 已送達 ${transitOrder.destination}`, 'info', now),
          lastUpdated: now,
        },
        state,
        now,
        {
          command: 'DELIVERY_DONE',
          label: `送達 ${transitOrder.productName}`,
          target: transitOrder.destination,
          source: 'delivery',
          note: `${transitOrder.robotId} 完成取件確認，回到待命狀態。`,
        },
      );
    }

    case 'SAVE_SCHEDULE': {
      const schedule = state.schedules.find((item) => item.id === action.payload.id);
      const updated = state.schedules.map((item) =>
        item.id === action.payload.id ? { ...item, time: action.payload.time, area: action.payload.area } : item,
      );

      return withRobotCommandLog(
        {
          ...state,
          schedules: updated,
          logs: addLog(
            state,
            `排程更新：${schedule?.title ?? '預約任務'} 改為 ${action.payload.time} / ${action.payload.area}`,
            'info',
            now,
          ),
          lastUpdated: now,
        },
        state,
        now,
        {
          command: schedule?.kind === 'broadcast' ? 'BROADCAST_SCHEDULE' : 'CLEAN_SCHEDULE',
          label: schedule?.title ?? '預約任務更新',
          target: `${action.payload.time} / ${action.payload.area}`,
          source: 'schedule',
          note: '排程已同步到本機展示狀態，橋接服務會嘗試送出硬體提示。',
        },
      );
    }

    case 'SET_ATTENDANCE_SCANNED':
      return withRobotCommandLog(
        {
          ...state,
          attendance: { scanned: true, present: 30, absent: 2, total: 32, absentNames: ['座號 05', '座號 12'] },
          logs: addLog(state, '教學系統：AI 場域點名完成，2 個座位待確認', 'info', now),
          lastUpdated: now,
        },
        state,
        now,
        {
          command: 'TEACH_SCAN',
          label: '課堂點名掃描',
          target: '教室視覺節點',
          source: 'teaching',
          note: '以本機資料模擬場域點名，橋接服務會送出教學掃描提示。',
        },
      );

    case 'RESOLVE_TEACHING_SIGNAL': {
      const signal = state.teachingSignals.find((item) => item.id === action.payload.signalId);
      if (!signal) return state;
      const report = state.studentReports[signal.studentId] ?? {
        studentId: signal.studentId,
        name: signal.name,
        averageFocus: 80,
        distractRate: 1.5,
        learningStyle: '待分析',
        events: [],
      };

      return withRobotCommandLog(
        {
          ...state,
          teachingSignals: state.teachingSignals.filter((item) => item.id !== signal.id),
          studentReports: {
            ...state.studentReports,
            [signal.studentId]: {
              ...report,
              events: [`${stampTime(now)} ${action.payload.action}：${signal.message}`, ...report.events].slice(0, 12),
            },
          },
          logs: addLog(state, `教學告警已處理：${signal.name} / ${action.payload.action}`, 'info', now),
          lastUpdated: now,
        },
        state,
        now,
        {
          command: signal.type === 'alert' ? 'FOCUS_NUDGE' : 'QUESTION_ACK',
          label: `${signal.name} 訊號處理`,
          target: signal.type === 'alert' ? '教室提醒模組' : '課堂提問佇列',
          source: 'teaching',
          note: action.payload.action,
        },
      );
    }

    case 'ADD_TEACHER_REPLY': {
      if (!action.payload.reply?.trim()) return state;
      const signal = state.teachingSignals.find((item) => item.id === action.payload.signalId);
      if (!signal) return state;
      const report = state.studentReports[signal.studentId];

      return withRobotCommandLog(
        {
          ...state,
          teachingSignals: state.teachingSignals.filter((item) => item.id !== signal.id),
          studentReports: {
            ...state.studentReports,
            [signal.studentId]: {
              ...report,
              events: [
                `${stampTime(now)} 教師回覆：「${action.payload.reply}」`,
                ...(report?.events ?? []),
              ].slice(0, 12),
            },
          },
          logs: addLog(state, `教學互動：已回覆 ${signal.name} 的提問`, 'info', now),
          lastUpdated: now,
        },
        state,
        now,
        {
          command: 'TEACH_REPLY',
          label: `${signal.name} 課業問答`,
          target: '教室小聲問答模組',
          source: 'teaching',
          note: action.payload.reply,
        },
      );
    }

    case 'SET_EMERGENCY':
      return withRobotCommandLog(
        {
          ...state,
          campusStatus: {
            ...state.campusStatus,
            isEmergency: action.payload.enabled,
            safetyMode: action.payload.enabled ? 'lockdown' : 'normal',
          },
          logs: addLog(
            state,
            action.payload.enabled ? '安全系統：全校安全封鎖啟動' : '安全系統：封鎖解除，恢復一般模式',
            action.payload.enabled ? 'warn' : 'info',
            now,
          ),
          lastUpdated: now,
        },
        state,
        now,
        {
          command: action.payload.enabled ? 'SAFETY_LOCKDOWN' : 'SAFETY_CLEAR',
          label: action.payload.enabled ? '全校安全封鎖' : '解除安全封鎖',
          target: '校園安全模組',
          source: 'life',
          note: action.payload.enabled ? '示範模式：門禁、廣播、巡邏同步啟動。' : '示範模式：恢復一般校園服務。',
        },
      );

    case 'SET_NOTIFICATIONS':
      return {
        ...state,
        settings: { ...state.settings, notifications: action.payload.enabled },
        logs: addLog(
          state,
          action.payload.enabled ? '系統：緊急推播已開啟' : '系統：緊急推播已關閉',
          'info',
          now,
        ),
        lastUpdated: now,
      };

    case 'SET_REMIND_WARNING':
      return withRobotCommandLog(
        {
          ...state,
          settings: { ...state.settings, remindWarning: action.payload.enabled },
          logs: addLog(
            state,
            action.payload.enabled ? '生活系統：智慧鐘聲提示已開啟' : '生活系統：智慧鐘聲提示已關閉',
            'info',
            now,
          ),
          lastUpdated: now,
        },
        state,
        now,
        {
          command: action.payload.enabled ? 'BELL_REMIND_ON' : 'BELL_REMIND_OFF',
          label: action.payload.enabled ? '開啟智慧鐘聲' : '關閉智慧鐘聲',
          target: '全校廣播節點',
          source: 'life',
          note: '下課結束前一分鐘提醒，對應作品說明書的時間管理功能。',
        },
      );

    case 'ADD_DISPATCH_TASK': {
      const sourceTitle = action.payload.taskType === 'broadcast' ? '群眾疏導' : '自動巡邏';
      const robotId = action.payload.taskType === 'broadcast' ? '3號' : '1號';
      const status: RobotStatus = action.payload.taskType === 'broadcast' ? '疏導' : '巡邏';

      return withRobotCommandLog(
        {
          ...state,
          campusStatus: { ...state.campusStatus, activeZone: action.payload.zone },
          tasks: [
            {
              id: uid('task-dispatch', now),
              title: `${sourceTitle} - 區域 ${action.payload.zone}`,
              area: `區域 ${action.payload.zone}`,
              status: 'in_progress',
              source: 'dispatch',
              robotId,
              createdAt: now,
              detail: action.payload.taskType === 'broadcast' ? '校園廣播與人流疏導' : '巡邏熱區並回傳影像',
            },
            ...state.tasks,
          ],
          robots: state.robots.map((robot) =>
            robot.id === robotId
              ? {
                  ...robot,
                  status,
                  position: `區域 ${action.payload.zone}`,
                  task: sourceTitle,
                  eta: '6 MINS',
                  phase: action.payload.taskType === 'broadcast' ? 'BROADCAST' : 'PATROL',
                  isRunning: true,
                }
              : robot,
          ),
          logs: addLog(state, `派遣中心：${robotId} 已前往區域 ${action.payload.zone} 執行${sourceTitle}`, 'info', now),
          lastUpdated: now,
        },
        state,
        now,
        {
          command: action.payload.taskType === 'broadcast' ? 'BROADCAST_START' : 'PATROL_START',
          label: `${sourceTitle} - 區域 ${action.payload.zone}`,
          target: robotId,
          source: 'dispatch',
          note: action.payload.taskType === 'broadcast' ? '疏導廣播與人流提醒。' : '巡邏熱區並回傳影像。',
        },
      );
    }

    case 'COMPLETE_DISPATCH_TASK': {
      const sourceTitle = action.payload.taskType === 'broadcast' ? '群眾疏導' : '自動巡邏';
      const robotId = action.payload.taskType === 'broadcast' ? '3號' : '1號';
      let completed = false;
      return {
        ...state,
        tasks: state.tasks.map((task) => {
          if (completed || task.source !== 'dispatch' || task.area !== `區域 ${action.payload.zone}` || task.status === 'completed') {
            return task;
          }
          completed = true;
          return {...task, status: 'completed', completedAt: now, detail: `${sourceTitle}已回報完成`};
        }),
        robots: state.robots.map((robot) =>
          robot.id === robotId
            ? {...robot, status: '待命', task: '回到待命點', eta: '完成', phase: 'READY', isRunning: false}
            : robot,
        ),
        logs: addLog(state, `派遣中心：區域 ${action.payload.zone} ${sourceTitle}已完成`, 'info', now),
        lastUpdated: now,
      };
    }

    case 'SET_ROBOT_RUNNING':
      return withRobotCommandLog(
        {
          ...state,
          robots: state.robots.map((robot) =>
            robot.id === action.payload.robotId ? { ...robot, isRunning: action.payload.running } : robot,
          ),
          logs: addLog(
            state,
            `${action.payload.robotId} ${action.payload.running ? '恢復執行' : '暫停執行'}`,
            'info',
            now,
          ),
          lastUpdated: now,
        },
        state,
        now,
        {
          command: action.payload.running ? 'ROBOT_RESUME' : 'ROBOT_PAUSE',
          label: action.payload.running ? '恢復任務' : '暫停任務',
          target: action.payload.robotId,
          source: 'system',
          note: '中控台任務控制，橋接服務會嘗試同步到 UNO R4。',
        },
      );

    case 'SET_ROBOT_SPEED':
      return withRobotCommandLog(
        {
          ...state,
          robots: state.robots.map((robot) =>
            robot.id === action.payload.robotId ? { ...robot, speed: action.payload.speed } : robot,
          ),
          logs: addLog(state, `${action.payload.robotId} 巡航速度設定為 ${action.payload.speed.toFixed(1)} m/s`, 'info', now),
          lastUpdated: now,
        },
        state,
        now,
        {
          command: 'SPEED_SET',
          label: `速度 ${action.payload.speed.toFixed(1)} m/s`,
          target: action.payload.robotId,
          source: 'system',
          note: '本機只校準展示速度，實機需轉換成馬達 PWM 或速度控制參數。',
        },
      );

    case 'TICK_SENSORS':
      return {
        ...state,
        sensors: action.payload,
        lastUpdated: now,
      };

    case 'CLEAR_LOCAL_CACHE':
      return {
        ...state,
        logs: addLog(state, '系統：已清除本地緩存標記並保留展示資料', 'info', now),
        lastUpdated: now,
      };

    case 'MARK_HARDWARE_COMMAND':
      return {
        ...state,
        hardwareMode: action.payload.ok ? 'serial-ready' : state.hardwareMode,
        robotCommandLogs: state.robotCommandLogs.map((log) =>
          log.id === action.payload.id
            ? {
                ...log,
                mode: action.payload.ok ? 'serial-ready' : log.mode,
                status: action.payload.ok ? 'sent' : 'failed',
                note: action.payload.message,
              }
            : log,
        ),
        logs: addLog(
          state,
            action.payload.ok ? `Arduino：${action.payload.message}` : `Arduino 示範紀錄：${action.payload.message}`,
          action.payload.ok ? 'info' : 'warn',
          now,
        ),
        lastUpdated: now,
      };

    case 'RESTORE_DEMO_STATE':
      return {
        ...action.payload.state,
        lastUpdated: now,
        logs: addLog(action.payload.state, '系統：已匯入展示資料並完成安全修復', 'info', now),
      };

    case 'RESET_DEMO':
      return {
        ...createInitialAppState(),
        lastUpdated: now,
        logs: addLog(createInitialAppState(), '系統：展示資料已重置', 'info', now),
      };

    default:
      return state;
  }
}

export function loadPersistedState(): AppState {
  if (typeof window === 'undefined') return createInitialAppState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialAppState();
    const normalized = normalizePersistedState(JSON.parse(raw));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  } catch {
    const initial = createInitialAppState();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }
}

export function persistState(state: AppState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    if (error instanceof DOMException && (error.code === 22 || error.name === 'QuotaExceededError')) {
      try {
        const trimmed = {...state, logs: state.logs.slice(0, 30), robotCommandLogs: state.robotCommandLogs.slice(0, 30)};
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      } catch {
        // give up gracefully — in-memory state is still correct
      }
    }
  }
}

export function normalizePersistedState(input: unknown): AppState {
  const fallback = createInitialAppState();
  if (!input || typeof input !== 'object') return fallback;

  const parsed = input as Partial<AppState>;
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;
  const text = (value: unknown, fallbackText: string) =>
    typeof value === 'string' && value.trim() ? value : fallbackText;
  const number = (value: unknown, fallbackNumber: number, min = 0, max = 10000) =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallbackNumber;
  const bool = (value: unknown, fallbackBoolean: boolean) =>
    typeof value === 'boolean' ? value : fallbackBoolean;
  const normalizeList = <T>(value: unknown, fallbackItems: T[], normalize: (item: unknown, fallbackItem: T, index: number) => T | null) => {
    if (!Array.isArray(value) || fallbackItems.length === 0) return fallbackItems;
    const items = value
      .map((item, index) => normalize(item, fallbackItems[index % fallbackItems.length], index))
      .filter((item): item is T => Boolean(item));
    return items.length > 0 ? items : fallbackItems;
  };

  return {
    ...fallback,
    ...parsed,
    robots: normalizeList(parsed.robots, fallback.robots, (item, robot) => {
      if (!isRecord(item)) return null;
      return {
        ...robot,
        id: text(item.id, robot.id),
        serial: text(item.serial, robot.serial),
        status: ['待命', '充電', '導診', '清掃', '配送', '巡邏', '疏導'].includes(String(item.status)) ? item.status as RobotStatus : robot.status,
        position: text(item.position, robot.position),
        battery: number(item.battery, robot.battery, 0, 100),
        task: text(item.task, robot.task),
        eta: text(item.eta, robot.eta),
        phase: text(item.phase, robot.phase),
        isRunning: bool(item.isRunning, robot.isRunning),
        speed: number(item.speed, robot.speed, 0, 5),
      };
    }),
    products: normalizeList(parsed.products, fallback.products, (item, product) => {
      if (!isRecord(item)) return null;
      return {
        ...product,
        id: number(item.id, product.id),
        name: text(item.name, product.name),
        price: number(item.price, product.price, 0, 9999),
        desc: text(item.desc, product.desc),
        img: text(item.img, product.img),
        category: item.category === 'snacks' || item.category === 'stationery' || item.category === 'drinks' ? item.category : product.category,
        stock: number(item.stock, product.stock, 0, 999),
      };
    }),
    orders: Array.isArray(parsed.orders)
      ? parsed.orders
          .map((item, index): Order | null => {
            if (!isRecord(item)) return null;
            const order: Order = fallback.orders[index % Math.max(1, fallback.orders.length)] ?? {
              id: `recovered-order-${index + 1}`,
              productId: fallback.products[0].id,
              productName: fallback.products[0].name,
              quantity: 1,
              destination: '總務處',
              status: 'in_transit',
              robotId: fallback.robots[0].id,
              createdAt: fallback.lastUpdated,
            };
            return {
              ...order,
              id: text(item.id, order.id),
              productId: number(item.productId, order.productId),
              productName: text(item.productName, order.productName),
              quantity: number(item.quantity, order.quantity, 1, 99),
              destination: text(item.destination, order.destination),
              status: item.status === 'delivered' || item.status === 'in_transit' ? item.status : order.status,
              robotId: text(item.robotId, order.robotId),
              createdAt: text(item.createdAt, order.createdAt),
              deliveredAt: typeof item.deliveredAt === 'string' ? item.deliveredAt : order.deliveredAt,
            };
          })
          .filter((order): order is Order => Boolean(order))
      : fallback.orders,
    tasks: normalizeList(parsed.tasks, fallback.tasks, (item, task) => {
      if (!isRecord(item)) return null;
      return {
        ...task,
        id: text(item.id, task.id),
        title: text(item.title, task.title),
        area: text(item.area, task.area),
        status: item.status === 'pending' || item.status === 'in_progress' || item.status === 'completed' ? item.status : task.status,
        source: ['delivery', 'schedule', 'dispatch', 'teaching', 'life'].includes(String(item.source)) ? item.source as TaskSource : task.source,
        robotId: typeof item.robotId === 'string' ? item.robotId : task.robotId,
        createdAt: text(item.createdAt, task.createdAt),
        completedAt: typeof item.completedAt === 'string' ? item.completedAt : task.completedAt,
        detail: typeof item.detail === 'string' ? item.detail : task.detail,
      };
    }),
    schedules: normalizeList(parsed.schedules, fallback.schedules, (item, schedule) => {
      if (!isRecord(item)) return null;
      return {
        ...schedule,
        id: text(item.id, schedule.id),
        title: text(item.title, schedule.title),
        time: text(item.time, schedule.time),
        area: text(item.area, schedule.area),
        kind: item.kind === 'cleaning' || item.kind === 'broadcast' ? item.kind : schedule.kind,
      };
    }),
    teachingSignals: normalizeList(parsed.teachingSignals, fallback.teachingSignals, (item, signal) => {
      if (!isRecord(item)) return null;
      return {
        ...signal,
        id: text(item.id, signal.id),
        type: item.type === 'question' || item.type === 'alert' ? item.type : signal.type,
        name: text(item.name, signal.name),
        studentId: text(item.studentId, signal.studentId),
        message: text(item.message, signal.message),
        createdAt: text(item.createdAt, signal.createdAt),
      };
    }),
    studentReports: parsed.studentReports && typeof parsed.studentReports === 'object' ? parsed.studentReports : fallback.studentReports,
    attendance: isRecord(parsed.attendance) ? {
      scanned: bool(parsed.attendance.scanned, fallback.attendance.scanned),
      present: number(parsed.attendance.present, fallback.attendance.present, 0, 999),
      absent: number(parsed.attendance.absent, fallback.attendance.absent, 0, 999),
      total: number(parsed.attendance.total, fallback.attendance.total, 0, 999),
      absentNames: Array.isArray(parsed.attendance.absentNames) ? parsed.attendance.absentNames.filter((name): name is string => typeof name === 'string') : fallback.attendance.absentNames,
    } : fallback.attendance,
    sensors: isRecord(parsed.sensors) ? {
      temp: number(parsed.sensors.temp, fallback.sensors.temp, -20, 80),
      hum: number(parsed.sensors.hum, fallback.sensors.hum, 0, 100),
      aqi: number(parsed.sensors.aqi, fallback.sensors.aqi, 0, 500),
    } : fallback.sensors,
    settings: isRecord(parsed.settings) ? {
      notifications: bool(parsed.settings.notifications, fallback.settings.notifications),
      remindWarning: bool(parsed.settings.remindWarning, fallback.settings.remindWarning),
    } : fallback.settings,
    campusStatus: isRecord(parsed.campusStatus) ? {
      isEmergency: bool(parsed.campusStatus.isEmergency, fallback.campusStatus.isEmergency),
      safetyMode: parsed.campusStatus.safetyMode === 'lockdown' ? 'lockdown' : 'normal',
      activeZone: typeof parsed.campusStatus.activeZone === 'string' ? parsed.campusStatus.activeZone : fallback.campusStatus.activeZone,
    } : fallback.campusStatus,
    hardwareMode: parsed.hardwareMode === 'serial-ready' ? 'serial-ready' : 'demo',
    robotCommandLogs: normalizeList(parsed.robotCommandLogs, fallback.robotCommandLogs, (item, log) => {
      if (!isRecord(item)) return null;
      return {
        ...log,
        id: text(item.id, log.id),
        time: text(item.time, log.time),
        command: text(item.command, log.command),
        label: text(item.label, log.label),
        target: text(item.target, log.target),
        source: ['delivery', 'schedule', 'dispatch', 'teaching', 'life', 'system'].includes(String(item.source)) ? item.source as RobotCommandLog['source'] : log.source,
        mode: item.mode === 'serial-ready' ? 'serial-ready' : 'demo',
        status: item.status === 'queued' || item.status === 'sent' || item.status === 'failed' ? item.status : 'demo-only',
        note: text(item.note, log.note),
      };
    }),
    logs: normalizeList(parsed.logs, fallback.logs, (item, log) => {
      if (!isRecord(item)) return null;
      return {
        id: text(item.id, log.id),
        time: text(item.time, log.time),
        message: text(item.message, log.message),
        type: item.type === 'warn' || item.type === 'error' || item.type === 'info' ? item.type : log.type,
      };
    }),
    lastUpdated: typeof parsed.lastUpdated === 'string' ? parsed.lastUpdated : fallback.lastUpdated,
  };
}
