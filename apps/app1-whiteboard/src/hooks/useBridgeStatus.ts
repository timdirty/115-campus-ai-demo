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
        ? '展示模式已就緒，機器人任務會留下完成紀錄'
        : nextHealth.geminiConfigured ? 'AI 助教已就緒，可以開始示範' : 'AI 助教已切到展示模式，可以完整走完流程');
    } catch (error) {
      setNotice('展示模式已就緒，可以完整走完流程');
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
