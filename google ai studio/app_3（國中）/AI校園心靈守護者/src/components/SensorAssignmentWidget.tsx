import {useEffect, useState} from 'react';
import {ChevronDown, Cpu, X} from 'lucide-react';
import type {DetectedPort} from '../types';
import {assignSensorPort} from '../services/hardwareBridge';

const ZONE_OPTIONS = [
  {id: 'zone-library', name: '圖書館'},
  {id: 'zone-hall', name: '穿堂'},
  {id: 'zone-classroom', name: '九年級教室'},
  {id: 'zone-gym', name: '體育館'},
  {id: 'zone-field', name: '操場'},
];

interface SensorAssignmentWidgetProps {
  ports: DetectedPort[];
  onAssigned: () => void;
}

export function SensorAssignmentWidget({ports, onAssigned}: SensorAssignmentWidgetProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [selections, setSelections] = useState<Record<string, string>>({});

  // Rebuild selections from current ports, preserving pending user changes
  useEffect(() => {
    setSelections((prev) => {
      const next: Record<string, string> = {};
      for (const p of ports) {
        // Keep user's pending selection if it differs from the assigned zone
        if (prev[p.path] && prev[p.path] !== (p.assignedZone ?? '')) {
          next[p.path] = prev[p.path];
        } else if (p.assignedZone) {
          next[p.path] = p.assignedZone;
        }
      }
      return next;
    });
  }, [ports]);

  const unassigned = ports.filter((p) => !p.assignedZone);
  if (unassigned.length === 0 && !open) return null;

  const handleAssign = async (portPath: string) => {
    const zoneId = selections[portPath];
    if (!zoneId || busy) return;
    setBusy(portPath);
    const ok = await assignSensorPort(portPath, zoneId);
    setBusy(null);
    if (ok) onAssigned();
  };

  const handleUnassign = async (portPath: string) => {
    if (busy) return;
    setBusy(portPath);
    const ok = await assignSensorPort(portPath, null);
    setBusy(null);
    if (ok) onAssigned();
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      {/* Collapsed banner */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="mb-2 flex w-full items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-left text-xs font-black text-amber-800 shadow-sm transition hover:bg-amber-100"
        >
          <Cpu className="h-4 w-4 shrink-0" />
          <span className="flex-1">偵測到 {unassigned.length} 個未指派感測板 — 點此指派區域</span>
          <ChevronDown className="h-4 w-4 shrink-0" />
        </button>
      )}

      {/* Expanded panel */}
      {open && (
        <div className="mb-2 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-amber-700" />
              <p className="text-sm font-black text-amber-800">感測板指派</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-amber-500 hover:text-amber-800">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {ports.length === 0 && (
              <p className="text-xs text-amber-600">未偵測到任何 Arduino 板</p>
            )}
            {ports.map((port) => (
              <div key={port.path} className="flex flex-wrap items-center gap-2 rounded-lg bg-white border border-amber-100 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-mono text-slate-500 truncate">{port.path}</p>
                  {port.manufacturer && (
                    <p className="text-[9px] text-slate-400">{port.manufacturer}</p>
                  )}
                </div>

                <select
                  value={selections[port.path] ?? port.assignedZone ?? ''}
                  onChange={(e) => setSelections((prev) => ({...prev, [port.path]: e.target.value}))}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-black text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-300"
                >
                  <option value="">— 選擇空間 —</option>
                  {ZONE_OPTIONS.map((z) => (
                    <option key={z.id} value={z.id}>{z.name}</option>
                  ))}
                </select>

                <button
                  onClick={() => handleAssign(port.path)}
                  disabled={!selections[port.path] || busy === port.path}
                  className="rounded-lg bg-amber-600 px-3 py-1 text-[10px] font-black text-white transition hover:bg-amber-700 disabled:opacity-40"
                >
                  {busy === port.path ? '…' : '指派'}
                </button>

                {port.assignedZone && (
                  <button
                    onClick={() => handleUnassign(port.path)}
                    disabled={busy === port.path}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-[10px] font-black text-slate-500 transition hover:border-red-200 hover:text-red-500 disabled:opacity-40"
                  >
                    解除
                  </button>
                )}

                {port.assignedZone && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-700">
                    {ZONE_OPTIONS.find((z) => z.id === port.assignedZone)?.name ?? port.assignedZone}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
