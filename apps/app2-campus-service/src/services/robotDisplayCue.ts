import type {AppState, RobotCommandLog, TaskSource} from '../state/appState';

export type RobotDisplayEmotion =
  | 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised'
  | 'love' | 'sleepy' | 'cool' | 'thinking' | 'wink' | 'excited' | 'crying';

export interface RobotDisplayCue {
  emotion: RobotDisplayEmotion;
  mission: string;
  status: string;
  message: string;
  source: TaskSource | 'system';
  command?: string;
}

const sourceMission: Record<TaskSource | 'system', string> = {
  delivery: '配送服務',
  schedule: '生活排程',
  dispatch: '校園派遣',
  teaching: '教學協助',
  life: '生活服務',
  system: '展示待命',
};

function cleanText(input: string | undefined, fallback: string, maxLength: number) {
  const value = (input ?? '').replace(/\s+/g, ' ').trim();
  return (value || fallback).slice(0, maxLength);
}

function cueFromCommand(command: RobotCommandLog): RobotDisplayCue {
  const commandText = command.command.toUpperCase();
  const base = {
    source: command.source,
    command: command.command,
    status: cleanText(command.label, '任務更新', 28),
  };

  if (command.source === 'delivery') {
    if (commandText.includes('DONE')) {
      return {
        ...base,
        emotion: 'love',
        mission: '配送完成',
        message: `我已經把${cleanText(command.label.replace(/^送達\s*/, ''), '物品', 12)}送到${cleanText(command.target, '教室', 12)}，紀錄也完成了。`,
      };
    }
    return {
      ...base,
      emotion: 'happy',
      mission: '配送服務',
      message: `我正在前往${cleanText(command.target, '教室', 12)}，幫大家把物品送到。`,
    };
  }

  if (command.source === 'teaching') {
    return {
      ...base,
      emotion: commandText.includes('NUDGE') ? 'thinking' : 'happy',
      mission: '教學協助',
      message: commandText.includes('NUDGE')
        ? '我收到課堂提醒，會用溫和的方式協助同學回到學習。'
        : '我完成點名了，老師可以接著看課堂紀錄。',
    };
  }

  if (command.source === 'dispatch') {
    if (commandText.includes('CROWD') || commandText.includes('BROADCAST')) {
      return {
        ...base,
        emotion: 'excited',
        mission: '人流疏導',
        message: '我發現人比較多，現在用廣播提醒大家慢慢走。',
      };
    }
    if (commandText.includes('SAFETY')) {
      return {
        ...base,
        emotion: 'surprised',
        mission: '安全巡查',
        message: '我收到安全巡查任務，會前往現場確認狀況。',
      };
    }
    if (commandText.includes('CLEAN')) {
      return {
        ...base,
        emotion: 'thinking',
        mission: '清掃巡邏',
        message: '我看到地面需要整理，已加入清掃巡邏路線。',
      };
    }
    if (commandText.includes('DELIVERY')) {
      return {
        ...base,
        emotion: 'happy',
        mission: '配送服務',
        message: '我收到配送需求，會把任務送進服務流程。',
      };
    }
    return {
      ...base,
      emotion: 'cool',
      mission: '一般巡邏',
      message: '目前沒有緊急狀況，我會繼續巡邏並留下紀錄。',
    };
  }

  if (command.source === 'life' || command.source === 'schedule') {
    if (commandText.includes('LOCKDOWN')) {
      return {
        ...base,
        emotion: 'surprised',
        mission: '全校安全',
        message: '我收到安全提醒，請大家聽老師指示並保持冷靜。',
      };
    }
    if (commandText.includes('UNLOCK')) {
      return {
        ...base,
        emotion: 'happy',
        mission: '安全解除',
        message: '安全狀態已解除，我回到一般校園服務。',
      };
    }
    return {
      ...base,
      emotion: 'thinking',
      mission: sourceMission[command.source],
      message: '我已經收到生活服務任務，會把結果留在展示紀錄。',
    };
  }

  return {
    ...base,
    emotion: 'neutral',
    mission: sourceMission[command.source] ?? '展示待命',
    message: '我已經準備好，等學生按下一個展示步驟。',
  };
}

export function buildRobotDisplayCue(state: AppState): RobotDisplayCue {
  if (state.campusStatus.isEmergency) {
    return {
      emotion: 'surprised',
      mission: '全校安全',
      status: state.campusStatus.activeZone ? `${state.campusStatus.activeZone} 管制中` : '管制中',
      message: '我收到全校安全提醒，請大家聽老師指示並保持冷靜。',
      source: 'life',
      command: 'SAFETY_LOCKDOWN',
    };
  }

  const latestCommand = state.robotCommandLogs.find((command) => command.command !== 'SYSTEM_READY');
  if (latestCommand) return cueFromCommand(latestCommand);

  if (state.attendance.scanned) {
    return {
      emotion: 'happy',
      mission: '教學協助',
      status: '點名完成',
      message: '點名完成了，老師可以開始看課堂互動紀錄。',
      source: 'teaching',
      command: 'TEACH_SCAN',
    };
  }

  return {
    emotion: 'neutral',
    mission: '展示待命',
    status: '等待學生操作',
    message: '我準備好了，請從開始、教學、配送、生活照順序展示。',
    source: 'system',
    command: 'SYSTEM_READY',
  };
}

export function robotDisplayCueSignature(cue: RobotDisplayCue) {
  return [cue.emotion, cue.mission, cue.status, cue.message, cue.source, cue.command ?? ''].join('|');
}
