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
  const [notice, setNotice] = useState('正在同步本機 bridge...');
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
      setNotice(nextHealth.geminiConfigured ? 'Gemini 已在 bridge 端就緒' : 'Gemini Key 未設定，正在使用本機 fallback');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '無法同步本機 bridge');
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
