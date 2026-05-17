import {useCallback, useEffect, useState} from 'react';
import {
  BridgeHealth,
  ClassroomSession,
  loadBridgeHealth,
  loadClassroomSession,
} from '../services/classroomApi';
import {loadNotesAsync, WhiteboardNote} from '../services/notesStore';

export function useBridgeStatus() {
  const [health, setHealth] = useState<BridgeHealth | null>(null);
  const [classroom, setClassroom] = useState<ClassroomSession | null>(null);
  const [latestNote, setLatestNote] = useState<WhiteboardNote | null>(null);
  const [notice, setNotice] = useState('正在準備展示流程...');
  const [statusBusy, setStatusBusy] = useState(false);

  const refreshStatus = useCallback(async () => {
    setStatusBusy(true);
    try {
      const [nextHealth, nextClassroom, notes] = await Promise.all([
        loadBridgeHealth(),
        loadClassroomSession(),
        loadNotesAsync(),
      ]);
      setHealth(nextHealth);
      setClassroom(nextClassroom);
      setLatestNote(notes[0] ?? null);
      setNotice(nextHealth.hardwareSimulation
        ? '示範模式：所有功能均可完整體驗，機器人任務會留下紀錄'
        : nextHealth.geminiConfigured ? 'AI 助教已就緒，按「一鍵示範」開始流程' : '示範模式：AI 助教已啟動，可以完整走完示範流程');
    } catch (error) {
      setNotice('示範模式：所有功能均可完整體驗');
    } finally {
      setStatusBusy(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  return {
    health,
    classroom,
    latestNote,
    notice,
    statusBusy,
    refreshStatus,
    setClassroom,
    setLatestNote,
    setNotice,
  };
}
