import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BottomSheet } from '../components/ui';
import { MapPin, Search, Route, Calendar, Volume2, Megaphone, Terminal, Loader2, Thermometer, Droplets, Wind, Activity, AlertOctagon, Zap } from 'lucide-react';
import { useAppActions, useAppState } from '../state/AppStateProvider';

export function LifeView({ showToast, navigateTo }: { showToast: (msg: string) => void, navigateTo: (id: string, props?: any) => void }) {
  const state = useAppState();
  const actions = useAppActions();
  const [modal, setModal] = useState<string | null>(null);
  const sensors = state.sensors;
  const isEmergency = state.campusStatus.isEmergency;
  const remindWarning = state.settings.remindWarning;

  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    // Dynamic sensors fluctuation
    const intv = setInterval(() => {
      actions.tickSensors({
        temp: +(sensors.temp + (Math.random() * 0.4 - 0.2)).toFixed(1),
        hum: Math.max(0, Math.min(100, Math.round(sensors.hum + (Math.random() * 2 - 1)))),
        aqi: Math.max(0, Math.round(sensors.aqi + (Math.random() * 4 - 2))),
      });
      setLastUpdated(new Date());
    }, 3000);
    return () => clearInterval(intv);
  }, [actions, sensors]);
  const [robotDispatched, setRobotDispatched] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editArea, setEditArea] = useState('');

  const handleOpenSchedule = (id: string, time: string, area: string) => {
    setEditingSchedule(id);
    setEditTime(time);
    setEditArea(area);
    setModal('schedule');
  };

  const handleSaveSchedule = () => {
    actions.saveSchedule({ id: editingSchedule, time: editTime, area: editArea });
    showToast('任務排程設定已更新');
    setModal(null);
  };

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (modal === 'logs' && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [state.logs, modal]);

  return (
    <div className="space-y-8 pb-10">
      <section className="space-y-4 pb-2 px-1">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-6 bg-primary rounded-full shadow-[0_0_10px_rgba(var(--color-primary),0.5)]"></div>
          <span className="font-headline font-extrabold text-primary tracking-[0.3em] uppercase text-[10px] font-mono">校園生活引擎</span>
        </div>
        <div className="flex justify-between items-start">
          <h2 className="font-headline text-4xl font-bold text-on-surface tracking-tight">校園生活智慧中心</h2>
          <motion.div
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => setModal('logs')}
            className="bg-surface-container-low p-2 rounded-2xl border border-outline-variant/30 shadow-sm cursor-pointer hover:bg-surface-container transition-all flex items-center justify-center group"
          >
             <Terminal size={20} className="text-on-surface-variant group-hover:text-primary transition-colors" />
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-surface-container-lowest px-5 py-3.5 rounded-2xl flex items-center gap-4 border border-outline-variant/20 w-fit shadow-sm"
        >
          <div className="w-2.5 h-2.5 bg-[#87d46c] rounded-full animate-pulse shadow-[0_0_10px_rgba(135,212,108,0.8)]"></div>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-on-surface-variant/60 tracking-widest block">系統狀態</span>
            <span className="text-xs font-bold font-headline tracking-wide">校園服務中控 • 在線</span>
          </div>
        </motion.div>
      </section>

      {/* Environmental Sensors */}
      <section className="grid grid-cols-2 gap-5 mb-8 px-1">
        <p className="col-span-2 text-xs text-gray-400 text-right -mb-2">
          更新於 {lastUpdated.getHours().toString().padStart(2, '0')}:{lastUpdated.getMinutes().toString().padStart(2, '0')}
        </p>
        {[
          { icon: Thermometer, label: '室內溫度', val: sensors.temp, unit: '°C', color: isEmergency?'text-error':'text-primary', bg: 'bg-primary/5' },
          { icon: Droplets, label: '環境濕度', val: sensors.hum, unit: '%', color: isEmergency?'text-error':'text-[#4a80db]', bg: 'bg-primary/5' },
          { icon: Wind, label: '空氣指標', val: sensors.aqi, unit: 'AQI', color: isEmergency?'text-error':'text-[#87d46c]', bg: 'bg-[#87d46c]/5' },
          { icon: Activity, label: '環境通風', val: isEmergency?'封閉':'良好', unit: '', color: isEmergency?'text-error':'text-tertiary', bg: 'bg-tertiary/5' }
        ].map((sensor, i) => (
          <motion.div
            whileHover={{ y: -4, shadow: '0 10px 25px -5px rgba(0,0,0,0.05)' }}
            whileTap={{ scale: 0.98 }}
            onClick={() => showToast(`正在同步 ${sensor.label} 感測器資料...`)}
            key={i}
            className={`bg-surface-container-lowest p-6 rounded-[2.2rem] border transition-all cursor-pointer flex flex-col items-start gap-5 relative overflow-hidden group ${isEmergency ? 'border-error/40 bg-error/5 shadow-inner' : 'border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.02)]'}`}
          >
             <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border border-outline-variant/10 shadow-sm transition-transform group-hover:scale-110 ${sensor.bg} ${sensor.color}`}>
               <sensor.icon size={26} className="shrink-0" />
             </div>
             <div className="w-full">
               <p className="text-[10px] text-on-surface-variant font-extrabold mb-1.5 tracking-[0.15em] uppercase truncate font-mono opacity-60">{sensor.label}</p>
               <p className={`font-headline text-3xl font-bold leading-none tracking-tighter truncate ${isEmergency ? 'text-error animate-pulse' : 'text-on-surface'}`}>{sensor.val} <span className="text-xs font-sans font-bold opacity-40 uppercase ml-1">{sensor.unit}</span></p>
             </div>
             <div className="absolute -bottom-6 -right-6 w-20 h-20 bg-surface-container opacity-20 rounded-full blur-xl group-hover:opacity-40 transition-opacity"></div>
          </motion.div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 px-1">
        {/* Emergency Broadcasting Toggle */}
        <div className={`rounded-[2.5rem] p-8 shadow-xl transition-all duration-500 border ${isEmergency ? 'bg-error text-white border-error shadow-error/30' : 'bg-surface-container-low border-outline-variant/30 shadow-[0_8px_30px_rgba(0,0,0,0.02)]'}`}>
          <div className="flex items-center justify-between mb-4">
             <div className="flex items-center gap-5">
               <div className={`w-16 h-16 shrink-0 rounded-[1.5rem] shadow-xl flex items-center justify-center border-2 transition-all ${isEmergency ? 'bg-white text-error border-white animate-pulse' : 'bg-surface-container-lowest text-error border-error/10'}`}>
                 <AlertOctagon size={36} strokeWidth={2.5} />
               </div>
               <div>
                  <h3 className={`font-headline text-2xl font-bold tracking-tight leading-none mb-2 ${isEmergency ? 'text-white' : 'text-on-surface'}`}>全校安全應變</h3>
                  <p className={`text-xs font-bold tracking-widest ${isEmergency ? 'text-white/80' : 'text-on-surface-variant/40'}`}>{isEmergency ? '應變啟動' : '待命部署'}</p>
               </div>
             </div>
             <button
               onClick={() => { actions.setEmergency(!isEmergency); showToast(isEmergency ? '已解除緊急狀態，系統恢復正常運行' : '【警告】全校進入緊急安全封控模式！'); }}
               className={`shrink-0 relative w-20 h-10 rounded-full transition-all duration-500 border-2 ${isEmergency ? 'bg-white border-white' : 'bg-surface-container-high border-outline-variant/30'}`}
             >
               <motion.div animate={{ x: isEmergency ? 42 : 4 }} transition={{ type: "spring", stiffness: 400, damping: 25 }} className={`absolute top-1 w-7 h-7 rounded-full shadow-lg transition-colors ${isEmergency ? 'bg-error' : 'bg-white'}`} />
             </button>
          </div>
          {isEmergency && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 text-sm font-bold bg-black/20 p-4 rounded-2xl border border-white/10 leading-relaxed font-mono">
              [CRITICAL] 所有自動門已啟動電磁鎖，警衛機器人已在各出口就位。非授權人員請勿移動。
            </motion.p>
          )}
        </div>

        {/* Broadcasting Interface */}
        <div className="bg-surface-container-low rounded-[3rem] p-8 border border-outline-variant/30 flex flex-col gap-6 shadow-sm overflow-hidden relative group">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/5 rounded-full blur-[60px] group-hover:bg-primary/10 transition-colors"></div>

          <div className="flex items-center justify-between px-2">
            <div>
              <p className="font-extrabold text-[10px] tracking-[0.25em] text-on-surface-variant font-mono uppercase opacity-60">實況廣播</p>
              <div className="flex items-center gap-2 mt-2">
                 <div className="w-2 h-2 bg-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(var(--color-primary),0.8)]"></div>
                 <p className="text-2xl font-bold font-headline tracking-tight text-primary">系統播放待命</p>
              </div>
            </div>
            <Megaphone size={32} className="text-primary opacity-20 group-hover:rotate-12 transition-transform" />
          </div>

          <div className="h-[1px] w-full bg-outline-variant/30"></div>

          <div className="space-y-4">
            <h3 className="font-headline text-[11px] font-extrabold uppercase tracking-[0.2em] px-2 text-on-surface-variant/40 font-mono">操作設定</h3>
            <div
              className="flex items-center justify-between p-6 bg-surface-container-lowest rounded-[2rem] shadow-sm cursor-pointer hover:shadow-xl hover:border-primary/30 border border-outline-variant/20 transition-all active:scale-[0.985] group/item"
              onClick={() => { actions.setRemindWarning(!remindWarning); showToast(remindWarning ? '已關閉下課提醒' : '已開啟下課提醒'); }}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${remindWarning ? 'bg-primary/10 text-primary' : 'bg-surface-container-high text-on-surface-variant/40'}`}>
                  <Volume2 size={24} />
                </div>
                <div>
                  <p className="font-bold text-lg tracking-tight leading-none mb-1">智慧鐘聲提示</p>
                  <p className="text-[10px] text-on-surface-variant font-extrabold font-mono uppercase tracking-widest opacity-60">自動提醒（1分鐘前）</p>
                </div>
              </div>
              <div className={`w-14 h-8 rounded-full transition-all relative flex items-center px-1 border-2 ${remindWarning ? 'bg-primary shadow-[0_0_20px_rgba(var(--color-primary),0.3)] border-primary' : 'bg-surface-container-highest border-outline-variant/30'}`}>
                <motion.div layout className="w-5 h-5 bg-white rounded-full shadow-md" animate={{ x: remindWarning ? 24 : 0 }} transition={{ type: "spring", stiffness: 450, damping: 25 }} />
              </div>
            </div>
          </div>
        </div>

        {/* Schedule */}
        <div className="bg-surface-container-low rounded-[3rem] p-8 border border-outline-variant/30 shadow-sm mt-2 group">
          <div className="flex items-center justify-between mb-8 px-2">
            <h3 className="font-headline text-2xl font-bold tracking-tight">預約巡邏任務</h3>
            <div className="bg-primary/10 text-primary px-3 py-1 rounded-xl text-[10px] font-extrabold uppercase tracking-widest border border-primary/20 font-mono shadow-sm">排程器</div>
          </div>
          <div className="space-y-4">
            {state.schedules.map(schedule => {
              const Icon = schedule.kind === 'broadcast' ? Volume2 : Calendar;
              return (
                <motion.div key={schedule.id} whileHover={{ x: 4 }} whileTap={{ scale: 0.985 }} onClick={() => handleOpenSchedule(schedule.id, schedule.time, schedule.area)} className="group/card flex items-center gap-6 p-6 bg-surface-container-lowest rounded-[2.2rem] shadow-sm cursor-pointer border border-outline-variant/20 hover:border-primary/40 hover:shadow-xl transition-all">
                  <div className="bg-surface-container-low p-4 rounded-2xl text-on-surface-variant group-hover/card:text-primary transition-all group-hover/card:bg-primary/5 group-hover/card:rotate-6 border border-transparent group-hover/card:border-primary/10">
                    <Icon size={26} />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex justify-between items-center">
                       <p className="text-xl font-bold tracking-tight text-on-surface">{schedule.title}</p>
                       <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/20">{schedule.time}</span>
                    </div>
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest opacity-60 font-mono">地點: {schedule.area}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Map Control - Radar View */}
      <section className="px-1">
        <div className="relative min-h-[460px] bg-[#0c121d] rounded-[3rem] overflow-hidden shadow-2xl border-4 border-surface-container-low cursor-pointer active:scale-[0.99] transition-all group" onClick={(e) => {
           if ((e.target as HTMLElement).closest('.mapcam-trigger')) return;
           navigateTo('dispatch-map');
        }}>
          {/* Radar Background */}
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #4a80db 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

          <div className="absolute inset-0 flex items-center justify-center">
              {/* Radar Rings */}
              <motion.div animate={{ scale: [1, 2, 3], opacity: [0.6, 0.2, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeOut" }} className="w-32 h-32 rounded-full border border-primary/40 absolute shadow-[0_0_15px_rgba(var(--color-primary),0.3)]"></motion.div>
              <motion.div animate={{ scale: [1, 2, 3], opacity: [0.6, 0.2, 0] }} transition={{ duration: 4, delay: 2, repeat: Infinity, ease: "easeOut" }} className="w-32 h-32 rounded-full border border-primary/40 absolute shadow-[0_0_15px_rgba(var(--color-primary),0.3)]"></motion.div>

              {/* Grid Lines */}
              <div className="absolute w-[200%] h-[1px] bg-primary/10 rotate-45"></div>
              <div className="absolute w-[200%] h-[1px] bg-primary/10 -rotate-45"></div>
              <div className="absolute w-full h-[1px] bg-primary/10"></div>
              <div className="absolute h-full w-[1px] bg-primary/10"></div>

              {/* Rotating Sweep */}
              <motion.div
                 animate={{ rotate: 360 }}
                 transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                 className="w-[200%] h-[200%] absolute rounded-full"
                 style={{ background: 'conic-gradient(from 0deg, transparent 75%, rgba(var(--color-primary), 0.4) 100%)' }}
              />
          </div>

          {/* Animated Path on Map */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none p-10" viewBox="0 0 100 100" preserveAspectRatio="none">
            <motion.path
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              d="M 20,40 C 40,60 60,60 80,40"
              fill="none" stroke="rgba(var(--color-primary), 0.8)" strokeWidth="0.5" strokeDasharray="2 2"
            />
          </svg>

          <div className="absolute top-[42%] left-[30%] pointer-events-none">
             <div className="w-5 h-5 bg-error rounded-full animate-ping absolute opacity-60"></div>
             <div className="w-4 h-4 bg-error rounded-full relative border-2 border-white shadow-xl shadow-error/40"></div>
             <div className="absolute top-6 -left-6 bg-error shadow-xl shadow-error/30 text-white text-[8px] font-mono px-2 py-0.5 rounded-full whitespace-nowrap border border-white/20">TARGET: 1120054</div>
          </div>

          <div className="absolute inset-0 p-8 flex flex-col justify-between">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              onClick={(e) => { e.stopPropagation(); setModal('mapcam'); }}
              className="mapcam-trigger bg-[#1a2333]/90 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] p-6 rounded-[2.2rem] border border-white/10 w-full md:w-3/4 max-w-sm cursor-pointer hover:border-primary/50 transition-all z-10 relative group/cam"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                   <h4 className="font-headline font-bold text-xl text-white tracking-tight">AI 即時視覺引導</h4>
                   <p className="text-[10px] text-white/50 font-extrabold flex items-center gap-1.5 mt-1 font-mono uppercase tracking-widest"><MapPin size={12} className="text-primary" /> ZONE: B-4 EXIT</p>
                </div>
                <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary border border-primary/20"><Activity size={20} /></div>
              </div>

              <div className="pt-5 border-t border-white/10">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(var(--color-primary),1)]"></div>
                  <span className="text-[9px] font-extrabold text-primary tracking-[0.2em]">場域狀態已更新</span>
                </div>
                <div className="bg-white/5 rounded-2xl border border-white/10 p-4 relative overflow-hidden group-hover/cam:bg-white/10 transition-colors">
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary-container text-white flex items-center justify-center shrink-0 shadow-lg border border-white/10"><span className="font-bold text-xs font-mono">XM</span></div>
                    <div>
                      <p className="text-sm font-bold text-white tracking-wide">人流密度：偏高</p>
                      <p className="text-[10px] text-white/40 font-bold mt-1 tracking-widest leading-none">不辨識身分，只看場域狀態</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            <button
              onClick={(e) => { e.stopPropagation(); navigateTo('dispatch-map'); }}
              className="w-full py-5 px-8 rounded-3xl font-headline font-bold text-base shadow-2xl flex items-center justify-center gap-4 transition-all z-10 relative bg-primary text-white border-b-4 border-primary-container hover:shadow-[0_0_30px_rgba(var(--color-primary),0.5)] active:translate-y-1 active:border-b-0"
            >
              <Route size={22} className="group-hover:rotate-12 transition-transform" />
              開啟校園派遣
            </button>
          </div>
        </div>
      </section>

      {/* Modals */}
      <BottomSheet isOpen={modal === 'logs'} onClose={() => setModal(null)} title="系統紀錄">
         <div className="p-6 bg-[#0c121d] rounded-[2.5rem] mx-4 mb-10 mt-2 font-mono text-[11px] text-[#a9b1d6] leading-relaxed h-[50vh] overflow-y-auto custom-scrollbar shadow-2xl relative border-4 border-surface-container-low">
           <div className="flex items-center justify-between mb-6 sticky top-0 bg-[#0c121d]/90 backdrop-blur-xl pb-3 z-10 border-b border-white/10">
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary border border-primary/20"><Terminal size={16}/></div>
                 <span className="text-white font-extrabold tracking-widest text-[10px]">派遣與硬體紀錄</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1 bg-[#87d46c]/10 rounded-full border border-[#87d46c]/20">
                 <div className="w-1.5 h-1.5 bg-[#87d46c] rounded-full animate-pulse shadow-[0_0_8px_rgba(135,212,108,1)]"></div>
                 <span className="text-[9px] text-[#87d46c] font-extrabold tracking-[0.2em] font-mono">即時更新</span>
              </div>
           </div>

           <div className="space-y-2">
             <div className="text-[10px] text-primary/40 font-bold mb-4 italic px-2">本次展示紀錄</div>
             {state.logs.map((log, i) => (
                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} key={i} className={`flex gap-3 group/log p-2 rounded-lg transition-colors hover:bg-white/5 ${log.type === 'warn' ? 'text-tertiary shadow-[inset_4px_0_0_rgba(var(--color-tertiary),1)]' : log.type === 'error' ? 'text-error shadow-[inset_4px_0_0_rgba(var(--color-error),1)]' : 'text-[#a9b1d6] shadow-[inset_4px_0_0_rgba(255,255,255,0.1)]'}`}>
                   <span className="opacity-30 font-bold shrink-0">{log.time}</span>
                   <span className="flex-1 font-medium select-all">{log.message}</span>
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
             <input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} className="w-full bg-surface-container-lowest shadow-sm border border-outline-variant/20 rounded-2xl px-5 py-4 text-xl font-headline font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
           </div>
           <div>
             <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">覆蓋區域設定</label>
             <div className="relative">
               <select value={editArea} onChange={(e) => setEditArea(e.target.value)} className="w-full bg-surface-container-lowest shadow-sm border border-outline-variant/20 rounded-2xl px-5 py-4 text-base font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none transition-all cursor-pointer">
                 <option value="所有走廊與公共區">所有走廊與公共區</option>
                 <option value="僅 A 棟教學樓">僅 A 棟教學樓</option>
                 <option value="B 棟活動中心與操場">B 棟活動中心與操場</option>
               </select>
               <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">▼</div>
             </div>
           </div>
           <button onClick={handleSaveSchedule} className="w-full bg-primary hover:bg-primary/95 text-white font-bold py-4 rounded-2xl active:scale-95 shadow-lg shadow-primary/20 transition-all text-lg">儲存變更</button>
         </div>
      </BottomSheet>

      <BottomSheet isOpen={modal === 'mapcam'} onClose={() => setModal(null)} fullScreen={true}>
        <div className="w-full h-full bg-[#050912] relative flex flex-col justify-center overflow-hidden">
          <div className="absolute top-10 left-10 z-20 flex flex-col gap-1">
             <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-error rounded-full animate-pulse"></div>
                <span className="text-white font-mono font-bold tracking-[0.4em] text-sm uppercase italic">REC_04:12:30_B4</span>
             </div>
             <div className="text-[10px] text-white/30 font-mono tracking-widest font-bold ml-6">延遲：12ms • 狀態：追蹤中</div>
          </div>

          <div className="absolute top-0 inset-x-0 h-48 bg-gradient-to-b from-[#050912] to-transparent z-10 pointer-events-none opacity-80"></div>
          <div className="absolute inset-0 bg-[#0c121d]">
            <div className="w-full h-full scale-110" style={{background: 'linear-gradient(180deg, #0c1829 0%, #1a2d4a 50%, #0a1525 100%)'}} />
          </div>

          <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden opacity-30">
             <div className="w-full h-[1px] bg-white absolute top-1/4 animate-[scan_4s_ease-in-out_infinite]"></div>
             <div className="w-full h-[1px] bg-white absolute top-2/4 animate-[scan_4s_ease-in-out_infinite_1s]"></div>
             <div className="w-full h-[1px] bg-white absolute top-3/4 animate-[scan_4s_ease-in-out_infinite_2s]"></div>
          </div>

          {/* Scanning Box Map Cam */}
          <div className="absolute inset-0 flex items-center justify-center z-20">
             <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} className="w-56 h-56 border-2 border-primary/50 relative shadow-[0_0_100px_rgba(var(--color-primary),0.2)]">
                <div className="absolute -top-10 left-0 bg-primary shadow-xl shadow-primary/30 text-white font-mono text-[10px] px-3 py-1 rounded-full uppercase tracking-[0.2em] font-bold border border-white/20">目標分析：匹配度 98%</div>

                <div className="absolute -top-[4px] -left-[4px] w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-xl shadow-[-5px_-5px_15px_rgba(var(--color-primary),0.4)]"></div>
                <div className="absolute -top-[4px] -right-[4px] w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-xl shadow-[5px_-5px_15px_rgba(var(--color-primary),0.4)]"></div>
                <div className="absolute -bottom-[4px] -left-[4px] w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-xl shadow-[-5px_5px_15px_rgba(var(--color-primary),0.4)]"></div>
                <div className="absolute -bottom-[4px] -right-[4px] w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-xl shadow-[5px_5px_15px_rgba(var(--color-primary),0.4)]"></div>

                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] bg-primary/40 animate-[radar-line_2s_ease-in-out_infinite]"></div>
             </motion.div>
          </div>

          <div className="absolute bottom-12 left-8 right-8 z-30">
             <div className="bg-[#0c121d]/90 backdrop-blur-3xl px-8 py-8 rounded-[3rem] border border-white/10 shadow-[0_30px_100px_rgba(0,0,0,0.8)] relative overflow-hidden">
                <div className="absolute -right-20 -top-20 w-40 h-40 bg-primary/20 rounded-full blur-[60px]"></div>

                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-4">
                     <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary-container text-white flex items-center justify-center shrink-0 shadow-2xl border border-white/20 font-bold font-mono text-xl">XM</div>
                     <div>
                        <p className="text-[10px] text-primary font-extrabold tracking-[0.3em] mb-1">場域狀態</p>
                        <p className="text-white text-3xl font-bold tracking-tight">走廊人流偏高</p>
                     </div>
                  </div>
                  <div className="text-right">
                     <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest font-mono">地理座標</p>
                     <p className="text-white/80 font-bold text-lg">B-4 EXIT_A1</p>
                  </div>
                </div>

                <div className="flex gap-4">
                   <button onClick={() => setModal(null)} className="flex-1 py-5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-3xl transition-all border border-white/10 active:scale-95 text-base tracking-widest uppercase italic">關閉</button>
                   <button onClick={() => { setModal(null); navigateTo('dispatch-map'); }} className="flex-[2] py-5 bg-primary text-white font-bold rounded-3xl active:scale-95 transition-all text-lg shadow-[0_15px_40px_rgba(var(--color-primary),0.4)] flex items-center justify-center gap-4 group/p">
                      <Zap size={24} className="group-hover/p:rotate-12 transition-transform" />
                      <span className="tracking-[0.1em] uppercase">立即派遣巡邏</span>
                   </button>
                </div>
             </div>
          </div>

          {/* Vignette */}
          <div className="absolute inset-0 shadow-[inset_0_0_150px_rgba(0,0,0,0.9)] pointer-events-none"></div>
        </div>
      </BottomSheet>
    </div>
  );
}
