import React, {memo, useCallback, useEffect, useRef, useState} from 'react';
import {motion, AnimatePresence} from 'motion/react';
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp,
  Bot, ChevronDown, ClipboardCheck, Loader2,
  Play, RotateCw, Send, Sparkles, Square, Wifi, WifiOff, Zap,
} from 'lucide-react';
import {
  loadClassroomSession, loadRobotCommands, loadRobotStatus, saveClassroomSession,
  sendRobotCommand, sendRobotTask,
} from '../services/classroomApi';
import type {BoardRegion, RobotCommandInfo, TaskLogItem} from '../services/classroomApi';
import {saveDemoProgress} from '../services/demoProgress';
import {loadNotesAsync, type NoteContentType} from '../services/notesStore';
import {say as robotSay, cancel as robotVoiceCancel} from '../services/robotVoice';
import {runEraseWithVerification, residualToQualityLabel} from '../services/eraseVerifier';
import EV3ControlPanel from '../components/EV3ControlPanel';
import AIThinkingOverlay, {type ThinkingRegion} from '../components/AIThinkingOverlay';
import CelebrationOverlay from '../components/CelebrationOverlay';

function commandVoicePhrase(command: string, phase: 'start' | 'done'): string | null {
  const trimmed = command.trim().toUpperCase();
  if (phase === 'start') {
    if (trimmed === 'ERASE_ALL') return '好，我要全部擦掉囉';
    if (trimmed === 'ERASE_REGION_A') return '好，我來擦 A 區';
    if (trimmed === 'ERASE_REGION_B') return '好，我來擦 B 區';
    if (trimmed === 'ERASE_REGION_C') return '好，我來擦 C 區';
    if (trimmed === 'CELEBRATE') return '擦好了，我來慶祝一下';
    if (trimmed === 'PAUSE_TASK') return '暫停一下';
    if (trimmed.startsWith('KEEP_REGION_')) return '這區是重點，我會保留';
    return null;
  }
  if (trimmed === 'ERASE_ALL') return '全部擦好了！';
  if (trimmed === 'ERASE_REGION_A') return 'A 區擦好了！';
  if (trimmed === 'ERASE_REGION_B') return 'B 區擦好了！';
  if (trimmed === 'ERASE_REGION_C') return 'C 區擦好了！';
  if (trimmed === 'CELEBRATE') return '耶！';
  return null;
}

const ERASE_COMMAND_PATTERN = /^(ERASE_REGION_[ABC]|ERASE_ALL|CELEBRATE)$/i;

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

const QUICK_TASKS = [
  {label: '擦除 A 區', action: 'erase', regionId: 'A'},
  {label: '擦除 B 區', action: 'erase', regionId: 'B'},
  {label: '保留重點 A', action: 'keep', regionId: 'A'},
  {label: '暫停等待抄寫', action: 'pause', regionId: undefined},
] as const;

