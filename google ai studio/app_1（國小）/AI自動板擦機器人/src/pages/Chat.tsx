import ReactMarkdown from 'react-markdown';
import { Cast, Sparkles, Bot, Copy, Trash2, Check, ArrowDownCircle, FileText, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useRef, useEffect } from 'react';

import { chatWithAI } from '../services/geminiService';
import {loadNotes, loadNotesAsync, WhiteboardNote} from '../services/notesStore';
import {apiRequest} from '../services/apiClient';

const containerVariants: any = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } }, exit: { opacity: 0, y: -10 } };
const messageVariants: any = { hidden: { opacity: 0, y: 15, scale: 0.95 }, show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", bounce: 0.3 } } };

type Message = { id: string; role: 'ai' | 'user'; text: string; };

const INITIAL_MESSAGES: Message[] = [
  { id: '1', role: 'ai', text: '您好！我是國小課堂 AI 小老師。我會依據課堂紀錄本中的白板文字與老師講解，幫你改寫成孩子聽得懂的說法、活動或小測驗。' }
];
const CHAT_KEY = 'whiteboard-chat:elementary:v1';

export default function Chat({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const raw = localStorage.getItem(CHAT_KEY);
      return raw ? JSON.parse(raw) : INITIAL_MESSAGES;
    } catch {
      return INITIAL_MESSAGES;
    }
  });
  const [isTyping, setIsTyping] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notes, setNotes] = useState<WhiteboardNote[]>(() => loadNotes());
  const [relatedNote, setRelatedNote] = useState<WhiteboardNote | null>(loadNotes()[0] ?? null);
  const [syncStatus, setSyncStatus] = useState<'loading' | 'ok' | 'offline'>('loading');
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const didLoadRemoteChat = useRef(false);

  useEffect(() => {
    loadNotesAsync().then((loadedNotes) => {
      setNotes(loadedNotes);
      setRelatedNote(loadedNotes[0] ?? null);
    }).catch(() => {});
    apiRequest<{messages: Message[]}>('/api/chat')
      .then((result) => {
        if (Array.isArray(result.messages) && result.messages.length > 0) {
          setMessages(result.messages);
        }
        setSyncStatus('ok');
      })
      .catch(() => {
        setSyncStatus('offline');
      })
      .finally(() => {
        didLoadRemoteChat.current = true;
      });
  }, []);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
    try {
      localStorage.setItem(CHAT_KEY, JSON.stringify(messages));
    } catch {
      try { localStorage.setItem(CHAT_KEY, JSON.stringify(messages.slice(-30))); } catch { /* quota full */ }
    }
    if (didLoadRemoteChat.current) {
      apiRequest('/api/chat', {
        method: 'PUT',
        body: JSON.stringify({messages}),
      }).catch(() => {
      });
    }
  }, [messages]);

  const autoResize = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  useEffect(() => {
    if (copiedId === null) return;
    const timer = setTimeout(() => setCopiedId(null), 2000);
    return () => clearTimeout(timer);
  }, [copiedId]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
  };

  const submitMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;

    const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const userMsg: Message = { id: uid(), role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsTyping(true);

    try {
      const matchedNote = findRelevantNote(text, notes);
      setRelatedNote(matchedNote);
      const noteIds = (matchedNote ? [matchedNote.id, ...notes.filter((note) => note.id !== matchedNote.id).map((note) => note.id)] : notes.map((note) => note.id)).slice(0, 3);
      const response = await chatWithAI(text, messages.map(m => ({ role: m.role, text: m.text })), noteIds);
      setMessages(prev => [...prev, {id: uid(), role: 'ai', text: response}]);
    } catch {
      setMessages(prev => [...prev, {id: uid(), role: 'ai', text: '抱歉，AI 小老師暫時休息中，請稍後再試。'}]);
    } finally {
      setIsTyping(false);
    }
  };

  const clearChat = () => {
    if(confirm('確定要清除所有對話紀錄嗎？')) {
      const resetMessages = [{ id: Date.now().toString(), role: 'ai' as const, text: '對話已重置。要我把哪一段白板改成國小生聽得懂的說法？' }];
      setMessages(resetMessages);
      localStorage.setItem(CHAT_KEY, JSON.stringify(resetMessages));
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      exit="exit"
      className="absolute inset-0 w-full h-full flex flex-col lg:flex-row max-w-6xl mx-auto gap-4 p-4 lg:p-6 pb-[100px] lg:pb-6"
    >
      {/* Left Sidebar Context */}
      <aside className="w-full lg:w-[32%] flex flex-col gap-4 sm:gap-6 hide-scrollbar overflow-y-auto lg:pb-8 lg:pr-2 lg:shrink-0">
        <motion.div variants={messageVariants} className="bg-surface-container-low rounded-3xl p-4 sm:p-6 flex flex-col gap-3 sm:gap-4 border border-outline-variant/10 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between relative z-10">
            {syncStatus === 'loading' && (
              <span className="text-primary font-headline font-bold text-[10px] sm:text-xs tracking-[0.2em] uppercase flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                紀錄本同步中
              </span>
            )}
            {syncStatus === 'ok' && (
              <span className="text-emerald-600 font-headline font-bold text-[10px] sm:text-xs tracking-[0.2em] uppercase flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                已同步
              </span>
            )}
            {syncStatus === 'offline' && (
              <span className="text-amber-600 font-headline font-bold text-[10px] sm:text-xs tracking-[0.2em] uppercase flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                橋接器離線 · 本機模式
              </span>
            )}
            <button type="button" onClick={() => onNavigate('library')} aria-label="切換至課堂紀錄" className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-surface shadow-sm cursor-pointer hover:scale-105 active:scale-95 flex items-center justify-center transition-transform">
               <Cast className="text-primary w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
            </button>
          </div>
          <div className="space-y-0.5 relative z-10">
            <h2 className="font-headline font-extrabold text-lg sm:text-xl text-on-surface tracking-tight line-clamp-2" title={relatedNote?.title}>{relatedNote?.title ?? '尚無關聯紀錄'}</h2>
            <p className="text-on-surface-variant text-[11px] sm:text-[12px] font-medium opacity-80">{relatedNote ? `${relatedNote.subject} • ${relatedNote.date} ${relatedNote.time}` : '請先新增課堂紀錄'}</p>
          </div>
          <div className="mt-1 aspect-video rounded-xl sm:rounded-[1.25rem] overflow-hidden relative shadow-inner border border-outline-variant/10 cursor-pointer hidden sm:block" onClick={() => onNavigate('library')}>
            {relatedNote?.imageUrl || relatedNote?.img ? (
              <img className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" src={relatedNote.imageUrl || relatedNote.img} alt="Whiteboard" />
            ) : (
              <div className="w-full h-full bg-surface-container flex flex-col items-center justify-center gap-2 text-on-surface-variant">
                <span className="text-2xl">📋</span>
                <span className="text-xs font-bold">點此前往新增紀錄</span>
              </div>
            )}
          </div>
          <div className="bg-surface rounded-2xl p-4 border border-outline-variant/10">
            <div className="flex items-center gap-2 text-primary font-bold text-xs tracking-widest uppercase mb-2">
              <FileText className="w-4 h-4" /> 情境復現
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed line-clamp-4" title={relatedNote?.ocrText || relatedNote?.content}>{relatedNote?.ocrText || relatedNote?.content || '等待關聯課堂紀錄。'}</p>
            <div className="mt-3 flex items-center gap-2 text-xs text-on-surface-variant">
              <Volume2 className="w-4 h-4" />
              {relatedNote?.audioUrl ? '已連結老師講解片段' : '尚未匯入音訊，顯示逐字稿'}
            </div>
          </div>
        </motion.div>

        <motion.div variants={messageVariants} className="bg-surface-container-highest rounded-[2rem] p-6 space-y-4 border border-outline-variant/10 hidden lg:block">
          <h3 className="font-headline font-bold text-on-surface text-sm tracking-wide">建議追問</h3>
          <div className="flex flex-col gap-3">
            <button onClick={() => submitMessage('請把最新紀錄改成三年級會懂的說法')} className="text-left px-4 py-3 bg-surface rounded-xl hover:bg-primary-container text-sm font-bold text-on-surface-variant hover:text-primary transition-colors border border-transparent hover:border-primary/20">改成孩子聽得懂</button>
            <button onClick={() => submitMessage('請設計 3 題國小生小測驗，題目要短')} className="text-left px-4 py-3 bg-surface rounded-xl hover:bg-secondary-container text-sm font-bold text-on-surface-variant hover:text-secondary-dim transition-colors border border-transparent hover:border-secondary/20">做 3 題小測驗</button>
            <button onClick={() => submitMessage('請設計一個 5 分鐘分組活動')} className="text-left px-4 py-3 bg-surface rounded-xl hover:bg-tertiary-container text-sm font-bold text-on-surface-variant hover:text-tertiary transition-colors border border-transparent hover:border-tertiary/20">設計分組活動</button>
          </div>
        </motion.div>
      </aside>

      {/* Main Chat Interface */}
      <motion.section variants={messageVariants} className="flex-1 flex flex-col bg-surface-container-lowest rounded-3xl md:rounded-[2.5rem] editorial-shadow overflow-hidden border border-outline-variant/10 relative w-full max-w-full">
        {/* Header Options */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-surface-container flex items-center justify-between bg-surface z-20 shrink-0">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary-container flex items-center justify-center shadow-inner">
              <Sparkles className="text-primary w-4 h-4 sm:w-5 sm:h-5 fill-current" />
            </div>
            <h3 className="font-headline font-extrabold text-base sm:text-lg">AI 小老師</h3>
          </div>
          <button onClick={clearChat} className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-[11px] sm:text-xs font-bold text-error/80 hover:bg-error-container hover:text-error transition-colors">
            <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">重新對話</span><span className="sm:hidden">重置</span>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col scroll-smooth hide-scrollbar bg-surface-container-lowest/30">
          <div className="space-y-6 sm:space-y-8 flex flex-col mt-auto justify-end">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", bounce: 0.3 }} className={`flex gap-3 max-w-[95%] sm:max-w-[85%] group ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
                  {msg.role === 'ai' && (
                    <div className="w-8 h-8 rounded-full bg-secondary-container flex-shrink-0 flex items-center justify-center mt-auto z-10 shadow-sm border border-surface">
                      <Bot className="text-secondary w-4 h-4" />
                    </div>
                  )}
                  <div className={`p-4 sm:p-5 lg:p-6 rounded-2xl lg:rounded-[1.5rem] shadow-sm relative group-hover:shadow-md transition-shadow ${msg.role === 'ai' ? 'bg-surface-container rounded-bl-sm border border-outline-variant/10 text-on-surface' : 'bg-primary text-on-primary rounded-br-sm font-medium whitespace-pre-wrap'}`}>
                    <div className="text-[14px] lg:text-[15px] leading-relaxed">
                      {msg.role === 'ai' ? (
                        <div className="prose prose-sm max-w-none">
                          <ReactMarkdown>{msg.text}</ReactMarkdown>
                        </div>
                      ) : msg.text}
                    </div>

                    {msg.role === 'ai' && (
                      <div className="absolute right-2 -bottom-4 lg:-right-4 lg:bottom-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 z-20">
                        <button onClick={() => copyToClipboard(msg.text, msg.id)} aria-label={copiedId === msg.id ? '已複製到剪貼板' : '複製回覆'} className="p-2 bg-surface rounded-full shadow-md text-on-surface-variant hover:text-primary transition-colors border border-outline-variant/10">
                          {copiedId === msg.id ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {isTyping && (
               <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 max-w-[80%]">
                 <div className="w-8 h-8 rounded-full bg-secondary-container flex-shrink-0 flex items-center justify-center mt-auto relative shadow-sm border border-surface">
                   <div className="absolute inset-0 bg-white/30 animate-pulse rounded-full"></div>
                   <Bot className="text-secondary w-4 h-4 relative z-10" />
                 </div>
                 <div className="bg-surface-container px-4 py-3 sm:px-5 sm:py-4 rounded-[1.25rem] sm:rounded-[1.5rem] rounded-bl-sm flex items-center gap-1.5 shadow-sm border border-outline-variant/10">
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-secondary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-secondary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-secondary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                 </div>
               </motion.div>
            )}
            <div ref={endOfMessagesRef} className="h-1 shrink-0" />
          </div>
        </div>

        {/* Input Area */}
        <div className="p-3 sm:p-4 lg:p-5 bg-surface shrink-0 border-t border-outline-variant/10 z-20">
          <form onSubmit={(e) => { e.preventDefault(); submitMessage(inputValue); }} className="relative flex items-end group shadow-inner bg-surface-container-highest rounded-[1.25rem] sm:rounded-[1.5rem] border border-transparent focus-within:border-primary/40 focus-within:bg-surface focus-within:shadow-[0_4px_20px_rgba(80,107,79,0.08)] transition-all p-1.5 sm:p-2">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputValue}
              maxLength={500}
              onChange={(e) => { setInputValue(e.target.value); autoResize(); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submitMessage(inputValue);
                }
              }}
              className="w-full bg-transparent border-none py-2.5 sm:py-3 pl-3 sm:pl-4 pr-12 sm:pr-14 text-[14px] sm:text-[15px] font-medium text-on-surface outline-none resize-none hide-scrollbar placeholder:text-on-surface-variant/50"
              placeholder="輸入課堂問題，例如：改成孩子聽得懂的說法"
            />
            {inputValue.length > 400 && (
              <p className="absolute bottom-1 left-3 text-[10px] text-tertiary font-bold">{inputValue.length} / 500</p>
            )}
            <div className="absolute right-1.5 bottom-1.5 sm:right-2 sm:bottom-2 flex">
              <button type="submit" disabled={!inputValue.trim() || isTyping} className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all duration-300 ${!inputValue.trim() || isTyping ? 'bg-surface-container text-on-surface-variant/40' : 'bg-primary text-on-primary shadow-md hover:scale-105 active:scale-95'}`}>
                <ArrowDownCircle className={`w-5 h-5 sm:w-6 sm:h-6 rotate-180 transition-transform ${inputValue.trim() && !isTyping ? 'scale-110' : ''}`} strokeWidth={2.5}/>
              </button>
            </div>
          </form>
        </div>
      </motion.section>
    </motion.div>
  );
}

function findRelevantNote(query: string, notes: WhiteboardNote[]) {
  const q = query.toLowerCase();
  return [...notes].sort((a, b) => scoreNote(b, q) - scoreNote(a, q))[0] ?? null;
}

function scoreNote(note: WhiteboardNote, query: string) {
  const haystack = [
    note.title,
    note.subject,
    note.content,
    note.ocrText,
    note.transcript,
    ...(note.keywords ?? []),
  ].filter(Boolean).join(' ').toLowerCase();
  return query.split(/\s+/).filter(Boolean).reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}
