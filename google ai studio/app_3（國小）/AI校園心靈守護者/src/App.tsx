import {useEffect, useMemo, useReducer, useRef, useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {
  Activity,
  Bell,
  CheckCircle2,
  Download,
  HeartHandshake,
  Leaf,
  Lock,
  MapPin,
  MessageSquare,
  Radio,
  RefreshCw,
  Send,
  ShieldCheck,
  Smile,
  Upload,
  Users,
  Wifi,
} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';
import {GuardianAlert, MoodType, ViewType} from './types';
import {
  guardianReducer,
  loadGuardianState,
  normalizeGuardianState,
  persistGuardianState,
} from './state/guardianState';
import {generateSupportReply, summarizeGuardianState} from './services/localGuardianAi';
import {sendGuardianHardwareCommand} from './services/hardwareBridge';
import {AlertDetail, AlertRow, GuardianDemoPanel, MetricCard, NodeRow, TabButton} from './components/guardianUi';

const moodOptions: Array<{mood: MoodType; label: string; note: string; tone: string}> = [
  {mood: 'happy', label: '開心', note: '今天有一點亮亮的事', tone: 'bg-emerald-50 text-emerald-700 border-emerald-100'},
  {mood: 'steady', label: '還可以', note: '狀態普通，能慢慢做', tone: 'bg-sky-50 text-sky-700 border-sky-100'},
  {mood: 'tired', label: '有點累', note: '需要短暫休息一下', tone: 'bg-amber-50 text-amber-700 border-amber-100'},
  {mood: 'worried', label: '有點擔心', note: '想找人一起想辦法', tone: 'bg-rose-50 text-rose-700 border-rose-100'},
];

const tabs: Array<{id: ViewType; label: string; icon: LucideIcon}> = [
  {id: 'dashboard', label: '總覽', icon: Activity},
  {id: 'alerts', label: '預警', icon: Bell},
  {id: 'self-care', label: '照護', icon: Leaf},
  {id: 'nodes', label: '節點', icon: Radio},
];

export default function App() {
  const [state, dispatch] = useReducer(guardianReducer, undefined, loadGuardianState);
  const [activeTab, setActiveTab] = useState<ViewType>('dashboard');
  const [summary, setSummary] = useState('正在整理校園關懷摘要...');
  const [selectedAlert, setSelectedAlert] = useState<GuardianAlert | null>(null);
  const [selectedMood, setSelectedMood] = useState<MoodType>('steady');
  const [message, setMessage] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postType, setPostType] = useState<'thought' | 'gratitude' | 'support'>('support');
  const [chatBusy, setChatBusy] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    persistGuardianState(state);
    summarizeGuardianState(state).then(setSummary);
  }, [state]);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const showToast = (message: string) => setToastMessage(message);

  const sendHardwareCue = (command: string, source: string) => {
    void sendGuardianHardwareCommand(command, source).then((result) => {
      dispatch({
        type: 'RECORD_HARDWARE_EVENT',
        payload: {
          command,
          source,
          status: result.ok ? 'sent' : 'fallback',
          message: result.message,
        },
      });
      showToast(result.ok ? `Arduino 已接收：${command}` : `Arduino fallback：${result.message}`);
    });
  };

  const openAlerts = useMemo(() => state.alerts.filter((alert) => alert.status !== 'resolved'), [state.alerts]);
  const highPriority = useMemo(() => openAlerts.filter((alert) => alert.riskLevel === 'high'), [openAlerts]);
  const latestMood = state.moodLogs[0];

  const handleMood = (mood: MoodType) => {
    const option = moodOptions.find((item) => item.mood === mood) ?? moodOptions[1];
    setSelectedMood(mood);
    dispatch({type: 'ADD_MOOD', payload: {mood, label: option.label, note: option.note}});
  };

  const sendMessage = async () => {
    const text = message.trim();
    if (!text || chatBusy) return;
    setMessage('');
    dispatch({type: 'ADD_SUPPORT_MESSAGE', payload: {role: 'student', content: text}});
    setChatBusy(true);
    const reply = await generateSupportReply(text, selectedMood);
    dispatch({type: 'ADD_SUPPORT_MESSAGE', payload: {role: 'guardian', content: reply}});
    setChatBusy(false);
  };

  const addPost = () => {
    const content = postContent.trim();
    if (!content) return;
    dispatch({type: 'ADD_FOREST_POST', payload: {content, type: postType}});
    setPostContent('');
    showToast('匿名支持已加入心靈森林');
  };

  const exportDemoData = () => {
    const blob = new Blob([JSON.stringify({app: 'AI 校園心靈守護者', exportedAt: new Date().toISOString(), state}, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `mindful-guardian-demo-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast('展示資料已匯出');
  };

  const importDemoData = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      dispatch({type: 'RESTORE_DEMO_STATE', payload: {state: normalizeGuardianState(parsed.state ?? parsed)}});
      showToast('展示資料已匯入並完成匿名安全修復');
    } catch {
      showToast('匯入失敗，請選擇展示 JSON 檔');
    } finally {
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  return (
    <div className="guardian-shell min-h-screen overflow-x-hidden bg-[#f7faf8] text-slate-900">
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{opacity: 0, y: -16, x: '-50%'}}
            animate={{opacity: 1, y: 0, x: '-50%'}}
            exit={{opacity: 0, y: -16, x: '-50%'}}
            role="status"
            aria-live="polite"
            className="fixed left-1/2 top-20 z-[100] flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-2xl border border-teal-100 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-xl"
          >
            <CheckCircle2 className="h-5 w-5 shrink-0 text-teal-600" />
            <span className="truncate">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/90 px-3 py-3 backdrop-blur-xl sm:px-4">
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => void importDemoData(event.target.files?.[0])}
        />
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <button onClick={() => setActiveTab('dashboard')} className="flex min-w-0 items-center gap-3 text-left">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-sm sm:h-11 sm:w-11">
              <HeartHandshake className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-black tracking-tight sm:text-2xl">AI 校園心靈守護者</h1>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Local Care Demo</p>
            </div>
          </button>
          <div className="grid min-w-0 w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:shrink-0 sm:items-center">
            <button
              onClick={() => {
                dispatch({type: 'TOGGLE_PRIVACY'});
                showToast(state.privacyMode ? '已切換為完整欄位展示' : '已切換為匿名展示');
              }}
              className="hidden min-h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-600 shadow-sm sm:flex"
            >
              <Lock className="h-4 w-4 text-teal-600" />
              {state.privacyMode ? '匿名展示' : '完整展示'}
            </button>
            <button
              onClick={exportDemoData}
              aria-label="匯出展示資料"
              className="flex h-10 min-h-10 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-xs font-extrabold text-slate-600 shadow-sm sm:w-auto sm:gap-2 sm:px-3"
            >
              <Download className="h-4 w-4 text-teal-600" />
              <span className="text-xs sm:inline">匯出</span>
            </button>
            <button
              onClick={() => importInputRef.current?.click()}
              aria-label="匯入展示資料"
              className="flex h-10 min-h-10 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-xs font-extrabold text-slate-600 shadow-sm sm:w-auto sm:gap-2 sm:px-3"
            >
              <Upload className="h-4 w-4 text-teal-600" />
              <span className="text-xs sm:inline">匯入</span>
            </button>
            <button
              onClick={() => {
                dispatch({type: 'RESET_DEMO'});
                showToast('展示資料已重置');
              }}
              className="flex min-w-0 min-h-10 items-center justify-center gap-1.5 overflow-hidden rounded-2xl bg-slate-900 px-2 text-xs font-extrabold text-white shadow-sm active:scale-95 sm:gap-2 sm:px-3"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="truncate">重設</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 py-4 pb-28 sm:px-4 sm:py-6 md:pb-10">
        <GuardianDemoPanel
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          openAlertsCount={openAlerts.length}
          offlineNodesCount={state.nodes.filter((node) => node.status === 'offline').length}
          privacyMode={state.privacyMode}
        />

        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div key="dashboard" initial={{opacity: 0, y: 12}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: -10}} className="space-y-6">
              <section className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
                <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-teal-700">校園情緒總覽</p>
                      <h2 className="mt-3 text-4xl font-black tracking-tight sm:text-6xl">{state.stabilityScore}%</h2>
                      <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-slate-600">{summary}</p>
                    </div>
                    <div className="rounded-3xl bg-teal-50 p-4 text-teal-800">
                      <ShieldCheck className="h-8 w-8" />
                      <p className="mt-4 text-xs font-black uppercase tracking-[0.18em]">隱私保護</p>
                      <p className="mt-1 text-sm font-bold">{state.privacyMode ? '已隱藏姓名' : '展示完整欄位'}</p>
                    </div>
                  </div>
                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <MetricCard label="待關懷提醒" value={openAlerts.length.toString()} tone="text-rose-600" />
                    <MetricCard label="高優先處理" value={highPriority.length.toString()} tone="text-amber-600" />
                    <MetricCard label="教師支持指數" value={`${state.teacherWellbeingScore}%`} tone="text-sky-700" />
                  </div>
                </div>

                <div className="rounded-[2rem] border border-slate-200 bg-slate-900 p-6 text-white shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.22em] text-teal-200">智組型節點</p>
                      <h3 className="mt-2 text-2xl font-black">現場處理中</h3>
                    </div>
                    <Wifi className="h-8 w-8 text-teal-200" />
                  </div>
                  <div className="mt-6 space-y-3">
                    {state.nodes.slice(0, 3).map((node) => (
                      <button key={node.id} onClick={() => setActiveTab('nodes')} className="flex w-full items-center justify-between rounded-2xl bg-white/10 px-4 py-3 text-left">
                        <span>
                          <span className="block text-sm font-extrabold">{node.name}</span>
                          <span className="text-xs text-white/55">{node.location}</span>
                        </span>
                        <span className={`h-3 w-3 rounded-full ${node.status === 'online' ? 'bg-emerald-400' : node.status === 'attention' ? 'bg-amber-300' : 'bg-rose-400'}`} />
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="grid gap-4 lg:grid-cols-4">
                <div className="lg:col-span-2 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-xl font-black">即時關懷提醒</h3>
                    <button onClick={() => {
                      dispatch({type: 'DEPLOY_INTERVENTION', payload: {area: '全校'}});
                      sendHardwareCue('CARE_DEPLOYED', 'app3:dashboard');
                    }} className="min-h-11 rounded-2xl bg-teal-600 px-4 py-2 text-sm font-extrabold text-white active:scale-95">
                      佈署關懷
                    </button>
                  </div>
                  <div className="mt-5 grid gap-3">
                    {state.alerts.slice(0, 3).map((alert) => (
                      <AlertRow key={alert.id} alert={alert} onOpen={() => setSelectedAlert(alert)} />
                    ))}
                  </div>
                </div>

                <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-xl font-black">硬體提示紀錄</h3>
                  <div className="mt-5 space-y-3">
                    {state.hardwareEvents.slice(0, 3).map((event) => (
                      <div key={event.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-sm font-black">{event.command}</p>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${event.status === 'sent' ? 'bg-teal-600 text-white' : 'bg-amber-100 text-amber-800'}`}>
                            {event.status === 'sent' ? '已送' : 'Fallback'}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs font-semibold text-slate-500">{event.source} · {event.createdAt}</p>
                        <p className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">{event.message}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <h3 className="text-xl font-black">進行中的支持</h3>
                  <div className="mt-5 space-y-3">
                    {state.interventions.slice(0, 3).map((item) => (
                      <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                        <p className="text-sm font-black">{item.title}</p>
                        <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{item.description}</p>
                        <p className="mt-3 text-[10px] font-black uppercase tracking-[0.16em] text-teal-700">{item.area} · {item.updatedAt}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </motion.div>
          )}

          {activeTab === 'alerts' && (
            <motion.div key="alerts" initial={{opacity: 0, y: 12}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: -10}} className="grid gap-4 lg:grid-cols-[.9fr_1.1fr]">
              <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-2xl font-black">預警中心</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">所有內容都是示範資料，只用代號呈現學生狀態。</p>
                <div className="mt-5 space-y-3">
                  {state.alerts.map((alert) => (
                    <AlertRow key={alert.id} alert={alert} onOpen={() => setSelectedAlert(alert)} />
                  ))}
                </div>
              </section>

              <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-2xl font-black">處置建議</h2>
                {selectedAlert ? (
                  <AlertDetail alert={selectedAlert} dispatch={dispatch} onHardwareCommand={(command, source) => sendHardwareCue(command, `app3:${source}`)} />
                ) : (
                  <div className="mt-8 flex min-h-[24rem] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 text-center text-sm font-bold text-slate-400">
                    選擇左側提醒後查看建議流程
                  </div>
                )}
              </section>
            </motion.div>
          )}

          {activeTab === 'self-care' && (
            <motion.div key="care" initial={{opacity: 0, y: 12}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: -10}} className="grid gap-4 lg:grid-cols-[.85fr_1.15fr]">
              <section className="space-y-4">
                <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-2xl font-black">心情簽到</h2>
                  <p className="mt-2 text-sm font-semibold text-slate-500">最近一次：{latestMood?.label ?? '尚未簽到'} · {latestMood?.createdAt ?? '今天'}</p>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    {moodOptions.map((item) => (
                      <button key={item.mood} onClick={() => handleMood(item.mood)} className={`min-h-24 rounded-3xl border p-4 text-left transition active:scale-95 ${selectedMood === item.mood ? item.tone : 'border-slate-100 bg-slate-50 text-slate-600'}`}>
                        <Smile className="h-6 w-6" />
                        <span className="mt-3 block text-lg font-black">{item.label}</span>
                        <span className="mt-1 block text-xs font-semibold leading-5 opacity-75">{item.note}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="text-2xl font-black">心靈森林</h2>
                  <div className="mt-4 flex gap-2">
                    {(['support', 'gratitude', 'thought'] as const).map((type) => (
                      <button key={type} onClick={() => setPostType(type)} className={`rounded-xl px-3 py-2 text-xs font-black ${postType === type ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        {type === 'support' ? '互助' : type === 'gratitude' ? '感謝' : '想法'}
                      </button>
                    ))}
                  </div>
                  <textarea value={postContent} onChange={(event) => setPostContent(event.target.value)} className="mt-3 min-h-24 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold outline-none focus:border-teal-500" placeholder="匿名寫下一句支持自己的話..." />
                  <button onClick={addPost} className="mt-3 w-full rounded-2xl bg-slate-900 py-3 text-sm font-black text-white active:scale-95">發表葉子</button>
                  <div className="mt-5 grid gap-3">
                    {state.forestPosts.slice(0, 4).map((post) => (
                      <div key={post.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                        <p className="text-sm font-bold leading-6 text-slate-700">{post.content}</p>
                        <button onClick={() => dispatch({type: 'LIKE_FOREST_POST', payload: {id: post.id}})} className="mt-3 text-xs font-black text-teal-700">
                          送出支持 · {post.likes}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-2xl font-black">安全空間聊天</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">本機回覆只做情緒支持示範，不取代導師或輔導老師。</p>
                <div className="mt-5 flex h-[32rem] flex-col rounded-3xl border border-slate-200 bg-slate-50">
                  <div className="flex-1 space-y-3 overflow-y-auto p-4">
                    {state.supportMessages.map((item) => (
                      <div key={item.id} className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm font-semibold leading-6 ${item.role === 'student' ? 'ml-auto bg-teal-600 text-white' : 'bg-white text-slate-700 shadow-sm'}`}>
                        {item.content}
                      </div>
                    ))}
                    {chatBusy && <div className="w-fit rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-400 shadow-sm">整理回覆中...</div>}
                  </div>
                  <div className="flex gap-2 border-t border-slate-200 bg-white p-3">
                    <input value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && sendMessage()} className="min-h-12 flex-1 rounded-2xl bg-slate-100 px-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-teal-500" placeholder="輸入今天想說的心情..." />
                    <button onClick={sendMessage} disabled={chatBusy || !message.trim()} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600 text-white disabled:opacity-40">
                      <Send className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </section>
            </motion.div>
          )}

          {activeTab === 'nodes' && (
            <motion.div key="nodes" initial={{opacity: 0, y: 12}} animate={{opacity: 1, y: 0}} exit={{opacity: 0, y: -10}} className="grid gap-4 lg:grid-cols-[1fr_.9fr]">
              <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-2xl font-black">校園節點地圖</h2>
                <div className="mt-5 aspect-[4/3] rounded-[2rem] border border-teal-100 bg-teal-50 p-4">
                  <div className="relative h-full rounded-3xl bg-white">
                    {state.nodes.map((node, index) => (
                      <button
                        key={node.id}
                        onClick={() => {
                          if (node.status !== 'offline') return;
                          dispatch({type: 'RESTART_NODE', payload: {id: node.id}});
                          sendHardwareCue('NODE_RESTART', `app3:node:${node.id}`);
                        }}
                        className={`absolute flex h-16 w-24 flex-col items-center justify-center rounded-2xl border-2 text-xs font-black shadow-sm transition active:scale-95 sm:h-20 sm:w-28 ${node.status === 'online' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : node.status === 'attention' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}
                        style={{left: `${12 + (index % 2) * 48}%`, top: `${12 + Math.floor(index / 2) * 46}%`}}
                      >
                        <MapPin className="mb-1 h-5 w-5" />
                        {node.name.replace('節點', '')}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="rounded-[2rem] border border-slate-200 bg-slate-900 p-6 text-white shadow-sm">
                <h2 className="text-2xl font-black">節點狀態</h2>
                <div className="mt-5 space-y-3">
                  {state.nodes.map((node) => (
                    <NodeRow key={node.id} node={node} onRestart={() => {
                      dispatch({type: 'RESTART_NODE', payload: {id: node.id}});
                      sendHardwareCue('NODE_RESTART', `app3:node:${node.id}`);
                    }} />
                  ))}
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 px-3 py-3 backdrop-blur-xl md:hidden">
        <div className="mx-auto grid w-full grid-cols-4 gap-1.5">
          {tabs.map((tab) => (
            <TabButton key={tab.id} active={activeTab === tab.id} icon={tab.icon} label={tab.label} onClick={() => setActiveTab(tab.id)} />
          ))}
        </div>
      </nav>

      <aside className="fixed bottom-8 right-8 z-40 hidden rounded-[2rem] border border-slate-200 bg-white p-2 shadow-lg md:block">
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <TabButton key={tab.id} active={activeTab === tab.id} icon={tab.icon} label={tab.label} onClick={() => setActiveTab(tab.id)} compact />
          ))}
        </div>
      </aside>
    </div>
  );
}
