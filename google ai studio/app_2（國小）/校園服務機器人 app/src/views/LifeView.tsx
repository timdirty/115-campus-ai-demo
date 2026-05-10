import {useEffect, useRef, useState} from 'react';
import {motion} from 'motion/react';
import {BottomSheet} from '../components/ui';
import {AlertOctagon, Calendar, ChevronRight, Terminal} from 'lucide-react';
import {useAppActions, useAppState} from '../state/AppStateProvider';
import type {DispatchTaskType} from '../state/appState';
import {sendHardwareCommand} from '../services/hardwareBridge';
import type {VisionScene} from '../services/localVision';
import {BellScheduleCard} from '../components/life/BellScheduleCard';
import {EnvMonitorCard} from '../components/life/EnvMonitorCard';
import {ScanMapCard} from '../components/life/ScanMapCard';
import {BroadcastCard} from '../components/life/BroadcastCard';
import {VisionCameraCard} from '../components/life/VisionCameraCard';

let _eventId = 100;

const HERO_SCENES: VisionScene[] = ['crowd', 'safety', 'cleaning', 'delivery', 'patrol'];

const EVENT_ZONES: Array<{
  label: string;
  level: 'ok' | 'warn' | 'error';
  messages: string[];
}> = [
  {label: 'B-4 走廊', level: 'warn', messages: ['人流密度偏高', '走廊壅塞', '需要疏導']},
  {label: 'A-2 入口', level: 'ok', messages: ['人員正常流動', '場域正常', '無異常狀況']},
  {label: '操場出口', level: 'error', messages: ['偵測到異常聚集', '緊急狀況', '需立即處置']},
];