const QUICK_COMMANDS: RobotCommandInfo[] = [
  {label: '開始清潔', command: 'CLEAN_START', group: 'task'},
  {label: '清潔完成', command: 'CLEAN_STOP', group: 'task'},
  {label: '全板擦除', command: 'ERASE_ALL', group: 'task'},
  {label: '擦除 A 區', command: 'ERASE_REGION_A', group: 'task'},
  {label: '擦除 B 區', command: 'ERASE_REGION_B', group: 'task'},
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

function contentTypeVoiceOpening(contentType: NoteContentType) {
  if (contentType === 'illustration') return '發現小插圖，';
  if (contentType === 'message') return '發現鼓勵話，';
  if (contentType === 'reminder') return '發現提醒事項，';
  return '發現練習題，';
}

function taskVoicePhrase(action: string, taskName: string, contentType: NoteContentType) {
  const opening = contentTypeVoiceOpening(contentType);
  if (action === 'erase') return `${opening}好，我來擦${taskName}`;
  if (action === 'keep') return `${opening}建議保留這區`;
  if (action === 'pause') return '暫停一下';
  return '';
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
  const [classroomRegions, setClassroomRegions] = useState<BoardRegion[]>([]);
  const [latestContentType, setLatestContentType] = useState<NoteContentType>('question');
  const [activeFeedback, setActiveFeedback] = useState({
    title: '板擦機器人待命',
    detail: '選擇任務後，這裡會即時顯示動作與結果。',
    ok: true,
    working: false,
  });
  const [logExpanded, setLogExpanded] = useState(false);
  const [thinking, setThinking] = useState<{open: boolean; label: string; progress?: number; regions?: ThinkingRegion[]}>({open: false, label: ''});
  const [celebrating, setCelebrating] = useState(false);
  const [celebrateMessage, setCelebrateMessage] = useState('擦好了！');

  const refreshPorts = async () => {
    try {
      const result = await fetch('/api/arduino/ports')
        .then((r) => r.json())
        .catch(() => ({ports: [], activePath: ''}));
      const [robot, commandResult, classroom, notes] = await Promise.all([
        loadRobotStatus(),
        loadRobotCommands().catch(() => ({commands: QUICK_COMMANDS})),
        loadClassroomSession().catch(() => null),
        loadNotesAsync().catch(() => []),
      ]);
      const filtered = (commandResult.commands ?? QUICK_COMMANDS).filter(
        (c: RobotCommandInfo) => c.group !== 'drive' && QUICK_COMMANDS.some((q) => q.command === c.command),
      );
      setCommands(filtered.length ? filtered : QUICK_COMMANDS);
      setTaskLog(robot.taskLog);
      setClassroomRegions(classroom?.boardRegions ?? []);
      setLatestContentType(notes[0]?.contentType ?? 'question');
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

  const activePortRef = useRef(activePort);
  activePortRef.current = activePort;

  const handleDriveStart = useCallback((dir: string) => {
    setDriveActive(dir);
    if (!isConnected) {
      setActiveFeedback({title: '展示模式', detail: '目前是展示模式，方向鍵只留下操作紀錄。', ok: false, working: false});
      return;
    }
    fetch('/api/robot/drive', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({command: dir, port: activePortRef.current || undefined}),
    }).then((resp) => {
      // fetch 只在網路斷線才 reject；5xx 也算 resolve，必須檢查 ok
      if (!resp.ok) {
        setActiveFeedback({title: '移動任務失敗', detail: `機器人服務回應 HTTP ${resp.status}，請確認硬體連線。`, ok: false, working: false});
      }
    }).catch(() => {
      setActiveFeedback({title: '移動任務失敗', detail: '無法送出移動任務，請確認展示服務已啟動。', ok: false, working: false});
    });
  }, [isConnected]);

  const handleDriveStop = useCallback(() => {
    setDriveActive((prev) => {
      if (!prev) return null;
      fetch('/api/robot/drive', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({command: 'STOP', port: activePortRef.current || undefined}),
      }).catch(() => {});
      return null;
    });
  }, []);

  const handleSpeedChange = (value: number) => {
    setDriveSpeed(value);
    if (speedTimer.current) clearTimeout(speedTimer.current);
    speedTimer.current = setTimeout(() => sendDriveCommand(`SPEED:${value}`), 120);
  };

  useEffect(() => {
    refreshPorts();
  }, []);

  useEffect(() => {
    return () => {
      if (speedTimer.current) clearTimeout(speedTimer.current);
    };
  }, []);

  useEffect(() => {
    if (activePort) sendDriveCommand(`SPEED:${driveSpeed}`);
  }, [activePort]); // eslint-disable-line react-hooks/exhaustive-deps

  // Watchdog keepalive: firmware auto-STOPs after 3 s without HEARTBEAT
  useEffect(() => {
    if (!driveActive) return;
    const id = setInterval(() => {
      sendDriveCommand('HEARTBEAT');
    }, 1000);
    return () => clearInterval(id);
  }, [driveActive]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendCommand = async (command: string) => {
    const trimmedCommand = command.trim();
    if (!trimmedCommand) return;
    setBusy(true);
    const displayName = commandDisplayName(trimmedCommand);
    const startPhrase = commandVoicePhrase(trimmedCommand, 'start');
    if (startPhrase) robotSay(startPhrase, {priority: 'urgent'});
    setThinking({open: true, label: `機器人收到「${displayName}」`, progress: 15});
    setActiveFeedback({title: displayName, detail: '正在送出任務，等待回饋。', ok: true, working: true});
    try {
      const result = await sendRobotCommand(trimmedCommand, 'robot-control', activePort || undefined);
      setTaskLog(result.taskLog ?? []);
      setActivePort(result.status.activePort);
      setActiveFeedback({
        title: result.ok ? `${displayName} 已接收` : `${displayName} 已記錄`,
        detail: result.ok ? '實體機器人已收到任務。' : '目前使用展示備援，任務仍會出現在紀錄中。',
        ok: Boolean(result.ok),
        working: false,
      });
      saveDemoProgress({robot: true});
      setCustomCommand('');
      setThinking((prev) => ({...prev, open: false}));
      const donePhrase = commandVoicePhrase(trimmedCommand, 'done');
      if (donePhrase) robotSay(donePhrase, {priority: 'normal'});
      if (ERASE_COMMAND_PATTERN.test(trimmedCommand)) {
        setCelebrateMessage(donePhrase ?? '擦好了！');
        setCelebrating(true);
      }
    } catch (error) {
      setThinking((prev) => ({...prev, open: false}));
      robotSay('出狀況了，請老師檢查機器人', {priority: 'urgent'});
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

  const markClassroomTaskDone = async (action: string, regionId?: string) => {
    if (action !== 'erase') return;
    try {
      const session = await loadClassroomSession();
      const nextRegions = session.boardRegions.map((region) => {
        const shouldErase = regionId ? region.id === regionId : region.status === 'erasable' || region.status === 'erased';
        return shouldErase
          ? {...region, status: 'erased' as const, reason: '機器人任務已執行，老師可開始下一段課堂。'}
          : region;
      });
      const next = await saveClassroomSession({
        boardRegions: nextRegions,
        currentRecommendation: `${regionId ? `區塊 ${regionId}` : '可清空區塊'} 已完成板擦任務，可到紀錄本與學習單延伸。`,
      });
      setClassroomRegions(next.boardRegions);
    } catch {
      setClassroomRegions((current) => current.map((region) => {
        const shouldErase = regionId ? region.id === regionId : region.status === 'erasable' || region.status === 'erased';
        return shouldErase
          ? {...region, status: 'erased' as const, reason: '展示模式已完成任務紀錄。'}
          : region;
      }));
    }
  };

  const sendTask = async (action: string, regionId?: string) => {
    setBusy(true);
    const taskName = regionId ? `區塊 ${regionId}` : '全板';
    const voicePhrase = taskVoicePhrase(action, taskName, latestContentType);
    if (voicePhrase) robotSay(voicePhrase, {priority: 'urgent'});
    const thinkingRegions: ThinkingRegion[] | undefined = classroomRegions.length > 0
      ? classroomRegions.map((r) => ({
          id: r.id,
          label: `${r.id} 區`,
          status: r.id === regionId
            ? (action === 'erase' ? 'erase' : action === 'keep' ? 'keep' : 'analyzing')
            : (r.status === 'erased' ? 'done' : r.status === 'keep' ? 'keep' : 'analyzing'),
        }))
      : undefined;
    setThinking({open: true, label: `${taskName}任務分析中`, progress: 30, regions: thinkingRegions});
    setActiveFeedback({title: `${taskName}任務`, detail: '正在整理擦除範圍與保留重點。', ok: true, working: true});
    try {
      const result = await sendRobotTask(action, regionId, 'robot-control', activePort || undefined);
      setTaskLog(result.taskLog ?? []);
      setActivePort(result.status.activePort);
      const displayName = commandDisplayName(result.command);
      setActiveFeedback({
        title: result.ok ? `${displayName} 已排程` : `${displayName} 已記錄`,
        detail: result.ok ? '板擦機器人會依照區塊執行。' : '展示模式會保留任務流程，方便評審看見互動結果。',
        ok: Boolean(result.ok),
        working: false,
      });
      saveDemoProgress({robot: true});
      // codex-adv finding #2：bridge fallback (result.ok=false) 不該標已擦也不該進 verify cycle
      // 否則 hardware 沒接時會偽稱「AI 自我驗證通過」並飛撒花，跟實機沒擦這事實衝突
      if (!result.ok) {
        setThinking((prev) => ({...prev, open: false}));
        robotSay('機器人沒回應，請老師檢查連線', {priority: 'urgent'});
        return;
      }
      await markClassroomTaskDone(action, regionId);
      if (action === 'erase') {
        await runEraseWithVerification({
          regionLabel: taskName,
          eraseRunner: async (attempt) => {
            if (attempt === 1) return;
            const retryCmd = regionId ? `ERASE_REGION_${regionId}` : 'ERASE_ALL';
            try {
              await sendRobotCommand(retryCmd, 'robot-control', activePortRef.current || undefined);
            } catch {
              // 重試失敗時不中斷閉環，讓 verifier 用最後一輪結果決定 pass/fail
            }
          },
          callbacks: {
            onAttemptStart: (attempt) => {
              if (attempt > 1) {
                robotSay(`咦，還有殘留，再擦一次`, {priority: 'urgent'});
              }
            },
            onProgress: (msg, percent) => {
              setThinking((prev) => ({...prev, label: msg, progress: percent, open: true}));
            },
            onResidual: (residual, attempt) => {
              setActiveFeedback({
                title: `第 ${attempt} 次驗證`,
                detail: residualToQualityLabel(residual),
                ok: residual <= 0.25,
                working: false,
              });
            },
            onPassed: (_residual, attempt) => {
              const msg = `${taskName}擦好了！${attempt > 1 ? `（${attempt} 次達標）` : ''}`;
              robotSay(attempt === 1 ? `${taskName}擦好了！` : `乾淨了！${attempt} 次達標`, {priority: 'normal'});
              setCelebrateMessage(msg);
              window.setTimeout(() => setCelebrating(true), 600);
              sendRobotCommand('CELEBRATE', 'robot-control', activePortRef.current || undefined).catch(() => {});
            },
            onFailed: () => {
              robotSay('我擦不夠乾淨，請老師補擦', {priority: 'urgent'});
              setActiveFeedback({
                title: '需老師補擦',
                detail: '機器人試了 3 次仍有殘留，請老師接手最後一段（HITL）。',
                ok: false,
                working: false,
              });
            },
          },
        });
        await new Promise((r) => window.setTimeout(r, 700));
        setThinking((prev) => ({...prev, open: false}));
      } else {
        setThinking((prev) => ({...prev, open: false}));
      }
    } catch (error) {
      setThinking((prev) => ({...prev, open: false}));
      robotSay('出狀況了，請老師檢查機器人', {priority: 'urgent'});
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

  useEffect(() => {
    return () => robotVoiceCancel();
  }, []);

  return (
    <>
    {/* flex-col so the drive bar sits at the bottom without fixed-positioning issues */}
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
              <p className="text-xs font-bold text-primary mb-2">機器人任務台</p>
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
                <span>{isConnected ? '實體機器人已連線' : '展示模式'}</span>
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

          {classroomRegions.length > 0 && (
            <motion.section variants={itemVariants} className="mb-5">
              <div className="rounded-2xl border border-primary/10 bg-surface-container-low p-4 sm:p-5">
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2 font-extrabold text-primary text-sm">
                      <ClipboardCheck className="w-4 h-4" />
                      老師剛剛派來的任務
                    </div>
                    <p className="mt-1 text-xs font-bold text-on-surface-variant">學生上台只要按「清空可擦區」，再看回饋。</p>
                  </div>
                  <button
                    onClick={() => sendTask('erase')}
                    data-demo-primary="robot"
                    disabled={busy}
                    className="min-h-11 rounded-xl bg-primary px-4 text-sm font-black text-on-primary transition-colors hover:bg-primary-dim disabled:opacity-50"
                  >
                    清空可擦區
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {classroomRegions.map((region) => (
                    <button
                      key={region.id}
                      onClick={() => sendTask(region.status === 'keep' ? 'keep' : 'erase', region.id)}
                      disabled={busy}
                      className={`min-h-20 rounded-xl border px-3 py-3 text-left transition-all active:scale-95 disabled:opacity-50 ${
                        region.status === 'keep'
                          ? 'border-primary/20 bg-primary-container/50 text-primary hover:bg-primary-container'
                          : region.status === 'erased'
                            ? 'border-outline-variant/20 bg-surface text-on-surface-variant'
                            : 'border-tertiary/20 bg-tertiary-container/45 text-tertiary hover:bg-tertiary-container'
                      }`}
                    >
                      <span className="block text-[10px] font-black tracking-widest">區塊 {region.id}</span>
                      <span className="mt-1 block text-sm font-extrabold leading-tight">{region.label}</span>
                      <span className="mt-1 block text-[11px] font-bold opacity-80">
                        {region.status === 'keep' ? '保留' : region.status === 'erased' ? '已完成' : '可擦，點我執行'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.section>
          )}

          <details className="mb-5 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-4">
            <summary className="cursor-pointer list-none text-sm font-extrabold text-on-surface-variant">
              進階控制（老師測試時再打開）
            </summary>
            <div className="mt-4">
          {/* Task command hero */}
          <motion.section variants={itemVariants} className="mb-5" data-tour="robot-commands">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-xl font-extrabold">任務按鈕</h2>
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
                {QUICK_TASKS.map((task) => (
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
	                placeholder="老師測試用，例如：全板擦除"
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

          <motion.section variants={itemVariants} className="mb-5">
            <EV3ControlPanel />
          </motion.section>
            </div>
          </details>
        </div>
      </div>

      {/* ── Collapsed teacher drive controls ── */}
      <details className="shrink-0 bg-surface-container-lowest border-t border-outline-variant/15 shadow-[0_-4px_20px_0_rgba(0,0,0,.07)]">
        <summary className="mx-auto max-w-6xl cursor-pointer list-none px-4 py-3 text-xs font-extrabold text-on-surface-variant sm:px-6">
          手動方向鍵（老師測試時再打開）
        </summary>
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
      </details>
    </motion.div>
    <AIThinkingOverlay
      open={thinking.open}
      label={thinking.label}
      progress={thinking.progress}
      regions={thinking.regions}
      onClose={() => setThinking((prev) => ({...prev, open: false}))}
    />
    <CelebrationOverlay
      open={celebrating}
      message={celebrateMessage}
      onDone={() => setCelebrating(false)}
    />
    </>
  );
}

const DriveBtn = memo(function DriveBtn({dir, icon: Icon, active, onStart, onStop}: {
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
});
