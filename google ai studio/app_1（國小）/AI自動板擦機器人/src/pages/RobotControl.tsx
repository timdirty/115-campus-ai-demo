import React, {useEffect, useRef, useState} from 'react';
import {motion, AnimatePresence} from 'motion/react';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp,
  Bot, ChevronDown, ClipboardCheck, Loader2,
  Play, RotateCw, Send, Sparkles, Square, Wifi, WifiOff, Zap,
} from 'lucide-react';
import {
  loadRobotCommands, loadRobotStatus,
  RobotCommandInfo,
  sendRobotCommand, sendRobotTask, TaskLogItem,
} from '../services/classroomApi';

type SerialPortInfo = {
  path: string;
  manufacturer?: string;
  vendorId?: string;
  productId?: string;
};

const containerVariants: any = {
  hidden: {opacity: 0},
  show: {opacity: 1, transition: {staggerChildren: 0.07, ease: 'easeOut'}},
  exit: {opacity: 0, y: -10, transition: {ease: 'easeIn', duration: 0.2}},
};

const itemVariants: any = {
  hidden: {opacity: 0, y: 24},
  show: {opacity: 1, y: 0, transition: {type: 'spring', bounce: 0.25, duration: 0.65}},
};

const QUICK_COMMANDS: RobotCommandInfo[] = [
  {label: '開始清潔', command: 'CLEAN_START', group: 'task'},
  {label: '清潔完成', command: 'CLEAN_STOP', group: 'task'},
  {label: '全板擦除', command: 'ERASE_ALL', group: 'task'},
  {label: '擦除 A 區', command: 'ERASE_REGION_A', group: 'task'},
  {label: '擦除 B 區', command: 'ERASE_REGION_B', group: 'task'},
  {label: '擦除 C 區', command: 'ERASE_REGION_C', group: 'task'},
  {label: '保留 A 區', command: 'KEEP_REGION_A', group: 'task'},
  {label: '保留 B 區', command: 'KEEP_REGION_B', group: 'task'},
  {label: '暫停等待', command: 'PAUSE_TASK', group: 'task'},
  {label: '成功動畫', command: 'FIREWORK', group: 'display'},
];

function iconForCommand(command: string) {
  if (command === 'CLEAN_START') return Play;
  if (command.includes('STOP') || command === 'CLEAN_STOP') return Square;
  if (command.includes('FIREWORK')) return Zap;
  if (command.includes('ERASE')) return ClipboardCheck;
  if (command.includes('KEEP') || command === 'PAUSE_TASK') return Sparkles;
  return Send;
}

function commandDisplayName(command: string) {
  if (command.includes('ERASE_REGION')) return `擦除 ${command.slice(-1)} 區`;
  if (command.includes('KEEP_REGION')) return `保留 ${command.slice(-1)} 區`;
  if (command === 'CLEAN_START') return '開始清潔';
  if (command === 'CLEAN_STOP') return '清潔完成';
  if (command === 'ERASE_ALL') return '全板擦除';
  if (command === 'FIREWORK') return '成功動畫';
  if (command === 'PAUSE_TASK') return '暫停等待';
  if (command === 'STOP') return '停止任務';
  if (command === 'SHOW_ON') return '開始展示';
  if (command === 'SHOW_OFF') return '停止展示';
  if (command === 'RESET') return '重置狀態';
  if (command.includes('LED')) return command.includes('ON') ? '提示燈開啟' : '提示燈關閉';
  if (command.includes('SERVO')) return '板擦角度調整';
  return command.replace(/_/g, ' ');
}

function dirLabel(dir: string) {
  const map: Record<string, string> = {FORWARD: '前進', BACKWARD: '後退', LEFT: '左轉', RIGHT: '右轉'};
  return map[dir] ?? dir;
}