function formatTime(date = new Date()) {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

function eventTone(level: 'ok' | 'warn' | 'error') {
  if (level === 'error') return 'bg-error/10 border-error/25 text-error';
  if (level === 'warn') return 'bg-amber-400/10 border-amber-400/25 text-amber-400';
  return 'bg-[#87d46c]/10 border-[#87d46c]/25 text-[#87d46c]';
}

export function LifeView({
  showToast,
  navigateTo,
}: {
  showToast: (msg: string) => void;
  navigateTo: (id: string, props?: Record<string, unknown>) => void;
}) {
  const state = useAppState();
  const actions = useAppActions();

  const [modal, setModal] = useState<string | null>(null);
  const [editingSchedule, setEditingSchedule] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editArea, setEditArea] = useState('');
  const [heroSceneIdx, setHeroSceneIdx] = useState(0);
  const [aiEvents, setAiEvents] = useState<
    {id: number; zone: string; msg: string; level: 'ok' | 'warn' | 'error'; time: string}[]
  >(() => [
    {id: 1, zone: 'B-4 走廊', msg: '人流密度偏高', level: 'warn', time: formatTime()},
    {id: 2, zone: 'A-2 入口', msg: '人員正常流動', level: 'ok', time: formatTime()},
    {id: 3, zone: '操場出口', msg: '偵測到異常聚集', level: 'error', time: formatTime()},
  ]);

  const isEmergency = state.campusStatus.isEmergency;
  const logsEndRef = useRef<HTMLDivElement>(null);
  const eventZoneIdxRef = useRef(0);

  useEffect(() => {
    const intv = setInterval(() => {
      const nextIdx = (eventZoneIdxRef.current + 1) % EVENT_ZONES.length;
      eventZoneIdxRef.current = nextIdx;
      const zone = EVENT_ZONES[nextIdx];
      const msg = zone.messages[Math.floor(Math.random() * zone.messages.length)];
      setAiEvents(prev => [
        {id: ++_eventId, zone: zone.label, msg, level: zone.level, time: formatTime()},
        ...prev.slice(0, 4),
      ]);
    }, 3000);
    return () => clearInterval(intv);
  }, []);

  useEffect(() => {
    if (modal === 'mapcam') return;
    const intv = setInterval(() => {
      setHeroSceneIdx(prev => (prev + 1) % HERO_SCENES.length);
    }, 5000);
    return () => clearInterval(intv);
  }, [modal]);

  useEffect(() => {
    if (modal === 'logs' && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({behavior: 'smooth'});
    }
  }, [state.logs, modal]);

  const handleOpenSchedule = (id: string, time: string, area: string) => {
    setEditingSchedule(id);
    setEditTime(time);
    setEditArea(area);
    setModal('schedule');
  };

  const handleSaveSchedule = () => {
    if (!editTime.trim() || !editArea.trim()) {
      showToast('時間和區域不能為空');
      return;
    }
    actions.saveSchedule({id: editingSchedule, time: editTime.trim(), area: editArea.trim()});
    showToast('任務排程設定已更新');
    setModal(null);
  };

  return (
    <div className="space-y-4 pb-10">
      <div className={`rounded-2xl px-5 py-3.5 flex items-center justify-between border transition-all duration-500 ${isEmergency ? 'bg-error text-white border-error shadow-lg shadow-error/30' : 'bg-surface-container-low border-outline-variant/30'}`}>
        <div className="flex items-center gap-3">
          <AlertOctagon size={18} className={isEmergency ? 'text-white animate-pulse' : 'text-error'} />
          <div>
            <p className={`text-[10px] font-black tracking-widest uppercase font-mono ${isEmergency ? 'text-white/70' : 'text-on-surface-variant/50'}`}>全校安全應變</p>
            <p className={`text-sm font-bold leading-none mt-0.5 ${isEmergency ? 'text-white' : 'text-on-surface'}`}>
              {isEmergency ? '[CRITICAL] 全校進入封控模式' : '系統待命 · 正常狀態'}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            actions.setEmergency(!isEmergency);
            showToast(isEmergency ? '已解除緊急狀態，系統恢復正常' : '【警告】全校進入緊急安全封控模式！');
          }}
          className={`shrink-0 relative w-14 h-7 rounded-full transition-all duration-500 border-2 ${isEmergency ? 'bg-white border-white' : 'bg-surface-container-high border-outline-variant/30'}`}
        >
          <motion.div
            animate={{x: isEmergency ? 28 : 2}}
            transition={{type: 'spring', stiffness: 400, damping: 25}}
            className={`absolute top-0.5 w-5 h-5 rounded-full shadow-lg ${isEmergency ? 'bg-error' : 'bg-white'}`}
          />
        </button>
      </div>

      <EnvMonitorCard />

      <section className="px-1" onClick={() => setModal('mapcam')}>
        <ScanMapCard />
      </section>

      <section className="px-1">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] text-on-surface-variant/50 font-mono font-bold tracking-[0.2em] uppercase">
            AI 事件串流 · {HERO_SCENES[heroSceneIdx]}
          </p>
          <button onClick={() => navigateTo('dispatch-map')} className="text-[10px] text-primary font-bold hover:underline">
            前往派遣
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {aiEvents.slice(0, 3).map(ev => (
            <div key={ev.id} className={`rounded-xl border px-3 py-2 text-[10px] font-mono font-bold ${eventTone(ev.level)}`}>
              <div className="flex justify-between gap-2">
                <span className="truncate">{ev.zone}</span>
                <span className="opacity-60">{ev.time}</span>
              </div>
              <p className="mt-1 truncate">{ev.msg}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 px-1">
        <BellScheduleCard />
        <BroadcastCard
          showToast={showToast}
          onDispatch={zones => actions.addDispatchTask({zone: zones, taskType: 'broadcast' as DispatchTaskType})}
        />
      </section>

      <section className="px-1">
        <div className="bg-surface-container-low rounded-2xl p-5 border border-outline-variant/30 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-headline text-sm font-bold">預約巡邏排程</h3>
            <button onClick={() => navigateTo('dispatch-map')} className="flex items-center gap-1 text-[10px] text-primary font-bold hover:underline">
              查看全部 <ChevronRight size={11} />
            </button>
          </div>
          <div className="space-y-2">
            {state.schedules.slice(0, 2).map(schedule => (
              <motion.div
                key={schedule.id}
                whileHover={{x: 2}}
                whileTap={{scale: 0.985}}
                onClick={() => handleOpenSchedule(schedule.id, schedule.time, schedule.area)}
                className="flex items-center gap-3 p-3.5 bg-surface-container-lowest rounded-xl border border-outline-variant/20 hover:border-primary/30 cursor-pointer transition-all"
              >
                <Calendar size={15} className="text-on-surface-variant shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{schedule.title}</p>
                  <p className="text-[10px] text-on-surface-variant font-mono opacity-60 truncate">{schedule.area}</p>
                </div>
                <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-lg shrink-0">{schedule.time}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="px-1 flex justify-end">
        <button
          onClick={() => setModal('logs')}
          className="flex items-center gap-1.5 text-[10px] text-on-surface-variant/40 hover:text-primary transition-colors font-mono font-bold"
        >
          <Terminal size={12} />
          系統日誌
        </button>
      </div>

      <BottomSheet isOpen={modal === 'mapcam'} onClose={() => setModal(null)} fullScreen>
        <VisionCameraCard
          isOpen={modal === 'mapcam'}
          showToast={showToast}
          onDispatch={r => {
            actions.addDispatchTask({zone: r.zone, taskType: r.dispatchTaskType});
            sendHardwareCommand(r.command, 'life-vision').catch(() => {});
          }}
        />
      </BottomSheet>

      <BottomSheet isOpen={modal === 'logs'} onClose={() => setModal(null)} title="系統紀錄">
        <div className="p-6 bg-[#0c121d] rounded-[2.5rem] mx-4 mb-10 mt-2 font-mono text-[11px] text-[#a9b1d6] leading-relaxed h-[50vh] overflow-y-auto custom-scrollbar shadow-2xl border-4 border-surface-container-low">
          <div className="flex items-center justify-between mb-6 sticky top-0 bg-[#0c121d]/90 backdrop-blur-xl pb-3 z-10 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary border border-primary/20">
                <Terminal size={16} />
              </div>
              <span className="text-white font-extrabold tracking-widest text-[10px]">派遣與硬體紀錄</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-[#87d46c]/10 rounded-full border border-[#87d46c]/20">
              <div className="w-1.5 h-1.5 bg-[#87d46c] rounded-full animate-pulse" />
              <span className="text-[9px] text-[#87d46c] font-extrabold tracking-[0.2em]">即時更新</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-[10px] text-primary/40 font-bold mb-4 italic px-2">本次展示紀錄</div>
            {state.logs.map(log => (
              <motion.div
                initial={{opacity: 0, x: -10}}
                animate={{opacity: 1, x: 0}}
                key={log.id}
                className={`flex gap-3 p-2 rounded-lg hover:bg-white/5 ${log.type === 'warn' ? 'text-tertiary' : log.type === 'error' ? 'text-error' : 'text-[#a9b1d6]'}`}
              >
                <span className="opacity-30 font-bold shrink-0">{log.time}</span>
                <span className="flex-1">{log.message}</span>
              </motion.div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      </BottomSheet>

      <BottomSheet isOpen={modal === 'schedule'} onClose={() => setModal(null)} title="編輯預約任務">
        <div className="p-4 space-y-8 pb-8">
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">任務時間</label>
            <input
              type="time"
              value={editTime}
              onChange={e => setEditTime(e.target.value)}
              className="w-full bg-surface-container-lowest shadow-sm border border-outline-variant/20 rounded-2xl px-5 py-4 text-xl font-headline font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">覆蓋區域設定</label>
            <div className="relative">
              <select
                value={editArea}
                onChange={e => setEditArea(e.target.value)}
                className="w-full bg-surface-container-lowest shadow-sm border border-outline-variant/20 rounded-2xl px-5 py-4 text-base font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
              >
                <option value="所有走廊與公共區">所有走廊與公共區</option>
                <option value="僅 A 棟教學樓">僅 A 棟教學樓</option>
                <option value="B 棟活動中心與操場">B 棟活動中心與操場</option>
              </select>
              <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">▼</div>
            </div>
          </div>
          <button
            onClick={handleSaveSchedule}
            className="w-full bg-primary hover:bg-primary/95 text-white font-bold py-4 rounded-2xl active:scale-95 shadow-lg shadow-primary/20 transition-all text-lg"
          >
            儲存變更
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
