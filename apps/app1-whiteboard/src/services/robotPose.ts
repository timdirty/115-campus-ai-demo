import type {BoardRegion} from './classroomApi';
import type {BoardCalibration} from './whiteboardCalibration';
import {calibrationBounds} from './whiteboardCalibration';

export type RobotPoseStage = 'standby' | 'preview' | 'moving' | 'erasing' | 'paused' | 'done';

export type RobotPoseEstimate = {
  x: number;
  y: number;
  heading: number;
  stage: RobotPoseStage;
  label: string;
  targetRegion?: string;
  command: string;
  updatedAt: string;
};

type ServoAngles = {
  regionA: number;
  regionB: number;
  eraseAll: number;
  standby: number;
};

type PoseContext = {
  boardRegions: BoardRegion[];
  boardCalibration: BoardCalibration;
  servoAngles: ServoAngles;
  previousPose?: RobotPoseEstimate;
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value * 10) / 10));

export function defaultRobotPose(): RobotPoseEstimate {
  return {
    x: 94,
    y: 14,
    heading: 180,
    stage: 'standby',
    label: '待命位置',
    command: 'SET_STANDBY',
    updatedAt: '',
  };
}

function standbyPoint(boardCalibration: BoardCalibration) {
  const board = calibrationBounds(boardCalibration);
  return {
    x: clampPercent(Math.min(96, board.x + board.width + 4)),
    y: clampPercent(Math.max(6, board.y - 2)),
  };
}

function boardCenter(boardCalibration: BoardCalibration) {
  const board = calibrationBounds(boardCalibration);
  return {
    x: clampPercent(board.x + board.width / 2),
    y: clampPercent(board.y + board.height / 2),
  };
}

function regionCenter(region: BoardRegion) {
  return {
    x: clampPercent(region.x + region.width / 2),
    y: clampPercent(region.y + region.height / 2),
  };
}

function findRegion(boardRegions: BoardRegion[], regionId?: string) {
  return regionId ? boardRegions.find((region) => region.id === regionId) : undefined;
}

function nearestServoTarget(angle: number, servoAngles: ServoAngles) {
  const targets = [
    {label: '左區', regionId: 'A', angle: servoAngles.regionA},
    {label: '右區', regionId: 'B', angle: servoAngles.regionB},
    {label: '全板', regionId: 'ALL', angle: servoAngles.eraseAll},
    {label: '待命位置', regionId: undefined, angle: servoAngles.standby},
  ];
  return targets.reduce((best, current) => (
    Math.abs(current.angle - angle) < Math.abs(best.angle - angle) ? current : best
  ));
}

export function estimateRobotPose(command: string, context: PoseContext): RobotPoseEstimate {
  const now = new Date().toISOString();
  const normalized = command.trim().toUpperCase();
  const standby = standbyPoint(context.boardCalibration);
  const center = boardCenter(context.boardCalibration);
  const previous = context.previousPose ?? defaultRobotPose();

  const regionCommand = normalized.match(/^(ERASE|KEEP)_REGION_([AB])$/);
  if (regionCommand) {
    const region = findRegion(context.boardRegions, regionCommand[2]);
    const point = region ? regionCenter(region) : previous;
    return {
      x: point.x,
      y: point.y,
      heading: 180,
      stage: regionCommand[1] === 'ERASE' ? 'erasing' : 'moving',
      label: `${regionCommand[1] === 'ERASE' ? '擦除' : '保留'}${regionCommand[2] === 'A' ? '左區' : '右區'}`,
      targetRegion: regionCommand[2],
      command: normalized,
      updatedAt: now,
    };
  }

  if (normalized === 'ERASE_ALL') {
    return {
      x: center.x,
      y: center.y,
      heading: 180,
      stage: 'erasing',
      label: '全板擦除',
      targetRegion: 'ALL',
      command: normalized,
      updatedAt: now,
    };
  }

  if (normalized === 'PAUSE_TASK' || normalized === 'STOP') {
    return {
      ...previous,
      x: previous.x || standby.x,
      y: previous.y || standby.y,
      stage: 'paused',
      label: normalized === 'STOP' ? '緊急停止' : '暫停等待',
      command: normalized,
      updatedAt: now,
    };
  }

  if (normalized === 'CLEAN_STOP' || normalized === 'SET_STANDBY') {
    return {
      x: standby.x,
      y: standby.y,
      heading: 180,
      stage: 'standby',
      label: '待命位置',
      command: normalized,
      updatedAt: now,
    };
  }

  const namedSetup = normalized.match(/^SET_REGION_([AB])$/);
  if (namedSetup) {
    const region = findRegion(context.boardRegions, namedSetup[1]);
    const point = region ? regionCenter(region) : center;
    return {
      x: point.x,
      y: point.y,
      heading: 180,
      stage: 'preview',
      label: `預覽區塊 ${namedSetup[1]}`,
      targetRegion: namedSetup[1],
      command: normalized,
      updatedAt: now,
    };
  }

  if (normalized === 'SET_ERASE_ALL') {
    return {
      x: center.x,
      y: center.y,
      heading: 180,
      stage: 'preview',
      label: '預覽全板',
      targetRegion: 'ALL',
      command: normalized,
      updatedAt: now,
    };
  }

  const servoSet = normalized.match(/^SERVO_SET:(\d{1,3})$/);
  if (servoSet) {
    const angle = Number(servoSet[1]);
    const nearest = nearestServoTarget(angle, context.servoAngles);
    if (nearest.regionId === 'ALL') {
      return {
        x: center.x,
        y: center.y,
        heading: 180,
        stage: 'preview',
        label: `伺服預覽 ${nearest.label}`,
        targetRegion: 'ALL',
        command: normalized,
        updatedAt: now,
      };
    }
    if (nearest.regionId) {
      const region = findRegion(context.boardRegions, nearest.regionId);
      const point = region ? regionCenter(region) : center;
      return {
        x: point.x,
        y: point.y,
        heading: 180,
        stage: 'preview',
        label: `伺服預覽 ${nearest.label}`,
        targetRegion: nearest.regionId,
        command: normalized,
        updatedAt: now,
      };
    }
    return {
      x: standby.x,
      y: standby.y,
      heading: 180,
      stage: 'preview',
      label: '伺服預覽待命位置',
      command: normalized,
      updatedAt: now,
    };
  }

  if (normalized === 'CLEAN_START') {
    return {
      x: standby.x,
      y: standby.y,
      heading: 180,
      stage: 'moving',
      label: '清潔任務啟動',
      command: normalized,
      updatedAt: now,
    };
  }

  return {
    ...previous,
    stage: 'done',
    label: previous.label || '機器人狀態更新',
    command: normalized,
    updatedAt: now,
  };
}
