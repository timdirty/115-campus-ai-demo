import {useEffect, useState} from 'react';
import {motion} from 'motion/react';
import {Activity, BatteryMedium, Bot, Cable, ClipboardCheck, Loader2, Play, Radio, RotateCw, Send, Sparkles, Square, Zap} from 'lucide-react';
import {loadRobotCommands, loadRobotStatus, RobotCommandInfo, RobotStatus, sendRobotCommand, sendRobotTask, TaskLogItem} from '../services/classroomApi';

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

const fallbackCommands: RobotCommandInfo[] = [
  {label: '開始動畫', command: 'SHOW_ON', group: 'display'},
  {label: '停止動畫', command: 'SHOW_OFF', group: 'display'},
  {label: '放煙火', command: 'FIREWORK', group: 'display'},
  {label: '重置動畫', command: 'RESET', group: 'display'},
  {label: 'LED 開', command: 'LED_ON', group: 'hardware'},
  {label: 'LED 關', command: 'LED_OFF', group: 'hardware'},
  {label: '伺服 0 度', command: 'SERVO_0', group: 'hardware'},
  {label: '伺服 90 度', command: 'SERVO_90', group: 'hardware'},
  {label: '伺服 180 度', command: 'SERVO_180', group: 'hardware'},
  {label: '清潔開始', command: 'CLEAN_START', group: 'task'},
  {label: '清潔完成', command: 'CLEAN_STOP', group: 'task'},
  {label: '擦除區塊 B', command: 'ERASE_REGION_B', group: 'task'},
  {label: '保留區塊 B', command: 'KEEP_REGION_B', group: 'task'},
  {label: '停止', command: 'STOP', group: 'task'},
];

function iconForCommand(command: string) {
  if (command.includes('SHOW') || command.includes('CLEAN_START')) return Play;
  if (command.includes('OFF') || command.includes('STOP')) return Square;
  if (command.includes('FIREWORK')) return Zap;
  if (command.includes('RESET')) return RotateCw;
  if (command.includes('ERASE')) return ClipboardCheck;
  if (command.includes('LED') || command.includes('CLEAN_STOP')) return Sparkles;
  return Send;
}

function commandDisplayName(command: string) {
  if (command.includes('ERASE_REGION')) return `擦除 ${command.slice(-1)} 區`;
  if (command.includes('KEEP_REGION')) return `保留 ${command.slice(-1)} 區`;
  if (command === 'CLEAN_START') return '開始清潔';
  if (command === 'CLEAN_STOP') return '清潔完成';
  if (command === 'SHOW_ON') return '開始展示';
  if (command === 'SHOW_OFF') return '停止展示';
  if (command === 'FIREWORK') return '成功動畫';
  if (command === 'RESET') return '重置狀態';
  if (command === 'STOP') return '停止任務';
  if (command.includes('LED')) return command.includes('ON') ? '提示燈開啟' : '提示燈關閉';
  if (command.includes('SERVO')) return '板擦角度調整';
  return command.replace(/_/g, ' ');
}

