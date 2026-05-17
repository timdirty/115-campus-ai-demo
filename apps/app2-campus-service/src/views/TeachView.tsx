import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { BottomSheet } from '../components/ui';
import { Video, MessageCircle, AlertCircle, Send, Activity, Focus, ArrowUpRight, Camera } from 'lucide-react';
import { useAppActions, useAppState } from '../state/AppStateProvider';
import type { TeachingSignal } from '../state/appState';
import { generateTeacherReply } from '../services/localAi';
import { openPrintableReport } from '../services/reports';
import {scanClassroom, type ClassroomScanApiResult, type ClassroomSignal} from '../services/hardwareBridge';
import {useCameraSelection} from '../hooks/useCameraSelection';
import {useGeminiVision} from '../hooks/useGeminiVision';
import {useActionAbort} from '../hooks/useActionAbort';
import {CameraPicker} from '../components/CameraPicker';

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
  const [activeAiSignal, setActiveAiSignal] = useState<ClassroomSignal | null>(null);
  const [chatReply, setChatReply] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentSubject, setCurrentSubject] = useState<string>('');
  const [scanResult, setScanResult] = useState<ClassroomScanApiResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [attendanceScanning, setAttendanceScanning] = useState(false);
  const [aiSignals, setAiSignals] = useState<ClassroomSignal[]>([]);
  const autoScanDoneRef = useRef(false);
  const chatAbort = useActionAbort();
  const scanAbort = useActionAbort();

  const attendanceCam = useCameraSelection(modal === 'attendance_scan');
  const attendanceVideoRef = attendanceCam.videoRef;
  const attendanceCamReady = attendanceCam.ready;
  const attendanceCamError = attendanceCam.error;

  const videoModalCam = useCameraSelection(modal === 'video');
  const videoRef = videoModalCam.videoRef;
  const canvasRef = videoModalCam.canvasRef;
  const camReady = videoModalCam.ready;
  const camError = videoModalCam.error;
  const {result: camResult, analyzing: camAnalyzing, source: camSource} = useGeminiVision(
    modal === 'video' && camReady,
    videoRef,
    canvasRef,
    5000,
  );
  const camScene = camResult?.scene ?? 'patrol';
  const camConfidence = camResult?.confidence ?? 0;
  const camZone = camResult?.zone ?? '';
  const camSummary = camResult?.summary ?? '';
  const firstSignal = state.teachingSignals[0] ?? null;

  // Reset scanning state when modal closes
  useEffect(() => {
    if (modal !== 'attendance_scan') {
      setAttendanceScanning(false);
    }
  }, [modal]);

  // Auto-scan once camera is ready
  useEffect(() => {
    if (attendanceCamReady && modal === 'attendance_scan' && !autoScanDoneRef.current) {
      autoScanDoneRef.current = true;
      void handleAttendanceScan();
    }
  }, [attendanceCamReady]); // eslint-disable-line react-hooks/exhaustive-deps


  const openStudent = (signal: TeachingSignal, aiSig?: ClassroomSignal) => {
    setActiveAiSignal(aiSig ?? null);
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
    const {signal, token} = chatAbort.begin();
    try {
      const reply = await generateTeacherReply(question, currentSubject || undefined, signal);
      if (signal.aborted) return;
      setIsTyping(false);
      setChatReply(reply);
      actions.addTeacherReply({ signalId: activeStudent.id, reply });
      showToast('本地 AI 已產生並發送回覆');
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setIsTyping(false);
      // show user-visible error in the chat
      setChatReply('AI 暫時無法回應，請稍後再試。');
    } finally {
      chatAbort.end(token);
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
    setScanResult(null);
    setScanError(null);
    autoScanDoneRef.current = false;
    setModal('attendance_scan');
  };

  const handleAttendanceScan = async () => {
    if (attendanceScanning) return;
    const video = attendanceVideoRef.current;
    if (!video) return;
    setAttendanceScanning(true);
    setScanResult(null);
    setScanError(null);
    const {signal, token} = scanAbort.begin();
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', 0.65).replace(/^data:image\/jpeg;base64,/, '');
        const snapshotDataUrl = canvas.toDataURL('image/jpeg', 0.5);
        const capturedAt = new Date().toISOString();
        const result = await scanClassroom(base64, signal);
        if (signal.aborted) return;
        if (result.ok) {
          setScanResult(result);
          setAiSignals(
            (result.signals ?? []).map(s => ({
              ...s,
              snapshot: snapshotDataUrl,
              capturedAt,
            }))
          );
        } else {
          setScanError(result.error ?? 'AI 辨識失敗，請重試或手動完成');
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setScanError('無法連接 AI 服務，請手動完成點名');
    } finally {
      scanAbort.end(token);
      setAttendanceScanning(false);
    }
  };


  const handleAttendanceComplete = () => {
    actions.scanAttendance();
    setModal(null);
    showToast('AI 場域點名已完成：2 個座位待確認');
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
           {scanResult?.ok ? (
             <div className="flex flex-col items-start gap-1">
               <div className="flex items-baseline gap-2">
                 <p className="font-headline font-bold text-2xl tracking-tighter text-on-surface leading-none">{scanResult.count}</p>
                 <span className="text-xs font-bold tracking-widest text-on-surface-variant">/ {state.attendance.total} 人出席</span>
               </div>
               <span className="text-[10px] font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full whitespace-nowrap mt-1 tracking-widest">AI 出席率 {scanResult.rate}%{scanResult.confidence !== undefined && scanResult.confidence < 60 ? '（估算）' : ''}</span>
               {scanResult.summary && <p className="text-[10px] text-on-surface-variant/80 mt-1 leading-snug">{scanResult.summary}</p>}
             </div>
           ) : (
             <div className="mt-1">
               <p className="font-headline font-bold text-2xl tracking-tighter text-on-surface-variant leading-none">—</p>
               <div className="mt-1.5 text-[10px] text-on-surface-variant/60 flex items-center gap-1">尚未掃描，請按右側按鈕</div>
             </div>
           )}
        </div>
        <button
          onClick={handleRollCall}
          className="relative z-10 shrink-0 bg-primary hover:bg-primary/95 text-white active:scale-95 transition-all w-16 h-16 rounded-2xl shadow-[0_0_20px_rgba(var(--color-primary),0.3)] border-2 border-primary/20 flex flex-col items-center justify-center gap-1"
        >
          <Camera size={20} className="drop-shadow-md" />
          <span className="text-[9px] font-bold tracking-wide text-center drop-shadow-md leading-tight">AI<br/>掃描</span>
        </button>
      </section>

      <div role="button" tabIndex={0} aria-label="開啟班級互動概況" onKeyDown={(e) => e.key === 'Enter' && setModal('chart')} className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/30 shadow-md cursor-pointer hover:bg-surface-container transition-colors active:scale-[0.98] flex items-center gap-4" onClick={() => setModal('chart')}>
          <div className="w-12 h-12 rounded-xl bg-secondary-container text-primary flex items-center justify-center shrink-0">
            <Activity size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant font-mono">班級互動概況</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-headline font-bold text-2xl text-on-surface">{aiSignals.length}</span>
              <span className="text-xs font-bold text-on-surface-variant">則訊號待處理</span>
            </div>
            <p className="text-[10px] text-on-surface-variant/70 mt-0.5">點此匯出完整報表</p>
          </div>
        </div>
      </div>{/* end attendance+focus grid */}

      {/* AI Signals */}
      <section data-tour="alert-list" className="space-y-3">
        <div className="flex items-center justify-between">
            <h3 className="font-headline font-bold text-base tracking-wide flex items-center gap-2">
              學習訊號偵測
              {aiSignals.length > 0 && <span className="text-[10px] bg-error/10 text-error px-2 py-0.5 rounded-full font-bold ml-1">{aiSignals.length}</span>}
            </h3>
            {aiSignals.length > 3 && (
              <span className="text-primary/60 text-xs font-medium">共 {aiSignals.length} 則</span>
            )}
        </div>
        {aiSignals.length === 0 ? (
           <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 text-center shadow-sm space-y-1.5">
             <p className="text-on-surface-variant font-medium text-sm">尚未進行 AI 掃描</p>
             <p className="text-on-surface-variant/60 text-xs">舉起圖卡對準攝影機，按「AI 掃描」即可自動偵測學習狀態</p>
           </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {aiSignals.map((sig, idx) => {
              const isAlert = sig.type === 'distracted';
              const syntheticSig: TeachingSignal = {
                id: `ai-${idx}`,
                type: isAlert ? 'alert' : 'question',
                name: isAlert ? '⚠️ 分心警示' : '❓ 學生提問',
                studentId: String(idx),
                message: sig.description,
                createdAt: new Date().toISOString(),
              };
              return (
              <motion.div
                key={syntheticSig.id}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => openStudent(syntheticSig, sig)}
                className={`bg-surface-container-lowest border ${isAlert ? 'border-l-4 border-l-tertiary border-y-outline-variant/20 border-r-outline-variant/20 shadow-[0_2px_10px_rgba(var(--color-tertiary),0.08)]' : 'border-outline-variant/20 shadow-sm'} rounded-2xl p-4 flex items-center gap-4 cursor-pointer hover:bg-surface-container transition-colors`}
              >
                <div className={`w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shrink-0 shadow-inner ${isAlert ? 'bg-tertiary text-white' : 'bg-primary/10 text-primary'}`}>
                  {isAlert ? <AlertCircle size={20} /> : <MessageCircle size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5 gap-2">
                    <h4 className="font-bold text-sm tracking-wide truncate">{syntheticSig.name}</h4>
                    <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg border uppercase tracking-widest ${isAlert ? 'text-tertiary bg-tertiary/10 border-tertiary/20' : 'text-primary bg-primary/10 border-primary/20'}`}>
                      {isAlert ? '分心中' : '提問中'}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-on-surface-variant/90 leading-relaxed truncate">{sig.description}</p>
                  {sig.capturedAt && (
                    <p className="text-[10px] text-on-surface-variant/50 mt-1 font-mono">
                      {new Intl.DateTimeFormat('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(sig.capturedAt))} 掃描 · 點開查看截圖
                    </p>
                  )}
                </div>
              </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* 開啟即時影像 — 點此進入真實 Gemini Vision 鏡頭，不再顯示假掃描動畫 */}
      <section
        role="button"
        tabIndex={0}
        aria-label="開啟攝影機即時影像"
        onKeyDown={(e) => e.key === 'Enter' && setModal('video')}
        onClick={() => setModal('video')}
        className="mt-4 rounded-2xl border border-primary/15 bg-white shadow-sm cursor-pointer transition-colors hover:border-primary/35 active:scale-[0.99]"
      >
        <div className="flex items-stretch">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center bg-primary/8 border-r border-primary/15">
            <Video className="h-9 w-9 text-primary" strokeWidth={1.5} />
          </div>
          <div className="flex-1 p-4 min-w-0">
            <p className="text-[10px] font-black tracking-[0.2em] uppercase text-primary">教室即時影像</p>
            <h3 className="text-base font-black text-on-surface leading-tight mt-0.5">點此開啟鏡頭辨識</h3>
            <p className="mt-0.5 text-xs font-medium text-on-surface-variant/70">Gemini 2.5 Flash 即時觀察教室情境</p>
          </div>
          <div className="flex items-center pr-4">
            <span className="rounded-full bg-primary text-white text-[10px] font-black tracking-widest px-3 py-1.5 shadow-sm">開啟 →</span>
          </div>
        </div>
      </section>

      {/* Interact Modals */}
      <BottomSheet isOpen={modal === 'student'} onClose={() => setModal(null)} title={`${activeStudent?.name} 即時互動`}>
        {activeStudent?.type === 'question' && (
          <div className="p-4 flex flex-col h-[65vh] min-h-[450px]">
            {/* Scan snapshot banner */}
            {activeAiSignal?.snapshot && (
              <div className="relative overflow-hidden rounded-2xl mb-3 flex-shrink-0" style={{height: 120}}>
                <img
                  src={activeAiSignal.snapshot}
                  alt="掃描當下畫面"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                <span className="absolute top-2 right-2 bg-black/55 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
                  {activeAiSignal.capturedAt
                    ? new Intl.DateTimeFormat('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(activeAiSignal.capturedAt))
                    : ''} 掃描
                </span>
                <span className="absolute bottom-2 left-2 bg-[#2563eb]/80 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
                  掃描當下畫面
                </span>
              </div>
            )}
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
            {/* Scan snapshot banner */}
            {activeAiSignal?.snapshot && (
              <div className="relative overflow-hidden rounded-2xl" style={{height: 130}}>
                <img
                  src={activeAiSignal.snapshot}
                  alt="掃描當下畫面"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                <span className="absolute top-2 right-2 bg-black/55 text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
                  {activeAiSignal.capturedAt
                    ? new Intl.DateTimeFormat('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(activeAiSignal.capturedAt))
                    : ''} 掃描
                </span>
                <span className="absolute bottom-2 left-2 bg-black/55 text-white text-[10px] font-medium px-2.5 py-1 rounded-full">
                  掃描當下畫面
                </span>
              </div>
            )}
            {!activeAiSignal?.snapshot && (
              <div className="flex items-center justify-center rounded-2xl bg-surface-container-high border border-outline-variant/30" style={{height: 80}}>
                <span className="text-on-surface-variant/50 text-xs">📷 截圖未保存（舊版掃描）</span>
              </div>
            )}
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
      <BottomSheet isOpen={modal === 'attendance_scan'} onClose={() => setModal(null)} title="AI 場域點名" fullScreen>
        <div className="flex flex-col h-full p-4 gap-4">
          {/* Live camera feed */}
          <div className="relative flex-1 min-h-0 rounded-2xl overflow-hidden bg-black">
            <video
              ref={attendanceVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover transition-opacity duration-500 ${attendanceCamReady ? 'opacity-100' : 'opacity-0'}`}
            />
            {!attendanceCamReady && !attendanceCamError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                style={{background: 'linear-gradient(160deg, #0d2137 0%, #1e3a5f 60%, #0a1a2e 100%)'}}>
                <div className="w-10 h-10 rounded-full border-2 border-primary/40 border-t-primary animate-spin" />
                <p className="text-white/60 text-sm font-mono">攝影機啟動中…</p>
                <p className="text-white/40 text-[10px] font-mono">第一次使用請允許瀏覽器使用相機</p>
              </div>
            )}
            {attendanceCamError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center"
                style={{background: 'linear-gradient(160deg, #3a1414 0%, #1a0a0a 100%)'}}>
                <Camera className="h-8 w-8 text-red-300" />
                <p className="text-red-100 text-sm font-bold leading-relaxed max-w-sm">{attendanceCamError}</p>
              </div>
            )}
            {attendanceCamReady && attendanceScanning && (
              <div className="absolute inset-0 pointer-events-none">
                <motion.div
                  animate={{y: ['0%', '100%', '0%']}}
                  transition={{duration: 1.5, repeat: Infinity, ease: 'linear'}}
                  className="w-full h-0.5 bg-primary/60 shadow-[0_0_8px_rgba(var(--color-primary),0.8)]"
                />
                <div className="absolute inset-0 border-2 border-primary/30 animate-pulse" />
              </div>
            )}
            {/* Inline camera picker (top-right) — only when we have multiple devices */}
            {attendanceCam.devices.length > 1 && (
              <div className="absolute top-3 right-3">
                <CameraPicker
                  devices={attendanceCam.devices}
                  selectedDeviceId={attendanceCam.selectedDeviceId}
                  onSelect={(id) => {
                    autoScanDoneRef.current = false;
                    setScanResult(null);
                    setScanError(null);
                    attendanceCam.selectDevice(id);
                  }}
                  variant="inline"
                />
              </div>
            )}
            <div className="absolute bottom-3 left-0 right-0 flex justify-center pointer-events-none">
              <span className="bg-black/60 backdrop-blur-sm text-white/70 text-[10px] font-bold px-3 py-1 rounded-full tracking-widest">
                不辨識身分，只統計場域
              </span>
            </div>
          </div>

          {/* Stacked picker when there's an error (helps user switch / retry) */}
          {attendanceCamError && (
            <CameraPicker
              devices={attendanceCam.devices}
              selectedDeviceId={attendanceCam.selectedDeviceId}
              onSelect={(id) => {
                autoScanDoneRef.current = false;
                setScanResult(null);
                setScanError(null);
                attendanceCam.selectDevice(id);
              }}
              onRefresh={() => { void attendanceCam.refresh(); }}
              variant="stacked"
              hint="若清單為空，請先到瀏覽器網址列旁的攝影機圖示允許權限，然後按「重新偵測」。"
            />
          )}

          {/* Action area */}
          {!scanResult?.ok ? (
            <div className="shrink-0 w-full space-y-3 pb-4">
              {scanError && (
                <div className="rounded-xl border border-error/30 bg-error/8 px-4 py-2.5 text-sm font-bold text-error">
                  {scanError}
                </div>
              )}
              <button
                onClick={() => void handleAttendanceScan()}
                disabled={attendanceScanning || (!attendanceCamReady && !scanError)}
                className="w-full py-4 rounded-2xl font-bold text-base tracking-widest transition-all active:scale-[0.98] disabled:opacity-40 bg-primary text-white shadow-[0_4px_20px_rgba(var(--color-primary),0.35)]"
              >
                {attendanceScanning ? 'AI 辨識中…' : scanError ? '重新辨識' : !attendanceCamReady ? '等待攝影機…' : 'AI 辨識中…'}
              </button>
              <button
                onClick={handleAttendanceComplete}
                disabled={attendanceScanning}
                className="w-full py-3 rounded-2xl font-bold text-sm text-on-surface-variant border border-outline-variant/30 active:scale-[0.98] transition-all disabled:opacity-40"
              >
                略過鏡頭，手動完成點名
              </button>
            </div>
          ) : (
            <div className="shrink-0 w-full space-y-4 pb-4">
              <div className="rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4">
                <p className="text-lg font-bold text-primary">
                  約 {scanResult.count} 人・出席率 {scanResult.rate}%
                  {scanResult.confidence !== undefined && scanResult.confidence < 60 && (
                    <span className="text-on-surface-variant font-normal text-sm ml-1">（估算）</span>
                  )}
                </p>
                {scanResult.summary && (
                  <p className="text-sm text-on-surface-variant mt-1">{scanResult.summary}</p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setScanResult(null)}
                  className="flex-1 py-4 rounded-2xl font-bold text-sm border border-outline-variant/30 text-on-surface-variant active:scale-[0.98] transition-all"
                >
                  重新辨識
                </button>
                <button
                  onClick={handleAttendanceComplete}
                  className="flex-1 py-4 rounded-2xl font-bold text-sm bg-primary text-white shadow-[0_4px_15px_rgba(var(--color-primary),0.3)] active:scale-[0.98] transition-all"
                >
                  完成點名
                </button>
              </div>
            </div>
          )}
        </div>
      </BottomSheet>

      {/* Fullscreen Video Modal */}
      <BottomSheet isOpen={modal === 'video'} onClose={() => setModal(null)} fullScreen={true}>
        <div className="w-full h-full bg-black relative flex flex-col justify-center overflow-hidden">
          {/* Real camera feed — always in DOM so ref stays stable */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${camReady ? 'opacity-100' : 'opacity-0'}`}
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Placeholder shown while camera starts */}
          {!camReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none"
              style={{background: 'linear-gradient(160deg, #0d2137 0%, #1e3a5f 60%, #0a1a2e 100%)'}}>
              {camError ? (
                <>
                  <p className="text-red-300 text-sm font-mono text-center px-6">{camError}</p>
                </>
              ) : (
                <>
                  <p className="text-white/50 text-sm font-mono animate-pulse">開啟攝影機中…</p>
                </>
              )}
            </div>
          )}

          <div className="absolute top-0 inset-x-0 h-32 bg-linear-to-b from-black/70 to-transparent z-10 pointer-events-none"></div>

          {/* Camera picker (top-left, away from BottomSheet close button) */}
          {videoModalCam.devices.length > 1 && (
            <div className="absolute top-4 left-4 z-30">
              <CameraPicker
                devices={videoModalCam.devices}
                selectedDeviceId={videoModalCam.selectedDeviceId}
                onSelect={videoModalCam.selectDevice}
                variant="inline"
              />
            </div>
          )}

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
                  {camAnalyzing ? '正在看教室畫面…' : camSummary || (camReady ? '智慧課堂觀察中' : '攝影機啟動中…')}
                </p>
                {camScene && !camAnalyzing && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] font-bold bg-primary/80 text-white px-2 py-0.5 rounded-full tracking-widest">
                      {SCENE_LABELS[camScene] ?? camScene}
                    </span>
                    <span className="text-[10px] text-white/50 font-mono">
                      {camSource === 'gemini' ? '智慧辨識' : '畫面分析'}
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
        <div className="p-5 space-y-4">
          {aiSignals.length === 0 ? (
            <div className="flex flex-col items-center py-10 gap-4">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Focus size={38} className="text-primary opacity-80" />
              </div>
              <p className="text-base font-headline font-bold text-on-surface">尚無掃描記錄</p>
              <p className="text-sm text-on-surface-variant text-center max-w-xs leading-relaxed">
                使用「AI 掃描」後，此處將顯示每次掃描的截圖與偵測結果。
              </p>
            </div>
          ) : (
            <>
              <h3 className="font-bold text-sm text-on-surface-variant uppercase tracking-widest">掃描記錄</h3>
              <div className="space-y-3">
                {aiSignals.map((sig, idx) => {
                  const isAlert = sig.type === 'distracted';
                  const timeLabel = sig.capturedAt
                    ? new Intl.DateTimeFormat('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date(sig.capturedAt))
                    : '—';
                  return (
                    <div key={idx} className="flex items-center gap-3">
                      {sig.snapshot ? (
                        <img
                          src={sig.snapshot}
                          alt="掃描截圖"
                          className="w-14 h-11 object-cover rounded-xl flex-shrink-0 border border-outline-variant/30"
                        />
                      ) : (
                        <div className="w-14 h-11 rounded-xl flex-shrink-0 bg-surface-container flex items-center justify-center border border-outline-variant/30">
                          <span className="text-lg">📷</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-mono text-on-surface-variant/60">{timeLabel}</p>
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5 ${
                          isAlert
                            ? 'bg-error/10 text-error'
                            : 'bg-primary/10 text-primary'
                        }`}>
                          {isAlert ? '⚠ 分心偵測' : '❓ 舉手偵測'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          <p className="text-[10px] text-on-surface-variant/40 text-center pt-2">
            僅供本節課參考，重整頁面後自動清除
          </p>
          <button onClick={downloadReport} className="mt-2 bg-primary hover:bg-primary/95 text-white py-4 px-6 rounded-2xl font-bold text-[15px] tracking-wide active:scale-[0.98] w-full transition-all flex items-center justify-center gap-2">
            匯出完整 PDF 報告
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
