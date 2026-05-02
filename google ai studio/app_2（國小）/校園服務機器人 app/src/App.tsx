import React, { Suspense, useRef, useState, useEffect } from 'react';
import { useProxyHealth } from './hooks/useProxyHealth';

const AVATAR_SVG = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#1d4ed8"/><circle cx="50" cy="36" r="16" fill="#BFDBFE"/><ellipse cx="50" cy="80" rx="28" ry="22" fill="#BFDBFE"/></svg>')}`;
import { motion, AnimatePresence } from 'motion/react';
import { Bot, LayoutDashboard, GraduationCap, Truck, Building2, CheckCircle2, Download, Upload } from 'lucide-react';
import { BottomSheet } from './components/ui';
import { useAppActions, useAppState } from './state/AppStateProvider';

const DashboardView = React.lazy(() => import('./views/DashboardView').then((module) => ({default: module.DashboardView})));
const TeachView = React.lazy(() => import('./views/TeachView').then((module) => ({default: module.TeachView})));
const DeliveryView = React.lazy(() => import('./views/DeliveryView').then((module) => ({default: module.DeliveryView})));
const LifeView = React.lazy(() => import('./views/LifeView').then((module) => ({default: module.LifeView})));
const TaskScheduleView = React.lazy(() => import('./views/TaskScheduleView').then((module) => ({default: module.TaskScheduleView})));
const StudentReportView = React.lazy(() => import('./views/StudentReportView').then((module) => ({default: module.StudentReportView})));
const DeliveryTrackingView = React.lazy(() => import('./views/DeliveryTrackingView').then((module) => ({default: module.DeliveryTrackingView})));
const DispatchMapView = React.lazy(() => import('./views/DispatchMapView').then((module) => ({default: module.DispatchMapView})));

const TABS = [
  { id: 'dashboard', icon: LayoutDashboard, label: '首頁' },
  { id: 'teach', icon: GraduationCap, label: '教學' },
  { id: 'delivery', icon: Truck, label: '配送', isPrimary: true },
  { id: 'life', icon: Building2, label: '生活' },
];

function ScreenFallback({label = '載入中'}: {label?: string}) {
  return (
    <div className="grid min-h-[22rem] place-items-center rounded-[2rem] border border-outline-variant/20 bg-surface-container-low">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
        <p className="mt-4 text-sm font-black text-on-surface-variant">{label}</p>
      </div>
    </div>
  );
}

