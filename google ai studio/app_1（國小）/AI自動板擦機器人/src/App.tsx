import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Settings, Search, Home as HomeIcon, ScrollText, MessageSquare, Sparkles, X, FileQuestion, LayoutDashboard, Bot } from 'lucide-react';

import Home from './pages/Home';
import Library from './pages/Library';
import Chat from './pages/Chat';
import Review from './pages/Review';
import TeacherDashboard from './pages/TeacherDashboard';
import RobotControl from './pages/RobotControl';
import SystemSettingsPanel from './components/SystemSettingsPanel';
import {loadNotesAsync, WhiteboardNote} from './services/notesStore';
import { TourProvider } from './components/tour/TourProvider';
import { TourOverlay } from './components/tour/TourOverlay';
import { useTour } from './components/tour/useTour';

type AppTab = 'home' | 'teacher' | 'robot' | 'library' | 'chat' | 'review';

const appTabs: AppTab[] = ['home', 'teacher', 'robot', 'library', 'chat', 'review'];

function isAppTab(tab: string): tab is AppTab {
  return appTabs.includes(tab as AppTab);
}

function RestartTourButton({ onClose }: { onClose: () => void }) {
  const { restartTour } = useTour();
  return (
    <button
      onClick={() => { restartTour(); onClose(); }}
      className="mt-4 w-full rounded-2xl border border-primary/20 bg-primary-container/40 px-4 py-3 text-left transition hover:bg-primary-container/60 active:scale-95"
    >
      <p className="text-sm font-extrabold text-primary">重看功能導覽</p>
      <p className="mt-0.5 text-xs text-on-surface-variant">再次走一遍 8 步引導</p>
    </button>
  );
}

