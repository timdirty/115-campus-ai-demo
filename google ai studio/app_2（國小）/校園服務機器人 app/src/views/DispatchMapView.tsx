import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Map, Navigation, ShieldAlert, Zap, Target, Users } from 'lucide-react';
import { useAppActions } from '../state/AppStateProvider';
import { generateDispatchRecommendation } from '../services/localAi';
import type { DispatchTaskType } from '../state/appState';

export function DispatchMapView({ goBack, showToast }: any) {
  const actions = useAppActions();
  const [selectedZone, setSelectedZone] = useState('none');
  const [taskType, setTaskType] = useState<DispatchTaskType>('patrol');
  const [recommendation, setRecommendation] = useState('');

  const handleDispatch = async () => {
    if (selectedZone === 'none') return;
    const dispatchType: DispatchTaskType = taskType === 'broadcast' ? 'broadcast' : 'patrol';
    const message = await generateDispatchRecommendation(selectedZone, dispatchType);
    setRecommendation(message);
    actions.addDispatchTask({ zone: selectedZone, taskType: dispatchType });
    showToast(`機器人已出發前往區域 ${selectedZone} 執行任務`);
    setTimeout(goBack, 700);
  };

  return (
    <div className="min-h-screen bg-[#050912] text-white pb-32">
      <header className="sticky top-0 z-50 bg-[#050912]/80 backdrop-blur-2xl border-b border-white/10 px-6 py-5 flex items-center justify-between">
        <button onClick={goBack} className="w-11 h-11 rounded-2xl bg-white/5 active:scale-90 transition-all flex items-center justify-center border border-white/10 shadow-sm">
          <ArrowLeft size={24} />
        </button>
        <h1 className="font-headline font-bold text-xl absolute left-1/2 -translate-x-1/2 tracking-tighter uppercase italic">戰術派遣</h1>
        <button onClick={() => showToast('全區衛星掃描中...')} className="w-11 h-11 rounded-2xl bg-primary/20 text-primary active:scale-90 transition-all flex items-center justify-center border border-primary/30 shadow-[0_0_15px_rgba(var(--color-primary),0.3)]">
          <Target size={24} />
        </button>
      </header>

      <main className="p-6 space-y-8 max-w-lg mx-auto">

        {/* Radar Map container */}
        <div className="w-full aspect-[4/5] bg-[#0c121d] rounded-[3rem] border-4 border-[#1a2333] relative overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] group">
           {/* Scan Grid */}
           <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'linear-gradient(rgba(var(--color-primary),0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(var(--color-primary),0.2) 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>

           {/* Radar sweep */}
           <motion.div animate={{ rotate: 360 }} transition={{ duration: 5, repeat: Infinity, ease: 'linear' }} className="absolute inset-0 z-0 origin-center scale-[1.5]">
             <div className="w-1/2 h-1/2 bg-gradient-to-br from-primary/30 to-transparent absolute top-0 left-1/2 origin-bottom-left" style={{ clipPath: 'polygon(0% 100%, 100% 0%, 100% 100%)' }}></div>
           </motion.div>

           {/* Central Crosshair */}
           <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-20">
              <div className="w-20 h-20 border border-primary rounded-full"></div>
              <div className="w-1 h-32 bg-primary absolute left-1/2 -top-6 -translate-x-1/2"></div>
              <div className="h-1 w-32 bg-primary absolute top-1/2 -left-6 -translate-y-1/2"></div>
           </div>

           {/* Zones */}
           <motion.button
             initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 }}
             onClick={() => setSelectedZone('A')}
             className={`absolute top-[15%] left-[12%] w-[140px] h-[120px] rounded-[2rem] flex flex-col items-center justify-center border-2 transition-all z-10 backdrop-blur-md
              ${selectedZone === 'A' ? 'bg-primary/30 border-primary shadow-[0_0_40px_rgba(var(--color-primary),0.5)] scale-110 active:scale-100' : 'bg-white/5 border-white/10 hover:bg-white/10 active:scale-95'}`}
           >
              <span className="text-[9px] font-extrabold text-primary mb-1 font-mono tracking-widest opacity-80 uppercase">阿爾法區域 (Alpha)</span>
              <p className="font-bold text-2xl tracking-tighter text-white font-mono">區域 A</p>
              <div className="w-8 h-1 bg-white/20 mt-3 rounded-full overflow-hidden">
                 <motion.div animate={{ x: [-32, 32] }} transition={{ duration: 1.5, repeat: Infinity }} className="w-full h-full bg-primary"></motion.div>
              </div>
           </motion.button>

           <motion.button
             initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2 }}
             onClick={() => setSelectedZone('B')}
             className={`absolute top-[45%] right-[8%] w-[130px] h-[140px] rounded-[2rem] flex flex-col items-center justify-center border-2 transition-all z-10 backdrop-blur-md
              ${selectedZone === 'B' ? 'bg-primary/30 border-primary shadow-[0_0_40px_rgba(var(--color-primary),0.5)] scale-110 active:scale-100' : 'bg-white/5 border-white/10 hover:bg-white/10 active:scale-95'}`}
           >
              <span className="text-[9px] font-extrabold text-[#f59e0b] mb-1 font-mono tracking-widest opacity-80 uppercase">貝塔區域 (Beta)</span>
              <p className="font-bold text-2xl tracking-tighter text-white font-mono">區域 B</p>
              <div className="mt-4 px-2 py-1 bg-error/20 border border-error/30 rounded-lg animate-pulse flex items-center gap-1.5">
                 <Users size={12} className="text-error" />
                 <span className="text-[9px] font-extrabold text-error font-mono uppercase tracking-tighter">熱區警示</span>
              </div>
           </motion.button>

           <motion.button
             initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3 }}
             onClick={() => setSelectedZone('C')}
             className={`absolute bottom-[10%] left-[18%] w-[170px] h-[100px] rounded-[2rem] flex flex-col items-center justify-center border-2 transition-all z-10 backdrop-blur-md
              ${selectedZone === 'C' ? 'bg-primary/30 border-primary shadow-[0_0_40px_rgba(var(--color-primary),0.5)] scale-110 active:scale-100' : 'bg-white/5 border-white/10 hover:bg-white/10 active:scale-95'}`}
           >
              <span className="text-[9px] font-extrabold text-primary mb-1 font-mono tracking-widest opacity-80 uppercase">伽瑪區域 (Gamma)</span>
              <p className="font-bold text-2xl tracking-tighter text-white font-mono">區域 C</p>
              <p className="text-[8px] font-bold text-white/40 mt-2 tracking-widest uppercase">待命 || 穩定</p>
           </motion.button>
        </div>

        {/* Task Control */}
        <div className="min-h-[220px]">
          <AnimatePresence mode="wait">
            {selectedZone === 'none' ? (
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col items-center justify-center py-10 bg-white/5 rounded-[2.5rem] border border-dashed border-white/10">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4 text-white/20"><Navigation size={32} /></div>
                  <p className="text-sm font-bold text-white/40 tracking-widest uppercase font-mono">請從雷達地圖選擇派遣區域</p>
               </motion.div>
            ) : (
              <motion.div
                key={selectedZone}
                initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -30, opacity: 0 }}
                className="bg-[#1e293b]/90 p-8 rounded-[3rem] border border-white/20 shadow-2xl backdrop-blur-2xl relative overflow-hidden"
              >
                 <div className="flex justify-between items-start mb-8 relative z-10">
                    <div>
                       <span className="text-[10px] font-extrabold text-primary uppercase tracking-[0.3em] font-mono mb-2 block">任務目標鎖定</span>
                       <h3 className="font-mono text-4xl font-bold tracking-tighter">
                         區域 <span className="text-primary">{selectedZone}</span>
                       </h3>
                    </div>
                    <button onClick={() => setSelectedZone('none')} className="text-[10px] font-bold text-white/40 hover:text-white uppercase tracking-widest bg-white/5 px-4 py-2 rounded-xl transition-colors">取消選擇</button>
                 </div>

                 <div className="grid grid-cols-2 gap-4 mb-8 relative z-10">
                   <button
                      onClick={() => setTaskType('patrol')}
                      className={`p-6 rounded-3xl border-2 flex flex-col items-center justify-center gap-3 transition-all active:scale-95 ${taskType === 'patrol' ? 'bg-primary/20 border-primary text-primary shadow-[0_0_20px_rgba(var(--color-primary),0.3)]' : 'bg-black/40 border-white/10 text-white/40 hover:bg-white/5'}`}
                   >
                      <motion.div animate={taskType === 'patrol' ? { scale: [1, 1.1, 1] } : {}} transition={{ repeat: Infinity, duration: 2 }}><Navigation size={32} /></motion.div>
                      <span className="text-[11px] font-extrabold font-mono tracking-widest uppercase">自動巡邏</span>
                   </button>
                   <button
                      onClick={() => setTaskType('broadcast')}
                      className={`p-6 rounded-3xl border-2 flex flex-col items-center justify-center gap-3 transition-all active:scale-95 ${taskType === 'broadcast' ? 'bg-tertiary/20 border-tertiary text-tertiary shadow-[0_0_20px_rgba(var(--color-tertiary),0.3)]' : 'bg-black/40 border-white/10 text-white/40 hover:bg-white/5'}`}
                   >
                      <motion.div animate={taskType === 'broadcast' ? { rotate: [0, 10, -10, 0] } : {}} transition={{ repeat: Infinity, duration: 2 }}><ShieldAlert size={32} /></motion.div>
                      <span className="text-[11px] font-extrabold font-mono tracking-widest uppercase">群眾疏導</span>
                   </button>
                 </div>

                 {recommendation && (
                   <p className="mb-5 rounded-2xl border border-primary/20 bg-primary/10 p-4 text-sm font-bold leading-relaxed text-primary">
                     {recommendation}
                   </p>
                 )}

                 <button
                   onClick={handleDispatch}
                   className="w-full py-6 bg-primary hover:bg-primary/95 text-white font-bold text-lg tracking-[0.2em] rounded-[2rem] active:scale-[0.985] transition-all flex items-center justify-center gap-4 shadow-[0_12px_40px_rgba(var(--color-primary),0.5)] group/btn relative overflow-hidden"
                 >
                   <div className="absolute inset-0 bg-white/10 -translate-x-full group-hover/btn:translate-x-0 transition-transform duration-500"></div>
                   <Zap size={24} className="group-hover/btn:scale-125 transition-transform" />
                   <span className="relative z-10">發送終端指令</span>
                 </button>

                 <div className="absolute -left-20 -bottom-20 w-40 h-40 bg-primary/10 rounded-full blur-[80px]"></div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </main>
    </div>
  );
}
