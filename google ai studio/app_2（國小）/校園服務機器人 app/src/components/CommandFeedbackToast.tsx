import {useEffect, useState} from 'react';
import type {HardwareSocketStatus} from '../hooks/useHardwareSocket';

interface Props {
  lastCommandAck: HardwareSocketStatus['lastCommandAck'];
}

export function CommandFeedbackToast({lastCommandAck}: Props) {
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
      style={{
        position: 'fixed',
        bottom: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        backgroundColor: info.ok ? '#166534' : '#7f1d1d',
        color: '#fff',
        borderRadius: 12,
        padding: '8px 16px',
        fontSize: 14,
        fontWeight: 600,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }}
    >
      {info.ok ? '✓' : '✗'} {info.command}
    </div>
  );
}
