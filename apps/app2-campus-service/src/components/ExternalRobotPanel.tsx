// 校園掃地機器人輔助控制面板 (App 2 — UNO R4 + L293D + TT Motor)
// 以折疊卡片形式嵌入 RemoteControlPanel BottomSheet。
// 送指令走主 bridge /api/robot/command。

import {memo, useEffect, useState} from 'react';
import {Bot, ChevronDown, ChevronUp, Navigation2, PackageCheck, TriangleAlert, Waves} from 'lucide-react';
import {BRIDGE_URL} from '../services/hardwareBridge';

interface BridgeHealth {
  ok: boolean;
  arduinoConnected: boolean;
  simulated?: boolean;
  activePath?: string | null;
}

const ROBOT_COMMANDS = [
  {label: '前進', cmd: 'FORWARD',        icon: '↑', group: 'drive'},
  {label: '後退', cmd: 'BACKWARD',       icon: '↓', group: 'drive'},
  {label: '左轉', cmd: 'LEFT',           icon: '←', group: 'drive'},
  {label: '右轉', cmd: 'RIGHT',          icon: '→', group: 'drive'},
  {label: '停止', cmd: 'STOP',           icon: '■', group: 'stop'},
  {label: '滾筒開', cmd: 'SWEEP_START',  icon: '🌀', group: 'sweep'},
  {label: '滾筒停', cmd: 'SWEEP_STOP',   icon: '⏹', group: 'sweep'},
  {label: '配送開始', cmd: 'DELIVERY_START', icon: '📦', group: 'task'},
  {label: '配送完成', cmd: 'DELIVERY_DONE',  icon: '✅', group: 'task'},
  {label: '巡邏', cmd: 'PATROL_START',   icon: '👁', group: 'task'},
] as const;

async function sendCmd(command: string): Promise<boolean> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 3000);
  try {
    const res = await fetch(`${BRIDGE_URL}/api/robot/command`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({command, source: 'ExternalRobotPanel'}),
      signal: ctrl.signal,
    });
    const data = await res.json() as {ok: boolean};
    return data.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

async function fetchHealth(): Promise<BridgeHealth | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 2000);
  try {
    const res = await fetch(`${BRIDGE_URL}/api/health`, {signal: ctrl.signal});
    if (!res.ok) return null;
    return res.json() as Promise<BridgeHealth>;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export const ExternalRobotPanel = memo(function ExternalRobotPanel() {
  const [expanded, setExpanded] = useState(false);
  const [health, setHealth] = useState<BridgeHealth | null>(null);
  const [lastResult, setLastResult] = useState<string>('待機中');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    const poll = async () => {
      const h = await fetchHealth();
      if (!cancelled) setHealth(h);
    };
    void poll();
    const id = setInterval(poll, 4000);
    return () => { cancelled = true; clearInterval(id); };
  }, [expanded]);

  const handleCmd = async (cmd: string) => {
    if (busy) return;
    setBusy(cmd);
    const ok = await sendCmd(cmd);
    setLastResult(ok ? `✓ ${cmd}` : `✗ ${cmd} 失敗`);
    setBusy(null);
  };

  const isConnected = health?.arduinoConnected ?? false;
  const isSimulated = health?.simulated ?? false;

  return (
    <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low/40 overflow-hidden">
      {/* Header toggle */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 p-4 text-left active:bg-surface-container-high/40"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 shrink-0">
          <Bot className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black tracking-widest text-on-surface-variant uppercase">底盤直送指令</p>
          <p className="text-sm font-bold text-on-surface truncate">
            UNO R4 + L293D
            {isSimulated && <span className="ml-1.5 text-[10px] text-amber-600 font-mono">[模擬]</span>}
            {isConnected && !isSimulated && <span className="ml-1.5 text-[10px] text-emerald-600 font-mono">[連線中]</span>}
          </p>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-on-surface-variant" /> : <ChevronDown className="h-4 w-4 text-on-surface-variant" />}
      </button>

      {expanded && (
        <div className="flex flex-col gap-4 px-4 pb-4">
          {/* Status bar */}
          <div className="flex items-center gap-2 rounded-xl bg-surface-container-lowest p-2.5 ring-1 ring-outline-variant/20">
            <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            <span className="text-xs font-bold text-on-surface-variant flex-1">
              {isConnected
                ? isSimulated ? '模擬模式（可送指令）' : `已連線 ${health?.activePath ?? ''}`
                : '未偵測到硬體'}
            </span>
            <span className="text-[10px] font-mono text-on-surface-variant">{lastResult}</span>
          </div>

          {/* Command grid */}
          <div className="grid grid-cols-5 gap-1.5">
            {ROBOT_COMMANDS.map(({label, cmd, icon, group}) => {
              const isStop  = group === 'stop';
              const isDrive = group === 'drive';
              return (
                <button
                  key={cmd}
                  type="button"
                  disabled={!isConnected || !!busy}
                  onClick={() => handleCmd(cmd)}
                  className={`flex flex-col items-center gap-0.5 rounded-xl py-2.5 text-center transition active:scale-95 disabled:opacity-40 ${
                    isStop
                      ? 'bg-rose-500 text-white shadow-sm'
                      : isDrive
                      ? 'bg-indigo-100 text-indigo-800 ring-1 ring-indigo-200'
                      : 'bg-surface-container-lowest text-on-surface ring-1 ring-outline-variant/30'
                  }`}
                >
                  <span className="text-sm leading-none">{busy === cmd ? '…' : icon}</span>
                  <span className="text-[9px] font-black tracking-tight leading-tight">{label}</span>
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-[10px] text-on-surface-variant">
            <span className="flex items-center gap-1"><Navigation2 className="h-3 w-3" />方向控制</span>
            <span className="flex items-center gap-1"><Waves className="h-3 w-3" />清掃滾筒</span>
            <span className="flex items-center gap-1"><PackageCheck className="h-3 w-3" />配送任務</span>
            <span className="flex items-center gap-1"><TriangleAlert className="h-3 w-3 text-amber-500" />硬體未接時不可用</span>
          </div>
        </div>
      )}
    </div>
  );
});
