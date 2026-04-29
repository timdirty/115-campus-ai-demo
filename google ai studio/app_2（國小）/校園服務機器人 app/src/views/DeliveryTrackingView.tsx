import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Package, MapPin, Truck, Clock, CheckCircle2 } from 'lucide-react';
import { useAppActions, useAppState } from '../state/AppStateProvider';

export function DeliveryTrackingView({ goBack, showToast, orderStatus }: any) {
  const state = useAppState();
  const actions = useAppActions();
  const activeOrder = state.orders.find((order) => order.status === 'in_transit') ?? state.orders[0] ?? null;
  const displayStatus = activeOrder
    ? `送達 ${activeOrder.destination}: ${activeOrder.productName} x${activeOrder.quantity}`
    : orderStatus;
  const [eta, setEta] = useState(3);
  const [phase, setPhase] = useState<'departed' | 'arriving' | 'delivered'>('departed');

  useEffect(() => {
    if (!displayStatus) return;

    // Simulate progression
    const t1 = setTimeout(() => { setPhase('arriving'); setEta(1); }, 3000);
    const t2 = setTimeout(() => { setPhase('delivered'); setEta(0); }, 6000);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [displayStatus]);

  useEffect(() => {
    if (phase === 'delivered') {
      if (activeOrder?.status === 'in_transit') {
        actions.completeOrder(activeOrder.id);
      }
      showToast('機器人已抵達，請取件！');
    }
  }, [phase]);

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-2xl border-b border-outline-variant/30 px-6 py-5 flex items-center justify-between">
        <button onClick={goBack} className="w-11 h-11 rounded-2xl bg-surface-container-low active:scale-90 transition-all text-on-surface flex items-center justify-center border border-outline-variant/10 shadow-sm">
          <ArrowLeft size={24} />
        </button>
        <h1 className="font-headline font-bold text-xl absolute left-1/2 -translate-x-1/2 tracking-tight">任務即時監控</h1>
        <div className="w-11 h-11 flex items-center justify-center bg-primary/5 rounded-2xl text-primary font-mono text-[10px] font-bold border border-primary/20">追蹤</div>
      </header>

      <main className="p-6 space-y-6 max-w-lg mx-auto">
        <div className="bg-surface-container-low p-10 rounded-[3rem] text-center border border-outline-variant/30 relative overflow-hidden shadow-sm group">
          <div className="absolute top-0 right-0 w-32 h-32 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(45deg, var(--color-primary) 1.5px, transparent 1.5px)', backgroundSize: '16px 16px' }}></div>

          <div className="relative z-10">
            {phase === 'delivered' ? (
              <motion.div initial={{ scale: 0.8, rotate: -20, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} className="mx-auto w-24 h-24 bg-[#87d46c] text-white rounded-[2rem] flex items-center justify-center mb-8 shadow-xl shadow-[#87d46c]/40 border-4 border-white">
                <CheckCircle2 size={48} strokeWidth={3} />
              </motion.div>
            ) : (
              <div className="relative mx-auto w-28 h-28 mb-8">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: 'linear' }} className="absolute -inset-2 rounded-full border-2 border-dashed border-primary/30"></motion.div>
                <div className={`w-full h-full rounded-[2.5rem] flex items-center justify-center shadow-inner border transition-all ${displayStatus ? 'bg-primary text-white border-primary/20 shadow-primary/30' : 'bg-surface-container-high text-on-surface-variant'}`}>
                  <Package size={44} className={displayStatus ? 'animate-bounce' : ''} />
                </div>
              </div>
            )}

            <h3 className="font-headline font-bold text-3xl mb-3 tracking-tight">
               {!displayStatus ? '等待指令發佈' :
                   (phase === 'delivered' ? '已順利抵達' : '機器人正在移動中')}
            </h3>

            <span className="inline-block text-[11px] font-extrabold text-primary bg-primary/10 px-4 py-1.5 rounded-xl uppercase tracking-[0.2em] font-mono border border-primary/10">
              {displayStatus || '系統待命'}
            </span>

            <AnimatePresence>
              {displayStatus && phase !== 'delivered' && (
                 <motion.div
                   initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                   className="mt-8 flex items-center justify-between gap-4 bg-surface-container-highest/50 py-5 px-8 rounded-[2rem] shadow-inner border border-outline-variant/20"
                 >
                   <div className="flex items-center gap-3">
                      <Clock size={20} className="text-primary" />
                      <span className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-widest font-mono">ESTIMATED_ETA</span>
                   </div>
                   <span className="font-mono font-bold text-3xl text-primary tracking-tighter">{eta} <span className="text-sm font-sans tracking-tight opacity-50 uppercase font-bold">min</span></span>
                 </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {displayStatus && (
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-[3rem] p-9 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
             <div className="flex items-center justify-between mb-10">
                <h4 className="font-bold text-[10px] text-on-surface-variant/60 uppercase tracking-[0.2em] font-mono">任務日誌</h4>
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(var(--color-primary),0.8)]"></div>
             </div>

             <div className="relative border-l-2 border-outline-variant/30 ml-3.5 space-y-12">
                {/* Step 1 */}
                <div className="relative pl-9 group">
                   <div className="absolute -left-[14px] top-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-[0_0_0_8px_var(--color-surface-container-lowest)]">
                     <div className="w-2.5 h-2.5 bg-white rounded-full"></div>
                   </div>
                   <div>
                     <h5 className="font-bold text-xl leading-none text-on-surface group-hover:text-primary transition-colors mb-2">離開配送中心</h5>
                     <p className="text-[10px] text-on-surface-variant/60 font-bold font-mono uppercase tracking-[0.2em]">記錄時間：11:42:05</p>
                   </div>
                </div>

                {/* Step 2 */}
                <div className={`relative pl-9 transition-all duration-500 group ${phase === 'arriving' || phase === 'delivered' ? 'opacity-100' : 'opacity-30 scale-95 origin-left'}`}>
                   <div className={`absolute -left-[14px] top-1 w-6 h-6 rounded-full flex items-center justify-center shadow-[0_0_0_8px_var(--color-surface-container-lowest)] transition-all ${phase === 'arriving' || phase === 'delivered' ? 'bg-primary scale-110' : 'bg-surface-container-highest shadow-none'}`}>
                     {(phase === 'arriving' || phase === 'delivered') && <div className="w-2.5 h-2.5 bg-white rounded-full"></div>}
                   </div>
                   <div>
                     <h5 className="font-bold text-xl leading-none text-on-surface group-hover:text-primary transition-colors mb-2">即將抵達目的地</h5>
                     <p className={`text-[10px] font-mono uppercase tracking-[0.2em] font-bold ${phase === 'arriving' || phase === 'delivered' ? 'text-primary' : 'text-on-surface-variant'}`}>{phase === 'arriving' || phase === 'delivered' ? '剛才' : '等待中'}</p>
                   </div>
                </div>

                {/* Step 3 */}
                <div className={`relative pl-9 transition-all duration-500 group ${phase === 'delivered' ? 'opacity-100' : 'opacity-30 scale-95 origin-left'}`}>
                   <div className={`absolute -left-[14px] top-1 w-6 h-6 rounded-full flex items-center justify-center shadow-[0_0_0_8px_var(--color-surface-container-lowest)] transition-all ${phase === 'delivered' ? 'bg-[#87d46c] scale-125 shadow-xl shadow-[#87d46c]/30' : 'bg-surface-container-highest shadow-none'}`}>
                     {phase === 'delivered' && <CheckCircle2 size={14} className="text-white" strokeWidth={4} />}
                   </div>
                   <div>
                     <h5 className="font-bold text-xl leading-none text-on-surface group-hover:text-primary transition-colors mb-2">任務配送完成</h5>
                     <p className={`text-[10px] font-mono uppercase tracking-[0.2em] font-bold ${phase === 'delivered' ? 'text-[#87d46c]' : 'text-on-surface-variant'}`}>
                       {phase === 'delivered' ? '已完成' : '等待抵達'}
                     </p>
                   </div>
                </div>
             </div>
          </div>
        )}
      </main>

      <AnimatePresence>
        {phase === 'delivered' && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="fixed bottom-0 inset-x-0 p-8 bg-background/90 backdrop-blur-2xl border-t border-outline-variant/30 max-w-md mx-auto z-[60] shadow-[0_-20px_50px_rgba(0,0,0,0.05)]">
            <button onClick={goBack} className="w-full py-5 bg-primary hover:bg-primary/95 text-white font-bold text-lg rounded-[2rem] active:scale-95 transition-all shadow-2xl shadow-primary/40 flex items-center justify-center gap-3">
               <Package size={24} />
               確認收件並結束任務
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
