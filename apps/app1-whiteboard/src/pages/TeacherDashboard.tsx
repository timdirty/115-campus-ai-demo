import {useEffect, useMemo, useRef, useState} from 'react';
import {motion} from 'motion/react';
import {AlertTriangle, ArrowRight, Bot, Brain, CheckCircle2, ClipboardCheck, Eraser, Loader2, Pause, Radio, RefreshCw, Settings2, ShieldCheck, Sparkles, Users, Video} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';
import {BoardRegion, ClassroomSession, EraseSequenceEvent, HardwareCalibrationProfile, eraseRegionSequence, loadClassroomSession, saveClassroomSession, sendRobotCommand, sendRobotTask} from '../services/classroomApi';
import {saveDemoProgress} from '../services/demoProgress';
import {estimateRobotPose} from '../services/robotPose';

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

const SERVO_ANGLE_FIELDS = [
  ['regionA', '左區'],
  ['regionB', '右區'],
  ['eraseAll', '全擦'],
  ['standby', '待命'],
] as const;

const HARDWARE_TOGGLES = [
  ['cameraMounted', '攝影機已固定在白板前方', Video],
  ['boardAnchored', '板擦機構已對齊白板軌道', Bot],
  ['visionReady', '白板辨識與區塊定位已可用', Sparkles],
] as const;

function regionDisplayName(regionId?: string) {
  if (regionId === 'A') return '左區';
  if (regionId === 'B') return '右區';
  return regionId ? `區塊 ${regionId}` : '全部';
}

