import {useEffect, useMemo, useState} from 'react';
import {motion} from 'motion/react';
import {AlertTriangle, Brain, CheckCircle2, ClipboardCheck, Eraser, Loader2, Pause, Radio, RefreshCw, ShieldCheck, Sparkles, Users} from 'lucide-react';
import {BoardRegion, ClassroomSession, loadClassroomSession, saveClassroomSession, sendRobotTask} from '../services/classroomApi';

const containerVariants: any = {
  hidden: {opacity: 0},
  show: {opacity: 1, transition: {staggerChildren: 0.06, ease: 'easeOut'}},
  exit: {opacity: 0, y: -10},
};

const itemVariants: any = {
  hidden: {opacity: 0, y: 22},
  show: {opacity: 1, y: 0, transition: {type: 'spring', bounce: 0.25, duration: 0.6}},
};

const paceLabel: Record<string, string> = {
  normal: '正常',
  slow_down: '放慢一點',
  review_needed: '需要再說一次',
};

export default function TeacherDashboard() {
  const [session, setSession] = useState<ClassroomSession | null>(null);
  const [busyCommand, setBusyCommand] = useState('');
  const [hardwareBusy, setHardwareBusy] = useState('');
  const [hardwareNotice, setHardwareNotice] = useState('硬體控制是選配展示：沒有接 UNO R4 WiFi 時會保留操作紀錄，不會中斷課堂流程。');
  const [notice, setNotice] = useState('正在讀取課堂狀態...');

  const loadSession = async () => {
    try {
      const data = await loadClassroomSession();
      setSession(data);
      setNotice('課堂狀態已同步');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '無法讀取課堂狀態');
    }
  };

  useEffect(() => {
    loadSession();
  }, []);

  const total = useMemo(() => {
    if (!session) return 100;
    return session.focusPercent + session.confusedPercent + session.tiredPercent;
  }, [session]);

  const updateRegionStatus = async (regionId: string, status: BoardRegion['status']) => {
    if (!session) return;
    const nextRegions = session.boardRegions.map((region) => (
      region.id === regionId ? {...region, status, reason: status === 'keep' ? '老師手動標記保留，方便孩子繼續看' : status === 'erased' ? '老師確認這區可清空' : region.reason} : region
    ));
    const next = await saveClassroomSession({boardRegions: nextRegions});
    setSession(next);
  };

  const runTask = async (action: string, regionId: string | undefined, message: string) => {
    if (!session) return;
    const busyKey = `${action}-${regionId ?? 'all'}`;
    setBusyCommand(busyKey);
    setNotice(`保存 ${regionId ? `區塊 ${regionId}` : '全部區塊'} 決策...`);
    try {
      const nextRegions = session.boardRegions.map((region) => {
        if (action === 'keep_all') {
          return {...region, status: 'keep' as const, reason: '老師已在本機標記全部保留，讓孩子繼續看'};
        }
        if (action === 'erase_all') {
          return {...region, status: 'erased' as const, reason: '老師已在本機標記全部可清空'};
        }
        if (region.id !== regionId) {
          return region;
        }
        if (action === 'erase') {
          return {...region, status: 'erased' as const, reason: '老師已在本機標記可清空'};
        }
        return {...region, status: 'keep' as const, reason: '老師已在本機標記保留'};
      });
      const next = await saveClassroomSession({boardRegions: nextRegions, currentRecommendation: message});
      setSession(next);
      setNotice(message);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '決策保存失敗');
    } finally {
      setBusyCommand('');
    }
  };

  const sendTaskToRobot = async (action: string, regionId: string | undefined, label: string) => {
    const busyKey = `robot-${action}-${regionId ?? 'all'}`;
    setHardwareBusy(busyKey);
    setHardwareNotice(`準備送出「${label}」到 UNO R4 WiFi...`);
    try {
      const result = await sendRobotTask(action, regionId, 'teacher-dashboard');
      const message = result.ok
        ? `已送到機器人：${label}（${result.command}）`
        : `已保留展示紀錄，硬體尚未連線：${result.error || result.status.lastResponse}`;
      setHardwareNotice(message);
      setNotice(message);
    } catch (error) {
      const message = error instanceof Error ? error.message : '無法送出機器人任務';
      setHardwareNotice(`已保留課堂決策，但硬體送出失敗：${message}`);
      setNotice(`課堂決策仍可展示；${message}`);
    } finally {
      setHardwareBusy('');
    }
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" exit="exit" className="absolute inset-0 w-full h-full overflow-y-auto hide-scrollbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-8 pb-36">
        <motion.section variants={itemVariants} className="mb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <p className="text-[10px] sm:text-xs font-bold tracking-[0.24em] text-primary uppercase mb-2">Elementary Teacher Dashboard</p>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">國小教師看板</h1>
            <p className="text-on-surface-variant mt-3 max-w-2xl leading-relaxed">整合孩子學習狀態、白板區塊與 AI 小老師建議；預設先保存教師決策，確認後可選擇送到 UNO R4 WiFi 機器人。</p>
          </div>
          <button onClick={loadSession} className="h-11 px-4 rounded-full bg-surface-container-high hover:bg-primary hover:text-on-primary transition-all active:scale-95 flex items-center justify-center gap-2 font-bold">
            <RefreshCw className="w-4 h-4" />
            重新同步
          </button>
        </motion.section>

        {!session ? (
          <div className="min-h-[24rem] flex items-center justify-center text-on-surface-variant">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> {notice}
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 sm:gap-6">
            <motion.section variants={itemVariants} className="xl:col-span-4 bg-surface-container-low rounded-3xl p-5 sm:p-7 border border-outline-variant/10 shadow-premium">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-extrabold">班級學習狀態</h2>
                  <p className="text-sm text-on-surface-variant mt-1">由白板分析結果彙整的國小課堂觀察</p>
                </div>
                <Users className="w-8 h-8 text-primary" />
              </div>

              <div className="space-y-4">
                <ClassMetric label="專心聽" value={session.focusPercent} total={total} tone="bg-primary" />
                <ClassMetric label="需要幫忙" value={session.confusedPercent} total={total} tone="bg-tertiary" />
                <ClassMetric label="需要休息" value={session.tiredPercent} total={total} tone="bg-secondary" />
              </div>

              <div className="mt-7 grid grid-cols-2 gap-3">
                <SmallStat icon={Sparkles} label="整理時間" value={`${session.savedMinutes.toFixed(1)} 分`} />
                <SmallStat icon={Brain} label="教學節奏" value={paceLabel[session.teacherPace]} />
              </div>
            </motion.section>

            <motion.section variants={itemVariants} className="xl:col-span-5 bg-surface-container-high rounded-3xl p-5 sm:p-7 border border-outline-variant/10">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-extrabold">白板區塊決策</h2>
                  <p className="text-sm text-on-surface-variant mt-1">綠色保留給孩子看，橘色可清空，灰色已清空。</p>
                </div>
                <ClipboardCheck className="w-7 h-7 text-primary" />
              </div>

              <div className="relative aspect-[16/9] rounded-3xl bg-surface overflow-hidden border border-outline-variant/20 shadow-inner">
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(200,200,188,.28)_1px,transparent_1px),linear-gradient(rgba(200,200,188,.28)_1px,transparent_1px)] bg-[size:24px_24px]" />
                {session.boardRegions.map((region) => (
                  <button
                    key={region.id}
                    onClick={() => updateRegionStatus(region.id, region.status === 'keep' ? 'erasable' : 'keep')}
                    className={`absolute rounded-2xl border-2 p-3 text-left transition-all active:scale-95 ${region.status === 'keep' ? 'bg-primary-container/80 border-primary text-primary' : region.status === 'erasable' ? 'bg-tertiary-container/80 border-tertiary text-tertiary' : 'bg-surface-container-highest border-outline-variant text-on-surface-variant opacity-70'}`}
                    style={{left: `${region.x}%`, top: `${region.y}%`, width: `${region.width}%`, height: `${region.height}%`}}
                  >
                    <span className="text-xs font-black tracking-widest">區塊 {region.id}</span>
                    <span className="block text-sm font-extrabold mt-1">{region.label}</span>
                  </button>
                ))}
              </div>

              <div className="mt-5 space-y-3">
                {session.boardRegions.map((region) => (
                  <div key={region.id} className="bg-surface rounded-2xl p-4 border border-outline-variant/10">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-extrabold">區塊 {region.id} · {region.label}</p>
                        <p className="text-xs text-on-surface-variant mt-1">{region.reason}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 justify-end">
                        <button onClick={() => updateRegionStatus(region.id, 'keep')} className="h-9 px-3 rounded-full bg-primary-container text-primary text-xs font-bold hover:bg-primary hover:text-on-primary transition-colors">保留給孩子</button>
                        <button onClick={() => runTask(region.status === 'erasable' ? 'erase' : 'keep', region.id, region.status === 'erasable' ? `區塊 ${region.id} 已標記為可清空` : `區塊 ${region.id} 已標記保留`)} className="h-9 px-3 rounded-full bg-surface-container-high text-xs font-bold hover:bg-primary hover:text-on-primary transition-colors">套用決策</button>
                        <button
                          onClick={() => sendTaskToRobot(region.status === 'erasable' || region.status === 'erased' ? 'erase' : 'keep', region.id, `${region.status === 'erasable' || region.status === 'erased' ? '擦除' : '保留'}區塊 ${region.id}`)}
                          disabled={Boolean(hardwareBusy)}
                          className="h-9 px-3 rounded-full bg-surface-container-lowest text-xs font-bold border border-primary/20 hover:bg-primary hover:text-on-primary disabled:opacity-50 transition-colors"
                        >
                          送到機器人
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.section>

            <motion.section variants={itemVariants} className="xl:col-span-3 bg-surface-container-lowest rounded-3xl p-5 sm:p-7 border border-outline-variant/10 shadow-premium">
              <div className="flex items-start gap-3 mb-5">
                <div className="w-11 h-11 rounded-2xl bg-primary text-on-primary flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold">AI 小老師建議</h2>
                  <p className="text-sm text-on-surface-variant mt-1">{notice}</p>
                </div>
              </div>

              <div className="bg-primary-container/60 text-primary rounded-2xl p-4 text-sm font-bold leading-relaxed mb-5">
                {session.currentRecommendation}
              </div>

              <div className="space-y-3">
                <TaskButton icon={Eraser} label="全部標記清空" action="erase_all" busyCommand={busyCommand} onRun={runTask} doneText="全部區塊已在本機標記為可清空" />
                {session.boardRegions.map((region) => (
                  <TaskButton key={region.id} icon={region.status === 'erasable' ? Eraser : CheckCircle2} label={`${region.status === 'erasable' ? '標記清空' : '保留'}區塊 ${region.id}`} action={region.status === 'erasable' ? 'erase' : 'keep'} regionId={region.id} busyCommand={busyCommand} onRun={runTask} doneText={`區塊 ${region.id} 決策已保存`} />
                ))}
                <TaskButton icon={Pause} label="全部保留" action="keep_all" busyCommand={busyCommand} onRun={runTask} doneText="全部區塊已標記保留" />
              </div>

              <div className="mt-5 rounded-2xl border border-primary/15 bg-surface p-4">
                <div className="flex items-center gap-2 text-sm font-extrabold text-primary">
                  {hardwareBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />}
                  UNO R4 WiFi 選配送出
                </div>
                <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">{hardwareNotice}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => sendTaskToRobot('erase', undefined, '一鍵全擦')}
                    disabled={Boolean(hardwareBusy)}
                    className="h-10 rounded-xl bg-primary-container text-primary text-xs font-bold hover:bg-primary hover:text-on-primary disabled:opacity-50 transition-colors"
                  >
                    送出全擦
                  </button>
                  <button
                    onClick={() => sendTaskToRobot('pause', undefined, '暫停等待學生抄寫')}
                    disabled={Boolean(hardwareBusy)}
                    className="h-10 rounded-xl bg-surface-container-high text-xs font-bold hover:bg-primary hover:text-on-primary disabled:opacity-50 transition-colors"
                  >
                    暫停機器人
                  </button>
                </div>
              </div>

              <div className="mt-6 flex items-start gap-2 text-xs text-on-surface-variant bg-surface-container p-4 rounded-2xl">
                <AlertTriangle className="w-4 h-4 shrink-0 text-tertiary" />
                本頁主流程會先保存國小課堂與白板決策；送到機器人是比賽展示支線，無硬體時仍會清楚顯示 fallback。
              </div>
            </motion.section>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ClassMetric({label, value, total, tone}: {label: string; value: number; total: number; tone: string}) {
  const percent = total ? Math.round((value / total) * 100) : value;
  return (
    <div>
      <div className="flex justify-between text-sm font-bold mb-2">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-3 rounded-full bg-surface-container-highest overflow-hidden">
        <motion.div initial={{width: 0}} animate={{width: `${percent}%`}} className={`h-full ${tone} rounded-full`} />
      </div>
    </div>
  );
}

function SmallStat({icon: Icon, label, value}: any) {
  return (
    <div className="bg-surface rounded-2xl p-4 border border-outline-variant/10">
      <Icon className="w-5 h-5 text-primary mb-3" />
      <p className="text-[10px] font-bold tracking-widest text-on-surface-variant uppercase">{label}</p>
      <p className="font-extrabold mt-1">{value}</p>
    </div>
  );
}

function TaskButton({icon: Icon, label, action, regionId, busyCommand, onRun, doneText}: any) {
  const busyKey = `${action}-${regionId ?? 'all'}`;
  const isBusy = busyCommand === busyKey;
  return (
    <button
      onClick={() => onRun(action, regionId, doneText)}
      disabled={Boolean(busyCommand)}
      className="w-full min-h-12 px-4 rounded-2xl bg-surface hover:bg-primary hover:text-on-primary disabled:opacity-50 transition-all active:scale-95 flex items-center justify-between gap-3 font-bold border border-outline-variant/10"
    >
      <span className="flex items-center gap-3">
        {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
        {label}
      </span>
    </button>
  );
}
