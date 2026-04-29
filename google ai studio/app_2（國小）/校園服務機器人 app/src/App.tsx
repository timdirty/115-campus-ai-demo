import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, LayoutDashboard, GraduationCap, Truck, Building2, CheckCircle2, Download, Upload } from 'lucide-react';
import { DashboardView } from './views/DashboardView';
import { TeachView } from './views/TeachView';
import { DeliveryView } from './views/DeliveryView';
import { LifeView } from './views/LifeView';
import { BottomSheet } from './components/ui';

import { TaskScheduleView } from './views/TaskScheduleView';
import { StudentReportView } from './views/StudentReportView';
import { DeliveryTrackingView } from './views/DeliveryTrackingView';
import { DispatchMapView } from './views/DispatchMapView';
import { useAppActions, useAppState } from './state/AppStateProvider';

const TABS = [
  { id: 'dashboard', icon: LayoutDashboard, label: '首頁' },
  { id: 'teach', icon: GraduationCap, label: '教學' },
  { id: 'delivery', icon: Truck, label: '配送', isPrimary: true },
  { id: 'life', icon: Building2, label: '生活' },
];

export default function App() {
  const state = useAppState();
  const actions = useAppActions();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [toastMessage, setToastMessage] = useState<{ id: number; message: string } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [subView, setSubView] = useState<{ id: string; props?: any } | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

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
    <div className="min-h-screen overflow-x-hidden text-on-surface md:flex md:bg-surface-container-low">
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
      <header className="fixed top-0 w-full z-50 bg-background/85 backdrop-blur-2xl border-b border-outline-variant/10 flex justify-between items-center px-5 h-[72px] max-w-md mx-auto left-0 right-0 shadow-[0_4px_32px_rgba(0,0,0,0.02)] md:left-[260px] md:right-0 md:max-w-none md:mx-0 md:px-8">
        <button
          onClick={() => showToast('核心系統診斷正常...')}
          className="flex items-center gap-2.5 text-primary hover:opacity-80 transition-opacity"
        >
          <div className="bg-primary/10 p-1.5 rounded-xl border border-primary/20">
             <Bot size={24} />
          </div>
          <span className="font-headline font-bold text-lg tracking-tight text-on-surface">
            校園服務機器人
          </span>
        </button>
        <button
          onClick={() => setShowSettings(true)}
          aria-label="開啟教職員帳號設定"
          className="w-10 h-10 rounded-full bg-surface-container-high overflow-hidden border border-outline-variant/30 hover:ring-2 hover:ring-primary/50 transition-all active:scale-95 flex items-center justify-center shadow-sm"
        >
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAFLMrOzzbl7TlA_AexPyf4-a6MT831xM_82rT_JMRsXBAO2ji7mPHgRTPaZKEaYEypzYv1NiVRmn6l9_W3dF9L9Z6lZ6CRhUkGXUxx6jYEHZKAEviNdoCkGrdM-CNtBwzrEfYQApLCJt8FU9k401DnXsJRJjiAp_xWa19RIT5RvGzj6E0fS6t5-mR8VNsumbJ7EOR8KiuLYabHo5Qyo5yoMP8AIa6xeXtxoSGOZfRa91jFXR4QP92FRGsfo6PewP_UzCF4YwNSVEQ"
            alt="User"
            className="w-full h-full object-cover"
          />
        </button>
      </header>

      {/* Dynamic Content Views */}
      <main className="pt-28 pb-36 px-5 max-w-md mx-auto min-h-screen md:max-w-6xl md:px-8 md:pb-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            {activeTab === 'dashboard' && <DashboardView showToast={showToast} navigateTo={navigateTo} />}
            {activeTab === 'teach' && <TeachView showToast={showToast} navigateTo={navigateTo} />}
            {activeTab === 'delivery' && <DeliveryView showToast={showToast} navigateTo={navigateTo} />}
            {activeTab === 'life' && <LifeView showToast={showToast} navigateTo={navigateTo} />}
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
            className="fixed inset-0 z-[100] bg-background overflow-y-auto scrollbar-hide max-w-md mx-auto shadow-2xl md:left-[260px] md:max-w-none"
          >
            {subView.id === 'task-schedule' && <TaskScheduleView goBack={goBack} showToast={showToast} {...subView.props} />}
            {subView.id === 'student-report' && <StudentReportView goBack={goBack} showToast={showToast} {...subView.props} />}
            {subView.id === 'delivery-tracking' && <DeliveryTrackingView goBack={goBack} showToast={showToast} {...subView.props} />}
            {subView.id === 'dispatch-map' && <DispatchMapView goBack={goBack} showToast={showToast} {...subView.props} />}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full z-50 rounded-t-[2rem] border-t border-outline-variant/30 bg-background/95 backdrop-blur-3xl shadow-[0_-8px_40px_rgba(0,0,0,0.08)] left-0 right-0 pb-safe pb-4 md:hidden" aria-label="手機底部導覽">
        <div className="flex justify-around items-end pt-3 px-5 w-full max-w-md mx-auto h-[76px]">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;

            if (tab.isPrimary) {
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  aria-label={`切換到${tab.label}`}
                  className={`flex flex-col items-center justify-center rounded-[1.5rem] p-3 w-[64px] h-[64px] -mt-8 shadow-2xl active:scale-95 transition-all duration-300 ease-out
                    ${isActive
                      ? 'bg-gradient-to-br from-primary to-primary-container text-white ring-[6px] ring-background'
                      : 'bg-surface-container-highest text-on-surface hover:bg-primary/90 hover:text-white border-[6px] border-background'
                    }`}
                >
                  <Icon size={26} strokeWidth={isActive ? 2.5 : 2} />
                </button>
              );
            }

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                aria-label={`切換到${tab.label}`}
                className={`flex flex-col items-center justify-center p-2 pt-1 transition-all duration-300 ease-out active:scale-90
                  ${isActive ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'}
                `}
              >
                <div className={`relative px-4 py-1.5 rounded-2xl transition-colors ${isActive ? 'bg-secondary-container' : 'bg-transparent'}`}>
                  <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className="font-label font-bold text-[10px] uppercase tracking-wider mt-1 text-center">
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
               src="https://lh3.googleusercontent.com/aida-public/AB6AXuAFLMrOzzbl7TlA_AexPyf4-a6MT831xM_82rT_JMRsXBAO2ji7mPHgRTPaZKEaYEypzYv1NiVRmn6l9_W3dF9L9Z6lZ6CRhUkGXUxx6jYEHZKAEviNdoCkGrdM-CNtBwzrEfYQApLCJt8FU9k401DnXsJRJjiAp_xWa19RIT5RvGzj6E0fS6t5-mR8VNsumbJ7EOR8KiuLYabHo5Qyo5yoMP8AIa6xeXtxoSGOZfRa91jFXR4QP92FRGsfo6PewP_UzCF4YwNSVEQ"
               className="w-20 h-20 rounded-[1.25rem] object-cover ring-4 ring-background shadow-md relative z-10"
             />
             <div className="relative z-10 py-1">
                <p className="font-headline font-bold text-3xl tracking-tight">李老師</p>
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
