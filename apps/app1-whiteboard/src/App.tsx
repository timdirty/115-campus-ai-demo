import { Suspense, lazy, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Settings, Search, Home as HomeIcon, ScrollText, MessageSquare, Sparkles, X, FileQuestion, LayoutDashboard, Bot, RefreshCw } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const Home = lazy(() => import('./pages/Home'));
const Library = lazy(() => import('./pages/Library'));
const Chat = lazy(() => import('./pages/Chat'));
const Review = lazy(() => import('./pages/Review'));
const TeacherDashboard = lazy(() => import('./pages/TeacherDashboard'));
const RobotControl = lazy(() => import('./pages/RobotControl'));
import SystemSettingsPanel from './components/SystemSettingsPanel';
import {loadNotesAsync, resetWhiteboardDemoState, WhiteboardNote} from './services/notesStore';
import { TourProvider } from './components/tour/TourProvider';
import { TourOverlay } from './components/tour/TourOverlay';
import { useTour } from './components/tour/useTour';
import { IssueReporter } from './components/IssueReporter';
import {useHardwareSocket} from './hooks/useHardwareSocket';
import {HardwareStatusBanner} from './components/HardwareStatusBanner';
import {CommandFeedbackToast} from './components/CommandFeedbackToast';
import {DemoTimer} from './components/DemoTimer';
import {JudgePreflightChip} from './components/JudgePreflightChip';
import {getBridgeBase} from './services/apiClient';
import {DemoProgress, loadDemoProgress, resetDemoProgress, subscribeDemoProgress} from './services/demoProgress';

type AppTab = 'whiteboard' | 'teacher' | 'robot' | 'library' | 'chat' | 'review';

const appTabs: AppTab[] = ['whiteboard', 'teacher', 'robot', 'library', 'chat', 'review'];
const demoSteps: Array<{tab: AppTab; label: string; short: string}> = [
  {tab: 'whiteboard', label: '拍白板', short: 'AI 分析'},
  {tab: 'teacher', label: '老師確認', short: '保留 / 可擦'},
  {tab: 'robot', label: '派機器人', short: '執行任務'},
  {tab: 'library', label: '紀錄本', short: '保存證據'},
  {tab: 'chat', label: '小老師', short: '孩子提問'},
  {tab: 'review', label: '學習單', short: '課後檢核'},
];

const demoRouteCards: Array<{
  id: string;
  badge: string;
  title: string;
  line: string;
  next: string;
  tab: AppTab;
  icon: LucideIcon;
}> = [
  {
    id: 'whiteboard-photo-loop',
    badge: '主線',
    title: '白板拍照閉環',
    line: '拍白板，看 AI 建議，再讓老師派板擦機器人。',
    next: '下一步：拍白板',
    tab: 'whiteboard',
    icon: HomeIcon,
  },
  {
    id: 'lesson-note-loop',
    badge: '加分',
    title: '課堂筆記閉環',
    line: '擦白板前先保存重點，讓學生可以複習問答。',
    next: '下一步：看紀錄本',
    tab: 'library',
    icon: ScrollText,
  },
  {
    id: 'calibration-drive-loop',
    badge: '硬體',
    title: '校準 / 遙控閉環',
    line: '老師測前後左右和停止，確認真硬體路徑。',
    next: '下一步：派機器人',
    tab: 'robot',
    icon: Bot,
  },
];

function isAppTab(tab: string): tab is AppTab {
  return appTabs.includes(tab as AppTab);
}

function getInitialTab(): AppTab {
  if (typeof window === 'undefined') return 'whiteboard';
  const hash = window.location.hash.slice(1);
  return isAppTab(hash) ? hash : 'whiteboard';
}

function readWhiteboardHasContent(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(sessionStorage.getItem('app1:home:analysis') || sessionStorage.getItem('app1:home:previewImage'));
  } catch {
    return false;
  }
}

function readTeacherToolsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('teacherTools') === '1') {
      localStorage.setItem('app1:teacherTools', '1');
      return true;
    }
    return localStorage.getItem('app1:teacherTools') === '1';
  } catch {
    return false;
  }
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

