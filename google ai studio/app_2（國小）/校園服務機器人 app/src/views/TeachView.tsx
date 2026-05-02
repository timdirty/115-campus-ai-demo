import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { BottomSheet } from '../components/ui';
import { Video, MessageCircle, AlertCircle, Trophy, Send, Activity, Focus, ArrowUpRight, Camera } from 'lucide-react';
import { useAppActions, useAppState } from '../state/AppStateProvider';
import type { TeachingSignal } from '../state/appState';
import { generateTeacherReply } from '../services/localAi';
import { openPrintableReport } from '../services/reports';

export function TeachView({ showToast, navigateTo }: { showToast: (m: string) => void, navigateTo: (id: string, props?: any) => void }) {
  const state = useAppState();
  const actions = useAppActions();
  const [modal, setModal] = useState<string | null>(null);
  const [activeStudent, setActiveStudent] = useState<TeachingSignal | null>(null);
  const [chatReply, setChatReply] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentSubject, setCurrentSubject] = useState<string>('');
  const SUBJECTS = ['數學', '語文', '自然', '社會', '英語', '體育', '藝術'];
  const [focusScore, setFocusScore] = useState(87);
  const [waveData, setWaveData] = useState([40, 60, 85, 70, 90, 55, 45, 30]);

  useEffect(() => {
    const interval = setInterval(() => {
      // Fluctuating score
      setFocusScore(prev => Math.min(100, Math.max(0, prev + (Math.random() > 0.5 ? 1 : -1))));
      // Fluctuating wave
      setWaveData(prev => prev.map(v => Math.min(100, Math.max(20, v + (Math.random() * 20 - 10)))));
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const openStudent = (signal: TeachingSignal) => {
    setChatReply(null);
    setChatInput('');
    setIsTyping(false);
    setActiveStudent(signal);
    setModal('student');
  };

  const handleSendChat = async () => {
    if (!activeStudent || !chatInput.trim() || isTyping) return;
    const question = chatInput;
    setChatInput('');
    setIsTyping(true);
    try {
      const reply = await generateTeacherReply(question, currentSubject || undefined);
      setIsTyping(false);
      setChatReply(reply);
      actions.addTeacherReply({ signalId: activeStudent.id, reply });
      showToast('本地 AI 已產生並發送回覆');
    } catch (err) {
      setIsTyping(false);
      // show user-visible error in the chat
      setChatReply('AI 暫時無法回應，請稍後再試。');
    }
  };

  const handleAlertAction = (actionMsg: string) => {
    if (!activeStudent) return;
    actions.resolveTeachingSignal({ signalId: activeStudent.id, action: actionMsg });
    showToast(actionMsg);
    setModal(null);
  };

  const downloadReport = async () => {
    await openPrintableReport({ state, kind: 'class', title: '101 教室歷史課報告' });
    showToast('已開啟可列印報表');
    setModal(null);
  };

  const handleRollCall = () => {
    setModal('attendance_scan');
    setTimeout(() => {
      actions.scanAttendance();
      setModal(null);
      showToast('AI 場域點名已完成：2 個座位待確認');
    }, 2500);
  };

  return (
    <div className="space-y-8 pb-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-headline font-bold">101 教室 <span className="text-on-surface-variant text-[1.1rem]">/ 歷史課</span></h2>
        <div className="bg-primary/10 px-3 py-1.5 rounded-full flex items-center gap-2 border border-primary/20 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(var(--color-primary),0.5)]"></span>
          <span className="text-[10px] font-bold text-primary tracking-widest uppercase">即時分析</span>
        </div>
      </div>

      {/* Attendance & Roll Call */}
      <section className="bg-surface-container-lowest rounded-[2.5rem] p-7 border border-outline-variant/30 shadow-md flex items-center justify-between gap-5 relative overflow-hidden group">
         <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform duration-700"></div>
        <div className="flex-1 min-w-0 relative z-10">
           <p className="text-[11px] font-bold text-on-surface-variant tracking-[0.2em] mb-2">出缺席場域評估</p>
           {state.attendance.scanned ? (
             <div className="flex flex-col items-start gap-1.5">
               <div className="flex items-baseline gap-2">
                 <p className="font-headline font-bold text-4xl tracking-tighter text-on-surface leading-none">{state.attendance.present}</p>
                 <span className="text-sm font-bold tracking-widest text-on-surface-variant">/ {state.attendance.total} 人出席</span>
               </div>
               <span className="text-xs font-bold bg-error text-white px-3 py-1.5 rounded-full whitespace-nowrap mt-2 shadow-[0_0_15px_rgba(var(--color-error),0.3)] tracking-widest">{state.attendance.absent} 人請假/缺席</span>
             </div>
           ) : (
             <div className="mt-2">
                <p className="font-headline font-bold text-xl text-on-surface-variant">掃描待命狀態</p>
                <div className="mt-2 text-[10px] text-primary/70 animate-pulse flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-primary inline-block"></span> 場域掃描待命</div>
             </div>
           )}
        </div>
        <button
          onClick={handleRollCall}
          className="relative z-10 shrink-0 bg-primary hover:bg-primary/95 text-white active:scale-95 transition-all w-24 h-24 rounded-[2rem] shadow-[0_0_30px_rgba(var(--color-primary),0.4)] border-2 border-primary/20 flex flex-col items-center justify-center gap-2 group-hover:shadow-[0_0_40px_rgba(var(--color-primary),0.6)]"
        >
          <Camera size={28} className="drop-shadow-md" />
          <span className="text-[11px] font-bold tracking-widest text-center shadow-black drop-shadow-md">環場<br/>確認</span>
        </button>
      </section>

      <div className="bg-surface-container-lowest rounded-[2.5rem] p-8 relative overflow-hidden shadow-md border border-outline-variant/30 cursor-pointer hover:bg-surface-container transition-all group active:scale-[0.98]" onClick={() => setModal('chart')}>
          <div className="flex justify-between items-start mb-8 relative z-10">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-on-surface-variant font-mono">班級專注度評分</p>
              <div className="flex items-baseline gap-1.5 mt-2">
                <motion.h2
                  key={focusScore}
                  initial={{ opacity: 0.5, y: -5 }} animate={{ opacity: 1, y: 0 }}
                  className="font-headline font-bold text-6xl text-primary tracking-tighter"
                >
                  {focusScore}
                </motion.h2>
                <span className="text-3xl text-on-surface-variant font-headline font-bold">%</span>
              </div>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-secondary-container text-primary flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:rotate-12 transition-all shadow-inner">
              <Activity size={28} />
            </div>
          </div>
          <div className="h-20 flex items-end gap-2 px-1 relative z-10">
            {waveData.map((h, i) => (
              <motion.div
                key={i}
                animate={{ height: `${h}%` }}
                transition={{ type: "spring", bounce: 0.2, duration: 0.8 }}
                className={`flex-1 rounded-t-md mx-[1px] ${i === waveData.length - 1 ? 'bg-primary shadow-[0_0_15px_rgba(var(--color-primary),0.6)]' : 'bg-primary/50'}`}
                style={{ opacity: 0.4 + (h/100)*0.6 }}
              />
            ))}
          </div>
          {/* Decorative Graph Grid */}
          <div className="absolute inset-0 top-auto h-28 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(to top, var(--color-primary) 1.5px, transparent 1.5px)', backgroundSize: '100% 24px' }}></div>
        </div>

      {/* AI Signals */}
      <section className="space-y-5">
        <div className="flex items-center justify-between">
            <h3 className="font-headline font-bold text-2xl tracking-wide flex items-center gap-2">即時告警與訊號 <span className="text-xs bg-error/10 text-error px-2 py-0.5 rounded-full font-bold ml-1">{state.teachingSignals.length}</span></h3>
            <button className="text-primary text-sm font-bold active:scale-95 transition-all">查看全部</button>
        </div>
        {state.teachingSignals.length === 0 ? (
           <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-[2rem] p-10 text-center text-on-surface-variant font-medium text-[15px] shadow-sm">
             目前無異常或提問訊號
           </div>
        ) : (
          <div className="space-y-4">
            {state.teachingSignals.map((sig) => (
              <motion.div
                key={sig.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => openStudent(sig)}
                className={`bg-surface-container-lowest border ${sig.type === 'alert' ? 'border-l-[8px] border-l-tertiary border-y-outline-variant/20 border-r-outline-variant/20 shadow-[0_4px_15px_rgba(var(--color-tertiary),0.1)]' : 'border-outline-variant/20 shadow-sm'} rounded-[1.75rem] p-6 flex items-center gap-6 cursor-pointer hover:bg-surface-container transition-colors`}
              >
                <div className={`w-16 h-16 rounded-[1.25rem] overflow-hidden flex items-center justify-center shrink-0 shadow-inner ${sig.type === 'alert' ? 'bg-tertiary text-white' : 'bg-primary/10 text-primary'}`}>
                  {sig.type === 'alert' ? <AlertCircle size={32} /> : <MessageCircle size={32} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-2 gap-2">
                    <h4 className="font-bold text-lg tracking-wide truncate">{sig.name}</h4>
                    <span className={`shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-lg border uppercase tracking-widest ${sig.type === 'alert' ? 'text-tertiary bg-tertiary/10 border-tertiary/20' : 'text-primary bg-primary/10 border-primary/20'}`}>
                      {sig.type === 'alert' ? '分心中' : '提問中'}
                    </span>
                  </div>
                  <p className="text-[15px] font-medium text-on-surface-variant/90 leading-relaxed truncate">{sig.message}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Video Feed */}
      <section onClick={() => setModal('video')} className="bg-inverse-surface rounded-[2.5rem] h-[320px] relative overflow-hidden shadow-2xl cursor-pointer group mt-10">
        <div className="w-full h-full group-hover:scale-105 transition-transform duration-1000" style={{background: 'linear-gradient(135deg, #0d2137 0%, #1e3a5f 50%, #0a1a2e 100%)'}} />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"></div>
        {/* Simulating Bounding Boxes */}
        <div className="absolute top-[20%] left-[30%] w-20 h-20 border-[3px] border-primary/50  rounded-xl pointer-events-none group-hover:border-primary transition-colors shadow-[0_0_15px_rgba(var(--color-primary),0.3)]">
          <div className="absolute -top-6 left-0 bg-primary/90 backdrop-blur-md text-white text-[10px] px-2.5 py-0.5 rounded-md font-bold tracking-widest shadow-sm">區域 A 專注</div>
        </div>
        <div className="absolute top-[35%] right-[25%] w-24 h-24 border-[3px] border-tertiary/50 rounded-xl pointer-events-none group-hover:border-tertiary transition-colors animate-pulse shadow-[0_0_15px_rgba(var(--color-tertiary),0.3)]">
          <div className="absolute -top-6 left-0 bg-tertiary/90 backdrop-blur-md text-white text-[10px] px-2.5 py-0.5 rounded-md font-bold tracking-widest shadow-sm">區域 B 需確認</div>
        </div>

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
          <div className="w-24 h-24 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center border-2 border-white/20 text-white shadow-[0_0_30px_rgba(255,255,255,0.2)]"><Video size={40} className="opacity-90 ml-2" /></div>
        </div>
        <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end">
           <div className="bg-black/60 backdrop-blur-xl px-5 py-4 rounded-[1.5rem] border border-white/10 shadow-lg">
             <p className="text-[11px] text-white/50 font-bold uppercase tracking-[0.3em] mb-2 font-mono">氛圍即時估測</p>
             <p className="text-xl text-white font-bold tracking-wide flex items-center gap-3">
               <span className="w-3 h-3 rounded-full bg-[#87d46c] animate-pulse shadow-[0_0_15px_#87d46c]"></span> 和諧積極
             </p>
           </div>
        </div>
      </section>

      {/* Interact Modals */}
      <BottomSheet isOpen={modal === 'student'} onClose={() => setModal(null)} title={`${activeStudent?.name} 即時互動`}>
        {activeStudent?.type === 'question' && (
          <div className="p-4 flex flex-col h-[65vh] min-h-[450px]">
            <div className="flex-1 overflow-y-auto space-y-6 pt-3 custom-scrollbar pr-2 mb-2">
              <div className="bg-surface-container p-6 rounded-[1.75rem] rounded-tl-[4px] text-[16px] w-[90%] text-on-surface shadow-sm leading-relaxed border border-outline-variant/30">
                <span className="text-[11px] text-on-surface-variant font-bold block mb-2 tracking-[0.2em] uppercase font-mono">10:41 AM</span>
                <p className="font-medium">{activeStudent.message}</p>
              </div>
              {isTyping && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-primary/10 text-primary p-6 rounded-[1.75rem] rounded-tr-[4px] text-sm w-fit self-end ml-auto shadow-sm flex gap-2.5 items-center border border-primary/20">
                   <div className="w-3 h-3 rounded-full bg-primary animate-bounce delay-75"></div>
                   <div className="w-3 h-3 rounded-full bg-primary animate-bounce delay-150"></div>
                   <div className="w-3 h-3 rounded-full bg-primary animate-bounce delay-300"></div>
                </motion.div>
              )}
              {chatReply && (
                <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="bg-primary text-white p-6 rounded-[1.75rem] rounded-tr-[4px] text-[16px] w-[90%] self-end ml-auto shadow-[0_4px_15px_rgba(var(--color-primary),0.3)] leading-relaxed border border-primary">
                  <span className="text-[11px] text-white/70 font-bold block mb-2 tracking-[0.2em] uppercase font-mono">剛剛</span>
                  <span className="break-words font-medium">{chatReply}</span>
                </motion.div>
              )}
            </div>

            {/* Nav button to view report */}
            <div className="pt-3 pb-3">
               <button
                 onClick={() => { setModal(null); navigateTo('student-report', { name: activeStudent.name, studentId: activeStudent.studentId }); }}
                 className="mt-2 text-[15px] font-bold text-primary flex items-center justify-center gap-2 w-full bg-primary/10 py-5 rounded-[1.5rem] hover:bg-primary/20 transition-all active:scale-[0.98] border border-primary/20 shadow-sm"
               >
                 開啟此訊號的學習狀態報告 <ArrowUpRight size={18} />
               </button>
            </div>

            {/* AI Suggestions */}
            {!isTyping && !chatReply && (
              <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-5 pt-3 -mx-4 px-4 snap-x">
                {['好問題！我先簡單說明。', '請大家看黑板這邊的說明。', '好問題，稍後全班統一說明！'].map((sug, idx) => (
                  <button
                    key={idx}
                    onClick={() => setChatInput(sug)}
                    className="shrink-0 bg-surface-container-high hover:bg-primary/10 text-primary text-[14px] font-bold px-7 py-4 rounded-[1.5rem] transition-colors truncate max-w-[280px] active:scale-95 border border-outline-variant/20 hover:border-primary/30 shadow-sm snap-center flex items-center gap-2"
                  >
                    <MessageCircle size={16} /> {sug}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-1 mb-2">
              {SUBJECTS.map(s => (
                <button
                  key={s}
                  onClick={() => setCurrentSubject(prev => prev === s ? '' : s)}
                  className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                    currentSubject === s
                      ? 'bg-indigo-500 text-white border-indigo-500'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="flex gap-3 pt-4 border-t border-outline-variant/30 items-center">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                className="flex-1 rounded-[1.75rem] bg-surface-container border border-outline-variant/50 px-6 py-5 text-[16px] focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium placeholder-on-surface-variant/60"
                placeholder="輸入 AI 輔助回覆..."
                disabled={isTyping}
              />
              <button
                onClick={handleSendChat}
                disabled={isTyping}
                className={`w-16 h-16 rounded-[1.75rem] flex items-center justify-center shrink-0 transition-colors ${chatInput.trim() && !isTyping ? 'bg-primary text-white shadow-[0_4px_15px_rgba(var(--color-primary),0.3)] active:scale-90 hover:bg-primary/95' : 'bg-surface-container border border-outline-variant/30 text-on-surface-variant'}`}
              >
                <Send size={24} className={chatInput.trim() && !isTyping ? "translate-x-[-1px] translate-y-[1px]" : ""} />
              </button>
            </div>
          </div>
        )}
        {activeStudent?.type === 'alert' && (
          <div className="p-5 space-y-8 pb-8">
            <div className="bg-error/10 p-6 rounded-[1.75rem] border border-error/20 flex gap-5 shadow-inner">
               <AlertCircle className="text-error shrink-0 mt-1" size={32} />
               <div>
                  <h4 className="font-bold text-error mb-2 font-headline tracking-wide text-lg">注意力提醒</h4>
                  <p className="text-[15px] font-medium text-error/90 leading-relaxed">系統偵測到此學習訊號的互動頻率降低，建議先用低干擾提醒，再由老師確認狀況。</p>
               </div>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <button
                onClick={() => handleAlertAction('已發送硬體震動提醒')}
                className="py-5 px-6 bg-tertiary text-white rounded-[1.75rem] font-bold text-[16px] tracking-wide active:scale-95 shadow-[0_4px_15px_rgba(var(--color-tertiary),0.3)] border border-tertiary/20 flex flex-col items-center justify-center transition-all bg-gradient-to-br from-tertiary to-tertiary/80"
              >
                <span>發送平板震動提醒 (柔性)</span>
                <span className="text-[12px] opacity-80 font-medium mt-1">僅提醒本人，不影響他人</span>
              </button>
              <button
                onClick={() => handleAlertAction('已送出老師確認提醒')}
                className="py-5 px-6 bg-surface-container border border-error/30 hover:bg-error/5 text-error rounded-[1.75rem] font-bold text-[16px] tracking-wide active:scale-[0.98] transition-all"
              >
                送出老師確認提醒
              </button>
              <button
                onClick={() => { setModal(null); navigateTo('student-report', { name: activeStudent.name, studentId: activeStudent.studentId }); }}
                className="py-5 px-6 bg-primary/10 border border-primary/20 text-primary rounded-[1.75rem] font-bold text-[16px] tracking-wide active:scale-95 flex items-center justify-center gap-2 mt-2 transition-all hover:bg-primary/20"
              >
                開啟此訊號的學習狀態報告 <ArrowUpRight size={20} />
              </button>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* Attendance Modal */}
      <BottomSheet isOpen={modal === 'attendance_scan'} onClose={() => setModal(null)} title="AI 場域點名">
        <div className="p-10 flex flex-col items-center justify-center space-y-12 pb-16">
           <div className="relative w-48 h-48 flex items-center justify-center my-4">
             <div className="absolute inset-0 border-[4px] border-primary/20 rounded-full animate-ping [animation-duration:2.5s] shadow-[0_0_30px_rgba(var(--color-primary),0.3)]"></div>
             <div className="absolute inset-4 border-2 border-primary/40 rounded-full animate-spin [animation-duration:4s] border-dashed"></div>
             <div className="w-full h-full bg-surface-container rounded-full flex items-center justify-center overflow-hidden relative shadow-inner">
                <motion.div animate={{ y: ['-100%', '100%'] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} className="absolute w-full h-[8px] bg-primary/60 blur-sm shadow-[0_0_20px_rgba(var(--color-primary),1)]"></motion.div>
                <div className="grid grid-cols-2 gap-3 opacity-50 p-8">
                  {[...Array(4)].map((_, i) => <div key={i} className="w-12 h-12 rounded-full border-[3px] border-primary/40 border-dashed"></div>)}
                </div>
             </div>
           </div>
           <div className="text-center space-y-3">
             <p className="font-headline font-bold text-3xl text-primary animate-pulse tracking-widest drop-shadow-sm">確認座位狀態中...</p>
             <p className="text-[12px] font-bold text-on-surface-variant tracking-[0.4em]">不辨識身分，只統計場域</p>
           </div>
        </div>
      </BottomSheet>

      {/* Fullscreen Video Modal */}
      <BottomSheet isOpen={modal === 'video'} onClose={() => setModal(null)} fullScreen={true}>
        <div className="w-full h-full bg-black relative flex flex-col justify-center overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-black/90 to-transparent z-10 pointer-events-none"></div>

          <div className="w-full h-full min-h-60 scale-[1.02]" style={{background: 'linear-gradient(160deg, #0d2137 0%, #1e3a5f 60%, #0a1a2e 100%)'}} />

          {/* AI Scanning FX */}
          <div className="absolute inset-0 pointer-events-none z-10">
            <motion.div
              animate={{ y: ['0%', '100%', '0%'] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
              className="w-full h-[2px] bg-primary/50 shadow-[0_0_10px_rgba(var(--color-primary),1)]"
            />
            {/* 場域狀態框 */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="absolute top-[25%] left-[30%] w-[15%] h-[20%] border-2 border-primary/70 rounded-lg">
               <div className="absolute -top-5 left-0 bg-primary/90 text-white text-[10px] px-2 py-0.5 rounded">區域 A [專注]</div>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }} className="absolute top-[38%] right-[22%] w-[12%] h-[18%] border-2 border-tertiary/80 rounded-lg">
               <div className="absolute -top-5 left-0 bg-tertiary/90 text-white text-[10px] px-2 py-0.5 rounded">區域 B [需確認]</div>
            </motion.div>
          </div>

          <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-10 pointer-events-none flex items-end p-6">
             <div className="w-full">
               <div className="flex justify-between items-end">
                 <div>
                   <h3 className="text-white font-headline font-bold text-xl drop-shadow-md">101 教室 - 前置全景</h3>
                   <p className="text-white/70 text-sm font-medium mt-1 font-mono">視覺系統運作中 v2.4.1</p>
                 </div>
                 <div className="bg-error/80 backdrop-blur text-white px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 shadow-lg">
                   <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div> 實況錄製
                 </div>
               </div>
             </div>
          </div>
        </div>
      </BottomSheet>

      {/* Simple Chart Modal */}
      <BottomSheet isOpen={modal === 'chart'} onClose={() => setModal(null)} title="即時專注度分析報表">
         <div className="p-6 flex flex-col items-center py-10">
           <div className="w-28 h-28 rounded-full bg-primary/10 flex items-center justify-center mb-8 relative shadow-inner">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 10, repeat: Infinity, ease: 'linear' }} className="absolute inset-0 border-[4px] border-dashed border-primary/40 rounded-full"></motion.div>
              <Focus size={52} className="text-primary opacity-90 drop-shadow-md" />
           </div>
           <p className="text-2xl font-headline font-bold mb-3 tracking-wide text-on-surface">分析數據匯總中...</p>
           <p className="text-[15px] text-on-surface-variant font-medium text-center max-w-[280px] leading-relaxed">系統正在統整本堂歷史課的所有互動訊號與視覺追蹤歷程。</p>
           <button onClick={downloadReport} className="mt-10 bg-primary hover:bg-primary/95 text-white py-5 px-8 rounded-[1.5rem] font-bold text-[17px] tracking-widest active:scale-[0.98] shadow-[0_0_20px_rgba(var(--color-primary),0.4)] w-full transition-all flex items-center justify-center gap-2 border border-primary/20">
             匯出完整 PDF 報告
           </button>
         </div>
      </BottomSheet>
    </div>
  );
}
