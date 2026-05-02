import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BottomSheet } from '../components/ui';
import { BatteryCharging, MapPin, Activity, Navigation, Wind, Building2, Route, Terminal, CheckCircle2, CircleDashed, FileText, Bot, ArrowRight } from 'lucide-react';
import { useAppActions, useAppState } from '../state/AppStateProvider';
import { getDemoHealth, getDemoSteps } from '../services/demoFlow';

export function DashboardView({ showToast, navigateTo }: { showToast: (m: string) => void, navigateTo: (id: string, props?: any) => void }) {
  const state = useAppState();
  const actions = useAppActions();
  const [modal, setModal] = useState<string | null>(null);
  const [speed, setSpeed] = useState(1.2);
  const [activeRobotId, setActiveRobotId] = useState('4號');

  const activeRobot = state.robots.find((robot) => robot.id === activeRobotId) ?? state.robots[0] ?? null;
  const demoSteps = getDemoSteps(state);
  const demoHealth = getDemoHealth(state);

  // Derive progress from task state: completed tasks / total tasks for active robot
  const robotTasks = state.tasks.filter((t) => t.robotId === activeRobot?.id);
  const completedTasks = robotTasks.filter((t) => t.status === 'completed').length;
  const totalTasks = robotTasks.length;
  const derivedProgress = totalTasks > 0
    ? Math.round((completedTasks / totalTasks) * 100)
    : activeRobot?.isRunning ? 64 : 0;

  useEffect(() => {
    if (activeRobot) setSpeed(activeRobot.speed);
  }, [activeRobot?.id, activeRobot?.speed]);

  if (!activeRobot) return null;

  return (
    <div className="space-y-6 pb-6">
      <section className="rounded-[2.5rem] border border-primary/10 bg-surface-container-lowest p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-extrabold text-primary">任務中控</p>
            <h2 className="mt-2 font-headline text-3xl font-bold tracking-tight">派單到回報</h2>
            <p className="mt-2 max-w-2xl text-sm font-bold leading-6 text-on-surface-variant">從派遣到回報，一屏完成。</p>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[28rem]">
            {demoHealth.map((item) => (
              <div key={item.label} className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-3">
                <p className="text-[10px] font-extrabold text-on-surface-variant/60">{item.label}</p>
                <p className={`mt-1 text-sm font-black ${item.ok ? 'text-primary' : 'text-error'}`}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-5">
          {demoSteps.map((step) => (
            <button
              key={step.id}
              onClick={() => {
                if (step.id === 'delivery') navigateTo('delivery-tracking');
                if (step.id === 'report') navigateTo('student-report');
              }}
              className={`min-h-28 rounded-2xl border p-4 text-left transition active:scale-95 ${step.done ? 'border-primary/20 bg-primary/10 text-primary' : 'border-outline-variant/20 bg-surface-container-low text-on-surface-variant hover:bg-surface-container'}`}
            >
              {step.done ? <CheckCircle2 size={20} /> : <CircleDashed size={20} />}
              <p className="mt-3 text-sm font-black">{step.label}</p>
              <p className="mt-1 text-[11px] font-bold leading-5 opacity-75">{step.detail}</p>
            </button>
          ))}
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <button onClick={() => navigateTo('dispatch-map')} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-black text-white shadow-lg shadow-primary/20 active:scale-95">
            校園派遣
            <ArrowRight size={18} />
          </button>
          <button onClick={() => navigateTo('delivery')} className="flex min-h-12 items-center justify-center rounded-2xl border border-outline-variant/20 bg-surface-container-low px-4 text-sm font-black text-on-surface active:scale-95">
            物品配送
          </button>
          <button onClick={() => navigateTo('task-schedule')} className="flex min-h-12 items-center justify-center rounded-2xl border border-outline-variant/20 bg-surface-container-low px-4 text-sm font-black text-on-surface active:scale-95">
            排程清潔
          </button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-5">
        {/* Robot Status Card */}
        <motion.div
          whileHover={{ scale: 1.01, translateY: -2 }} whileTap={{ scale: 0.98 }}
          className="col-span-2 bg-surface-container-low rounded-[2.5rem] p-8 relative overflow-hidden group border border-outline-variant/30 shadow-[0_4px_25px_rgba(0,0,0,0.02)] cursor-pointer hover:bg-surface-container transition-all"
          onClick={() => setModal('robot')}
        >
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="font-headline text-4xl font-bold mb-2 tracking-tight">{activeRobotId}機</h2>
                {activeRobot.status === '待命' || activeRobot.status === '充電' ? (
                  <span className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-surface-container-highest text-on-surface-variant rounded-lg text-xs font-bold shadow-sm">
                    <span className="w-2 h-2 bg-on-surface-variant/40 rounded-full" />{activeRobot.status}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-bold shadow-sm border border-primary/20">
                    <span className="w-2 h-2 bg-[#87d46c] rounded-full animate-pulse shadow-[0_0_10px_rgba(135,212,108,0.8)]" />{activeRobot.status}中
                  </span>
                )}
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-on-surface-variant/60 mb-1">機身代號</p>
                <p className="text-sm font-bold">{activeRobot.serial}</p>
              </div>
            </div>
            <div className="absolute right-8 top-1/2 hidden -translate-y-1/2 text-primary/10 sm:block">
              <Bot size={136} strokeWidth={1.4} />
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-surface-container-lowest flex items-center justify-center shrink-0 shadow-sm border border-outline-variant/20">
                  <BatteryCharging className="text-primary" size={26} />
                </div>
                <div>
                  <p className="text-[10px] text-on-surface-variant font-bold mb-1 text-primary/80">電量</p>
                  <p className="text-2xl font-headline font-bold">{activeRobot.battery}<span className="text-sm ml-0.5 opacity-60">%</span></p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-surface-container-lowest flex items-center justify-center shrink-0 shadow-sm border border-outline-variant/20">
                  <MapPin className="text-primary" size={26} />
                </div>
                <div>
                  <p className="text-[10px] text-on-surface-variant font-bold mb-1 text-primary/80">位置</p>
                  <p className="text-xl font-headline font-bold tracking-tight line-clamp-2">{activeRobot.position}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute -right-20 -bottom-20 w-80 h-80 opacity-5 blur-[80px] rounded-full bg-primary pointer-events-none group-hover:opacity-10 transition-opacity"></div>

          <div className="absolute left-8 bottom-4 text-[10px] font-bold opacity-20 pointer-events-none">狀態已同步</div>
        </motion.div>

        {/* Mini Cards */}
        <motion.div whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.95 }} className="bg-surface-container-lowest border border-outline-variant/30 rounded-[2.5rem] p-6 flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.02)] cursor-pointer hover:shadow-md relative overflow-hidden" onClick={() => setModal('radar')}>
          <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full border border-primary/10 flex flex-col items-center justify-center opacity-40">
             <motion.div animate={{ rotate: 360 }} transition={{ duration: 5, repeat: Infinity, ease: 'linear' }} className="w-1/2 h-full origin-bottom rounded-tr-full bg-gradient-to-t from-primary/30 to-transparent"></motion.div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 relative z-10 border border-primary/10">
            <Activity className="text-primary" size={20} />
          </div>
          <div className="relative z-10">
            <p className="text-[10px] font-bold text-on-surface-variant/60 mb-1">環境掃描</p>
            <p className="text-2xl font-headline font-bold text-primary tracking-tight">運作中</p>
          </div>
        </motion.div>

        <motion.div whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.95 }} className="bg-surface-container-lowest border border-outline-variant/30 rounded-[2.5rem] p-6 flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.02)] cursor-pointer hover:shadow-md relative overflow-hidden" onClick={() => setModal('speed')}>
          <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center mb-4 relative z-10 border border-secondary/10">
            <Navigation className="text-secondary" size={20} />
          </div>
          <div className="relative z-10">
            <p className="text-[10px] font-bold text-on-surface-variant/60 mb-1">巡航速度</p>
            <p className="text-2xl font-headline font-bold text-on-surface">{speed.toFixed(1)} <span className="text-xs opacity-50 ml-1 font-bold">速度</span></p>
          </div>
        </motion.div>
      </section>

      {/* Task Progress */}
      <section className="mt-4">
        <motion.div whileHover={{ scale: 1.005 }} whileTap={{ scale: 0.99 }} className="bg-surface-container-lowest rounded-[3rem] p-8 border border-outline-variant/30 shadow-[0_4px_25px_rgba(0,0,0,0.02)] cursor-pointer hover:bg-surface-container transition-all" onClick={() => setModal('task')}>
          <div className="flex items-center gap-8 mb-8 relative">
            <div className="w-[84px] h-[84px] shrink-0 rounded-3xl bg-gradient-to-br from-primary to-primary-container text-white flex items-center justify-center shadow-[0_8px_25px_rgba(var(--color-primary),0.3)] relative">
               <motion.div animate={{ rotate: -360 }} transition={{ duration: 10, repeat: Infinity, ease: 'linear' }} className="absolute -inset-1.5 rounded-[2rem] border-[1.5px] border-dashed border-primary/30"></motion.div>
               <Wind size={36} />
            </div>
             <div className="flex-1 min-w-0 py-1">
               <div className="flex items-center gap-2 mb-2">
                 <span className="w-2 h-2 bg-primary rounded-full"></span>
                 <p className="text-xs font-extrabold text-primary">任務執行中</p>
               </div>
               <h3 className="mb-1 font-headline text-2xl font-bold leading-tight tracking-tight sm:text-3xl line-clamp-2">{activeRobot.task}</h3>
               <p className="text-on-surface-variant font-bold text-xs opacity-70">預計完成：{activeRobot.eta}</p>
             </div>
          </div>
          <div>
            <div className="flex justify-between items-end mb-4">
              <span className="text-xs font-extrabold text-primary bg-primary/10 px-3 py-1 rounded-lg border border-primary/20">
                {activeRobot.status === '充電' || activeRobot.status === '待命' ? '0' : derivedProgress}% 已完成
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    actions.setRobotRunning(activeRobot.id, !activeRobot.isRunning);
                    showToast(activeRobot.isRunning ? '已暫停設備運作' : `${activeRobot.id} 任務已恢復`);
                  }}
                  className={`min-h-10 rounded-xl px-4 py-2 text-xs font-bold shadow-md transition-all cursor-pointer active:scale-95 ${activeRobot.isRunning ? 'bg-surface-container-highest text-on-surface hover:bg-outline-variant/30' : 'bg-primary text-white shadow-primary/30'}`}
                >
                  {activeRobot.isRunning ? '暫停執行' : '繼續執行'}
                </button>
                <div className="h-8 w-[1px] bg-outline-variant/30 hidden sm:block mx-2"></div>
                <span className="text-[10px] font-bold text-on-surface-variant/60 border border-outline-variant/30 bg-surface-container-high px-3 py-2 rounded-xl">{activeRobot.phase}</span>
              </div>
            </div>
            <div className="h-4 w-full bg-surface-container-high rounded-full overflow-hidden shadow-inner p-1">
              <motion.div
                className={`h-full bg-gradient-to-r ${activeRobot.status === '充電' ? 'from-[#f6d365] to-[#d4a017]' : 'from-primary to-primary-container shadow-[0_0_15px_rgba(var(--color-primary),0.4)]'} rounded-full relative`}
                animate={{ width: activeRobot.status === '充電' || activeRobot.status === '待命' ? '0%' : `${derivedProgress}%` }}
                transition={{ type: "spring", bounce: 0, duration: 1 }}
              >
                <motion.div
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                ></motion.div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Hardware command queue */}
      <section className="bg-surface-container-lowest rounded-[2.5rem] p-6 border border-outline-variant/30 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/10">
              <Terminal size={24} />
            </div>
            <div>
              <h3 className="font-headline text-xl font-bold tracking-tight">機器人任務紀錄</h3>
              <p className="text-[10px] font-bold text-on-surface-variant/60">
                {state.hardwareMode === 'serial-ready' ? '已接收' : '展示紀錄就緒'}
              </p>
            </div>
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-extrabold text-primary">
            {state.robotCommandLogs.length} 筆
          </span>
        </div>
        <div className="space-y-2">
          {state.robotCommandLogs.slice(0, 4).map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-surface-container-low px-4 py-3 border border-outline-variant/10">
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold" title={item.label}>{item.label}</p>
                <p className="mt-0.5 truncate text-[10px] font-bold text-on-surface-variant/60" title={item.target}>
                  {item.target}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-extrabold ${
                item.status === 'sent'
                  ? 'bg-primary text-white'
                  : item.status === 'failed'
                    ? 'bg-error/10 text-error'
                    : item.status === 'queued'
                      ? 'bg-secondary text-white'
                      : 'bg-surface-container-high text-on-surface-variant'
              }`}>
                {item.status === 'sent' ? '已送' : item.status === 'failed' ? '未連線' : item.status === 'queued' ? '待送' : '示範'}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Fleet Overview */}
      <section className="pt-2">
        <div className="flex justify-between items-center px-2 mb-5">
           <h4 className="font-headline text-xl font-bold tracking-tight">機隊狀態</h4>
           <div className="flex items-center gap-1.5 text-[10px] text-primary font-bold bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20">
             <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></div>
             {state.robots.length} / {state.robots.length} 在線
           </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
             {state.robots.map(bot => {
             const isActive = activeRobotId === bot.id;
             let bgClass = 'bg-surface-container-lowest border-outline-variant/30';
             if (isActive) {
               if(bot.id === '1號') bgClass = 'bg-surface-container-high text-on-surface border-on-surface/30';
               else if(bot.id === '2號') bgClass = 'bg-[#f6d365]/10 text-[#d4a017] border-[#f6d365]/30 shadow-sm';
               else if(bot.id === '3號') bgClass = 'bg-secondary/10 text-secondary border-secondary/30 shadow-sm';
               else if(bot.id === '4號') bgClass = 'bg-primary text-white border-primary shadow-xl shadow-primary/20';
             }

             return (
               <motion.div
                 whileHover={{ y: -2 }}
                 whileTap={{ scale: 0.9 }}
                 onClick={() => setActiveRobotId(bot.id)}
                 key={bot.id}
                 className={`rounded-2xl py-4 px-2 text-center cursor-pointer transition-all border ${bgClass} ${isActive ? '' : 'hover:bg-surface-container'}`}
               >
                  <p className={`font-headline font-bold text-lg tracking-tight ${!isActive ? (bot.status === '充電' ? 'text-[#d4a017]' : bot.status === '配送' ? 'text-primary' : 'text-on-surface-variant') : ''}`}>{bot.id}</p>
                  <p className={`text-[10px] font-bold mt-1 opacity-60 ${!isActive ? (bot.status === '充電' ? 'text-[#d4a017]' : bot.status === '配送' ? 'text-primary' : 'text-on-surface-variant') : ''}`}>{bot.status}</p>
               </motion.div>
             );
           })}
        </div>
      </section>

      {/* Quick Actions */}
      <section>
        <h4 className="font-headline text-xl font-bold mb-5 px-2 tracking-tight">中心化管理設施</h4>
        <div className="grid grid-cols-1 gap-4">
          <motion.button
            whileHover={{ scale: 1.01, x: 4 }} whileTap={{ scale: 0.98 }}
            onClick={() => navigateTo('task-schedule')}
            className="flex items-center gap-5 p-5 bg-surface-container-lowest border border-outline-variant/30 rounded-[1.75rem] text-left shadow-[0_4px_15px_rgba(0,0,0,0.02)] hover:shadow-md hover:border-primary/40 transition-all group"
          >
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 text-primary border border-primary/10 group-hover:bg-primary group-hover:text-white transition-colors">
               <Building2 size={28} />
            </div>
            <div className="flex-1">
               <p className="text-base font-bold tracking-tight">智能教室清掃</p>
               <p className="text-xs text-on-surface-variant font-bold mt-1 opacity-70">安排清掃路線</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center text-primary/40 group-hover:text-primary transition-colors">
              <Route size={20} />
            </div>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.01, x: 4 }} whileTap={{ scale: 0.98 }}
            onClick={() => navigateTo('dispatch-map')}
            className="flex items-center gap-5 p-5 bg-surface-container-lowest border border-outline-variant/30 rounded-[1.75rem] text-left shadow-[0_4px_15px_rgba(0,0,0,0.02)] hover:shadow-md hover:border-primary/40 transition-all group"
          >
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 text-primary border border-primary/10 group-hover:bg-primary group-hover:text-white transition-colors">
              <Bot size={28} />
            </div>
            <div className="flex-1">
              <p className="text-base font-bold tracking-tight">校園即時派遣</p>
              <p className="text-xs text-on-surface-variant font-bold mt-1 opacity-70">選區域並派 S-01</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center text-primary/40 group-hover:text-primary transition-colors">
              <Route size={20} />
            </div>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.01, x: 4 }} whileTap={{ scale: 0.98 }}
            onClick={() => navigateTo('student-report')}
            className="flex items-center gap-5 p-5 bg-surface-container-lowest border border-outline-variant/30 rounded-[1.75rem] text-left shadow-[0_4px_15px_rgba(0,0,0,0.02)] hover:shadow-md hover:border-primary/40 transition-all group"
          >
            <div className="w-14 h-14 rounded-2xl bg-secondary/10 flex items-center justify-center shrink-0 text-secondary border border-secondary/10 group-hover:bg-secondary group-hover:text-white transition-colors">
              <FileText size={28} />
            </div>
            <div className="flex-1">
              <p className="text-base font-bold tracking-tight">展示報表中心</p>
              <p className="text-xs text-on-surface-variant font-bold mt-1 opacity-70">輸出任務與教學紀錄</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center text-primary/40 group-hover:text-primary transition-colors">
              <Route size={20} />
            </div>
          </motion.button>
        </div>
      </section>

      {/* Modals */}
      <BottomSheet isOpen={modal === 'speed'} onClose={() => setModal(null)} title="巡航速度校準">
        <div className="p-6 space-y-10 pb-10">
          <div className="text-center bg-surface-container rounded-[2rem] py-12 border border-outline-variant/10 shadow-inner">
            <p className="text-7xl font-headline font-bold text-primary tracking-tight">
              {speed.toFixed(1)} <span className="text-2xl text-on-surface-variant/60 font-sans tracking-tight font-medium">m/s</span>
            </p>
            <div className="flex items-center justify-center gap-2 mt-4">
              <span className="w-2 h-2 bg-[#87d46c] rounded-full animate-pulse"></span>
              <p className="text-xs text-on-surface-variant font-bold">巡航穩定</p>
            </div>
          </div>
          <div className="px-4">
            <div className="flex justify-between text-[10px] text-on-surface-variant font-extrabold mb-4 opacity-60">
              <span>下限</span>
              <span>理論上限</span>
            </div>
            <input
              type="range" min="0.5" max="2.5" step="0.1" value={speed}
              onChange={(e)=>setSpeed(Number(e.target.value))}
              className="w-full h-8 bg-surface-container-highest rounded-full appearance-none cursor-pointer accent-primary border-[6px] border-surface-container shadow-inner"
            />
            <div className="flex justify-between text-[11px] text-primary font-bold mt-4">
              <span className="bg-primary/5 px-2 py-0.5 rounded">低速</span>
              <span className="bg-primary/5 px-2 py-0.5 rounded text-error/60">高速</span>
            </div>
          </div>
          <button
            onClick={() => { actions.setRobotSpeed(activeRobot.id, speed); showToast(`巡航速度定為 ${speed.toFixed(1)} m/s`); setModal(null); }}
            className="w-full py-5 bg-primary text-white font-bold rounded-2xl active:scale-95 transition-all text-lg shadow-[0_8px_30px_rgba(var(--color-primary),0.3)] hover:shadow-[0_12px_40px_rgba(var(--color-primary),0.4)]"
          >
            執行變更指令
          </button>
        </div>
      </BottomSheet>

      <BottomSheet isOpen={modal === 'task'} onClose={() => setModal(null)} title="即時路徑追蹤">
         <div className="p-6 flex flex-col items-center">
           <div className="w-full aspect-square bg-[#0f172a] rounded-[2.5rem] relative overflow-hidden flex items-center justify-center border-4 border-surface-container-highest shadow-2xl">
             <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #3b82f6 1px, transparent 0)', backgroundSize: '30px 30px' }}></div>

             <svg className="absolute inset-0 w-full h-full pointer-events-none p-10" preserveAspectRatio="none">
               <path d="M 50,50 L 250,50 L 250,150 L 50,150 L 50,250 L 250,250" fill="none" stroke="rgba(59, 130, 246, 0.1)" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
               <motion.path
                 initial={{ pathLength: 0 }}
                 animate={{ pathLength: 1 }}
                 transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                 d="M 50,50 L 250,50 L 250,150 L 50,150 L 50,250 L 250,250"
                 fill="none" stroke="#2563eb" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"
                 className="drop-shadow-[0_0_12px_rgba(37,99,235,0.8)]"
               />
             </svg>

             <motion.div animate={{
                x: [0, 200, 200, 0, 0, 200],
                y: [0, 0, 100, 100, 200, 200]
               }}
               transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
               className="absolute top-[50px] left-[50px] -translate-x-1/2 -translate-y-1/2 z-10"
             >
                <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center shadow-2xl border-[3px] border-primary rotate-45">
                   <div className="w-2 h-2 bg-primary rounded-full animate-ping absolute"></div>
                   <div className="w-2 h-2 bg-primary rounded-full relative"></div>
                </div>
             </motion.div>

             {/* Map Labels */}
             <div className="absolute top-8 left-8 text-[10px] font-bold text-blue-400/60">B 棟路線</div>
             <div className="absolute bottom-8 right-8 text-[10px] font-bold text-blue-400/60">自動導航</div>
           </div>

           <div className="mt-10 w-full bg-surface-container-lowest p-7 rounded-[2rem] border border-outline-variant/30 shadow-sm">
             <div className="flex justify-between items-center mb-4">
                <h4 className="text-2xl font-bold font-headline tracking-tight">507 教室 (B棟西側)</h4>
                <span className="text-[10px] bg-primary/10 text-primary px-3 py-1 rounded-full font-bold border border-primary/20">執行中</span>
             </div>
             <p className="text-sm text-on-surface-variant font-medium leading-relaxed">AI 正在計算動態避障路徑。目前環境清潔度預估已提升至 84%。</p>
           </div>
         </div>
      </BottomSheet>

      <BottomSheet isOpen={modal === 'robot' || modal === 'radar'} onClose={() => setModal(null)} title="系統診斷">
        <div className="p-4 space-y-4">
          {[
            { id: 'env-scan', n: '環境掃描', s: '正常', t: '即時回傳' },
            { id: 'obstacle', n: '避障感測', s: '正常', t: '路線安全' },
            { id: 'task-judge', n: '任務判斷', s: '正常', t: '狀態穩定' },
            { id: 'motion-mod', n: '移動模組', s: '正常', t: '輸出穩定' }
          ].map((s, i) => (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }} key={s.id} className="flex justify-between items-center p-5 bg-surface-container-low rounded-2xl border border-outline-variant/10 shadow-sm hover:shadow transition-shadow">
              <span className="font-bold text-sm tracking-wide text-on-surface">{s.n}</span>
              <div className="text-right">
                <span className="text-[10px] text-[#87d46c] font-bold">{s.s}</span>
                <p className="text-[11px] text-on-surface-variant font-medium mt-1">{s.t}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}