export default function TeacherDashboard({onNavigate}: {onNavigate?: (tab: string) => void}) {
  const [session, setSession] = useState<ClassroomSession | null>(null);
  const [hardwareProfileDraft, setHardwareProfileDraft] = useState<HardwareCalibrationProfile | null>(null);
  const [busyCommand, setBusyCommand] = useState('');
  const [hardwareBusy, setHardwareBusy] = useState('');
  const [robotStage, setRobotStage] = useState<'idle' | 'sending' | 'done' | 'fallback'>('idle');
  const [robotTarget, setRobotTarget] = useState<string | undefined>();
  const [completedRegions, setCompletedRegions] = useState<string[]>([]);
  const [robotTaskId, setRobotTaskId] = useState('');
  const [hardwareNotice, setHardwareNotice] = useState('機器人連動是選配展示：沒有接實體機器人時也會保留操作紀錄，不會中斷課堂流程。');
  const [notice, setNotice] = useState('正在讀取課堂狀態...');
  const robotResetTimerRef = useRef<number | null>(null);
  const [sequenceProgress, setSequenceProgress] = useState<{region: string; status: 'sending' | 'ok' | 'timeout' | 'error'}[]>([]);
  const [sequenceBusy, setSequenceBusy] = useState(false);
  const cancelSequenceRef = useRef<(() => void) | null>(null);
  const showEngineerTools = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('engineerTools') === '1';

  useEffect(() => {
    return () => {
      if (robotResetTimerRef.current) clearTimeout(robotResetTimerRef.current);
    };
  }, []);

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

  useEffect(() => {
    if (session) {
      setHardwareProfileDraft(session.hardwareProfile);
    }
  }, [session]);

  const total = useMemo(() => {
    if (!session) return 100;
    return session.focusPercent + session.confusedPercent + session.tiredPercent;
  }, [session]);
  const regionStats = useMemo(() => {
    if (!session) {
      return {keep: 0, erasable: 0, cleared: 0};
    }
    return session.boardRegions.reduce((acc, region) => {
      if (region.status === 'keep') acc.keep += 1;
      if (region.status === 'erasable') acc.erasable += 1;
      if (region.status === 'erased') acc.cleared += 1;
      return acc;
    }, {keep: 0, erasable: 0, cleared: 0});
  }, [session]);
  const persistedRobotPose = session?.hardwareProfile.robotPose;
  const activeRobotRegion = useMemo(() => {
    if (!session || !robotTarget || robotTarget === 'ALL') return null;
    return session.boardRegions.find((region) => region.id === robotTarget) ?? null;
  }, [robotTarget, session]);
  const robotMarkerPosition = robotStage === 'idle'
    ? {left: `${persistedRobotPose?.x ?? 92}%`, top: `${persistedRobotPose?.y ?? 14}%`}
    : activeRobotRegion
      ? {left: `${activeRobotRegion.x + activeRobotRegion.width / 2}%`, top: `${activeRobotRegion.y + activeRobotRegion.height / 2}%`}
      : {left: '50%', top: '50%'};
  const robotProgress = robotStage === 'idle' ? 0 : robotStage === 'sending' ? 54 : 100;
  const robotTargetLabel = robotTarget === 'ALL' ? '全板' : robotTarget ? `區塊 ${robotTarget}` : persistedRobotPose?.targetRegion ? `區塊 ${persistedRobotPose.targetRegion}` : '待命';
  const readinessChecks = useMemo(() => ([
    {
      label: '白板區塊',
      ok: Boolean(session?.boardRegions.length),
      detail: session?.boardRegions.length ? `已建立 ${session.boardRegions.length} 個區塊` : '尚未取得白板分析',
    },
    {
      label: '老師決策',
      ok: regionStats.keep + regionStats.erasable + regionStats.cleared > 0,
      detail: `保留 ${regionStats.keep} 區，可清空 ${regionStats.erasable + regionStats.cleared} 區`,
    },
    {
      label: '任務路徑',
      ok: hardwareNotice.includes('機器人任務已送出') || hardwareNotice.includes('正在建立'),
      detail: hardwareBusy ? '任務送出中' : '展示模式也會保留任務紀錄',
    },
  ]), [hardwareBusy, hardwareNotice, regionStats, session]);

  const persistErasedRegions = async (regionIds: string[], reason: string) => {
    if (!session || regionIds.length === 0) return session;
    const nextRegions = session.boardRegions.map((region) => regionIds.includes(region.id)
      ? {...region, status: 'erased' as const, reason}
      : region);
    const next = await saveClassroomSession({
      boardRegions: nextRegions,
      currentRecommendation: `板擦任務已完成：${regionIds.map(regionDisplayName).join('、')} 已清空，可以進入下一個教學活動。`,
    });
    setSession(next);
    setHardwareProfileDraft(next.hardwareProfile);
    return next;
  };

  const persistRobotTaskOutcome = async (action: string, regionId: string | undefined, command: string) => {
    if (!session) return session;
    const nextRegions = action === 'erase'
      ? session.boardRegions.map((region) => {
        const shouldErase = regionId ? region.id === regionId : region.status === 'erasable' || region.status === 'erased';
        return shouldErase
          ? {...region, status: 'erased' as const, reason: '板擦任務已完成，老師可開始下一段課堂。'}
          : region;
      })
      : session.boardRegions;
    const currentProfile = hardwareProfileDraft ?? session.hardwareProfile;
    const next = await saveClassroomSession({
      boardRegions: nextRegions,
      currentRecommendation: action === 'erase'
        ? `${regionId ? regionDisplayName(regionId) : '可清空區'} 已完成板擦任務，下一步可到紀錄本或小老師延伸複習。`
        : session.currentRecommendation,
      hardwareProfile: {
        ...currentProfile,
        robotPose: estimateRobotPose(command, {
          boardRegions: session.boardRegions,
          boardCalibration: currentProfile.boardCalibration,
          servoAngles: currentProfile.servoAngles,
          previousPose: session.hardwareProfile.robotPose,
        }),
      },
    });
    setSession(next);
    setHardwareProfileDraft(next.hardwareProfile);
    return next;
  };

  const markCompletedRegions = (action: string, regionId: string | undefined, regions: BoardRegion[]) => {
    if (action !== 'erase') return;
    if (regionId) {
      setCompletedRegions((prev) => prev.includes(regionId) ? prev : [...prev, regionId]);
      return;
    }
    const targets = regions.filter((region) => region.status === 'erasable' || region.status === 'erased').map((region) => region.id);
    setCompletedRegions(targets);
  };

  const updateRegionStatus = async (regionId: string, status: BoardRegion['status']) => {
    if (!session) return;
    const nextRegions = session.boardRegions.map((region) => (
      region.id === regionId ? {...region, status, reason: status === 'keep' ? '老師手動標記保留，方便孩子繼續看' : status === 'erased' ? '老師確認這區可清空' : region.reason} : region
    ));
    const next = await saveClassroomSession({boardRegions: nextRegions});
    setSession(next);
    saveDemoProgress({teacher: true});
  };

  const runTask = async (action: string, regionId: string | undefined, message: string) => {
    if (!session) return;
    const busyKey = `${action}-${regionId ?? 'all'}`;
    setBusyCommand(busyKey);
    setNotice(`保存 ${regionId ? regionDisplayName(regionId) : '全部區域'} 決策...`);
    try {
      const nextRegions = session.boardRegions.map((region) => {
        if (action === 'keep_all') {
          return {...region, status: 'keep' as const, reason: '老師已標記全部保留，讓孩子繼續看'};
        }
        if (action === 'erase_all') {
          return {...region, status: 'erased' as const, reason: '老師已標記全部可清空'};
        }
        if (region.id !== regionId) {
          return region;
        }
        if (action === 'erase') {
          return {...region, status: 'erased' as const, reason: '老師已標記可清空'};
        }
        return {...region, status: 'keep' as const, reason: '老師已標記保留'};
      });
      const next = await saveClassroomSession({boardRegions: nextRegions, currentRecommendation: message});
      setSession(next);
      saveDemoProgress({teacher: true});
      setNotice(message);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '決策保存失敗');
    } finally {
      setBusyCommand('');
    }
  };

  const updateServoDraft = (key: keyof HardwareCalibrationProfile['servoAngles'], value: number) => {
    setHardwareProfileDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        servoAngles: {
          ...current.servoAngles,
          [key]: Math.max(0, Math.min(180, Math.round(value))),
        },
      };
    });
  };

  const updateHardwareToggle = (key: 'cameraMounted' | 'boardAnchored' | 'visionReady', value: boolean) => {
    setHardwareProfileDraft((current) => current ? {...current, [key]: value} : current);
  };

  const saveHardwareProfile = async () => {
    if (!session || !hardwareProfileDraft) return;
    setHardwareBusy('save-profile');
    try {
      const nextProfile = {
        ...hardwareProfileDraft,
        lastCalibratedAt: new Date().toISOString(),
      };
      const next = await saveClassroomSession({hardwareProfile: nextProfile});
      setSession(next);
      setHardwareProfileDraft(next.hardwareProfile);
      setHardwareNotice('已保存實體機器人校正設定，接上機器人後可直接使用這組角度。');
      setNotice('實機校正設定已保存');
    } catch (error) {
      setHardwareNotice(error instanceof Error ? error.message : '無法保存校正設定');
    } finally {
      setHardwareBusy('');
    }
  };

  const sendCalibrationPreview = async (command: string, label: string) => {
    if (hardwareBusy) {
      setHardwareNotice('上一個機器人任務仍在處理，請稍後。');
      return;
    }
    setHardwareBusy(command);
    setHardwareNotice(`正在送出 ${label} 校正任務...`);
    try {
      const result = await sendRobotCommand(command, 'teacher-calibration');
      if (session && hardwareProfileDraft) {
        const next = await saveClassroomSession({
          hardwareProfile: {
            ...hardwareProfileDraft,
            robotPose: estimateRobotPose(command, {
              boardRegions: session.boardRegions,
              boardCalibration: hardwareProfileDraft.boardCalibration,
              servoAngles: hardwareProfileDraft.servoAngles,
              previousPose: session.hardwareProfile.robotPose,
            }),
          },
        });
        setSession(next);
        setHardwareProfileDraft(next.hardwareProfile);
      }
      setHardwareNotice(result.ok
        ? `${label} 校正任務已送出`
        : `${label} 任務已記錄，展示模式可繼續操作`);
      setNotice(result.ok ? `${label} 校正成功` : `${label} 已保留展示紀錄`);
    } catch (error) {
      setHardwareNotice(error instanceof Error ? error.message : `${label} 校正任務送出失敗`);
    } finally {
      setHardwareBusy('');
    }
  };

  const pushServoProfileToRobot = async () => {
    if (!hardwareProfileDraft) return;
    const sequence = [
      {command: `SET_REGION_A:${hardwareProfileDraft.servoAngles.regionA}`, label: '左區'},
      {command: `SET_REGION_B:${hardwareProfileDraft.servoAngles.regionB}`, label: '右區'},
      {command: `SET_ERASE_ALL:${hardwareProfileDraft.servoAngles.eraseAll}`, label: '全擦'},
      {command: `SET_STANDBY:${hardwareProfileDraft.servoAngles.standby}`, label: '待命'},
    ];
    setHardwareBusy('push-profile');
    setHardwareNotice('正在把校正角度寫到實體機器人...');
    try {
      for (const item of sequence) {
        await sendRobotCommand(item.command, 'teacher-calibration');
      }
      setHardwareNotice('實體機器人已收到左區、右區、全擦與待命角度，接著可以預覽各區域。');
      setNotice('校正角度已推送到機器人');
    } catch (error) {
      setHardwareNotice(error instanceof Error ? error.message : '無法推送校正角度到機器人');
    } finally {
      setHardwareBusy('');
    }
  };

  const sendTaskToRobot = async (action: string, regionId: string | undefined, label: string) => {
    if (!session) {
      setHardwareNotice('請先完成白板分析與教師決策，再送出機器人任務。');
      return;
    }
    if (session.boardRegions.length === 0) {
      setHardwareNotice('尚未建立白板區塊，請先回首頁拍白板或上傳圖片。');
      setNotice('請先取得白板區塊，再送出機器人任務。');
      return;
    }
    if (action === 'erase' && regionId) {
      const targetRegion = session.boardRegions.find((region) => region.id === regionId);
      if (!targetRegion || (targetRegion.status !== 'erasable' && targetRegion.status !== 'erased')) {
        setHardwareNotice(`${regionDisplayName(regionId)}目前不是可清空狀態，請先由老師確認後再送出。`);
        setNotice(`請先把${regionDisplayName(regionId)}標記成可清空，再送機器人。`);
        return;
      }
    }
    if (action === 'erase' && !regionId && regionStats.erasable + regionStats.cleared === 0) {
      setHardwareNotice('目前沒有標記可清空的區塊，建議先完成老師決策。');
      setNotice('先確認哪些區塊可清空，再送出全擦任務。');
      return;
    }
    if (hardwareBusy) {
      setHardwareNotice('上一個機器人任務正在處理，請等任務回饋完成。');
      return;
    }
    const busyKey = `robot-${action}-${regionId ?? 'all'}`;
    setHardwareBusy(busyKey);
    setRobotTarget(regionId ?? 'ALL');
    setRobotStage('sending');
    setRobotTaskId(`E-${Date.now().toString().slice(-4)}`);
    setHardwareNotice(`正在建立「${label}」任務，板擦機器人會先確認目標區再執行。`);
    try {
      const result = await sendRobotTask(action, regionId, 'teacher-dashboard');
      const nextSession = await persistRobotTaskOutcome(action, regionId, result.command);
      setRobotStage(result.ok ? 'done' : 'fallback');
      markCompletedRegions(action, regionId, nextSession?.boardRegions ?? session.boardRegions);
      const message = result.ok
        ? `機器人任務已送出：${label}`
        : `展示模式已完成${regionId ? `「區塊 ${regionId}」` : '全板'}擦除。接上實體機器人後，同一個流程就能實際執行。`;
      setHardwareNotice(message);
      setNotice(message);
      saveDemoProgress({teacher: true, robot: true});
    } catch (error) {
      const message = error instanceof Error ? error.message : '無法送出機器人任務';
      const fallbackCommand = action === 'erase'
        ? (regionId ? `ERASE_REGION_${regionId}` : 'ERASE_ALL')
        : action === 'pause' ? 'PAUSE_TASK' : action.toUpperCase();
      const nextSession = await persistRobotTaskOutcome(action, regionId, fallbackCommand);
      markCompletedRegions(action, regionId, nextSession?.boardRegions ?? session.boardRegions);
      setRobotStage('fallback');
      setHardwareNotice(`展示模式已完成${regionId ? `「區塊 ${regionId}」` : '全板'}擦除。接上實體機器人後，同一個流程就能實際執行。`);
      setNotice(`課堂決策仍可展示；${message}`);
      saveDemoProgress({teacher: true, robot: true});
    } finally {
      setHardwareBusy('');
      if (robotResetTimerRef.current) clearTimeout(robotResetTimerRef.current);
      robotResetTimerRef.current = window.setTimeout(() => {
        setRobotStage('idle');
        setRobotTarget(undefined);
        setRobotTaskId('');
      }, 3200);
    }
  };

  const runEraseSequence = () => {
    if (!session) return;
    const targets = session.boardRegions
      .filter((r) => r.status === 'erasable' || r.status === 'erased')
      .map((r) => r.id);
    if (targets.length === 0) {
      setNotice('沒有標記可清空的區塊，請先確認白板決策。');
      return;
    }
    setSequenceBusy(true);
    setSequenceProgress(targets.map((r) => ({region: r, status: 'sending' as const})));
    setRobotTarget('ALL');
    setRobotStage('sending');

    const cancel = eraseRegionSequence(targets, (event: EraseSequenceEvent) => {
      if (event.type === 'ok') {
        setSequenceProgress((prev) =>
          prev.map((p) => p.region === event.region ? {...p, status: 'ok'} : p),
        );
        setCompletedRegions((prev) => prev.includes(event.region) ? prev : [...prev, event.region]);
        void persistErasedRegions([event.region], '循序擦除已由機器人回報完成。');
      }
      if (event.type === 'timeout' || event.type === 'error') {
        setSequenceProgress((prev) =>
          prev.map((p) => p.region === event.region ? {...p, status: event.type} : p),
        );
      }
      if (event.type === 'done') {
        setSequenceBusy(false);
        cancelSequenceRef.current = null;
        setRobotStage(event.failed === 0 ? 'done' : 'fallback');
        saveDemoProgress({teacher: true, robot: true});
        if (event.failed === 0) {
          void persistErasedRegions(targets, '循序擦除已全部完成，老師可開始下一段課堂。');
        } else if (event.failed === targets.length) {
          setCompletedRegions(targets);
          void persistErasedRegions(targets, '展示模式已完成循序擦除，接上實體機器人後同一個流程就能實際執行。');
        }
        setNotice(event.failed === 0
          ? `全部 ${event.ok} 個區塊已擦除完成 ✓`
          : event.failed === targets.length
            ? `展示模式完成 ${targets.length} 個區塊，接上實體機器人後會改由機器人回報。`
            : `完成 ${event.ok} 個，${event.failed} 個未確認（展示模式可繼續操作）`);
        const t = setTimeout(() => { setRobotStage('idle'); setRobotTarget(undefined); }, 3200);
        cancelSequenceRef.current = () => clearTimeout(t);
      }
    }, 1500);

    cancelSequenceRef.current = cancel;
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" exit="exit" className="absolute inset-0 w-full h-full overflow-y-auto hide-scrollbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-8 pb-36">
        <motion.section variants={itemVariants} className="mb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-primary mb-2">教師決策台</p>
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight">國小教師看板</h1>
            <p className="text-on-surface-variant mt-3 max-w-2xl leading-relaxed">看狀態、選左區或右區、送機器人。沒有接實體機器人也會留下任務紀錄。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={loadSession} className="h-11 px-4 rounded-full bg-surface-container-high hover:bg-primary hover:text-on-primary transition-all active:scale-95 flex items-center justify-center gap-2 font-bold">
              <RefreshCw className="w-4 h-4" />
              重新同步
            </button>
            {onNavigate && (
              <button onClick={() => onNavigate('robot')} className="h-11 px-4 rounded-full bg-primary text-on-primary hover:bg-primary-dim transition-all active:scale-95 flex items-center justify-center gap-2 font-bold">
                到機器人台
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </motion.section>

        {!session ? (
          <div className="min-h-[24rem] flex items-center justify-center text-on-surface-variant">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> {notice}
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 sm:gap-6">
            <motion.section variants={itemVariants} className="xl:col-span-4 bg-surface-container-low rounded-3xl p-5 sm:p-7 border border-outline-variant/10 shadow-premium" data-tour="class-stats">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-extrabold">班級學習狀態</h2>
                  <p className="text-sm text-on-surface-variant mt-1">白板分析彙整</p>
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

            <motion.section variants={itemVariants} className="xl:col-span-5 bg-surface-container-high rounded-3xl p-5 sm:p-7 border border-outline-variant/10" data-tour="board-regions">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-extrabold">白板左右區決策</h2>
                  <p className="text-sm text-on-surface-variant mt-1">只分左區、右區，點一下就切換保留或可擦。</p>
                </div>
                <button
                  onClick={() => sendTaskToRobot('erase', undefined, '清空可擦區')}
                  data-demo-primary="teacher"
                  disabled={Boolean(hardwareBusy) || regionStats.erasable + regionStats.cleared === 0}
                  className="min-h-11 rounded-xl bg-primary px-4 text-sm font-black text-on-primary transition-colors hover:bg-primary-dim disabled:opacity-50"
                >
                  送可擦區
                </button>
              </div>

              {completedRegions.length > 0 && (
                <motion.div
                  initial={{opacity: 0, y: -8}} animate={{opacity: 1, y: 0}}
                  className="mb-3 flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-on-primary text-xs font-black"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {robotTarget === 'ALL' ? '全板' : regionDisplayName(robotTarget)} 板擦完成 · 老師確認後可繼續下一節課
                  <button
                    onClick={(e) => { e.stopPropagation(); setCompletedRegions([]); }}
                    className="ml-auto shrink-0 rounded-xl bg-on-primary/15 px-2.5 py-1 text-[10px] font-black hover:bg-on-primary/25 transition-colors"
                  >
                    重置記錄
                  </button>
                </motion.div>
              )}

              <div className="relative aspect-[16/9] rounded-3xl bg-surface overflow-hidden border border-outline-variant/20 shadow-inner">
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(200,200,188,.28)_1px,transparent_1px),linear-gradient(rgba(200,200,188,.28)_1px,transparent_1px)] bg-[size:24px_24px]" />
                {session.boardRegions.map((region) => (
                  <button
                    key={region.id}
                    onClick={() => updateRegionStatus(region.id, region.status === 'keep' ? 'erasable' : 'keep')}
                    className={`absolute rounded-2xl border-2 p-3 text-left transition-all active:scale-95 ${robotTarget === region.id ? 'robot-region-focus' : ''} ${region.status === 'keep' ? 'bg-primary-container/80 border-primary text-primary' : region.status === 'erasable' ? 'bg-tertiary-container/80 border-tertiary text-tertiary' : 'bg-surface-container-highest border-outline-variant text-on-surface-variant opacity-70'}`}
                    style={{left: `${region.x}%`, top: `${region.y}%`, width: `${region.width}%`, height: `${region.height}%`}}
                  >
                    {robotStage === 'fallback' && robotTarget === region.id && (
                      <span className="absolute top-1 right-1 z-10 rounded-full bg-amber-400 text-amber-900 text-[9px] font-black px-1.5 py-0.5 animate-pulse">
                        ⚡ 虛擬執行
                      </span>
                    )}
                    <span className="text-xs font-black tracking-widest">{regionDisplayName(region.id)}</span>
                    <span className="block text-sm font-extrabold mt-1">{region.label}</span>
                    {completedRegions.includes(region.id) && (
                      <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-primary/25 text-primary text-2xl font-black pointer-events-none">✓</span>
                    )}
                  </button>
                ))}
                <motion.div
                  animate={{
                    left: robotMarkerPosition.left,
                    top: robotMarkerPosition.top,
                    scale: robotStage === 'sending' ? 1.12 : 1,
                  }}
                  transition={{type: 'spring', damping: 18, stiffness: 120}}
                  className={`board-robot-marker absolute z-20 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border bg-surface-container-lowest text-primary shadow-premium ${robotStage !== 'idle' ? 'board-robot-active' : ''} ${robotTarget === 'ALL' ? 'board-robot-sweep' : ''}`}
                >
                  <Bot className="h-7 w-7" />
                  <span className="absolute -right-2 -top-2 rounded-full bg-primary px-2 py-0.5 text-[9px] font-black text-on-primary">{robotTaskId || 'E-01'}</span>
                  {robotStage !== 'idle' && <span className="absolute h-20 w-20 rounded-full border-2 border-primary/30" />}
                </motion.div>
              </div>

              <div className="mt-5 space-y-3">
                {session.boardRegions.map((region) => (
                  <div key={region.id} className="bg-surface rounded-2xl p-4 border border-outline-variant/10">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-extrabold">{regionDisplayName(region.id)} · {region.label}</p>
                        <p className="text-xs text-on-surface-variant mt-1">{region.reason}</p>
                      </div>
                      <div className="flex flex-wrap gap-2 justify-end">
                        <button onClick={() => updateRegionStatus(region.id, 'keep')} className="min-h-10 px-3 rounded-full bg-primary-container text-primary text-xs font-bold hover:bg-primary hover:text-on-primary transition-colors">保留</button>
                        <button onClick={() => runTask(region.status === 'erasable' ? 'erase' : 'keep', region.id, region.status === 'erasable' ? `${regionDisplayName(region.id)}已標記為可清空` : `${regionDisplayName(region.id)}已標記保留`)} className="min-h-10 px-3 rounded-full bg-surface-container-high text-xs font-bold hover:bg-primary hover:text-on-primary transition-colors">保存</button>
                        <button
                          onClick={() => sendTaskToRobot(region.status === 'erasable' || region.status === 'erased' ? 'erase' : 'keep', region.id, `${region.status === 'erasable' || region.status === 'erased' ? '擦除' : '保留'}${regionDisplayName(region.id)}`)}
                          disabled={Boolean(hardwareBusy)}
                          className="min-h-10 px-3 rounded-full bg-surface-container-lowest text-xs font-bold border border-primary/20 hover:bg-primary hover:text-on-primary disabled:opacity-50 transition-colors"
                        >
                          送機器人
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {session.boardOcrText && (
                <div className="mt-5 rounded-2xl border border-primary/15 bg-surface p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 shrink-0 text-primary" />
                    <p className="text-xs font-black text-primary">白板文字整理</p>
                  </div>
                  <p className="text-sm leading-relaxed text-on-surface-variant whitespace-pre-wrap font-mono">{session.boardOcrText}</p>
                </div>
              )}
            </motion.section>

            <motion.section variants={itemVariants} className="xl:col-span-3 bg-surface-container-lowest rounded-3xl p-5 sm:p-7 border border-outline-variant/10 shadow-premium">
              <div className="mb-5 rounded-2xl border border-primary/15 bg-primary-container/35 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black text-primary">目前模式</p>
                    <h2 className="mt-1 text-xl font-extrabold text-primary">老師可控的半自動板擦</h2>
                    <p className="mt-2 text-xs font-bold leading-5 text-on-surface-variant">先完成白板分析與老師確認，再送出左區或右區任務；實機角度設定已收進工程模式。</p>
                  </div>
                  <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
                </div>
                <div className="mt-4 grid grid-cols-1 gap-2">
                  {readinessChecks.map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl bg-surface/80 px-3 py-2 text-xs font-bold">
                      <div className="min-w-0">
                        <p className={item.ok ? 'text-primary' : 'text-on-surface'}>{item.label}</p>
                        <p className="mt-0.5 text-[11px] leading-4 text-on-surface-variant">{item.detail}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${item.ok ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>
                        {item.ok ? '已就緒' : '待確認'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {showEngineerTools && hardwareProfileDraft && (
                <details className="mb-5 rounded-2xl border border-outline-variant/10 bg-surface p-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black text-primary">工程模式</p>
                      <h3 className="mt-1 text-lg font-extrabold">實機校正，需要時再打開</h3>
                      <p className="mt-1 text-xs font-bold leading-5 text-on-surface-variant">只有工程模式顯示；學生展示不需要碰這些參數。</p>
                    </div>
                    <Settings2 className="h-5 w-5 shrink-0 text-primary" />
                  </summary>

                  <div className="mt-4 grid grid-cols-1 gap-3">
                    {SERVO_ANGLE_FIELDS.map(([key, label]) => (
                      <label key={key} className="rounded-xl border border-outline-variant/10 bg-surface-container-low px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-bold">{label}</span>
                          <span className="text-xs font-black text-primary">{hardwareProfileDraft.servoAngles[key]}°</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={180}
                          step={1}
                          value={hardwareProfileDraft.servoAngles[key]}
                          onChange={(event) => updateServoDraft(key, Number(event.target.value))}
                          className="mt-3 w-full accent-primary"
                        />
                      </label>
                    ))}
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-2">
                    {HARDWARE_TOGGLES.map(([key, label, Icon]) => (
                      <label key={key} className="flex items-center gap-3 rounded-xl border border-outline-variant/10 bg-surface-container-low px-3 py-3 text-sm font-bold">
                        <input
                          type="checkbox"
                          checked={hardwareProfileDraft[key]}
                          onChange={(event) => updateHardwareToggle(key, event.target.checked)}
                          className="h-4 w-4 accent-primary"
                        />
                        <Icon className="h-4 w-4 text-primary" />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>

                  <label className="mt-4 block">
                    <span className="text-xs font-black text-on-surface-variant">現場備註</span>
                    <textarea
                      value={hardwareProfileDraft.notes}
                      onChange={(event) => setHardwareProfileDraft((current) => current ? {...current, notes: event.target.value} : current)}
                      rows={3}
                      className="mt-2 w-full rounded-xl border border-outline-variant/20 bg-surface-container-low px-3 py-2 text-sm"
                    />
                  </label>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      onClick={saveHardwareProfile}
                      disabled={Boolean(hardwareBusy)}
                      className="min-h-11 rounded-xl bg-primary px-3 text-xs font-bold text-on-primary transition-colors hover:opacity-90 disabled:opacity-50"
                    >
                      保存校正設定
                    </button>
                    <button
                      onClick={pushServoProfileToRobot}
                      disabled={Boolean(hardwareBusy)}
                      className="min-h-11 rounded-xl bg-surface-container-high px-3 text-xs font-bold transition-colors hover:bg-primary hover:text-on-primary disabled:opacity-50"
                    >
                      寫入機器人
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => sendCalibrationPreview(`SERVO_SET:${hardwareProfileDraft.servoAngles.regionA}`, '預覽左區')}
                      disabled={Boolean(hardwareBusy)}
                      className="min-h-10 rounded-xl border border-outline-variant/20 bg-surface-container-low px-3 text-xs font-bold"
                    >
                      預覽左區
                    </button>
                    <button
                      onClick={() => sendCalibrationPreview(`SERVO_SET:${hardwareProfileDraft.servoAngles.regionB}`, '預覽右區')}
                      disabled={Boolean(hardwareBusy)}
                      className="min-h-10 rounded-xl border border-outline-variant/20 bg-surface-container-low px-3 text-xs font-bold"
                    >
                      預覽右區
                    </button>
                    <button
                      onClick={() => sendCalibrationPreview(`SERVO_SET:${hardwareProfileDraft.servoAngles.standby}`, '待命位置')}
                      disabled={Boolean(hardwareBusy)}
                      className="min-h-10 rounded-xl border border-outline-variant/20 bg-surface-container-low px-3 text-xs font-bold"
                    >
                      回待命
                    </button>
                  </div>

                  {hardwareProfileDraft.lastCalibratedAt && (
                    <p className="mt-3 text-[11px] font-bold text-on-surface-variant">
                      上次保存：{new Date(hardwareProfileDraft.lastCalibratedAt).toLocaleString('zh-TW')}
                    </p>
                  )}
                </details>
              )}

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
                <TaskButton icon={Eraser} label="全部標記清空" action="erase_all" busyCommand={busyCommand} onRun={runTask} doneText="全部區塊已標記為可清空" />
                {session.boardRegions.map((region) => (
                  <TaskButton key={region.id} icon={region.status === 'erasable' ? Eraser : CheckCircle2} label={`${region.status === 'erasable' ? '標記清空' : '保留'}${regionDisplayName(region.id)}`} action={region.status === 'erasable' ? 'erase' : 'keep'} regionId={region.id} busyCommand={busyCommand} onRun={runTask} doneText={`${regionDisplayName(region.id)}決策已保存`} />
                ))}
                <TaskButton icon={Pause} label="全部保留" action="keep_all" busyCommand={busyCommand} onRun={runTask} doneText="全部區塊已標記保留" />
              </div>

              <div className="mt-5 rounded-2xl border border-primary/15 bg-surface p-4">
                <div className="flex items-start gap-3">
                  <div className={`robot-board-avatar flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border bg-primary-container text-primary ${robotStage !== 'idle' ? 'robot-board-active' : ''}`}>
                    {hardwareBusy ? <Loader2 className="w-7 h-7 animate-spin" /> : <Bot className="w-8 h-8" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-extrabold text-primary">
                      <Radio className="w-4 h-4" />
                      {robotTarget === 'ALL' ? '正在送出全板任務' : robotTarget ? `正在送出${regionDisplayName(robotTarget)}` : '板擦機器人待命'}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-primary-container px-2.5 py-1 text-[10px] font-black text-primary">{robotTaskId || '待命'}</span>
                      <span className="rounded-full bg-surface-container-high px-2.5 py-1 text-[10px] font-black text-on-surface-variant">{robotTargetLabel}</span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">{hardwareNotice}</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    ['建單', robotStage !== 'idle'],
                    ['前往', robotStage === 'sending' || robotStage === 'done' || robotStage === 'fallback'],
                    [robotStage === 'fallback' ? '備援' : '完成', robotStage === 'done' || robotStage === 'fallback'],
                  ].map(([label, active]) => (
                    <div key={String(label)} className={`rounded-xl border px-2 py-2 text-center text-[10px] font-black ${active ? 'border-primary/30 bg-primary-container text-primary' : 'border-outline-variant/20 bg-surface-container-low text-on-surface-variant'}`}>
                      {label}
                    </div>
                  ))}
                </div>
                <div className="mt-3 rounded-2xl border border-outline-variant/10 bg-surface-container-low p-3">
                  <div className="flex items-center justify-between text-[11px] font-black text-on-surface-variant">
                    <span>{robotTaskId || '尚未建立任務'}</span>
                    <span>{robotTargetLabel}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-container-highest">
                    <motion.div animate={{width: `${robotProgress}%`}} className="h-full rounded-full bg-primary" />
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => sendTaskToRobot('erase', undefined, '一鍵全擦')}
                    disabled={Boolean(hardwareBusy)}
                    className="min-h-11 rounded-xl bg-primary-container px-3 text-xs font-bold text-primary transition-colors hover:bg-primary hover:text-on-primary disabled:opacity-50"
                  >
                    送出全擦
                  </button>
                  <button
                    onClick={() => sendTaskToRobot('pause', undefined, '暫停等待學生抄寫')}
                    disabled={Boolean(hardwareBusy)}
                    className="min-h-11 rounded-xl bg-surface-container-high px-3 text-xs font-bold transition-colors hover:bg-primary hover:text-on-primary disabled:opacity-50"
                  >
                    暫停機器人
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2">
                  <button
                    onClick={runEraseSequence}
                    disabled={sequenceBusy || Boolean(hardwareBusy)}
                    className="min-h-11 rounded-xl bg-tertiary px-3 text-xs font-bold text-on-tertiary transition-colors hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {sequenceBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eraser className="w-4 h-4" />}
                    {sequenceBusy ? '循序擦除中…' : '一鍵擦除可清空區'}
                  </button>
                  {sequenceBusy && (
                    <button
                      onClick={() => {
                        cancelSequenceRef.current?.();
                        cancelSequenceRef.current = null;
                        setSequenceBusy(false);
                        setRobotStage('idle');
                        setRobotTarget(undefined);
                        setNotice('已取消循序擦除任務');
                      }}
                      className="min-h-10 rounded-xl bg-surface-container-high px-3 text-xs font-bold transition-colors hover:bg-error hover:text-on-error"
                    >
                      取消任務序列
                    </button>
                  )}
                </div>

                {sequenceProgress.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-[10px] font-black text-on-surface-variant">循序擦除進度</p>
                    <div className="flex flex-wrap gap-2">
                      {sequenceProgress.map(({region, status}) => (
                        <span
                          key={region}
                          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black ${
                            status === 'ok' ? 'bg-primary text-on-primary' :
                            status === 'sending' ? 'bg-surface-container-high text-on-surface animate-pulse' :
                            status === 'timeout' ? 'bg-tertiary-container text-tertiary' :
                            'bg-error-container text-error'
                          }`}
                        >
                          {status === 'ok' ? '✓' : status === 'sending' ? '⋯' : status === 'timeout' ? '⚠' : '✗'}
                          {' '}{regionDisplayName(region)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex items-start gap-2 text-xs text-on-surface-variant bg-surface-container p-4 rounded-2xl">
                <AlertTriangle className="w-4 h-4 shrink-0 text-tertiary" />
                本頁主流程會先保存國小課堂與白板決策；送到機器人是比賽展示支線，展示模式仍會清楚留下任務紀錄。
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

function SmallStat({icon: Icon, label, value}: {icon: LucideIcon; label: string; value: string | number}) {
  return (
    <div className="bg-surface rounded-2xl p-4 border border-outline-variant/10">
      <Icon className="w-5 h-5 text-primary mb-3" />
      <p className="text-[10px] font-bold text-on-surface-variant">{label}</p>
      <p className="font-extrabold mt-1">{value}</p>
    </div>
  );
}

function TaskButton({icon: Icon, label, action, regionId, busyCommand, onRun, doneText}: {icon: LucideIcon; label: string; action: string; regionId?: string; busyCommand: string | null; onRun: (action: string, regionId: string | undefined, doneText: string) => void; doneText: string}) {
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