export default function App() {
  const [currentTab, setCurrentTab] = useState<AppTab>('home');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchNotes, setSearchNotes] = useState<WhiteboardNote[]>([]);

  // Remove scroll when modal is open
  useEffect(() => {
    if (isSettingsOpen || isSearchOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
  }, [isSettingsOpen, isSearchOpen]);

  useEffect(() => {
    if (isSearchOpen) {
      loadNotesAsync().then(setSearchNotes).catch(() => setSearchNotes([]));
    }
  }, [isSearchOpen]);

  const searchResults = searchQuery.trim()
    ? searchNotes.filter((note) => [
      note.title,
      note.subject,
      note.desc,
      note.content,
      note.ocrText,
      note.transcript,
      ...(note.keywords ?? []),
    ].filter(Boolean).join(' ').toLowerCase().includes(searchQuery.toLowerCase()))
    : searchNotes.slice(0, 5);

  const navigateTo = (tab: string) => {
    if (isAppTab(tab)) {
      setCurrentTab(tab);
    }
  };

  const openNoteFromSearch = (noteId: number) => {
    localStorage.setItem('whiteboard-notes:selected-id', String(noteId));
    setIsSearchOpen(false);
    setCurrentTab('library');
  };

  const getPage = () => {
    switch (currentTab) {
      case 'home': return <Home key="home" onNavigate={navigateTo} />;
      case 'teacher': return <TeacherDashboard key="teacher" />;
      case 'robot': return <RobotControl key="robot" />;
      case 'library': return <Library key="library" onNavigate={navigateTo} />;
      case 'chat': return <Chat key="chat" onNavigate={navigateTo} />;
      case 'review': return <Review key="review" onNavigate={navigateTo} />;
    }
  };

  return (
    <TourProvider onTabChange={navigateTo}>
    <div className="app1-shell flex flex-col min-h-screen relative overflow-x-hidden bg-surface">
      <div className="noise-overlay" />
      {/* TopAppBar */}
      <header className="sticky top-0 w-full z-30 flex items-center justify-between px-4 sm:px-6 py-2.5 sm:py-4 bg-surface/90 backdrop-blur-xl transition-all border-b border-outline-variant/10">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2 sm:gap-3 cursor-pointer"
          onClick={() => setCurrentTab('home')}
        >
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <Sparkles className="text-on-primary w-4 h-4" />
          </div>
          <span className="text-base sm:text-xl font-extrabold font-headline tracking-tighter text-primary">國小 AI 白板助教</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-1 sm:gap-2"
        >
          <button
            onClick={() => setIsSearchOpen(true)}
            aria-label="搜尋課堂紀錄"
            className="w-10 h-10 flex items-center justify-center hover:bg-[#eae8dd] rounded-full transition-colors active:scale-95 group"
          >
            <Search className="text-on-surface/70 group-hover:text-primary w-5 h-5" />
          </button>

          <button
            onClick={() => setIsSettingsOpen(true)}
            aria-label="開啟系統設定"
            className="w-10 h-10 flex items-center justify-center hover:bg-[#eae8dd] rounded-full transition-colors active:scale-95 group"
          >
            <Settings className="text-on-surface/70 group-hover:text-primary w-5 h-5" />
          </button>
        </motion.div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col w-full relative pb-44 md:pb-10">
        <AnimatePresence mode="wait" initial={false}>
          {getPage()}
        </AnimatePresence>
      </main>

      {/* Mobile NavBar - Floating Pill */}
      <div className="md:hidden fixed bottom-3 left-3 right-3 z-[100] flex justify-center pointer-events-none">
        <nav className="w-full max-w-[27rem] grid grid-cols-3 gap-1.5 p-2 glass-pill rounded-[1.75rem] pointer-events-auto shrink-0">
          <NavButton icon={HomeIcon} label="首頁" isActive={currentTab === 'home'} onClick={() => setCurrentTab('home')} />
          <NavButton icon={LayoutDashboard} label="教師" isActive={currentTab === 'teacher'} onClick={() => setCurrentTab('teacher')} />
          <NavButton icon={Bot} label="機器人" isActive={currentTab === 'robot'} onClick={() => setCurrentTab('robot')} />
          <NavButton icon={ScrollText} label="紀錄本" isActive={currentTab === 'library'} onClick={() => setCurrentTab('library')} />
          <NavButton icon={MessageSquare} label="小老師" isActive={currentTab === 'chat'} onClick={() => setCurrentTab('chat')} />
          <NavButton icon={FileQuestion} label="學習單" isActive={currentTab === 'review'} onClick={() => setCurrentTab('review')} />
        </nav>
      </div>

      {/* Web Sidebar Nav Overlay */}
      <div className="hidden md:flex fixed left-0 top-1/2 -translate-y-1/2 flex-col gap-8 ml-6 z-30">
        <div className="bg-surface-container-high/60 backdrop-blur-xl p-2 rounded-full flex flex-col gap-4 editorial-shadow border border-white/40">
          <WebNavButton icon={HomeIcon} ariaLabel="切換到首頁" isActive={currentTab === 'home'} onClick={() => setCurrentTab('home')} />
          <WebNavButton icon={LayoutDashboard} ariaLabel="切換到教師看板" isActive={currentTab === 'teacher'} onClick={() => setCurrentTab('teacher')} />
          <WebNavButton icon={Bot} ariaLabel="切換到機器人控制" isActive={currentTab === 'robot'} onClick={() => setCurrentTab('robot')} />
          <WebNavButton icon={ScrollText} ariaLabel="切換到紀錄本" isActive={currentTab === 'library'} onClick={() => setCurrentTab('library')} />
          <WebNavButton icon={MessageSquare} ariaLabel="切換到 AI 小老師" isActive={currentTab === 'chat'} onClick={() => setCurrentTab('chat')} />
          <WebNavButton icon={FileQuestion} ariaLabel="切換到學習單" isActive={currentTab === 'review'} onClick={() => setCurrentTab('review')} />
        </div>
      </div>

      {/* Modals & Overlays */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            role="dialog"
            aria-modal="true"
            aria-label="搜尋課堂紀錄"
            className="fixed inset-0 z-50 bg-surface/95 backdrop-blur-sm px-6 py-6"
          >
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center gap-4 bg-surface-container-highest p-2 rounded-full shadow-sm border border-outline-variant/20">
                <Search className="w-6 h-6 ml-4 text-on-surface-variant" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜尋分數、自然、國語或孩子提問..."
                  className="flex-1 bg-transparent border-none outline-none text-lg py-2 text-on-surface placeholder:text-on-surface-variant/50"
                  type="text"
                />
                <button
                  onClick={() => setIsSearchOpen(false)}
                  className="w-10 h-10 bg-surface rounded-full flex items-center justify-center hover:bg-surface-container-low transition-colors"
                >
                  <X className="w-5 h-5 text-on-surface-variant" />
                </button>
              </div>

              <div className="mt-8 px-4">
                <h4 className="text-sm font-bold text-on-surface-variant tracking-widest uppercase mb-4">{searchQuery ? '搜尋結果' : '最近課堂紀錄'}</h4>
                <div className="space-y-3">
                  {searchResults.length === 0 ? (
                    <p className="text-sm text-on-surface-variant bg-surface-container p-4 rounded-2xl">找不到相符課堂紀錄。</p>
                  ) : searchResults.map(note => (
                    <button
                      key={note.id}
                      onClick={() => openNoteFromSearch(note.id)}
                      className="w-full text-left p-4 bg-surface-container hover:bg-primary-container hover:text-primary rounded-2xl transition-colors border border-outline-variant/10"
                    >
                      <span className="text-xs font-bold tracking-widest uppercase text-on-surface-variant">{note.subject}</span>
                      <span className="block text-lg font-extrabold mt-1">{note.title}</span>
                      <span className="block text-sm text-on-surface-variant mt-1 line-clamp-2">{note.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {isSettingsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-on-surface/20 backdrop-blur-sm flex items-center justify-center px-4"
            onClick={() => setIsSettingsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full flex justify-center"
            >
              <div className="w-full max-w-2xl">
                <SystemSettingsPanel onClose={() => setIsSettingsOpen(false)} />
                <RestartTourButton onClose={() => setIsSettingsOpen(false)} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <TourOverlay />
    </div>
    </TourProvider>
  );
}

function NavButton({ icon: Icon, label, isActive, onClick }: any) {
  return (
    <button
      onClick={onClick}
      aria-label={`切換到${label}`}
      className={`relative flex min-h-14 min-w-0 flex-col items-center justify-center rounded-2xl px-1.5 py-1.5 transition-all duration-300 ease-out active:scale-95 ${
        isActive ? 'bg-primary/10 text-primary' : 'text-on-surface/50 hover:bg-primary/5 hover:text-primary'
      }`}
    >
      <div className="rounded-full transition-all duration-300">
        <Icon className={`w-5 h-5 transition-all duration-300 ${isActive ? 'scale-110' : ''}`} />
      </div>
      <span className="mt-1 max-w-full truncate font-headline text-[10px] font-extrabold leading-none">{label}</span>
    </button>
  );
}

function WebNavButton({ icon: Icon, isActive, onClick, ariaLabel }: any) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel ?? '切換頁面'}
      className={`relative w-12 h-12 flex items-center justify-center rounded-full transition-transform duration-300 active:scale-90 ${
        isActive ? 'text-on-primary editorial-shadow scale-110' : 'text-on-surface/50 hover:bg-surface hover:text-primary'
      }`}
    >
      {isActive && (
        <motion.div
          layoutId="web-nav-pill"
          initial={false}
          className="absolute inset-0 bg-primary rounded-full shadow-md -z-10"
          transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
        />
      )}
      <Icon className={`w-5 h-5 z-10 transition-all duration-300 ${isActive ? 'fill-on-primary/20' : ''}`} />
    </button>
  );
}
