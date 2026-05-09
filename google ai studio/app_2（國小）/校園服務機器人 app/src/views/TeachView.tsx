import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { BottomSheet } from '../components/ui';
import { Video, MessageCircle, AlertCircle, Trophy, Send, Activity, Focus, ArrowUpRight, Camera } from 'lucide-react';
import { useAppActions, useAppState } from '../state/AppStateProvider';
import type { TeachingSignal } from '../state/appState';
import { generateTeacherReply } from '../services/localAi';
import { openPrintableReport } from '../services/reports';
import { BRIDGE_URL } from '../services/hardwareBridge';

const SCENE_LABELS: Record<string, string> = {
  crowd: '人流偵測',
  safety: '安全警示',
  cleaning: '清潔需求',
  delivery: '配送任務',
  patrol: '一般巡邏',
};

const SUBJECTS = ['數學', '語文', '自然', '社會', '英語', '體育', '藝術'] as const;

const CHAT_SUGGESTIONS = ['好問題！我先簡單說明。', '請大家看黑板這邊的說明。', '好問題，稍後全班統一說明！'] as const;

export function TeachView({ showToast, navigateTo }: { showToast: (m: string) => void, navigateTo: (id: string, props?: any) => void }) {
  const state = useAppState();
  const actions = useAppActions();
  const [modal, setModal] = useState<string | null>(null);
  const [activeStudent, setActiveStudent] = useState<TeachingSignal | null>(null);
  const [chatReply, setChatReply] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentSubject, setCurrentSubject] = useState<string>('');
  const [focusScore, setFocusScore] = useState(87);
  const [waveData, setWaveData] = useState([40, 60, 85, 70, 90, 55, 45, 30]);

  // Camera / vision state for video modal
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const visionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [camReady, setCamReady] = useState(false);
  const [camAnalyzing, setCamAnalyzing] = useState(false);
  const [camScene, setCamScene] = useState<string>('patrol');
  const [camConfidence, setCamConfidence] = useState<number>(0);
  const [camZone, setCamZone] = useState<string>('');
  const [camSummary, setCamSummary] = useState<string>('');
  const [camSource, setCamSource] = useState<'gemini' | 'local'>('local');

  useEffect(() => {
    const interval = setInterval(() => {
      // Fluctuating score
      setFocusScore(prev => Math.min(100, Math.max(0, prev + (Math.random() > 0.5 ? 1 : -1))));
      // Fluctuating wave
      setWaveData(prev => prev.map(v => Math.min(100, Math.max(20, v + (Math.random() * 20 - 10)))));
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const captureAndAnalyze = useCallback(async () => {
    if (camAnalyzing) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;
    canvas.width = 320;
    canvas.height = Math.round(video.videoHeight * (320 / video.videoWidth)) || 240;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
    const imageBase64 = dataUrl.split(',')[1];
    setCamAnalyzing(true);
    try {
      const res = await fetch(`${BRIDGE_URL}/api/ai/vision-classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error('vision-classify failed');
      const data = await res.json() as { scene: string; confidence: number; zone: string; summary: string; source: 'gemini' | 'local' };
      setCamScene(data.scene);
      setCamConfidence(data.confidence);
      setCamZone(data.zone);
      setCamSummary(data.summary);
      setCamSource(data.source);
    } catch {
      // keep previous result
    } finally {
      setCamAnalyzing(false);
    }
  }, [camAnalyzing]);

  useEffect(() => {
    if (modal !== 'video') {
      // cleanup
      if (visionTimerRef.current) { clearInterval(visionTimerRef.current); visionTimerRef.current = null; }
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
      setCamReady(false);
      setCamAnalyzing(false);
      return;
    }
    let cancelled = false;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      .then(stream => {
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setCamReady(true);
        visionTimerRef.current = setInterval(captureAndAnalyze, 5000);
        captureAndAnalyze();
      })
      .catch(() => {
        if (!cancelled) setCamReady(false);
      });
    return () => {
      cancelled = true;
      if (visionTimerRef.current) { clearInterval(visionTimerRef.current); visionTimerRef.current = null; }
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
      setCamReady(false);
    };
  }, [modal, captureAndAnalyze]);

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
    try {
      await openPrintableReport({ state, kind: 'class', title: '101 教室歷史課報告' });
      showToast('已開啟可列印報表');
      setModal(null);
    } catch {
      showToast('報表匯出失敗，請稍後再試');
    }
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
    <div className="space-y-5 pb-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-headline font-bold">101 教室 <span className="text-on-surface-variant text-base">/ 歷史課</span></h2>
        <div className="bg-primary/10 px-3 py-1.5 rounded-full flex items-center gap-2 border border-primary/20 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(var(--color-primary),0.5)]"></span>
          <span className="text-[10px] font-bold text-primary tracking-widest uppercase">即時分析</span>
        </div>
      </div>

      {/* Attendance + Focus — side by side on tablet */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Attendance & Roll Call */}
      <section data-tour="attendance-card" className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/30 shadow-md flex items-center justify-between gap-4 relative overflow-hidden group">
         <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform duration-700"></div>
        <div className="flex-1 min-w-0 relative z-10">
           <p className="text-[10px] font-bold text-on-surface-variant tracking-[0.2em] mb-1.5">出缺席場域評估</p>
           {state.attendance.scanned ? (
             <div className="flex flex-col items-start gap-1">
               <div className="flex items-baseline gap-2">
                 <p className="font-headline font-bold text-2xl tracking-tighter text-on-surface leading-none">{state.attendance.present}</p>
                 <span className="text-xs font-bold tracking-widest text-on-surface-variant">/ {state.attendance.total} 人出席</span>
               </div>
               <span className="text-[10px] font-bold bg-error text-white px-2.5 py-1 rounded-full whitespace-nowrap mt-1 shadow-[0_0_10px_rgba(var(--color-error),0.3)] tracking-widest">{state.attendance.absent} 人請假/缺席</span>
             </div>
           ) : (
             <div className="mt-1">
                <p className="font-headline font-bold text-base text-on-surface-variant">掃描待命狀態</p>
                <div className="mt-1 text-[10px] text-primary/70 animate-pulse flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-primary inline-block"></span> 場域掃描待命</div>
             </div>
           )}
        </div>
        <button
          onClick={handleRollCall}
          className="relative z-10 shrink-0 bg-primary hover:bg-primary/95 text-white active:scale-95 transition-all w-16 h-16 rounded-2xl shadow-[0_0_20px_rgba(var(--color-primary),0.3)] border-2 border-primary/20 flex flex-col items-center justify-center gap-1"
        >
          <Camera size={20} className="drop-shadow-md" />
          <span className="text-[10px] font-bold tracking-widest text-center drop-shadow-md">環場確認</span>
        </button>
      </section>

      <div role="button" tabIndex={0} aria-label="開啟班級專注度分析報表" onKeyDown={(e) => e.key === 'Enter' && setModal('chart')} className="bg-surface-container-lowest rounded-2xl p-5 relative overflow-hidden shadow-md border border-outline-variant/30 cursor-pointer hover:bg-surface-container transition-all group active:scale-[0.98]" onClick={() => setModal('chart')}>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-on-surface-variant font-mono">班級專注度評分</p>
              <div className="flex items-baseline gap-1.5 mt-1">
                <motion.h2
                  key={focusScore}
                  initial={{ opacity: 0.5, y: -5 }} animate={{ opacity: 1, y: 0 }}
                  className="font-headline font-bold text-4xl text-primary tracking-tighter"
                >
                  {focusScore}
                </motion.h2>
                <span className="text-xl text-on-surface-variant font-headline font-bold">%</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-secondary-container text-primary flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:rotate-12 transition-all shadow-inner">
              <Activity size={20} />
            </div>
          </div>
          <div className="h-14 flex items-end gap-1.5 px-1 relative z-10">
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
      </div>{/* end attendance+focus grid */}

      {/* AI Signals */}
      <section data-tour="alert-list" className="space-y-3">
        <div className="flex items-center justify-between">
            <h3 className="font-headline font-bold text-base tracking-wide flex items-center gap-2">即時告警與訊號 <span className="text-[10px] bg-error/10 text-error px-2 py-0.5 rounded-full font-bold ml-1">{state.teachingSignals.length}</span></h3>
            {state.teachingSignals.length > 3 && (
              <span className="text-primary/60 text-xs font-medium">共 {state.teachingSignals.length} 則</span>
            )}
        </div>
        {state.teachingSignals.length === 0 ? (
           <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 text-center text-on-surface-variant font-medium text-sm shadow-sm">
             目前無異常或提問訊號
           </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {state.teachingSignals.map((sig) => (
              <motion.div
                key={sig.id}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => openStudent(sig)}
                className={`bg-surface-container-lowest border ${sig.type === 'alert' ? 'border-l-4 border-l-tertiary border-y-outline-variant/20 border-r-outline-variant/20 shadow-[0_2px_10px_rgba(var(--color-tertiary),0.08)]' : 'border-outline-variant/20 shadow-sm'} rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:bg-surface-container transition-colors`}
              >
                <div className={`w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shrink-0 shadow-inner ${sig.type === 'alert' ? 'bg-tertiary text-white' : 'bg-primary/10 text-primary'}`}>
                  {sig.type === 'alert' ? <AlertCircle size={20} /> : <MessageCircle size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5 gap-2">
                    <h4 className="font-bold text-sm tracking-wide truncate">{sig.name}</h4>
                    <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg border uppercase tracking-widest ${sig.type === 'alert' ? 'text-tertiary bg-tertiary/10 border-tertiary/20' : 'text-primary bg-primary/10 border-primary/20'}`}>
                      {sig.type === 'alert' ? '分心中' : '提問中'}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-on-surface-variant/90 leading-relaxed truncate">{sig.message}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* Video Feed */}
      <section role="button" tabIndex={0} aria-label="開啟攝影機即時影像" onKeyDown={(e) => e.key === 'Enter' && setModal('video')} onClick={() => setModal('video')} className="bg-inverse-surface rounded-2xl h-52 relative overflow-hidden shadow-2xl cursor-pointer group mt-4">
        <div className="w-full h-full group-hover:scale-105 transition-transform duration-1000" style={{background: 'linear-gradient(135deg, #0d2137 0%, #1e3a5f 50%, #0a1a2e 100%)'}} />
        <div className="absolute inset-0 bg-linear-to-t from-black via-black/20 to-transparent"></div>
        {/* Simulating Bounding Boxes */}
        <div className="absolute top-[20%] left-[30%] w-14 h-14 border-2 border-primary/50 rounded-xl pointer-events-none group-hover:border-primary transition-colors shadow-[0_0_12px_rgba(var(--color-primary),0.3)]">
          <div className="absolute -top-5 left-0 bg-primary/90 backdrop-blur-md text-white text-[9px] px-2 py-0.5 rounded-md font-bold tracking-widest shadow-sm">區域 A 專注</div>
        </div>
        <div className="absolute top-[35%] right-[25%] w-16 h-16 border-2 border-tertiary/50 rounded-xl pointer-events-none group-hover:border-tertiary transition-colors animate-pulse shadow-[0_0_12px_rgba(var(--color-tertiary),0.3)]">
          <div className="absolute -top-5 left-0 bg-tertiary/90 backdrop-blur-md text-white text-[9px] px-2 py-0.5 rounded-md font-bold tracking-widest shadow-sm">區域 B 需確認</div>
        </div>

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
          <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center border-2 border-white/20 text-white shadow-[0_0_24px_rgba(255,255,255,0.2)]"><Video size={28} className="opacity-90 ml-1" /></div>
        </div>
        <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
           <div className="bg-black/60 backdrop-blur-xl px-4 py-3 rounded-2xl border border-white/10 shadow-lg">
             <p className="text-[9px] text-white/50 font-bold uppercase tracking-[0.3em] mb-1 font-mono">氛圍即時估測</p>
             <p className="text-sm text-white font-bold tracking-wide flex items-center gap-2">
               <span className="w-2 h-2 rounded-full bg-[#87d46c] animate-pulse shadow-[0_0_10px_#87d46c]"></span> 和諧積極
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
                <span className="text-[11px] text-on-surface-variant font-bold block mb-2 tracking-widest font-mono">{new Intl.DateTimeFormat('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(activeStudent.createdAt))}</span>
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
                {CHAT_SUGGESTIONS.map((sug, idx) => (
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
                  className={`px-3 py-2 min-h-11 text-xs rounded-full border transition-colors ${
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
                onChange={(e) => setChatInput(e.target.value.slice(0, 500))}
                onKeyDown={(e) => e.key === 'Enter' && !isTyping && handleSendChat()}
                maxLength={500}
                className="flex-1 rounded-[1.75rem] bg-surface-container border border-outline-variant/50 px-6 py-5 text-[16px] focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium placeholder-on-surface-variant/60"
                placeholder="輸入 AI 輔助回覆..."
                disabled={isTyping}
                aria-label="輸入 AI 輔助回覆"
              />
              <button
                onClick={handleSendChat}
                disabled={!chatInput.trim() || isTyping}
                className={`w-16 h-16 rounded-[1.75rem] flex items-center justify-center shrink-0 transition-colors ${chatInput.trim() && !isTyping ? 'bg-primary text-white shadow-[0_4px_15px_rgba(var(--color-primary),0.3)] active:scale-90 hover:bg-primary/95 cursor-pointer' : 'bg-surface-container border border-outline-variant/30 text-on-surface-variant cursor-not-allowed opacity-50'}`}
                aria-label="送出 AI 回覆"
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
                className="py-5 px-6 bg-tertiary text-white rounded-[1.75rem] font-bold text-[16px] tracking-wide active:scale-95 shadow-[0_4px_15px_rgba(var(--color-tertiary),0.3)] border border-tertiary/20 flex flex-col items-center justify-center transition-all bg-linear-to-br from-tertiary to-tertiary/80"
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
                <motion.div animate={{ y: ['-100%', '100%'] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} className="absolute w-full h-2 bg-primary/60 blur-sm shadow-[0_0_20px_rgba(var(--color-primary),1)]"></motion.div>
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
          <canvas ref={canvasRef} className="hidden" />

          {/* Real camera feed — always in DOM so ref stays stable */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`absolute inset-0 w-full h-full object-cover scale-[1.02] transition-opacity duration-700 ${camReady ? 'opacity-100' : 'opacity-0'}`}
          />

          {/* Placeholder shown while camera starts */}
          {!camReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none" style={{background: 'linear-gradient(160deg, #0d2137 0%, #1e3a5f 60%, #0a1a2e 100%)'}}>
              <Video size={48} className="text-white/40 animate-pulse" />
              <p className="text-white/50 text-sm font-mono">開啟攝影機中…</p>
            </div>
          )}

          <div className="absolute top-0 inset-x-0 h-32 bg-linear-to-b from-black/70 to-transparent z-10 pointer-events-none"></div>

          {/* AI Scanning overlay */}
          {camReady && (
            <div className="absolute inset-0 pointer-events-none z-10">
              <motion.div
                animate={{ y: ['0%', '100%', '0%'] }}
                transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                className="w-full h-0.5 bg-primary/40 shadow-[0_0_8px_rgba(var(--color-primary),0.8)]"
              />
              {/* Dynamic detection box based on Gemini result */}
              {camScene && (
                <motion.div
                  key={camScene + camZone}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute top-[25%] left-[28%] w-[18%] h-[22%] border-2 border-primary/70 rounded-lg"
                >
                  <div className="absolute -top-5 left-0 bg-primary/90 text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap">
                    {camZone || '教室前區'} [{camConfidence}%]
                  </div>
                </motion.div>
              )}
              {camScene === 'crowd' || camScene === 'safety' ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute top-[40%] right-[20%] w-[14%] h-[18%] border-2 border-tertiary/80 rounded-lg animate-pulse"
                >
                  <div className="absolute -top-5 left-0 bg-tertiary/90 text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap">
                    {SCENE_LABELS[camScene] ?? camScene}
                  </div>
                </motion.div>
              ) : null}
            </div>
          )}

          {/* Bottom info bar */}
          <div className="absolute bottom-0 inset-x-0 z-20 bg-linear-to-t from-black/90 via-black/60 to-transparent pt-16 pb-6 px-6">
            <div className="flex justify-between items-end gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-headline font-bold text-xl drop-shadow-md truncate">
                  {camZone || '101 教室 · 即時場域'}
                </h3>
                <p className="text-white/60 text-sm font-medium mt-1 font-mono">
                  {camAnalyzing ? 'Gemini 辨識中…' : camSummary || (camReady ? 'Gemini Vision 監控中' : '攝影機啟動中…')}
                </p>
                {camScene && !camAnalyzing && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] font-bold bg-primary/80 text-white px-2 py-0.5 rounded-full tracking-widest">
                      {SCENE_LABELS[camScene] ?? camScene}
                    </span>
                    <span className="text-[10px] text-white/50 font-mono">
                      {camSource === 'gemini' ? '✦ Gemini 2.5 Flash' : '本地分析'}
                    </span>
                  </div>
                )}
              </div>
              <div className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 shadow-lg ${camReady ? 'bg-error/80 backdrop-blur text-white' : 'bg-black/60 text-white/40'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${camReady ? 'bg-white animate-pulse' : 'bg-white/30'}`}></div>
                {camReady ? '實況錄製' : '待機'}
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
