import { FileText, FileQuestion, CheckCircle2, FileSymlink, Sparkles, ChevronRight, PartyPopper, ArrowRight, RotateCcw, Download, Share2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { generateQuizFromNote, QuizQuestion, summarizeNote } from '../services/geminiService';
import {downloadTextFile, loadNotes, loadNotesAsync, WhiteboardNote} from '../services/notesStore';

const containerVariants: any = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1, ease: "easeOut" } }, exit: { opacity: 0, y: -10 } };
const itemVariants: any = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

export default function Review({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [outputFormat, setOutputFormat] = useState<'quiz' | 'summary'>('quiz');
  const [lengthVal, setLengthVal] = useState(50);
  const [notes, setNotes] = useState<WhiteboardNote[]>(() => loadNotes());
  const [activeRecord, setActiveRecord] = useState(() => loadNotes()[0]?.id ?? 0);
  const [summaryText, setSummaryText] = useState('');
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [errorText, setErrorText] = useState('');

  // States
  const [viewState, setViewState] = useState<'setup' | 'generating' | 'quiz_play' | 'quiz_result' | 'summary_view'>('setup');

  // Quiz
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [selOpt, setSelOpt] = useState<number | null>(null);
  const [ansd, setAnsd] = useState(false);

  useEffect(() => {
    loadNotesAsync().then((loadedNotes) => {
      setNotes(loadedNotes);
      if (!activeRecord && loadedNotes[0]) {
        setActiveRecord(loadedNotes[0].id);
      }
    });
  }, []);

  // Auto-select first note whenever the notes list changes and nothing is selected yet
  useEffect(() => {
    if (!activeRecord && notes.length > 0) {
      setActiveRecord(notes[0].id);
    }
  }, [notes]);

  const handleGenerate = async () => {
    const selectedNote = notes.find((note) => note.id === activeRecord) ?? notes[0];
    if (!selectedNote) {
      setErrorText('請先到首頁拍下白板，或到課堂紀錄本新增一筆紀錄。');
      return;
    }

    setViewState('generating');
    setErrorText('');
    setCurrentQ(0);
    setScore(0);
    setSelOpt(null);
    setAnsd(false);

    try {
      const sourceContent = selectedNote.content;
      if (outputFormat === 'summary') {
        const result = await summarizeNote(selectedNote.id, sourceContent);
        setSummaryText(result);
        setViewState('summary_view');
      } else {
        const result = await generateQuizFromNote(selectedNote.id, sourceContent);
        if (!result.length) {
          throw new Error('目前紀錄內容不足以產生小測驗，請先補上白板文字或老師講解重點。');
        }
        setQuizQuestions(result);
        setViewState('quiz_play');
      }
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : '生成失敗，請確認本機展示服務已啟動。');
      setViewState('setup');
    }
  };

  const handleAns = () => {
    if (selOpt === null || !quizQuestions[currentQ]) return;
    setAnsd(true);
    if (selOpt === quizQuestions[currentQ].ans) setScore(p => p + 1);
  };

  const handleNextQ = () => {
    if (currentQ < quizQuestions.length - 1) {
      setCurrentQ(p => p + 1); setSelOpt(null); setAnsd(false);
    } else {
      setViewState('quiz_result');
    }
  };

  const reset = () => {
    setViewState('setup'); setCurrentQ(0); setScore(0); setSelOpt(null); setAnsd(false);
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      exit="exit"
      className="absolute inset-0 w-full h-full overflow-y-auto hide-scrollbar"
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 lg:py-8 relative pb-36">

      <AnimatePresence>
        {viewState === 'generating' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-surface/90 backdrop-blur-xl flex flex-col items-center justify-center">
            <motion.div initial={{ scale: 0.8, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-surface-container p-12 rounded-[3.5rem] flex flex-col items-center shadow-premium text-center max-w-md border border-outline-variant/10">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/30 rounded-full blur-2xl animate-pulse"></div>
                <div className="w-24 h-24 bg-primary text-on-primary rounded-[2rem] flex items-center justify-center relative z-10 shadow-inner overflow-hidden">
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 3, ease: "linear" }} className="absolute inset-0 border-[6px] border-dashed border-white/20 rounded-[2rem]" />
                  <Sparkles className="w-10 h-10 fill-current animate-pulse outline-none" />
                </div>
              </div>
              <h3 className="text-3xl font-extrabold font-headline mt-10 mb-3 tracking-tight">AI 小老師整理中...</h3>
              <p className="text-on-surface-variant font-medium text-[15px] leading-relaxed">正在把白板內容轉成國小生看得懂的<br/> {outputFormat === 'quiz' ? '互動小測驗' : '學習單'}。</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {viewState === 'setup' && (
          <motion.div key="setup" initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} exit={{opacity:0, scale:0.95}}>
            <section className="mb-6 md:mb-14">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6">
                <div>
                  <span className="text-primary font-bold tracking-[0.2em] text-[9px] md:text-xs mb-1.5 md:mb-3 flex items-center gap-2"><Sparkles className="w-3 h-3"/>國小學習單生成</span>
                  <h2 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-on-surface leading-tight font-headline">
                    把白板紀錄變成 <span className="text-primary tracking-tighter">國小學習單。</span>
                  </h2>
                </div>
              </div>
              {errorText && (
                <div className="mt-5 rounded-2xl bg-tertiary-container text-tertiary px-4 py-3 text-sm font-bold">
                  {errorText}
                </div>
              )}
            </section>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-8 lg:gap-10">
              <div className="md:col-span-12 lg:col-span-7 space-y-5 sm:space-y-6">
                <div className="bg-surface-container-lowest rounded-3xl sm:rounded-[2.5rem] p-5 sm:p-8 lg:p-10 transition-all border border-outline-variant/20 shadow-sm md:shadow-md">
                  <h3 className="font-headline text-lg sm:text-2xl font-extrabold mb-5 sm:mb-8 flex items-center gap-2">第一步 <ChevronRight className="w-4 h-4 text-on-surface-variant"/> 選擇課堂紀錄</h3>
                  <div className="space-y-4">
                    {notes.map((note) => (
                      <RecordItem key={note.id} title={note.title} meta={`${note.date} • ${note.subject}`} active={activeRecord===note.id} onClick={() => setActiveRecord(note.id)} />
                    ))}
                    {notes.length === 0 ? (
                      <button onClick={() => onNavigate('library')} className="w-full p-8 rounded-[1.5rem] bg-primary/5 border-2 border-dashed border-primary/30 flex flex-col items-center gap-3 hover:bg-primary/10 transition-all group/empty">
                        <span className="text-3xl">📋</span>
                        <p className="text-sm font-bold text-primary">尚無課堂紀錄</p>
                        <p className="text-xs text-on-surface-variant text-center">點此前往課堂紀錄本，拍下白板或新增筆記，<br/>再回來生成小測驗或學習單。</p>
                        <span className="mt-1 text-xs font-extrabold text-primary flex items-center gap-1 group-hover/empty:gap-2 transition-all"><FileSymlink className="w-4 h-4"/> 前往課堂紀錄本</span>
                      </button>
                    ) : (
                      <button onClick={() => onNavigate('library')} className="w-full p-6 border-2 border-dashed border-outline-variant/30 rounded-[1.5rem] text-on-surface-variant font-bold flex items-center justify-center gap-2 hover:bg-surface-container-low transition-all">
                        <FileSymlink className="w-5 h-5"/> 前往課堂紀錄本新增或選擇內容
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="md:col-span-12 lg:col-span-5 space-y-6">
                 <div className="bg-surface-container-low rounded-3xl sm:rounded-[2.5rem] p-6 sm:p-8 border border-outline-variant/10">
                   <h3 className="font-headline text-xl font-extrabold mb-6">第二步 <ChevronRight className="w-4 h-4 text-on-surface-variant inline"/> 生成設定</h3>

                   <div className="space-y-8">
                     <div>
                       <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-4">輸出形式</label>
                       <div className="grid grid-cols-2 gap-3">
                         <button onClick={() => setOutputFormat('quiz')} className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all ${outputFormat==='quiz'?'bg-primary/5 border-primary shadow-sm':'bg-surface border-outline-variant/20 opacity-60'}`}>
                           <FileQuestion className={`w-6 h-6 ${outputFormat==='quiz'?'text-primary':'text-on-surface-variant'}`} />
                           <span className={`text-sm font-bold ${outputFormat==='quiz'?'text-primary':'text-on-surface-variant'}`}>小測驗</span>
                         </button>
                         <button onClick={() => setOutputFormat('summary')} className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all ${outputFormat==='summary'?'bg-primary/5 border-primary shadow-sm':'bg-surface border-outline-variant/20 opacity-60'}`}>
                           <FileText className={`w-6 h-6 ${outputFormat==='summary'?'text-primary':'text-on-surface-variant'}`} />
                           <span className={`text-sm font-bold ${outputFormat==='summary'?'text-primary':'text-on-surface-variant'}`}>學習單</span>
                         </button>
                       </div>
                     </div>
                   </div>

                   <button onClick={handleGenerate} disabled={notes.length === 0} className="w-full mt-10 bg-primary text-on-primary font-extrabold text-lg py-5 rounded-[1.5rem] shadow-premium hover:shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 group overflow-hidden relative disabled:opacity-50">
                     <div className="absolute inset-0 bg-white/10 translate-y-full hover:translate-y-0 transition-transform duration-500"></div>
                     <Sparkles className="w-5 h-5 fill-current relative z-10" />
                     <span className="relative z-10">開始生成</span>
                     <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
                   </button>
                 </div>
              </div>
            </div>
          </motion.div>
        )}

        {viewState === 'quiz_play' && (
          <motion.div key="quiz" initial={{opacity:0, x:20}} animate={{opacity:1, x:0}} exit={{opacity:0, x:-20}} className="max-w-3xl mx-auto">
             <div className="flex items-center justify-between mb-8">
               <div className="flex items-center gap-4">
                 <button onClick={reset} className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center hover:bg-surface-container-highest transition-colors"><RotateCcw className="w-4 h-4"/></button>
                 <span className="font-bold text-on-surface-variant">第 {currentQ + 1} 題 / 共 {quizQuestions.length} 題</span>
               </div>
               <div className="px-4 py-1.5 bg-primary-container text-primary text-xs font-black rounded-full shadow-sm">來源：{notes.find((note) => note.id === activeRecord)?.subject ?? '課堂紀錄'}</div>
             </div>

             <div className="bg-surface-container-lowest rounded-[2.5rem] p-8 sm:p-12 border border-outline-variant/10 shadow-premium relative min-h-[400px] flex flex-col">
                <h3 className="text-2xl sm:text-3xl font-extrabold font-headline leading-tight mb-12">{quizQuestions[currentQ]?.q}</h3>

                <div className="grid grid-cols-1 gap-4 flex-1">
                  {quizQuestions[currentQ]?.options.map((opt, i) => (
                    <button
                      key={i} onClick={() => !ansd && setSelOpt(i)}
                      className={`text-left p-6 rounded-2xl border-2 font-bold text-lg transition-all ${selOpt === i ? 'bg-primary/5 border-primary ring-4 ring-primary/10' : 'bg-surface border-outline-variant/20 hover:border-outline-variant/50'} ${ansd && i === quizQuestions[currentQ].ans ? 'bg-primary/10 border-primary' : ansd && i === selOpt ? 'bg-error/10 border-error' : ''}`}
                    >
                      <div className="flex items-center gap-4">
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${selOpt === i ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}`}>{String.fromCharCode(65 + i)}</span>
                        {opt}
                      </div>
                    </button>
                  ))}
                </div>

                <AnimatePresence>
                  {selOpt !== null && !ansd && (
                    <motion.div initial={{opacity:0, scale:0.8, y:20}} animate={{opacity:1, scale:1, y:0}} className="mt-12 absolute bottom-6 right-6">
                      <button onClick={handleAns} className="bg-primary text-on-primary font-extrabold text-lg px-8 py-4 rounded-full shadow-premium hover:shadow-lg active:scale-95 transition-all outline-none">驗證答案</button>
                    </motion.div>
                  )}
                  {ansd && (
                    <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} className="mt-10 w-full flex flex-col sm:flex-row items-center justify-between bg-surface-container-low p-6 rounded-3xl border border-outline-variant/10">
                      {selOpt === quizQuestions[currentQ].ans ? (
                        <span className="text-primary font-extrabold text-xl flex items-center gap-3"><div className="w-10 h-10 bg-primary text-on-primary rounded-full flex items-center justify-center shadow-lg"><CheckCircle2 className="w-6 h-6"/></div> 答對了！</span>
                      ) : (
                        <span className="text-error font-extrabold text-xl flex items-center gap-3"><div className="w-10 h-10 bg-error text-on-error rounded-full flex items-center justify-center shadow-lg"><CheckCircle2 className="w-6 h-6"/></div> 再想一次</span>
                      )}
                      <button onClick={handleNextQ} className="bg-surface font-extrabold px-8 py-4 rounded-full shadow-sm hover:shadow-md border border-outline-variant/20 hover:border-primary/40 flex items-center gap-2 mt-4 sm:mt-0 transition-all hover:bg-surface-container-highest group">
                          {currentQ < quizQuestions.length - 1 ? '繼續下一題' : '查看成績'} <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform"/>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
             </div>
          </motion.div>
        )}

        {viewState === 'quiz_result' && (
          <motion.div key="result" initial={{opacity:0, scale:0.9, filter:"blur(8px)"}} animate={{opacity:1, scale:1, filter:"blur(0px)"}} className="max-w-2xl mx-auto py-16 text-center">
            <div className="w-36 h-36 bg-primary-container rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 shadow-2xl overflow-hidden relative rotate-12 hover:rotate-0 transition-transform duration-700">
              <PartyPopper className="w-20 h-20 text-primary relative z-10" />
            </div>
            <h2 className="text-5xl font-extrabold font-headline mb-4 tracking-tight">小測驗完成！</h2>
            <p className="text-xl font-medium text-on-surface-variant mb-12">可以把結果當成課堂即時檢核，看看哪些重點需要再說一次。</p>

            <div className="bg-surface-container-lowest rounded-[2rem] md:rounded-[3rem] p-8 md:p-12 border border-outline-variant/20 shadow- premium mb-10 md:mb-12 relative overflow-hidden group mx-4 md:mx-0">
              <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
              <span className="text-7xl sm:text-[100px] md:text-[120px] leading-none font-black text-primary font-headline tracking-tighter relative z-10 drop-shadow-md">{score}<span className="text-3xl sm:text-5xl text-on-surface-variant opacity-40 ml-1 md:ml-2">/{quizQuestions.length}</span></span>
            </div>

            <div className="flex gap-4 justify-center">
              <button onClick={reset} className="bg-surface-container hover:bg-surface-container-highest text-on-surface font-bold text-lg px-8 py-4 rounded-[1.5rem] transition-all flex items-center gap-2 border border-transparent hover:border-outline-variant/20 active:scale-95"><RotateCcw className="w-5 h-5"/> 再測</button>
              <button onClick={() => onNavigate('library')} className="bg-primary hover:bg-primary-dim text-on-primary font-bold text-lg px-8 py-4 rounded-[1.5rem] transition-all flex items-center gap-2 shadow-premium active:scale-95">返回紀錄本 <ArrowRight className="w-5 h-5"/></button>
            </div>
          </motion.div>
        )}

        {viewState === 'summary_view' && (
          <motion.div key="summary" initial={{opacity:0, y:40}} animate={{opacity:1, y:0}} className="max-w-4xl mx-auto py-8">
            <div className="flex items-center justify-between mb-8 px-4">
              <button onClick={reset} className="font-bold text-sm text-on-surface-variant hover:text-primary transition-colors flex items-center gap-2 bg-surface-container-low px-4 py-2 rounded-full"><RotateCcw className="w-4 h-4" /> 返回設定</button>
              <div className="flex gap-3">
                <button className="w-10 h-10 rounded-full bg-surface text-on-surface-variant hover:text-primary flex items-center justify-center hover:bg-primary-container transition-all shadow-sm"><Share2 className="w-4 h-4"/></button>
                <button onClick={() => downloadTextFile(`${notes.find((note) => note.id === activeRecord)?.title ?? '國小學習單'}.md`, summaryText)} className="w-10 h-10 rounded-full bg-surface text-on-surface-variant hover:text-primary flex items-center justify-center hover:bg-primary-container transition-all shadow-sm"><Download className="w-4 h-4"/></button>
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-[2.5rem] p-8 md:p-16 shadow-premium border border-outline-variant/10 relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary via-tertiary to-secondary opacity-50"></div>

               <div className="prose prose-lg max-w-none text-on-surface/90 font-medium leading-loose marker:text-primary font-body markdown-body">
                 <ReactMarkdown>{summaryText}</ReactMarkdown>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </motion.div>
  );
}

function RecordItem({ title, meta, active, onClick }: any) {
  return (
    <div onClick={onClick} className={`p-5 rounded-[1.5rem] flex justify-between items-center cursor-pointer transition-all ${active ? 'bg-surface-container-lowest border-2 border-primary shadow-md transform scale-[1.02]' : 'bg-surface border border-outline-variant/10 hover:border-outline-variant/30 hover:bg-surface-container-highest'}`}>
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-[1rem] flex items-center justify-center transition-colors ${active ? 'bg-primary text-on-primary shadow-inner' : 'bg-surface-container text-on-surface-variant'}`}><FileText className="w-5 h-5"/></div>
        <div><p className="font-extrabold text-lg text-on-surface leading-tight">{title}</p><p className={`text-[12px] font-bold tracking-wide mt-1 uppercase ${active ? 'text-primary/80' : 'text-on-surface-variant'}`}>{meta}</p></div>
      </div>
      {active && <CheckCircle2 className="text-primary w-6 h-6 drop-shadow-sm" />}
    </div>
  );
}