export default function RobotControl() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('等待連線');
  const [ports, setPorts] = useState<SerialPortInfo[]>([]);
  const [activePort, setActivePort] = useState('');
  const [customCommand, setCustomCommand] = useState('');
  const [robotStatus, setRobotStatus] = useState<RobotStatus | null>(null);
  const [taskLog, setTaskLog] = useState<TaskLogItem[]>([]);
  const [commands, setCommands] = useState<RobotCommandInfo[]>(fallbackCommands);
  const [activeFeedback, setActiveFeedback] = useState({title: '板擦機器人待命', detail: '選擇任務後，這裡會即時顯示動作與結果。', ok: true, working: false});

  const refreshPorts = async () => {
    try {
      const result = await fetch('/api/arduino/ports')
        .then((response) => response.json())
        .catch(() => ({ports: [], activePath: ''}));
      const [robot, commandResult] = await Promise.all([
        loadRobotStatus(),
        loadRobotCommands().catch(() => ({commands: fallbackCommands})),
      ]);
      setCommands(commandResult.commands ?? fallbackCommands);
      setPorts(result.ports ?? []);
      setRobotStatus(robot.status);
      setTaskLog(robot.taskLog);
      setActivePort(robot.status.activePort || result.activePath || result.ports?.[0]?.path || '');
      setStatus(robot.status.connected ? '已偵測到實體機器人' : '展示模式：尚未偵測到實體機器人，指令會保留為任務紀錄');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '無法連線到本機硬體服務');
    }
  };

  useEffect(() => {
    refreshPorts();
  }, []);

  const sendCommand = async (command: string) => {
    const trimmedCommand = command.trim();
    if (!trimmedCommand) return;

    setBusy(true);
    const displayName = commandDisplayName(trimmedCommand);
    setStatus(`正在建立「${displayName}」任務...`);
    setActiveFeedback({title: displayName, detail: '正在送出任務，等待回饋。', ok: true, working: true});

    try {
      const result = await sendRobotCommand(trimmedCommand, 'robot-control', activePort || undefined);
      setRobotStatus(result.status);
      setTaskLog(result.taskLog ?? []);
      setActivePort(result.status.activePort);
      setStatus(result.ok ? `${displayName} 已送出` : `已保留展示紀錄：${result.error || result.status.lastResponse}`);
      setActiveFeedback({
        title: result.ok ? `${displayName} 已接收` : `${displayName} 已記錄`,
        detail: result.ok ? '實體機器人已收到指令。' : '目前使用展示備援，任務仍會出現在紀錄中。',
        ok: result.ok,
        working: false,
      });
      setCustomCommand('');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '無法送出指令');
      setActiveFeedback({title: `${displayName} 未送出`, detail: error instanceof Error ? error.message : '請稍後再試。', ok: false, working: false});
    } finally {
      setBusy(false);
    }
  };

  const sendTask = async (action: string, regionId?: string) => {
    setBusy(true);
    const taskName = regionId ? `區塊 ${regionId}` : '全板';
    setStatus(`正在建立${taskName}任務...`);
    setActiveFeedback({title: `${taskName}任務`, detail: '正在整理擦除範圍與保留重點。', ok: true, working: true});
    try {
      const result = await sendRobotTask(action, regionId, 'robot-control', activePort || undefined);
      setRobotStatus(result.status);
      setTaskLog(result.taskLog ?? []);
      setActivePort(result.status.activePort);
      const displayName = commandDisplayName(result.command);
      setStatus(result.ok ? `${displayName} 已送出` : `已保留展示紀錄：${result.error || result.status.lastResponse}`);
      setActiveFeedback({
        title: result.ok ? `${displayName} 已排程` : `${displayName} 已記錄`,
        detail: result.ok ? '板擦機器人會依照區塊執行。' : '展示模式會保留任務流程，方便評審看見互動結果。',
        ok: result.ok,
        working: false,
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '無法送出任務');
      setActiveFeedback({title: `${taskName}任務未送出`, detail: error instanceof Error ? error.message : '請稍後再試。', ok: false, working: false});
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" exit="exit" className="absolute inset-0 w-full h-full overflow-y-auto hide-scrollbar">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6 lg:py-10 pb-36">
        <motion.section variants={itemVariants} className="mb-6 sm:mb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-primary mb-2">機器人指令台</p>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">板擦任務台</h1>
            <p className="text-on-surface-variant mt-3 max-w-2xl leading-relaxed">選任務、看回饋、留紀錄。</p>
          </div>
          <button onClick={refreshPorts} className="h-11 px-4 rounded-full bg-surface-container-high hover:bg-primary hover:text-on-primary transition-all active:scale-95 flex items-center justify-center gap-2 font-bold">
            <RotateCw className="w-4 h-4" />
            重新偵測
          </button>
        </motion.section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
          <motion.section variants={itemVariants} className="lg:col-span-5 bg-surface-container-low rounded-3xl sm:rounded-[2rem] p-5 sm:p-7 border border-outline-variant/10 shadow-premium">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary text-on-primary flex items-center justify-center shrink-0">
                  <Radio className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold">連線狀態</h2>
                  <p className="text-sm text-on-surface-variant mt-1">{status}</p>
                </div>
              </div>
              <span className={`w-3 h-3 rounded-full mt-2 ${ports.length ? 'bg-primary animate-pulse' : 'bg-outline-variant'}`} />
            </div>

            <label className="block text-xs font-bold tracking-widest text-on-surface-variant mb-2">連接埠</label>
            <select
              value={activePort}
              onChange={(event) => setActivePort(event.target.value)}
              className="w-full h-12 rounded-2xl bg-surface px-4 outline-none border border-outline-variant/20 text-sm font-bold"
            >
              {!ports.length && <option value="">尚未偵測到連接埠</option>}
              {ports.map((port) => (
                <option key={port.path} value={port.path}>
                  {port.path}{port.manufacturer ? ` - ${port.manufacturer}` : ''}
                </option>
              ))}
            </select>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <StatusMetric icon={Cable} label="硬體服務" value={ports.length ? '已偵測' : '展示備援'} />
              <StatusMetric icon={BatteryMedium} label="傳輸狀態" value={ports.length ? '可送出' : '先記錄'} />
              <StatusMetric icon={Activity} label="最後指令" value={robotStatus?.lastCommand || '尚無'} />
              <StatusMetric icon={Sparkles} label="最後回應" value={robotStatus?.lastResponse || '尚無'} />
            </div>

            <div className={`mt-5 overflow-hidden rounded-3xl border p-5 transition ${activeFeedback.ok ? 'border-primary/15 bg-primary-container/40' : 'border-tertiary/20 bg-tertiary/10'}`}>
              <div className="flex items-center gap-4">
                <div className={`robot-board-avatar grid h-20 w-20 place-items-center rounded-3xl bg-surface text-primary shadow-lg ${activeFeedback.working ? 'robot-board-active' : ''}`}>
                  {activeFeedback.working ? <Loader2 className="h-9 w-9 animate-spin" /> : activeFeedback.ok ? <Bot className="h-10 w-10" /> : <Square className="h-9 w-9" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-on-surface-variant">即時回饋</p>
                  <h3 className="mt-1 text-xl font-extrabold leading-tight">{activeFeedback.title}</h3>
                  <p className="mt-1 text-sm font-bold leading-6 text-on-surface-variant">{activeFeedback.detail}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
                {['建立', '送出', '紀錄'].map((step, index) => (
                  <div key={step} className={`rounded-xl px-2 py-2 ${activeFeedback.working ? index === 0 ? 'bg-primary text-on-primary' : 'bg-surface text-on-surface-variant' : activeFeedback.ok ? 'bg-primary text-on-primary' : index === 2 ? 'bg-tertiary text-on-tertiary' : 'bg-surface text-on-surface-variant'}`}>
                    {step}
                  </div>
                ))}
              </div>
            </div>
          </motion.section>

          <motion.section variants={itemVariants} className="lg:col-span-7 bg-surface-container-high rounded-3xl sm:rounded-[2rem] p-5 sm:p-7 border border-outline-variant/10" data-tour="robot-commands">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <h2 className="text-xl font-extrabold">快速指令</h2>
                <p className="text-sm text-on-surface-variant mt-1">每個按鈕都會更新狀態、留下任務紀錄，接上硬體後沿用同一流程。</p>
              </div>
              {busy && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2.5">
              {commands.map((item) => {
                const Icon = iconForCommand(item.command);
                return (
                <button
                  key={item.command}
                  onClick={() => sendCommand(item.command)}
                  disabled={busy}
                  className="min-h-24 rounded-2xl bg-surface hover:bg-primary hover:text-on-primary disabled:opacity-50 disabled:hover:bg-surface disabled:hover:text-on-surface transition-all active:scale-95 flex flex-col items-center justify-center gap-2 p-3 text-center font-bold border border-outline-variant/10"
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm">{item.label}</span>
                  <span className="text-[10px] opacity-60">{commandDisplayName(item.command)}</span>
                </button>
                );
              })}
            </div>

            <div className="mt-6 rounded-2xl bg-primary-container/50 p-4 border border-primary/10">
              <div className="flex items-center gap-2 font-extrabold text-primary mb-3">
                <ClipboardCheck className="w-5 h-5" />
                教師建議任務
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  {label: '擦除區塊 A', action: 'erase', regionId: 'A'},
                  {label: '擦除區塊 B', action: 'erase', regionId: 'B'},
                  {label: '擦除區塊 C', action: 'erase', regionId: 'C'},
                  {label: '保留重點區 A', action: 'keep', regionId: 'A'},
                  {label: '暫停等待學生抄寫', action: 'pause'},
                ].map((task) => (
                  <button key={`${task.action}-${task.regionId ?? 'all'}`} onClick={() => sendTask(task.action, task.regionId)} disabled={busy} className="h-11 rounded-xl bg-surface hover:bg-primary hover:text-on-primary disabled:opacity-50 transition-all active:scale-95 text-sm font-bold">
                    {task.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 bg-surface rounded-2xl p-2 flex items-center gap-2 border border-outline-variant/10">
              <input
                value={customCommand}
                onChange={(event) => setCustomCommand(event.target.value.toUpperCase())}
                onKeyDown={(event) => event.key === 'Enter' && customCommand.trim() && sendCommand(customCommand)}
                placeholder="輸入自訂任務，例如：擦除 A 區"
                className="flex-1 bg-transparent outline-none px-3 text-sm font-bold"
              />
              <button
                onClick={() => sendCommand(customCommand)}
                disabled={busy || !customCommand.trim()}
                className="h-10 px-4 rounded-xl bg-primary text-on-primary disabled:opacity-50 transition-all active:scale-95 flex items-center gap-2 font-bold text-sm"
              >
                <Send className="w-4 h-4" />
                送出
              </button>
            </div>
          </motion.section>
        </div>

        <motion.section variants={itemVariants} className="mt-6 bg-surface-container-low rounded-3xl p-5 sm:p-7 border border-outline-variant/10">
          <h2 className="text-xl font-extrabold mb-4">任務紀錄</h2>
          <div className="space-y-3 max-h-72 overflow-y-auto hide-scrollbar">
            {taskLog.length === 0 ? (
              <p className="text-sm text-on-surface-variant">尚未送出任務。</p>
            ) : taskLog.slice(0, 12).map((item) => (
              <div key={item.id} className="bg-surface rounded-2xl p-4 border border-outline-variant/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <p className="font-extrabold">{commandDisplayName(item.command)} <span className={`text-xs ${item.ok ? 'text-primary' : 'text-tertiary'}`}>{item.ok ? '已送出' : '備援紀錄'}</span></p>
                  <p className="text-xs text-on-surface-variant mt-1">{item.message}</p>
                </div>
                <p className="text-xs text-on-surface-variant">{new Date(item.createdAt).toLocaleTimeString('zh-TW', {hour: '2-digit', minute: '2-digit'})}</p>
              </div>
            ))}
          </div>
        </motion.section>
      </div>
    </motion.div>
  );
}

function StatusMetric({icon: Icon, label, value}: any) {
  return (
    <div className="bg-surface rounded-2xl p-4 border border-outline-variant/10">
      <Icon className="w-5 h-5 text-primary mb-3" />
      <p className="text-[10px] font-bold text-on-surface-variant">{label}</p>
      <p className="text-sm font-extrabold mt-1 break-words">{value}</p>
    </div>
  );
}
