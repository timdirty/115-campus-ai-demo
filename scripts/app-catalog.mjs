import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const pagesDir = path.join(rootDir, 'pages-dist');
export const sharedBridgePort = 3200;

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
    devName: 'App1-Web',
    devColor: 'green',
    pagePhrases: ['AI', '白板'],
    guidePhrases: ['AI 自動板擦機器人', '後續機器人連動計畫', '公開展示網址'],
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
    devName: 'App2',
    devColor: 'blue',
    pagePhrases: ['校園', '服務'],
    guidePhrases: ['校園服務機器人', '後續機器人連動計畫', '公開展示網址'],
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
    desc: '匿名關懷、預警處理、自我照護、聊天與節點監控。',
    accent: '#0f766e',
    flow: ['看總覽', '處理提醒', '自我照護'],
    devPort: 11503,
    devName: 'App3',
    devColor: 'magenta',
    pagePhrases: ['校園', '心靈'],
    guidePhrases: ['AI 校園心靈守護者', '後續機器人連動計畫', '公開展示網址'],
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

export function appUrl(app) {
  return `${app.id}/`;
}

export function guideUrl(app) {
  return `${app.id}-guide.html`;
}

export function allPublishedRoutes() {
  return [
    '/',
    ...apps.map((app) => `/${appUrl(app)}`),
    ...apps.map((app) => `/${guideUrl(app)}`),
  ];
}