export default function App() {
  const state = useAppState();
  const actions = useAppActions();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [toastMessage, setToastMessage] = useState<{ id: number; message: string } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [subView, setSubView] = useState<{ id: string; props?: any } | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const proxyOnline = useProxyHealth();
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const showToast = (message: string) => {
    setToastMessage({ id: Date.now(), message });
  };

  const navigateTo = (id: string, props?: any) => {
    setSubView({ id, props });
  };

  const exportDemoState = () => {
    const blob = new Blob([
      JSON.stringify({ app: '校園服務機器人', exportedAt: new Date().toISOString(), state }, null, 2),
    ], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `campus-service-robot-demo-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast('展示資料已匯出');
  };

  const importDemoState = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      actions.restoreDemo(parsed.state ?? parsed);
      showToast('展示資料已匯入並完成安全修復');
      setShowSettings(false);
    } catch {
      showToast('匯入失敗，請選擇展示 JSON 檔');
    } finally {
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const goBack = () => {
    setSubView(null);
  };

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  return (
    <div className="app2-shell min-h-screen overflow-x-hidden text-on-surface md:flex md:bg-surface-container-low">
      {/* Proxy Health Banner */}
      {proxyOnline === false && !bannerDismissed && (
        <div className="fixed top-0 inset-x-0 z-50 flex items-center justify-between gap-2 bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-800">
          <span>⚠️ AI 橋接伺服器未連線（localhost:3200），智慧功能將使用本地模式</span>
          <button
            onClick={() => setBannerDismissed(true)}
            className="shrink-0 w-11 h-11 flex items-center justify-center text-amber-600 hover:text-amber-900 font-medium"
          >
            ✕
          </button>
        </div>
      )}

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            role="status"
            aria-live="polite"
            className="fixed top-20 left-1/2 bg-surface-container-lowest text-on-surface shadow-xl border border-primary/20 rounded-full px-5 py-3 flex items-center gap-3 z-[200] whitespace-nowrap"
          >
            <CheckCircle2 size={18} className="text-primary shrink-0" />
            <span className="text-sm font-bold tracking-wide">{toastMessage.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-[260px] flex-col border-r border-outline-variant/20 bg-background/95 backdrop-blur-2xl px-5 py-6 shadow-[6px_0_32px_rgba(20,31,50,0.04)]">
        <button
          onClick={() => showToast('核心系統診斷正常，展示資料已同步')}
          className="flex items-center gap-3 text-left text-primary transition-opacity hover:opacity-80"
        >
          <div className="rounded-2xl border border-primary/20 bg-primary/10 p-2">
            <Bot size={26} />
          </div>
          <div>
            <p className="font-headline text-lg font-bold tracking-tight text-on-surface">校園服務機器人</p>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Campus Command</p>
          </div>
        </button>

        <nav className="mt-10 space-y-2" aria-label="平板側邊導覽">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left font-bold transition-all ${
                  isActive
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                }`}
              >
                <Icon size={22} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-on-surface-variant">展示狀態</p>
          <p className="mt-2 text-sm font-bold">{state.tasks.filter((task) => task.status === 'in_progress').length} 個任務進行中</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-surface-container-lowest px-2 py-2">
              <p className="text-lg font-black text-primary">{state.tasks.filter((task) => task.status === 'completed').length}</p>
              <p className="text-[10px] font-bold text-on-surface-variant">已完成</p>
            </div>
            <div className="rounded-xl bg-surface-container-lowest px-2 py-2">
              <p className="text-lg font-black text-tertiary">{state.robotCommandLogs.length}</p>
              <p className="text-[10px] font-bold text-on-surface-variant">指令紀錄</p>
            </div>
          </div>
          <button
            onClick={() => {
              actions.resetDemo();
              showToast('展示資料已重置');
            }}
            className="mt-4 min-h-11 w-full rounded-xl bg-surface-container-lowest px-4 py-2 text-sm font-bold text-primary shadow-sm transition-all hover:bg-primary/10 active:scale-95"
          >
            重置展示資料
          </button>
        </div>
      </aside>

      <div className="min-h-screen w-full pb-32 md:ml-[260px] md:pb-0">
      <header className="fixed top-0 w-full z-50 bg-background/85 backdrop-blur-2xl border-b border-outline-variant/10 flex justify-between items-center gap-3 px-4 h-[72px] left-0 right-0 shadow-[0_4px_32px_rgba(0,0,0,0.02)] md:left-[260px] md:right-0 md:max-w-none md:mx-0 md:px-8">
        <button
          onClick={() => showToast('核心系統診斷正常...')}
          className="flex min-h-10 min-w-0 items-center gap-2.5 text-primary hover:opacity-80 transition-opacity"
        >
          <div className="bg-primary/10 p-1.5 rounded-xl border border-primary/20">
             <Bot size={24} />
          </div>
          <span className="min-w-0 truncate font-headline text-base font-bold tracking-tight text-on-surface sm:text-lg">
            校園服務機器人
          </span>
        </button>
        <button
          onClick={() => setShowSettings(true)}
          aria-label="開啟教職員帳號設定"
          className="w-10 h-10 rounded-full bg-surface-container-high overflow-hidden border border-outline-variant/30 hover:ring-2 hover:ring-primary/50 transition-all active:scale-95 flex items-center justify-center shadow-sm"
        >
          <img
            src={AVATAR_SVG}
            alt="User"
            className="w-full h-full object-cover"
          />
        </button>
      </header>

      {/* Dynamic Content Views */}
      <main className="mx-auto min-h-screen max-w-6xl px-4 pb-36 pt-24 sm:px-5 md:px-8 md:pb-12 md:pt-28">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <Suspense fallback={<ScreenFallback label="正在載入頁面" />}>
              {activeTab === 'dashboard' && <DashboardView showToast={showToast} navigateTo={navigateTo} />}
              {activeTab === 'teach' && <TeachView showToast={showToast} navigateTo={navigateTo} />}
              {activeTab === 'delivery' && <DeliveryView showToast={showToast} navigateTo={navigateTo} />}
              {activeTab === 'life' && <LifeView showToast={showToast} navigateTo={navigateTo} />}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Sub-Views (Full page overlays) */}
      <AnimatePresence>
        {subView && (
          <motion.div
            key={subView.id}
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%', filter: 'blur(4px)' }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            className="fixed inset-0 z-[100] bg-background overflow-y-auto scrollbar-hide shadow-2xl md:left-[260px]"
          >
            <Suspense fallback={<div className="p-5"><ScreenFallback label="正在開啟功能" /></div>}>
              {subView.id === 'task-schedule' && <TaskScheduleView goBack={goBack} showToast={showToast} {...subView.props} />}
              {subView.id === 'student-report' && <StudentReportView goBack={goBack} showToast={showToast} {...subView.props} />}
              {subView.id === 'delivery-tracking' && <DeliveryTrackingView goBack={goBack} showToast={showToast} {...subView.props} />}
              {subView.id === 'dispatch-map' && <DispatchMapView goBack={goBack} showToast={showToast} {...subView.props} />}
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full z-50 rounded-t-[2rem] border-t border-outline-variant/30 bg-background/95 backdrop-blur-3xl shadow-[0_-8px_40px_rgba(0,0,0,0.08)] left-0 right-0 pb-safe pb-4 md:hidden" aria-label="手機底部導覽">
        <div className="grid h-[82px] w-full grid-cols-4 items-end gap-1 px-2 pt-3 mx-auto">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;

            if (tab.isPrimary) {
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  aria-label={`切換到${tab.label}`}
                  className={`mx-auto flex h-[62px] w-[62px] flex-col items-center justify-center rounded-[1.5rem] p-3 -mt-8 shadow-2xl active:scale-95 transition-all duration-300 ease-out
                    ${isActive
                      ? 'bg-gradient-to-br from-primary to-primary-container text-white ring-[6px] ring-background'
                      : 'bg-surface-container-highest text-on-surface hover:bg-primary/90 hover:text-white border-[6px] border-background'
                    }`}
                >
                  <Icon size={26} strokeWidth={isActive ? 2.5 : 2} />
                  <span className="mt-0.5 max-w-full truncate text-[10px] font-bold leading-none">{tab.label}</span>
                </button>
              );
            }

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                aria-label={`切換到${tab.label}`}
                className={`flex min-w-0 flex-col items-center justify-center p-1.5 pt-1 transition-all duration-300 ease-out active:scale-90
                  ${isActive ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'}
                `}
              >
                <div className={`relative px-3 py-1.5 rounded-2xl transition-colors ${isActive ? 'bg-secondary-container' : 'bg-transparent'}`}>
                  <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className="mt-1 max-w-full truncate text-center font-label text-[10px] font-bold">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Global Settings Modal */}
      <BottomSheet isOpen={showSettings} onClose={() => setShowSettings(false)} title="教職員帳號設定">
        <div className="p-5 space-y-8 pb-8">
          <div className="flex items-center gap-6 bg-surface-container-low p-6 rounded-[2rem] border border-outline-variant/20 shadow-sm relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full pointer-events-none"></div>
             <img
               src={AVATAR_SVG}
               className="w-20 h-20 rounded-[1.25rem] object-cover ring-4 ring-background shadow-md relative z-10"
             />
             <div className="relative z-10 py-1">
                <p className="font-headline font-bold text-3xl tracking-tight">值班老師</p>
                <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.2em] mt-2 bg-surface-container-high/80 backdrop-blur-md px-3 py-1 rounded-md inline-block shadow-inner">最高權限管理員</p>
             </div>
          </div>

          <div className="space-y-4">
             <input
               ref={importInputRef}
               type="file"
               accept="application/json,.json"
               className="hidden"
               onChange={(event) => void importDemoState(event.target.files?.[0])}
             />
             <button onClick={() => { actions.setNotifications(!state.settings.notifications); showToast('系統推播設定已更新'); setShowSettings(false); }} className="w-full flex items-center justify-between text-left font-bold text-base bg-surface-container-lowest border border-outline-variant/20 hover:border-primary/30 hover:bg-surface-container-low p-5 rounded-[1.5rem] active:scale-[0.98] transition-all shadow-sm">
               <span>允許系統緊急推播</span>
               <div className={`w-10 h-6 rounded-full relative shadow-inner ${state.settings.notifications ? 'bg-primary' : 'bg-outline-variant'}`}><div className={`w-4 h-4 bg-white rounded-full absolute top-1 shadow-sm transition-all ${state.settings.notifications ? 'right-1' : 'left-1'}`}></div></div>
             </button>
             <button onClick={() => { actions.clearLocalCache(); showToast('已清除本地緩存標記'); setShowSettings(false); }} className="w-full flex items-center justify-between text-left font-bold text-base text-on-surface bg-surface-container-lowest border border-outline-variant/20 hover:border-outline-variant/50 hover:bg-surface-container-low p-5 rounded-[1.5rem] active:scale-[0.98] transition-all shadow-sm">
               <span>清除本地任務緩存</span>
             </button>
             <button onClick={() => { exportDemoState(); setShowSettings(false); }} className="w-full flex items-center justify-between text-left font-bold text-base text-on-surface bg-surface-container-lowest border border-outline-variant/20 hover:border-primary/30 hover:bg-surface-container-low p-5 rounded-[1.5rem] active:scale-[0.98] transition-all shadow-sm">
               <span>匯出展示資料</span>
               <Download size={20} className="text-primary" />
             </button>
             <button onClick={() => importInputRef.current?.click()} className="w-full flex items-center justify-between text-left font-bold text-base text-on-surface bg-surface-container-lowest border border-outline-variant/20 hover:border-primary/30 hover:bg-surface-container-low p-5 rounded-[1.5rem] active:scale-[0.98] transition-all shadow-sm">
               <span>匯入展示資料</span>
               <Upload size={20} className="text-primary" />
             </button>
             <button onClick={() => { actions.resetDemo(); showToast('展示資料已重置'); setShowSettings(false); }} className="w-full flex items-center justify-between text-left font-bold text-base text-primary bg-primary/5 border border-primary/20 hover:bg-primary/10 p-5 rounded-[1.5rem] active:scale-[0.98] transition-all shadow-sm">
               <span>重置展示資料</span>
             </button>
          </div>

          <button
            onClick={() => { showToast('帳號已安全登出'); setShowSettings(false); }}
            className="w-full py-5 mt-10 bg-error/10 hover:bg-error/20 border border-error/20 text-error font-bold rounded-[1.5rem] active:scale-95 transition-all text-sm uppercase tracking-widest"
          >
            登出系統
          </button>
        </div>
      </BottomSheet>

      </div>
    </div>
  );
}
