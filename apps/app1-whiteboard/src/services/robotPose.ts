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

type PoseContext = {
  boardRegions: BoardRegion[];
  boardCalibration: BoardCalibration;
  previousPose?: RobotPoseEstimate;
  [legacyKey: string]: any;
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value * 10) / 10));

export function defaultRobotPose(): RobotPoseEstimate {
  return {
    x: 94,
    y: 14,
    heading: 180,
    stage: 'standby',
    label: '待命位置',
    command: 'STANDBY',
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

  if (normalized === 'CLEAN_STOP') {
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
