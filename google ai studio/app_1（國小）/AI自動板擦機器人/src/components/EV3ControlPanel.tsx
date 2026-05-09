import {useEffect, useState} from 'react';
import {Loader2, Wifi, WifiOff, Zap} from 'lucide-react';

type Ev3Status = {
  connected: boolean;
  lastCommand: string;
  lastResponse: string;
};

const EV3_BUTTONS: {label: string; command: string; className?: string}[] = [
  {label: '筆落下', command: 'EV3_PEN_DOWN'},
  {label: '筆抬起', command: 'EV3_PEN_UP'},
  {label: '臂延伸', command: 'EV3_ARM_EXTEND'},
  {label: '臂收回', command: 'EV3_ARM_RETRACT'},
  {label: '畫一條線', command: 'EV3_DRAW_LINE'},
  {label: '歸位', command: 'EV3_HOME'},
  {label: '校準', command: 'EV3_CALIBRATE'},
  {label: '安全姿態', command: 'EV3_SAFE_POSE'},
  {label: '取消序列', command: 'EV3_CANCEL'},
  {label: '自我測試', command: 'EV3_TEST'},
  {label: 'EV3 停止', command: 'EV3_STOP', className: 'rounded-lg bg-red-500 px-2 py-2 text-xs font-medium text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40'},
];

export default function EV3ControlPanel() {
  const [status, setStatus] = useState<Ev3Status>({connected: false, lastCommand: '', lastResponse: ''});
  const [busy, setBusy] = useState(false);
  const [activeCmd, setActiveCmd] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch('/api/ev3/status', {signal: AbortSignal.timeout(2000)});
        if (res.ok && !cancelled) setStatus(await res.json());
      } catch { /* ignore */ }
    };
    void poll();
    const timer = setInterval(poll, 3000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  const sendCmd = async (command: string) => {
    if (busy) return;
    setBusy(true);
    setActiveCmd(command);
    try {
      await fetch('/api/ev3/command', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({command}),
        signal: AbortSignal.timeout(8000),
      });
    } catch { /* ignore — status banner shows bridge state */ } finally {
      setBusy(false);
      setActiveCmd(null);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">EV3 筆臂控制</h3>
        <div className="flex items-center gap-1.5 text-xs">
          {status.connected
            ? <><Wifi className="h-3.5 w-3.5 text-green-500" /><span className="text-green-600">已連線</span></>
            : <><WifiOff className="h-3.5 w-3.5 text-gray-400" /><span className="text-gray-400">尋找中...</span></>
          }
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {EV3_BUTTONS.map(({label, command, className}) => (
          <button
            key={command}
            onClick={() => void sendCmd(command)}
            disabled={busy || !status.connected}
            className={className ?? 'rounded-lg border border-gray-200 bg-gray-50 px-2 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40'}
          >
            {activeCmd === command
              ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" />
              : label
            }
          </button>
        ))}
      </div>

      {status.lastCommand && (
        <div className="mt-3 flex items-start gap-1.5 text-xs text-gray-400">
          <Zap className="mt-0.5 h-3 w-3 flex-shrink-0" />
          <span>{status.lastCommand}: {status.lastResponse}</span>
        </div>
      )}
    </div>
  );
}