export default function RobotControl() {
  const [driveSpeed, setDriveSpeed] = useState(100);
  const [driveActive, setDriveActive] = useState<string | null>(null);
  const speedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [busy, setBusy] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [activePort, setActivePort] = useState('');
  const [customCommand, setCustomCommand] = useState('');
  const [taskLog, setTaskLog] = useState<TaskLogItem[]>([]);
  const [commands, setCommands] = useState<RobotCommandInfo[]>(QUICK_COMMANDS);
  const [activeFeedback, setActiveFeedback] = useState({
    title: '板擦機器人待命',
    detail: '選擇任務後，這裡會即時顯示動作與結果。',
    ok: true,
    working: false,
  });
  const [logExpanded, setLogExpanded] = useState(false);

  const refreshPorts = async () => {
    try {
      const result = await fetch('/api/arduino/ports')
        .then((r) => r.json())
        .catch(() => ({ports: [], activePath: ''}));
      const [robot, commandResult] = await Promise.all([
        loadRobotStatus(),
        loadRobotCommands().catch(() => ({commands: QUICK_COMMANDS})),
      ]);
      const filtered = (commandResult.commands ?? QUICK_COMMANDS).filter(
        (c: RobotCommandInfo) => c.group !== 'drive' && QUICK_COMMANDS.some((q) => q.command === c.command),
      );
      setCommands(filtered.length ? filtered : QUICK_COMMANDS);
      setTaskLog(robot.taskLog);
      const isArduinoLike = (s: string) => /usbmodem|arduino|uno/i.test(s);
      const arduinoPort = result.ports?.find((p: SerialPortInfo) =>
        isArduinoLike(`${p.path} ${p.manufacturer ?? ''}`),
      );
      const storedPort = robot.status.activePort;
      const bestPort =
        arduinoPort?.path || (isArduinoLike(storedPort) ? storedPort : '') || result.activePath || result.ports?.[0]?.path || '';
      setActivePort(bestPort);
      // Hardware present = connected; serial port opens automatically on first command
      const hardwareFound = Boolean(arduinoPort?.path || (isArduinoLike(storedPort) ? storedPort : ''));
      setIsConnected(hardwareFound);
    } catch {
      setIsConnected(false);
    }
  };

  const sendDriveCommand = (command: string) => {
    fetch('/api/robot/drive', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({command, port: activePort || undefined}),
    }).catch(() => {});
  };

  const handleDriveStart = (dir: string) => {
    setDriveActive(dir);
    sendDriveCommand(dir);
  };

  const handleDriveStop = () => {
    if (!driveActive) return;
    setDriveActive(null);
    sendDriveCommand('STOP');
  };

  const handleSpeedChange = (value: number) => {
    setDriveSpeed(value);
    if (speedTimer.current) clearTimeout(speedTimer.current);
    speedTimer.current = setTimeout(() => sendDriveCommand(`SPEED:${value}`), 120);
  };

  useEffect(() => {
    refreshPorts();
  }, []);

  useEffect(() => {
    if (activePort) sendDriveCommand(`SPEED:${driveSpeed}`);
  }, [activePort]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendCommand = async (command: string) => {
    const trimmedCommand = command.trim();
    if (!trimmedCommand) return;
    setBusy(true);
    const displayName = commandDisplayName(trimmedCommand);
    setActiveFeedback({title: displayName, detail: '正在送出任務，等待回饋。', ok: true, working: true});
    try {
      const result = await sendRobotCommand(trimmedCommand, 'robot-control', activePort || undefined);
      setTaskLog(result.taskLog ?? []);
      setActivePort(result.status.activePort);
      setActiveFeedback({
        title: result.ok ? `${displayName} 已接收` : `${displayName} 已記錄`,
        detail: result.ok ? '實體機器人已收到指令。' : '目前使用展示備援，任務仍會出現在紀錄中。',
        ok: result.ok,
        working: false,
      });
      setCustomCommand('');
    } catch (error) {
      setActiveFeedback({
        title: `${displayName} 未送出`,
        detail: error instanceof Error ? error.message : '請稍後再試。',
        ok: false,
        working: false,
      });
    } finally {
      setBusy(false);
    }
  };

  const sendTask = async (action: string, regionId?: string) => {
    setBusy(true);
    const taskName = regionId ? `區塊 ${regionId}` : '全板';
    setActiveFeedback({title: `${taskName}任務`, detail: '正在整理擦除範圍與保留重點。', ok: true, working: true});
    try {
      const result = await sendRobotTask(action, regionId, 'robot-control', activePort || undefined);
      setTaskLog(result.taskLog ?? []);
      setActivePort(result.status.activePort);
      const displayName = commandDisplayName(result.command);
      setActiveFeedback({
        title: result.ok ? `${displayName} 已排程` : `${displayName} 已記錄`,
        detail: result.ok ? '板擦機器人會依照區塊執行。' : '展示模式會保留任務流程，方便評審看見互動結果。',
        ok: result.ok,
        working: false,
      });
    } catch (error) {
      setActiveFeedback({
        title: '任務未送出',
        detail: error instanceof Error ? error.message : '請稍後再試。',
        ok: false,
        working: false,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    /* flex-col so the drive bar sits at the bottom without fixed-positioning issues */
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      exit="exit"
      className="absolute inset-0 w-full h-full flex flex-col"
    >
      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto hide-scrollbar">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-6">

          {/* Header */}
          <motion.section variants={itemVariants} className="mb-5 sm:mb-7 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-primary mb-2">機器人指令台</p>
              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">板擦任務台</h1>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Connection status pill */}
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-bold transition-all ${
                isConnected
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-surface-container-high border-outline-variant/20 text-on-surface-variant'
              }`}>
                {isConnected
                  ? <span className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
                  : <WifiOff className="w-4 h-4" />}
                <span>{isConnected ? '機器人已連線' : '展示模式'}</span>
                {isConnected && activePort && (
                  <span className="font-mono text-[10px] opacity-60 hidden sm:inline">{activePort.split('/').pop()}</span>
                )}
              </div>
              <button
                onClick={refreshPorts}
                className="h-10 px-4 rounded-full bg-surface-container-high hover:bg-primary hover:text-on-primary transition-all active:scale-95 flex items-center gap-2 font-bold text-sm"
              >
                <RotateCw className="w-4 h-4" />
                重新偵測
              </button>
            </div>
          </motion.section>

          {/* Feedback banner */}
          <motion.div
            variants={itemVariants}
            className={`mb-5 rounded-2xl border p-4 flex items-center gap-4 transition-colors ${
              activeFeedback.ok ? 'border-primary/15 bg-primary-container/30' : 'border-tertiary/20 bg-tertiary/10'
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-surface flex items-center justify-center shrink-0 shadow-sm">
              {activeFeedback.working
                ? <Loader2 className="w-6 h-6 text-primary animate-spin" />
                : activeFeedback.ok
                  ? <Bot className="w-6 h-6 text-primary" />
                  : <Square className="w-6 h-6 text-tertiary" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">即時回饋</p>
              <p className="text-base sm:text-lg font-extrabold leading-tight mt-0.5">{activeFeedback.title}</p>
              <p className="text-sm text-on-surface-variant mt-0.5 leading-relaxed">{activeFeedback.detail}</p>
            </div>
            {busy && <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />}
          </motion.div>

          {/* Task command hero */}
          <motion.section variants={itemVariants} className="mb-5" data-tour="robot-commands">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-xl font-extrabold">任務指令</h2>
              <span className="text-xs text-on-surface-variant font-bold">按下即執行，自動記錄</span>
              {busy && <Loader2 className="w-4 h-4 animate-spin text-primary ml-auto" />}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
              {commands.map((item) => {
                const Icon = iconForCommand(item.command);
                return (
                  <button
                    key={item.command}
                    onClick={() => sendCommand(item.command)}
                    disabled={busy}
                    className="min-h-32 rounded-2xl bg-surface-container-lowest shadow hover:bg-primary hover:text-on-primary hover:shadow-lg disabled:opacity-50 disabled:hover:bg-surface-container-lowest disabled:hover:text-on-surface disabled:hover:shadow transition-all active:scale-95 flex flex-col items-center justify-center gap-3 p-4 text-center font-bold border border-outline-variant/10"
                  >
                    <Icon className="w-7 h-7 shrink-0" />
                    <span className="text-sm leading-tight">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </motion.section>

          {/* Teacher suggested tasks */}
          <motion.section variants={itemVariants} className="mb-5">
            <div className="rounded-2xl bg-primary-container/40 border border-primary/10 p-4 sm:p-5">
              <div className="flex items-center gap-2 font-extrabold text-primary mb-3 text-sm">
                <ClipboardCheck className="w-4 h-4" />
                教師指定任務
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {[
                  {label: '擦除 A 區', action: 'erase', regionId: 'A'},
                  {label: '擦除 B 區', action: 'erase', regionId: 'B'},
                  {label: '擦除 C 區', action: 'erase', regionId: 'C'},
                  {label: '保留重點 A', action: 'keep', regionId: 'A'},
                  {label: '暫停等待抄寫', action: 'pause'},
                ].map((task) => (
                  <button
                    key={`${task.action}-${task.regionId ?? 'all'}`}
                    onClick={() => sendTask(task.action, task.regionId)}
                    disabled={busy}
                    className="h-11 rounded-xl bg-surface hover:bg-primary hover:text-on-primary disabled:opacity-50 transition-all active:scale-95 text-sm font-bold border border-primary/10"
                  >
                    {task.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.section>

          {/* Custom command */}
          <motion.section variants={itemVariants} className="mb-5">
            <div className="bg-surface rounded-2xl p-2.5 flex items-center gap-2 border border-outline-variant/10">
              <Send className="w-4 h-4 text-on-surface-variant shrink-0 ml-1.5" />
              <input
                value={customCommand}
                onChange={(e) => setCustomCommand(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && customCommand.trim() && sendCommand(customCommand)}
                placeholder="自訂指令，例如：ERASE_ALL"
                className="flex-1 bg-transparent outline-none px-2 text-sm font-bold placeholder:font-normal placeholder:opacity-40"
              />
              <button
                onClick={() => sendCommand(customCommand)}
                disabled={busy || !customCommand.trim()}
                className="h-10 px-4 rounded-xl bg-primary text-on-primary disabled:opacity-50 transition-all active:scale-95 font-bold text-sm"
              >
                送出
              </button>
            </div>
          </motion.section>

          {/* Task log (collapsible) */}
          <motion.section variants={itemVariants}>
            <button
              onClick={() => setLogExpanded((v) => !v)}
              className="w-full flex items-center justify-between py-3 px-1 text-sm font-bold text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <span>任務紀錄{taskLog.length > 0 ? ` (${taskLog.length})` : ''}</span>
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${logExpanded ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence initial={false}>
              {logExpanded && (
                <motion.div
                  key="log"
                  initial={{height: 0, opacity: 0}}
                  animate={{height: 'auto', opacity: 1}}
                  exit={{height: 0, opacity: 0}}
                  transition={{duration: 0.2, ease: 'easeInOut'}}
                  className="overflow-hidden"
                >
                  <div className="space-y-2 pb-4">
                    {taskLog.length === 0 ? (
                      <p className="text-sm text-on-surface-variant text-center py-4">尚未送出任務。</p>
                    ) : (
                      taskLog.slice(0, 12).map((item) => (
                        <div
                          key={item.id}
                          className="bg-surface-container-low rounded-2xl p-3 border border-outline-variant/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                        >
                          <div>
                            <p className="font-extrabold text-sm">
                              {commandDisplayName(item.command)}{' '}
                              <span className={`text-xs ${item.ok ? 'text-primary' : 'text-tertiary'}`}>
                                {item.ok ? '已送出' : '備援紀錄'}
                              </span>
                            </p>
                            <p className="text-xs text-on-surface-variant mt-0.5">{item.message}</p>
                          </div>
                          <p className="text-xs text-on-surface-variant shrink-0">
                            {new Date(item.createdAt).toLocaleTimeString('zh-TW', {hour: '2-digit', minute: '2-digit'})}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        </div>
      </div>

      {/* ── Persistent drive bar ── */}
      <div className="shrink-0 bg-surface-container-lowest border-t border-outline-variant/15 shadow-[0_-4px_20px_0_rgba(0,0,0,.07)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-4 sm:gap-6">

            {/* D-pad */}
            <div className="grid grid-cols-3 gap-1.5 select-none shrink-0" style={{touchAction: 'none'}}>
              <div />
              <DriveBtn dir="FORWARD" icon={ArrowUp} active={driveActive === 'FORWARD'} onStart={handleDriveStart} onStop={handleDriveStop} />
              <div />
              <DriveBtn dir="LEFT" icon={ArrowLeft} active={driveActive === 'LEFT'} onStart={handleDriveStart} onStop={handleDriveStop} />
              <button
                className="h-12 w-12 rounded-xl bg-error/15 hover:bg-error/25 text-error transition-all flex items-center justify-center select-none"
                style={{touchAction: 'none'}}
                onPointerDown={() => {setDriveActive(null); sendDriveCommand('STOP');}}
              >
                <Square className="w-5 h-5" />
              </button>
              <DriveBtn dir="RIGHT" icon={ArrowRight} active={driveActive === 'RIGHT'} onStart={handleDriveStart} onStop={handleDriveStop} />
              <div />
              <DriveBtn dir="BACKWARD" icon={ArrowDown} active={driveActive === 'BACKWARD'} onStart={handleDriveStart} onStop={handleDriveStop} />
              <div />
            </div>

            <div className="w-px self-stretch bg-outline-variant/20 hidden sm:block" />

            {/* Speed slider */}
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-on-surface-variant">移動速度</span>
                <span className="text-sm font-extrabold tabular-nums">
                  {driveSpeed}
                  <span className="text-[10px] font-bold text-on-surface-variant"> / 255</span>
                </span>
              </div>
              <input
                type="range"
                min={50}
                max={255}
                value={driveSpeed}
                onChange={(e) => handleSpeedChange(Number(e.target.value))}
                className="w-full accent-primary h-2 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] font-bold text-on-surface-variant">
                <span>最低 50</span>
                <span>全速 255</span>
              </div>
            </div>

            {/* Direction indicator */}
            <div className={`shrink-0 min-w-18 text-center text-xs font-bold px-3 py-2 rounded-full border transition-all hidden sm:block ${
              driveActive
                ? 'bg-primary text-on-primary border-primary'
                : 'bg-surface-container-high text-on-surface-variant border-outline-variant/20'
            }`}>
              {driveActive ? dirLabel(driveActive) : '待機'}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function DriveBtn({dir, icon: Icon, active, onStart, onStop}: {
  dir: string;
  icon: React.ElementType;
  active: boolean;
  onStart: (dir: string) => void;
  onStop: () => void;
}) {
  return (
    <button
      className={`h-12 w-12 rounded-xl transition-all flex items-center justify-center select-none ${
        active
          ? 'bg-primary text-on-primary scale-95 shadow-lg'
          : 'bg-surface-container-high hover:bg-surface-container-high border border-outline-variant/15'
      }`}
      style={{touchAction: 'none'}}
      onPointerDown={(e) => {e.currentTarget.setPointerCapture(e.pointerId); onStart(dir);}}
      onPointerUp={onStop}
      onPointerCancel={onStop}
      onPointerLeave={onStop}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
}
