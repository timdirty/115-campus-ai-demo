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

function displayCommand(command: string) {
  if (command.includes('ERASE_REGION')) return `擦除 ${command.slice(-1)} 區`;
  if (command.includes('KEEP_REGION')) return `保留 ${command.slice(-1)} 區`;
  if (command === 'ERASE_ALL') return '全板擦除';
  if (command === 'CLEAN_START') return '開始清潔';
  if (command === 'CLEAN_STOP') return '清潔完成';
  if (command === 'PAUSE_TASK') return '暫停等待';
  if (command === 'FIREWORK') return '成功動畫';
  if (command === 'STOP') return '停止任務';
  if (command.includes('SERVO')) return '板擦角度調整';
  if (command.includes('LED')) return command.includes('ON') ? '提示燈開啟' : '提示燈關閉';
  return '任務已更新';
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
      style={{...TOAST_BASE, backgroundColor: info.ok ? '#166534' : '#7f1d1d', opacity: visible ? 1 : 0}}
    >
      {info.ok ? '✓' : '✗'} {displayCommand(info.command)}
    </div>
  );
});