function DemoRouteCards({
  currentTab,
  onNavigate,
}: {
  currentTab: AppTab;
  onNavigate: (tab: AppTab) => void;
}) {
  return (
    <section className="relative z-10 mx-auto mt-4 w-full max-w-6xl px-4 sm:px-6" data-demo-routes="app1">
      <div className="grid gap-3 md:grid-cols-3">
        {demoRouteCards.map((route) => {
          const Icon = route.icon;
          const isActive = currentTab === route.tab;
          return (
            <button
              key={route.id}
              type="button"
              onClick={() => onNavigate(route.tab)}
              className={`min-h-36 rounded-3xl border p-4 text-left shadow-sm transition active:scale-[0.99] ${
                isActive
                  ? 'border-primary bg-primary text-on-primary shadow-lg shadow-primary/15'
                  : 'border-outline-variant/20 bg-surface-container-lowest hover:border-primary/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${isActive ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
                  <Icon className="h-6 w-6" />
                </span>
                <span className="min-w-0">
                  <span className={`block text-[10px] font-black tracking-[0.2em] ${isActive ? 'text-white/70' : 'text-primary'}`}>{route.badge}</span>
                  <span className={`block text-base font-black leading-tight ${isActive ? 'text-white' : 'text-on-surface'}`}>{route.title}</span>
                </span>
              </div>
              <p className={`mt-3 text-sm font-bold leading-6 ${isActive ? 'text-white/80' : 'text-on-surface-variant'}`}>{route.line}</p>
              <p className={`mt-3 text-xs font-black ${isActive ? 'text-white' : 'text-primary'}`}>{route.next} →</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function App() {
  const [currentTab, setCurrentTab] = useState<AppTab>(() => getInitialTab());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [teacherToolsEnabled] = useState(() => readTeacherToolsEnabled());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchNotes, setSearchNotes] = useState<WhiteboardNote[]>([]);
  const [resetNonce, setResetNonce] = useState(0);
  const [whiteboardHasContent, setWhiteboardHasContent] = useState(() => readWhiteboardHasContent());
  const [demoProgress, setDemoProgress] = useState<DemoProgress>(() => loadDemoProgress());
  const [resetArmed, setResetArmed] = useState(false);
  const resetArmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => subscribeDemoProgress(setDemoProgress), []);

  useEffect(() => {
    const syncWhiteboardState = (event: Event) => {
      const detail = (event as CustomEvent<{hasContent?: boolean}>).detail;
      setWhiteboardHasContent(typeof detail?.hasContent === 'boolean' ? detail.hasContent : readWhiteboardHasContent());
    };

    syncWhiteboardState(new Event('init'));
    window.addEventListener('app1:whiteboard-state', syncWhiteboardState as EventListener);
    window.addEventListener('storage', syncWhiteboardState);
    return () => {
      window.removeEventListener('app1:whiteboard-state', syncWhiteboardState as EventListener);
      window.removeEventListener('storage', syncWhiteboardState);
    };
  }, []);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return searchNotes.slice(0, 5);
    return searchNotes.filter((note) => [
      note.title,
      note.subject,
      note.desc,
      note.content,
      note.ocrText,
      note.transcript,
      ...(note.keywords ?? []),
    ].filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [searchNotes, searchQuery]);

  const hwStatus = useHardwareSocket(getBridgeBase());

  const navigateTo = useCallback((tab: string) => {
    if (isAppTab(tab)) {
      setCurrentTab(tab);
    }
  }, []);

  // Hash-based deep-link: guide page chips can link to e.g. ./app1/#teacher
  useEffect(() => {
    const syncHashToTab = () => {
      const hash = window.location.hash.slice(1);
      if (isAppTab(hash)) setCurrentTab(hash);
    };
    syncHashToTab();
    window.addEventListener('hashchange', syncHashToTab);
    return () => window.removeEventListener('hashchange', syncHashToTab);
  }, []);

  // Keep URL hash in sync with active tab so shared URLs open correct tab
  useEffect(() => {
    history.replaceState(null, '', window.location.pathname + '#' + currentTab);
  }, [currentTab]);

  const [resetting, setResetting] = useState(false);
  const resetDemo = useCallback(async () => {
    if (resetArmTimerRef.current) {
      clearTimeout(resetArmTimerRef.current);
      resetArmTimerRef.current = null;
    }
    setResetArmed(false);
    setResetting(true);
    try {
      sessionStorage.clear();
      resetWhiteboardDemoState();
      setDemoProgress(resetDemoProgress());
      await fetch(`${getBridgeBase()}/api/ops/reset`, {method: 'POST'});
    } catch { /* offline OK — UI-only reset still useful */ }
    setSearchQuery('');
    setSearchNotes([]);
    setWhiteboardHasContent(false);
    setCurrentTab('whiteboard');
    setResetNonce((value) => value + 1);
    setResetting(false);
  }, []);

  useEffect(() => () => {
    if (resetArmTimerRef.current) clearTimeout(resetArmTimerRef.current);
  }, []);

  const requestResetDemo = useCallback(() => {
    if (resetting) return;
    if (!resetArmed) {
      setResetArmed(true);
      if (resetArmTimerRef.current) clearTimeout(resetArmTimerRef.current);
      resetArmTimerRef.current = setTimeout(() => {
        setResetArmed(false);
        resetArmTimerRef.current = null;
      }, 4000);
      return;
    }
    void resetDemo();
  }, [resetArmed, resetDemo, resetting]);

  const openNoteFromSearch = useCallback((noteId: number) => {
    localStorage.setItem('whiteboard-notes:selected-id', String(noteId));
    setIsSearchOpen(false);
    setCurrentTab('library');
  }, []);

  const getPage = () => {
    switch (currentTab) {
      case 'whiteboard': return <Home key={`whiteboard-${resetNonce}`} onNavigate={navigateTo} />;
      case 'teacher': return <TeacherDashboard key={`teacher-${resetNonce}`} onNavigate={navigateTo} />;
      case 'robot': return <RobotControl key={`robot-${resetNonce}`} />;
      case 'library': return <Library key={`library-${resetNonce}`} onNavigate={navigateTo} />;
      case 'chat': return <Chat key={`chat-${resetNonce}`} onNavigate={navigateTo} />;
      case 'review': return <Review key={`review-${resetNonce}`} onNavigate={navigateTo} />;
    }
  };

  return (
    <TourProvider onTabChange={navigateTo}>
    <div className="app1-shell flex flex-col min-h-screen relative overflow-x-hidden bg-surface">
      <HardwareStatusBanner status={hwStatus} />
      <CommandFeedbackToast lastCommandAck={hwStatus.lastCommandAck} />
      <JudgePreflightChip className="fixed right-3 top-16 z-40 sm:right-4" />
      <div className="noise-overlay" />
      {/* TopAppBar */}
      <header className="sticky top-0 w-full z-30 flex items-center justify-between px-4 sm:px-6 py-2.5 sm:py-4 bg-surface/90 backdrop-blur-xl transition-all border-b border-outline-variant/10">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2 sm:gap-3 cursor-pointer"
          onClick={() => setCurrentTab('whiteboard')}
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
            onClick={requestResetDemo}
            aria-label={resetArmed ? '再次按下重置展示資料' : '準備重置展示資料'}
            data-demo-reset-button="true"
            disabled={resetting}
            title={resetArmed ? '再按一次才會重置' : '防誤觸：需連按兩次才會重置'}
            className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors active:scale-95 group disabled:opacity-50 ${
              resetArmed ? 'bg-tertiary-container text-tertiary' : 'hover:bg-[#eae8dd]'
            }`}
          >
            <RefreshCw className={`${resetArmed ? 'text-tertiary' : 'text-on-surface/70 group-hover:text-primary'} w-5 h-5 ${resetting ? 'animate-spin' : ''}`} />
          </button>

          {teacherToolsEnabled && (
            <button
              onClick={() => setIsSettingsOpen(true)}
              aria-label="開啟老師設定"
              data-teacher-tool="settings-button"
              className="w-10 h-10 flex items-center justify-center hover:bg-[#eae8dd] rounded-full transition-colors active:scale-95 group"
            >
              <Settings className="text-on-surface/70 group-hover:text-primary w-5 h-5" />
            </button>
          )}
        </motion.div>
      </header>

      <AnimatePresence>
        {resetArmed && (
          <motion.div
            initial={{opacity: 0, y: -8}}
            animate={{opacity: 1, y: 0}}
            exit={{opacity: 0, y: -8}}
            role="status"
            className="relative z-30 border-b border-tertiary/20 bg-tertiary-container px-4 py-2 text-center text-xs font-black text-tertiary"
          >
            再按一次重置，才會清空展示資料
          </motion.div>
        )}
      </AnimatePresence>

      <DemoFlowRail currentTab={currentTab} whiteboardHasContent={whiteboardHasContent} demoProgress={demoProgress} onNavigate={setCurrentTab} />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col w-full relative pb-44 md:pb-10">
        <Suspense fallback={<div className="flex-1 flex items-center justify-center p-10 text-on-surface-variant text-sm font-bold">載入中…</div>}>
          <AnimatePresence mode="wait" initial={false}>
            {getPage()}
          </AnimatePresence>
        </Suspense>
      </main>

      {/* Mobile NavBar - Floating Pill */}
      <div className="md:hidden fixed bottom-3 left-3 right-3 z-100 flex justify-center pointer-events-none">
        <nav className="w-full max-w-[27rem] grid grid-cols-3 gap-1.5 p-2 glass-pill rounded-[1.75rem] pointer-events-auto shrink-0">
          <NavButton icon={HomeIcon} label="白板" isActive={currentTab === 'whiteboard'} onClick={() => setCurrentTab('whiteboard')} />
          <NavButton icon={LayoutDashboard} label="教師" isActive={currentTab === 'teacher'} onClick={() => setCurrentTab('teacher')} />
          <NavButton icon={Bot} label="機器人" isActive={currentTab === 'robot'} onClick={() => setCurrentTab('robot')} />
          <NavButton icon={ScrollText} label="紀錄本" isActive={currentTab === 'library'} onClick={() => setCurrentTab('library')} />
          <NavButton icon={MessageSquare} label="小老師" isActive={currentTab === 'chat'} onClick={() => setCurrentTab('chat')} />
          <NavButton icon={FileQuestion} label="學習單" isActive={currentTab === 'review'} onClick={() => setCurrentTab('review')} />
        </nav>
      </div>

      {/* Web Sidebar Nav */}
      <div className="hidden md:flex fixed left-0 top-1/2 -translate-y-1/2 flex-col ml-3 z-30" data-demo-side-nav="true">
        <div className="bg-surface-container-high/80 backdrop-blur-xl p-2 rounded-3xl flex flex-col gap-0.5 editorial-shadow border border-white/40 w-[4.25rem]">
          <WebNavButton icon={HomeIcon} label="白板" isActive={currentTab === 'whiteboard'} onClick={() => setCurrentTab('whiteboard')} />
          <WebNavButton icon={LayoutDashboard} label="教師" isActive={currentTab === 'teacher'} onClick={() => setCurrentTab('teacher')} />
          <WebNavButton icon={Bot} label="機器人" isActive={currentTab === 'robot'} onClick={() => setCurrentTab('robot')} />
          <WebNavButton icon={ScrollText} label="紀錄本" isActive={currentTab === 'library'} onClick={() => setCurrentTab('library')} />
          <WebNavButton icon={MessageSquare} label="小老師" isActive={currentTab === 'chat'} onClick={() => setCurrentTab('chat')} />
          <WebNavButton icon={FileQuestion} label="學習單" isActive={currentTab === 'review'} onClick={() => setCurrentTab('review')} />
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
      {teacherToolsEnabled && <IssueReporter storageKey="issues-app1:v1" accentColor="#6366f1" />}
      <DemoTimer />
    </div>
    </TourProvider>
  );
}

function DemoFlowRail({
  currentTab,
  whiteboardHasContent,
  demoProgress,
  onNavigate,
}: {
  currentTab: AppTab;
  whiteboardHasContent: boolean;
  demoProgress: DemoProgress;
  onNavigate: (tab: AppTab) => void;
}) {
  const currentIndex = demoSteps.findIndex((step) => step.tab === currentTab);
  const safeIndex = Math.max(0, currentIndex);
  const completedCount = demoSteps.filter((step) => demoProgress[step.tab]).length;
  const allDone = completedCount === demoSteps.length;
  const nextStep = allDone ? demoSteps[3] : demoSteps[(safeIndex + 1) % demoSteps.length];
  const currentDone = demoProgress[currentTab];
  const shouldRunWhiteboardDemo = currentTab === 'whiteboard' && !whiteboardHasContent;
  const primaryActionByTab: Record<AppTab, string> = {
    whiteboard: '一鍵示範',
    teacher: '送可擦區',
    robot: '清空可擦區',
    library: '問小老師',
    chat: '改成孩子聽得懂',
    review: '開始生成',
  };
  const actionLabel = shouldRunWhiteboardDemo
    ? '按：一鍵示範'
    : !currentDone
      ? `按：${primaryActionByTab[currentTab]}`
      : allDone
        ? '回紀錄本收尾'
        : currentTab === 'whiteboard'
        ? '到教師看板'
        : `下一步：${nextStep.label}`;
  const runCurrentPagePrimary = () => {
    const button = document.querySelector<HTMLButtonElement>(`button[data-demo-primary="${currentTab}"]:not(:disabled)`);
    if (!button) return false;
    button.click();
    return true;
  };
  const handlePrimaryAction = () => {
    if (shouldRunWhiteboardDemo || !currentDone) {
      let ran = false;
      const runWhenReady = () => {
        if (ran) return;
        if (runCurrentPagePrimary()) {
          ran = true;
          return;
        }
        if (currentTab === 'whiteboard') {
          window.dispatchEvent(new Event('app1:run-demo-sample'));
          ran = true;
        }
      };
      runWhenReady();
      const retryTimer = window.setInterval(runWhenReady, 200);
      window.setTimeout(() => window.clearInterval(retryTimer), 4000);
      return;
    }
    if (allDone) {
      onNavigate('library');
      return;
    }
    onNavigate(nextStep.tab);
  };

  return (
    <section className="relative z-20 border-b border-outline-variant/10 bg-surface-container-lowest/90 px-3 py-2.5 backdrop-blur-xl" data-tour="demo-flow">
      <div className="mx-auto flex max-w-7xl items-center gap-2 md:pl-32">
        <div className="hidden flex-1 items-center gap-1.5 overflow-x-auto md:flex">
          {demoSteps.map((step, index) => {
            const active = step.tab === currentTab;
            const done = demoProgress[step.tab];
            return (
              <button
                key={step.tab}
                type="button"
                onClick={() => onNavigate(step.tab)}
                className={`flex min-h-11 min-w-[8.25rem] items-center gap-2 rounded-md border px-3 text-left transition-colors ${
                  active
                    ? 'border-primary bg-primary text-on-primary'
                    : done
                      ? 'border-primary/20 bg-primary-container/50 text-primary hover:bg-primary-container'
                      : 'border-outline-variant/20 bg-surface text-on-surface-variant hover:border-primary/30 hover:text-primary'
                }`}
              >
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${
                  active ? 'bg-on-primary/20 text-on-primary' : done ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
                }`}>
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-black">{step.label}</span>
                  <span className="block truncate text-[10px] font-bold opacity-80">{step.short}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="min-w-0 flex-1 md:hidden">
          <p className="truncate text-[10px] font-black text-primary">完成進度 {completedCount} / {demoSteps.length}</p>
          <p className="truncate text-sm font-extrabold">{demoSteps[safeIndex]?.label ?? '拍白板'} · {demoSteps[safeIndex]?.short ?? 'AI 分析'}</p>
        </div>

        <button
          type="button"
          onClick={handlePrimaryAction}
          data-demo-flow-primary="true"
          className="min-h-10 shrink-0 rounded-md bg-primary px-3 text-xs font-black text-on-primary transition-all hover:bg-primary-dim active:scale-95"
        >
          {actionLabel}
        </button>
      </div>
    </section>
  );
}

function NavButton({ icon: Icon, label, isActive, onClick }: {icon: LucideIcon; label: string; isActive: boolean; onClick: () => void}) {
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

function WebNavButton({ icon: Icon, label, isActive, onClick }: { icon: React.ComponentType<{className?: string}>; label: string; isActive: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={`切換到${label}`}
      title={`切換到${label}`}
      className={`relative flex min-h-11 w-full items-center justify-center rounded-2xl px-2 py-2.5 transition-all duration-200 active:scale-95 ${
        isActive ? 'text-on-primary shadow-md' : 'text-on-surface/60 hover:bg-surface/80 hover:text-primary'
      }`}
    >
      {isActive && (
        <motion.div
          layoutId="web-nav-pill"
          initial={false}
          className="absolute inset-0 bg-primary rounded-2xl -z-10"
          transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
        />
      )}
      <Icon className="w-4.5 h-4.5 z-10 shrink-0" />
      <span className="sr-only">{label}</span>
    </button>
  );
}
