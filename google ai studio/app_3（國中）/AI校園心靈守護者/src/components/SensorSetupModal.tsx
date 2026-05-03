import {useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {
  CheckCircle2,
  Cpu,
  Droplets,
  Sun,
  Thermometer,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import type {DetectedPort, ZoneSensorReading} from '../types';
import {assignSensorPort} from '../services/hardwareBridge';

const ZONES: {id: string; name: string; emoji: string; bg: string; border: string; activeBg: string; activeText: string; dot: string}[] = [
  {
    id: 'zone-library',
    name: '圖書館',
    emoji: '📚',
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    activeBg: 'bg-sky-100',
    activeText: 'text-sky-900',
    dot: 'bg-sky-400',
  },
  {
    id: 'zone-hall',
    name: '穿堂',
    emoji: '🚶',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    activeBg: 'bg-emerald-100',
    activeText: 'text-emerald-900',
    dot: 'bg-emerald-400',
  },
  {
    id: 'zone-field',
    name: '操場',
    emoji: '⚽',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    activeBg: 'bg-amber-100',
    activeText: 'text-amber-900',
    dot: 'bg-amber-400',
  },
];

function deviceLabel(index: number) {
  return `感測器 ${String.fromCharCode(65 + index)}`;
}

interface Props {
  ports: DetectedPort[];
  sensors: ZoneSensorReading[];
  onClose: () => void;
  onChanged: () => void;
}

export function SensorSetupModal({ports, sensors, onClose, onChanged}: Props) {
  const [selectedPath, setSelectedPath] = useState<string | null>(
    () => ports.find((p) => !p.assignedZone)?.path ?? ports[0]?.path ?? null,
  );
  const [busyPath, setBusyPath] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const selectedPort = ports.find((p) => p.path === selectedPath) ?? null;

  const triggerFlash = (id: string) => {
    setFlash(id);
    setTimeout(() => setFlash(null), 1400);
  };

  const handleAssign = async (zoneId: string) => {
    if (!selectedPath || busyPath) return;
    setBusyPath(selectedPath);

    // Swap: if another port owns this zone, release it first
    const blocker = ports.find((p) => p.path !== selectedPath && p.assignedZone === zoneId);
    if (blocker) await assignSensorPort(blocker.path, null);

    const ok = await assignSensorPort(selectedPath, zoneId);
    setBusyPath(null);
    if (ok) {
      triggerFlash(zoneId);
      onChanged();
    }
  };

  const handleUnassign = async (portPath: string) => {
    if (busyPath) return;
    setBusyPath(portPath);
    await assignSensorPort(portPath, null);
    setBusyPath(null);
    onChanged();
  };

  const sensorFor = (zoneId: string) => sensors.find((s) => s.zoneId === zoneId);

  const allAssigned = ports.length > 0 && ports.every((p) => p.assignedZone);

  return (
    <motion.div
      initial={{opacity: 0}}
      animate={{opacity: 1}}
      exit={{opacity: 0}}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{y: 80, opacity: 0, scale: 0.98}}
        animate={{y: 0, opacity: 1, scale: 1}}
        exit={{y: 80, opacity: 0, scale: 0.98}}
        transition={{type: 'spring', damping: 30, stiffness: 320}}
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
        style={{maxHeight: '92dvh'}}
      >
        {/* ── Header ── */}
        <div className="flex shrink-0 items-center justify-between bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
              <Wifi className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">感測器配對</h2>
              <p className="text-xs text-teal-200">讓感測器守護每個空間</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white transition hover:bg-white/25"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto overscroll-contain">

          {/* No ports */}
          {ports.length === 0 && (
            <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
              <div className="rounded-full bg-slate-100 p-6">
                <WifiOff className="h-10 w-10 text-slate-400" />
              </div>
              <div>
                <p className="text-lg font-black text-slate-700">找不到感測器</p>
                <p className="mt-1 text-sm text-slate-500">請確認 USB 線已插好，系統會自動偵測</p>
              </div>
            </div>
          )}

          {ports.length > 0 && (
            <div className="space-y-6 px-5 py-5">

              {/* ── Step 1: device selection ── */}
              <section>
                <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-400">
                  步驟一・選擇感測器
                </p>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {ports.map((port, i) => {
                    const isSelected = port.path === selectedPath;
                    const isBusy = busyPath === port.path;
                    const zoneMeta = ZONES.find((z) => z.id === port.assignedZone);
                    const sensor = sensorFor(port.assignedZone ?? '');

                    return (
                      <button
                        key={port.path}
                        onClick={() => setSelectedPath(port.path)}
                        disabled={isBusy}
                        className={[
                          'relative w-40 shrink-0 rounded-2xl border-2 p-4 text-left transition-all',
                          isSelected
                            ? 'border-teal-500 bg-teal-50 shadow-lg ring-2 ring-teal-200'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm',
                        ].join(' ')}
                      >
                        {/* Icon */}
                        <div
                          className={[
                            'mb-3 inline-flex rounded-xl p-2',
                            isSelected ? 'bg-teal-100' : 'bg-slate-100',
                          ].join(' ')}
                        >
                          <Cpu
                            className={['h-5 w-5', isSelected ? 'text-teal-600' : 'text-slate-500'].join(' ')}
                          />
                        </div>

                        {/* Name */}
                        <p
                          className={[
                            'text-sm font-black',
                            isSelected ? 'text-teal-900' : 'text-slate-700',
                          ].join(' ')}
                        >
                          {deviceLabel(i)}
                        </p>

                        {/* Zone badge */}
                        {zoneMeta ? (
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className={['h-2 w-2 rounded-full', zoneMeta.dot].join(' ')} />
                            <span className="text-xs font-semibold text-slate-600">{zoneMeta.name}</span>
                          </div>
                        ) : (
                          <p className="mt-1 text-xs text-slate-400">尚未指派</p>
                        )}

                        {/* Mini live reading */}
                        {sensor?.connected && (
                          <p className="mt-2 text-[11px] tabular-nums text-slate-500">
                            {sensor.temp?.toFixed(1)}°C · {sensor.hum}%
                          </p>
                        )}

                        {/* Selected check */}
                        {isSelected && (
                          <div className="absolute -right-1.5 -top-1.5 rounded-full bg-teal-500 p-0.5 shadow">
                            <CheckCircle2 className="h-4 w-4 text-white" />
                          </div>
                        )}

                        {/* Busy spinner */}
                        {isBusy && (
                          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/70">
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* ── Step 2: zone grid ── */}
              <AnimatePresence mode="wait">
                {selectedPort && (
                  <motion.section
                    key={selectedPath}
                    initial={{opacity: 0, y: 10}}
                    animate={{opacity: 1, y: 0}}
                    exit={{opacity: 0, y: -6}}
                    transition={{duration: 0.18}}
                  >
                    <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-slate-400">
                      步驟二・指派到空間
                      {selectedPort.assignedZone && (
                        <span className="ml-2 font-semibold normal-case text-slate-500">
                          （目前：{ZONES.find((z) => z.id === selectedPort.assignedZone)?.name}）
                        </span>
                      )}
                    </p>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {ZONES.map((zone) => {
                        const isAssigned = selectedPort.assignedZone === zone.id;
                        const takenByOther = ports.some(
                          (p) => p.path !== selectedPath && p.assignedZone === zone.id,
                        );
                        const sensor = sensorFor(zone.id);
                        const isFlashing = flash === zone.id;

                        return (
                          <motion.button
                            key={zone.id}
                            whileTap={{scale: 0.95}}
                            onClick={() =>
                              isAssigned
                                ? handleUnassign(selectedPath!)
                                : handleAssign(zone.id)
                            }
                            disabled={!!busyPath}
                            className={[
                              'relative rounded-2xl border-2 p-4 text-left transition-all',
                              isAssigned
                                ? 'border-teal-500 bg-teal-50 shadow-md'
                                : `${zone.bg} ${zone.border} hover:shadow-sm`,
                              busyPath ? 'opacity-60' : '',
                            ].join(' ')}
                          >
                            {/* Flash overlay on success */}
                            <AnimatePresence>
                              {isFlashing && (
                                <motion.div
                                  initial={{opacity: 0.6}}
                                  animate={{opacity: 0}}
                                  exit={{opacity: 0}}
                                  transition={{duration: 1.2}}
                                  className="pointer-events-none absolute inset-0 rounded-2xl bg-teal-300"
                                />
                              )}
                            </AnimatePresence>

                            {/* Top row: emoji + checkmark */}
                            <div className="flex items-start justify-between gap-1">
                              <span className="text-2xl">{zone.emoji}</span>
                              {isAssigned && (
                                <motion.div
                                  initial={{scale: 0}}
                                  animate={{scale: 1}}
                                  className="rounded-full bg-teal-500 p-0.5 shadow"
                                >
                                  <CheckCircle2 className="h-4 w-4 text-white" />
                                </motion.div>
                              )}
                            </div>

                            {/* Zone name */}
                            <p
                              className={[
                                'mt-2 text-sm font-black',
                                isAssigned ? 'text-teal-800' : zone.activeText,
                              ].join(' ')}
                            >
                              {zone.name}
                            </p>

                            {/* "other port here" warning */}
                            {takenByOther && !isAssigned && (
                              <p className="mt-0.5 text-[11px] font-semibold text-amber-600">
                                其他感測器使用中
                              </p>
                            )}

                            {/* Live reading */}
                            {sensor?.connected && (
                              <div className="mt-2 space-y-0.5">
                                <div className="flex items-center gap-1 text-[11px] tabular-nums text-slate-600">
                                  <Thermometer className="h-3 w-3" />
                                  <span>{sensor.temp?.toFixed(1)}°C</span>
                                  <Droplets className="ml-1 h-3 w-3" />
                                  <span>{sensor.hum}%</span>
                                </div>
                                <div className="flex items-center gap-1 text-[11px] tabular-nums text-slate-400">
                                  <Sun className="h-3 w-3" />
                                  <span>光線 {sensor.light}</span>
                                </div>
                              </div>
                            )}

                            {/* Unassign hint */}
                            {isAssigned && (
                              <p className="mt-2 text-[11px] text-teal-600">再次點選可解除</p>
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.section>
                )}
              </AnimatePresence>

              {/* ── All-done banner ── */}
              <AnimatePresence>
                {allAssigned && (
                  <motion.div
                    initial={{opacity: 0, scale: 0.96}}
                    animate={{opacity: 1, scale: 1}}
                    exit={{opacity: 0, scale: 0.96}}
                    className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3"
                  >
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                    <div>
                      <p className="text-sm font-black text-emerald-800">所有感測器已配對完成！</p>
                      <p className="text-xs text-emerald-600">資料會自動更新，設定已儲存</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          )}
        </div>

        {/* ── Footer button ── */}
        <div className="shrink-0 border-t border-slate-100 bg-white px-5 py-4">
          <button
            onClick={onClose}
            className="w-full rounded-2xl bg-teal-600 py-3.5 text-sm font-black text-white shadow transition hover:bg-teal-700 active:scale-95"
          >
            {allAssigned ? '完成設定 ✓' : '關閉'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
