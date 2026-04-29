import { Search, Eye, Folder, ChevronRight, LayoutGrid, List, Trash2, X, Brain, PenTool, Sparkles, Download, Edit3, Loader2, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Variants } from 'motion/react';
import { useState, useMemo, useEffect } from 'react';
import {deleteNoteAsync, downloadTextFile, loadNotesAsync, updateNoteAsync, WhiteboardNote} from '../services/notesStore';

const containerVariants: Variants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1, ease: "easeOut" } }, exit: { opacity: 0, y: -10 } };
const itemVariants: Variants = { hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0, transition: { type: "spring", bounce: 0.3 } } };
const filterOptions = [
  {key: 'recent', label: '最近'},
  {key: 'topic', label: '科目'},
] as const;

export default function Library({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [activeFilter, setActiveFilter] = useState<'recent' | 'topic' | 'folder'>('recent');
  const [viewMode, setViewMode] = useState<'list'|'grid'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [notes, setNotes] = useState<WhiteboardNote[]>([]);
  const [selectedNote, setSelectedNote] = useState<WhiteboardNote | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editDraft, setEditDraft] = useState({
    title: '',
    subject: '',
    period: '',
    desc: '',
    content: '',
    ocrText: '',
    transcript: '',
  });

  useEffect(() => {
    const refresh = () => loadNotesAsync().then(setNotes);
    refresh();
    window.addEventListener('whiteboard-notes-updated', refresh);
    return () => window.removeEventListener('whiteboard-notes-updated', refresh);
  }, []);

  useEffect(() => {
    if (notes.length === 0) return;
    const selectedId = Number(localStorage.getItem('whiteboard-notes:selected-id'));
    if (!selectedId) return;
    const note = notes.find((item) => item.id === selectedId);
    if (note) {
      setSelectedNote(note);
      localStorage.removeItem('whiteboard-notes:selected-id');
    }
  }, [notes]);

  const displayedNotes = useMemo(() => {
    let result = [...notes];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(n => [
        n.title,
        n.subject,
        n.period,
        n.date,
        n.desc,
        n.content,
        n.ocrText,
        n.transcript,
        ...(n.keywords ?? []),
      ].filter(Boolean).join(' ').toLowerCase().includes(q));
    }
    if (activeFilter === 'topic') {
      result.sort((a, b) => a.subject.localeCompare(b.subject));
    }
    return result;
  }, [notes, searchQuery, activeFilter]);

  const deleteNote = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteNoteAsync(id).then(setNotes);
  };

  useEffect(() => {
    if (selectedNote) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'auto';
  }, [selectedNote]);

  useEffect(() => {
    if (!selectedNote) {
      setIsEditing(false);
      return;
    }
    setEditDraft({
      title: selectedNote.title,
      subject: selectedNote.subject,
      period: selectedNote.period,
      desc: selectedNote.desc,
      content: selectedNote.content,
      ocrText: selectedNote.ocrText || '',
      transcript: selectedNote.transcript || '',
    });
  }, [selectedNote]);

  const saveSelectedNote = async () => {
    if (!selectedNote || !editDraft.title.trim() || !editDraft.subject.trim() || !editDraft.content.trim()) {
      return;
    }

    setSavingEdit(true);
    try {
      const updated = await updateNoteAsync(selectedNote.id, {
        ...editDraft,
        title: editDraft.title.trim(),
        subject: editDraft.subject.trim(),
        period: editDraft.period.trim() || '即時紀錄',
        desc: editDraft.desc.trim() || editDraft.content.trim().slice(0, 80),
        content: editDraft.content.trim(),
        ocrText: editDraft.ocrText.trim() || editDraft.content.trim(),
        transcript: editDraft.transcript.trim() || '尚未匯入老師講解逐字稿。',
      });
      setNotes((current) => current.map((note) => note.id === updated.id ? updated : note));
      setSelectedNote(updated);
      setIsEditing(false);
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      exit="exit"
      className="absolute inset-0 w-full h-full overflow-y-auto hide-scrollbar"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:py-8 relative pb-36">
      <section className="mb-10 sm:mb-14">
        {/* Top Header */}
        <motion.div variants={itemVariants} className="flex flex-col md:flex-row justify-between items-start md:items-end gap-5 mb-5 sm:mb-8">
          <div>
            <span className="text-primary font-bold tracking-widest text-[9px] sm:text-xs uppercase font-label">Class Record Book</span>
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-on-surface font-headline mt-0.5 sm:mt-3">課堂紀錄本</h2>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full md:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant/50" />
              <input
                type="text" placeholder="搜尋分數、自然、國語..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-full py-2.5 pl-11 pr-4 text-sm font-medium focus:outline-none focus:border-primary/50 focus:bg-surface transition-all shadow-inner focus:shadow-md"
              />
            </div>
            <div className="flex items-center gap-1 bg-surface-container-low p-1.5 rounded-full overflow-x-auto hide-scrollbar border border-outline-variant/10 shrink-0 shadow-sm">
              {filterOptions.map(({key, label}) => {
                 return (
                  <button
                    key={key} onClick={() => setActiveFilter(key)}
                    className={`px-4 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap relative z-10 ${activeFilter === key ? 'text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
                  >
                    {activeFilter === key && <motion.div layoutId="filter-bg" className="absolute inset-0 bg-primary rounded-full -z-10 shadow-sm" transition={{ type: "spring", bounce: 0.2, duration: 0.6 }} />}
                    {label}
                  </button>
                 )
              })}
            </div>
          </div>
        </motion.div>

        {searchQuery === '' && (
          <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8 mb-6 md:mb-10">
            <div onClick={() => notes[0] && setSelectedNote(notes[0])} className="md:col-span-8 group cursor-pointer relative rounded-2xl sm:rounded-[2.5rem] overflow-hidden bg-surface-container-high aspect-[16/10] md:h-[320px] shadow-sm hover:shadow-2xl transition-all duration-700 border border-outline-variant/5 hover:border-primary/20">
              <img className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105 filter group-hover:brightness-110" src={notes[0]?.img} alt="精選課堂紀錄" />
              <div className="absolute inset-0 bg-gradient-to-t from-inverse-surface/90 via-inverse-surface/20 to-transparent"></div>
              <div className="absolute top-4 left-4 w-10 h-10 bg-surface/20 backdrop-blur-md rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity shadow-lg"><Eye className="text-white w-4.5 h-4.5"/></div>
              <div className="absolute bottom-0 left-0 p-5 sm:p-8 text-on-primary">
                <span className="bg-primary text-on-primary px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase mb-3 inline-block shadow-md">今日焦點</span>
                <h3 className="text-xl sm:text-3xl font-bold font-headline leading-tight drop-shadow-lg">{notes[0]?.title ?? '尚無課堂紀錄'}</h3>
              </div>
            </div>
            <div className="md:col-span-4 flex flex-col gap-4 md:gap-6">
              <div className="bg-surface-container-low rounded-2xl sm:rounded-[2.5rem] p-5 md:p-8 flex flex-col justify-center border border-outline-variant/10 shadow-sm md:h-full hover:shadow-md transition-shadow">
                <h4 className="text-primary font-bold text-[10px] sm:text-xs tracking-[0.2em] uppercase font-headline mb-3 sm:mb-4 flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"/>本機資料庫</h4>
                <div className="flex justify-between items-end mb-1 sm:mb-2 text-on-surface">
                  <span className="text-xs sm:text-sm font-bold opacity-60">紀錄數</span>
                  <span className="text-2xl sm:text-3xl font-extrabold font-headline">{notes.length}<span className="text-xs sm:text-sm font-medium opacity-60">筆</span></span>
                </div>
                <div className="w-full h-2 sm:h-3 bg-surface-container-highest rounded-full overflow-hidden mt-1 sm:mt-2 mb-3 sm:mb-4 shadow-inner relative">
                  <motion.div initial={{width:0}} animate={{width:`${Math.min(100, notes.length * 12)}%`}} className="h-full bg-gradient-to-r from-primary to-tertiary rounded-full shadow-[0_0_12px_rgba(80,107,79,0.5)]"></motion.div>
                </div>
                <p className="text-[10px] sm:text-xs text-on-surface-variant leading-relaxed">優先保存到本機 JSON；bridge 不可用時會暫存在瀏覽器，孩子的原始錄音不會被保存。</p>
              </div>
            </div>
          </motion.div>
        )}
      </section>

      {/* Dynamic List / Grid View */}
      <section className="space-y-6">
        <motion.div variants={itemVariants} className="flex items-center justify-between px-2 pb-4 border-b border-surface-container">
          <h3 className="text-2xl font-bold font-headline flex items-center gap-3">
            {searchQuery ? `搜尋結果: "${searchQuery}"` : '課堂紀錄清單'}
            <span className="bg-surface-container-high text-on-surface-variant text-sm px-3 py-0.5 rounded-full font-bold">{displayedNotes.length}</span>
          </h3>
          <div className="flex bg-surface-container-low rounded-full p-1 border border-outline-variant/10 shadow-sm">
            <button onClick={() => setViewMode('list')} className={`p-2 rounded-full transition-all ${viewMode==='list' ? 'bg-surface shadow-md text-primary' : 'text-on-surface-variant hover:bg-surface-container-highest'}`}><List className="w-4 h-4" /></button>
            <button onClick={() => setViewMode('grid')} className={`p-2 rounded-full transition-all ${viewMode==='grid' ? 'bg-surface shadow-md text-primary' : 'text-on-surface-variant hover:bg-surface-container-highest'}`}><LayoutGrid className="w-4 h-4" /></button>
          </div>
        </motion.div>

        {displayedNotes.length === 0 ? (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} className="text-center py-20">
            <div className="w-24 h-24 bg-surface-container rounded-full flex items-center justify-center mx-auto mb-6">
              <Folder className="w-10 h-10 text-on-surface-variant/40" />
            </div>
            <h4 className="text-xl font-bold text-on-surface mb-2">找不到相符的課堂紀錄</h4>
            <p className="text-sm text-on-surface-variant">可以試試「分數」「水循環」「故事」或清除搜尋條件。</p>
          </motion.div>
        ) : (
          <motion.div layout className={`gap-5 ${viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'flex flex-col'}`}>
            <AnimatePresence mode="popLayout">
              {displayedNotes.map((note) => (
                <motion.div
                  key={note.id} layoutId={`note-card-${note.id}`} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8, filter: "blur(8px)" }} transition={{ type: "spring", bounce: 0.2 }}
                  onClick={() => setSelectedNote(note)}
                  className={`group bg-surface-container-lowest rounded-[2rem] p-4 transition-all hover:shadow-xl hover:-translate-y-1 cursor-pointer border border-outline-variant/5 hover:border-primary/20 overflow-hidden relative ${viewMode==='grid' ? 'flex flex-col' : 'flex flex-col md:flex-row md:items-center gap-6'}`}
                >
                  <div className={`rounded-2xl overflow-hidden bg-surface-container relative shrink-0 z-10 ${viewMode==='grid' ? 'w-full aspect-video mb-3' : 'w-full md:w-56 h-28 sm:h-36 border border-outline-variant/10'}`}>
                    <img className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" src={note.img} alt={note.subject} />
                    <div className="absolute inset-0 bg-inverse-surface/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                      <div className="bg-surface p-3 rounded-full scale-50 group-hover:scale-100 transition-transform duration-300 shadow-xl"><Eye className="text-primary w-5 h-5"/></div>
                    </div>
                  </div>

                  <div className="flex-grow space-y-2.5 z-10 w-full relative">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full ${note.theme === 'primary' ? 'bg-primary-container/80 text-primary' : note.theme === 'secondary' ? 'bg-secondary-container/80 text-secondary-dim' : 'bg-tertiary-container/80 text-tertiary'}`}>
                        {note.subject}
                      </span>
                      <button onClick={(e) => deleteNote(note.id, e)} className="text-error/50 hover:text-error hover:bg-error-container p-2.5 rounded-full transition-colors active:scale-90 absolute right-0 -top-2 opacity-0 group-hover:opacity-100 shadow-sm border border-transparent hover:border-error/20">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <h4 className="text-xl font-bold font-headline text-on-surface group-hover:text-primary transition-colors leading-tight">{note.title}</h4>
                    <p className="text-[14px] text-on-surface-variant line-clamp-2 leading-relaxed font-body">{note.desc}</p>
                    {viewMode === 'grid' && (
                      <div className="mt-4 pt-4 border-t border-outline-variant/10 flex justify-between items-center text-xs text-on-surface-variant font-medium">
                         <span>{note.date}</span><span>{note.time}</span>
                      </div>
                    )}
                  </div>

                  {viewMode === 'list' && (
                    <div className="text-right shrink-0 px-4 hidden md:block z-10">
                      <p className="text-[15px] font-bold text-on-surface">{note.date}</p>
                      <p className="text-xs text-on-surface-variant mt-1.5 font-medium">{note.time}</p>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </section>

      {/* Note Detail Modal */}
      <AnimatePresence>
        {selectedNote && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-inverse-surface/60 backdrop-blur-md flex items-center justify-center p-4 md:p-8"
            onClick={() => setSelectedNote(null)}
          >
            <motion.div
              layoutId={`note-card-${selectedNote.id}`}
              initial={{ scale: 0.95, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.95, y: 20, opacity: 0 }} onClick={(e) => e.stopPropagation()}
              className="bg-surface w-full max-w-5xl h-[85vh] md:h-auto md:max-h-[85vh] rounded-3xl sm:rounded-[2.5rem] shadow-[0_32px_64px_rgba(0,0,0,0.25)] overflow-hidden flex flex-col md:flex-row relative border border-white/20"
            >
              <button onClick={() => setSelectedNote(null)} className="absolute top-3 right-3 z-50 w-10 h-10 bg-surface/90 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-surface-container-highest transition-colors shadow-sm">
                <X className="w-5 h-5 text-on-surface" />
              </button>

              <div className="w-full md:w-[45%] h-56 md:h-full bg-inverse-surface relative shrink-0">
                <img className="w-full h-full object-cover" src={selectedNote.img} alt={selectedNote.title} />
                <div className="absolute inset-0 bg-gradient-to-t from-inverse-surface/90 via-transparent to-transparent"></div>
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-2 text-white">
                  <span className="font-bold tracking-widest text-[10px] uppercase bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">課堂白板快照</span>
                  <div className="flex gap-2">
                    <button onClick={() => setIsEditing((value) => !value)} className="p-2 bg-black/30 hover:bg-white/20 backdrop-blur-md rounded-full transition-colors" aria-label="編輯課堂紀錄"><Edit3 className="w-4 h-4"/></button>
                    <button onClick={() => downloadTextFile(`${selectedNote.title}.md`, `# ${selectedNote.title}\n\n${selectedNote.content}`)} className="p-2 bg-black/30 hover:bg-white/20 backdrop-blur-md rounded-full transition-colors" aria-label="匯出 Markdown"><Download className="w-4 h-4"/></button>
                  </div>
                </div>
              </div>

              <div className="w-full md:w-[55%] flex flex-col bg-surface flex-1 min-h-0">
                <div className="flex-1 overflow-y-auto p-5 sm:p-10 hide-scrollbar scroll-smooth">
                  {isEditing ? (
                    <div className="space-y-3 mb-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <EditField label="標題" value={editDraft.title} onChange={(value) => setEditDraft((draft) => ({...draft, title: value}))} />
                        <EditField label="科目" value={editDraft.subject} onChange={(value) => setEditDraft((draft) => ({...draft, subject: value}))} />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-3">
                        <EditField label="課節" value={editDraft.period} onChange={(value) => setEditDraft((draft) => ({...draft, period: value}))} />
                        <EditField label="摘要" value={editDraft.desc} onChange={(value) => setEditDraft((draft) => ({...draft, desc: value}))} />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-4">
                        <span className={`text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full ${selectedNote.theme === 'primary' ? 'bg-primary-container text-primary' : selectedNote.theme === 'secondary' ? 'bg-secondary-container text-secondary-dim' : 'bg-tertiary-container text-tertiary'}`}>
                          {selectedNote.subject}
                        </span>
                        <span className="text-[11px] font-bold text-on-surface-variant uppercase">{selectedNote.date} • {selectedNote.time}</span>
                      </div>
                      <h2 className="text-2xl md:text-3xl font-extrabold font-headline text-on-surface mb-3 leading-tight">{selectedNote.title}</h2>
                      <p className="text-[14px] md:text-[15px] text-on-surface-variant mb-6">{selectedNote.desc}</p>
                    </>
                  )}

                  <div className="grid grid-cols-1 gap-4">
                    {isEditing ? (
                      <>
                        <EditTextArea label="白板辨識文字" value={editDraft.ocrText} onChange={(value) => setEditDraft((draft) => ({...draft, ocrText: value}))} rows={5} />
                        <EditTextArea label="老師講解逐字稿" value={editDraft.transcript} onChange={(value) => setEditDraft((draft) => ({...draft, transcript: value}))} rows={5} />
                      </>
                    ) : (
                      <>
                        <ContextPanel title="白板辨識文字" content={selectedNote.ocrText || selectedNote.content} />
                        <ContextPanel title="老師講解逐字稿" content={selectedNote.transcript || '尚未匯入語音逐字稿。'} />
                      </>
                    )}
                    <div className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/20 shadow-inner">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span className="text-[11px] font-bold text-primary tracking-wider uppercase">給孩子看的整理</span>
                      </div>
                      {isEditing ? (
                        <textarea value={editDraft.content} onChange={(event) => setEditDraft((draft) => ({...draft, content: event.target.value}))} rows={10} className="w-full rounded-xl bg-surface p-4 outline-none border border-outline-variant/20 resize-y text-sm leading-relaxed" />
                      ) : (
                        <div className="text-[13px] md:text-[14px] leading-relaxed md:leading-loose text-on-surface font-medium whitespace-pre-wrap">
                          {selectedNote.content}
                        </div>
                      )}
                      <div className="mt-4 p-3 rounded-xl bg-surface-container text-xs text-on-surface-variant">
                        {selectedNote.audioUrl ? '可播放老師講解片段。' : '尚未匯入音訊檔，先以逐字稿呈現，不假裝播放。'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-5 md:p-6 bg-surface-container-lowest shrink-0 border-t border-outline-variant/10 flex gap-3">
                  {isEditing ? (
                    <>
                      <button onClick={() => setIsEditing(false)} className="flex-1 bg-surface-container hover:bg-surface-container-high text-on-surface font-extrabold py-3.5 px-4 rounded-xl transition-colors shadow-sm text-sm">取消</button>
                      <button onClick={saveSelectedNote} disabled={savingEdit || !editDraft.title.trim() || !editDraft.subject.trim() || !editDraft.content.trim()} className="flex-1 bg-primary text-on-primary font-extrabold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all hover:bg-primary-dim disabled:opacity-50 text-sm">
                        {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 保存修改
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => { setSelectedNote(null); onNavigate('chat'); }} className="flex-1 bg-surface-container hover:bg-primary-container hover:text-primary text-on-surface font-extrabold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm text-sm">
                        <Brain className="w-4 h-4" /> 問 AI 小老師
                      </button>
                      <button onClick={() => { setSelectedNote(null); onNavigate('review'); }} className="flex-1 bg-primary text-on-primary font-extrabold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all hover:bg-primary-dim hover:shadow-md active:scale-95 text-sm">
                        <PenTool className="w-4 h-4" /> 生成學習單
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </motion.div>
  );
}

function ContextPanel({title, content}: {title: string; content: string}) {
  return (
    <div className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/20 shadow-inner">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="text-[11px] font-bold text-primary tracking-wider uppercase">{title}</span>
      </div>
      <div className="text-[13px] md:text-[14px] leading-relaxed text-on-surface font-medium whitespace-pre-wrap">
        {content}
      </div>
    </div>
  );
}

function EditField({label, value, onChange}: {label: string; value: string; onChange: (value: string) => void}) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold text-on-surface-variant uppercase">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full min-h-11 rounded-xl bg-surface-container px-3 outline-none border border-outline-variant/20 font-bold"
      />
    </label>
  );
}

function EditTextArea({label, value, rows, onChange}: {label: string; value: string; rows: number; onChange: (value: string) => void}) {
  return (
    <label className="block bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/20 shadow-inner">
      <span className="text-[11px] font-bold text-primary uppercase">{label}</span>
      <textarea
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        className="mt-3 w-full rounded-xl bg-surface p-4 outline-none border border-outline-variant/20 resize-y text-sm leading-relaxed"
      />
    </label>
  );
}
