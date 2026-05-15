import {memo, useEffect, useState} from 'react';
import type React from 'react';
import type {HardwareSocketStatus} from '../hooks/useHardwareSocket';

const TOAST_BASE: React.CSSProperties = {
  position: 'fixed',
  bottom: 80,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 100,
  color: '#fff',
  borderRadius: 12,
  padding: '8px 16px',
  fontSize: 14,
  fontWeight: 600,
  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  transition: 'opacity 0.3s ease',
};

interface Props {
  lastCommandAck: HardwareSocketStatus['lastCommandAck'];
}

function getStudentMessage(ok: boolean, command: string) {
  if (!ok) return '任務已記錄，展示繼續進行';
  if (/STOP|EMERGENCY/.test(command)) return '機器人已停止';
  if (/SWEEP|CLEAN/.test(command)) return '清潔任務已送出';
  if (/DELIVERY|ROUTE|PACKAGE/.test(command)) return '配送任務已送出';
  if (/BROADCAST/.test(command)) return '廣播任務已送出';
  if (/PATROL|SAFETY/.test(command)) return '巡邏任務已送出';
  return '任務已送出';
}

export const CommandFeedbackToast = memo(function CommandFeedbackToast({lastCommandAck}: Props) {
  const [visible, setVisible] = useState(false);
  const [info, setInfo] = useState<{command: string; ok: boolean} | null>(null);

  useEffect(() => {
    if (!lastCommandAck) return;
    setInfo({command: lastCommandAck.command, ok: lastCommandAck.ok});
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 2000);
    return () => clearTimeout(t);
  }, [lastCommandAck?.ts]);

  if (!visible || !info) return null;

  return (
    <div
      aria-live="polite"
      style={{...TOAST_BASE, backgroundColor: info.ok ? '#166534' : '#92400e', opacity: visible ? 1 : 0}}
    >
      {info.ok ? '✓' : '•'} {getStudentMessage(info.ok, info.command)}
    </div>
  );
});
