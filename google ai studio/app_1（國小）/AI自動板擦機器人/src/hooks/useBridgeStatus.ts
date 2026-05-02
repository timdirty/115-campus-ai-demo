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
  const [notice, setNotice] = useState('正在同步本機硬體狀態...');
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
      setNotice(nextHealth.geminiConfigured ? 'Gemini 已在本機橋接端就緒' : 'Gemini Key 未設定，正在使用本機示範分析');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '無法同步本機硬體狀態');
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
