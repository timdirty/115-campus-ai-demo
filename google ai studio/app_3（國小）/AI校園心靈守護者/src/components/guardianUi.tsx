import type {Dispatch} from 'react';
import {AlertCircle, CheckCircle2, MapPin, Sparkles} from 'lucide-react';
import {GuardianAlert, GuardianNode, ViewType} from '../types';
import {recommendationForAlert} from '../services/localGuardianAi';

export function MetricCard({label, value, tone}: {label: string; value: string; tone: string}) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-black ${tone}`}>{value}</p>
    </div>
  );
}

export function AlertRow({alert, onOpen}: {key?: unknown; alert: GuardianAlert; onOpen: () => void}) {
  return (
    <button onClick={onOpen} className="flex w-full items-start justify-between gap-3 rounded-3xl border border-slate-100 bg-slate-50 p-4 text-left transition hover:border-teal-200 hover:bg-teal-50/40">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-black">{alert.studentAlias}</span>
          <RiskPill level={alert.riskLevel} />
          <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-slate-500">{alert.status === 'new' ? '新提醒' : alert.status === 'processing' ? '處理中' : '已結案'}</span>
        </div>
        <p className="mt-2 text-sm font-bold text-slate-700">{alert.type}</p>
        <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">{alert.description}</p>
      </div>
      <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.14em] text-teal-700">{alert.location}</span>
    </button>
  );
}

export function AlertDetail({alert, dispatch, onHardwareCommand}: {alert: GuardianAlert; dispatch: Dispatch<any>; onHardwareCommand?: (command: string, source: string) => void}) {
  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-3xl bg-slate-50 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xl font-black">{alert.studentAlias}</h3>
          <RiskPill level={alert.riskLevel} />
        </div>
        <p className="mt-2 text-sm font-bold text-slate-500">{alert.className} · {alert.location} · {alert.time}</p>
        <p className="mt-4 text-sm font-semibold leading-7 text-slate-700">{alert.description}</p>
      </div>

      <div className="rounded-3xl border border-teal-100 bg-teal-50 p-5">
        <div className="flex items-center gap-2 text-teal-800">
          <Sparkles className="h-5 w-5" />
          <p className="font-black">AI 關懷建議</p>
        </div>
        <p className="mt-3 text-sm font-semibold leading-7 text-teal-900">{recommendationForAlert(alert)}</p>
      </div>

      <div className="space-y-2">
        {alert.checklist.map((item) => (
          <button key={item.id} onClick={() => dispatch({type: 'TOGGLE_CHECKLIST', payload: {alertId: alert.id, itemId: item.id}})} className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left text-sm font-bold ${item.completed ? 'border-emerald-100 bg-emerald-50 text-emerald-800' : 'border-slate-100 bg-white text-slate-700'}`}>
            {item.completed ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5 text-slate-400" />}
            {item.text}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <button onClick={() => {
          dispatch({type: 'UPDATE_ALERT_STATUS', payload: {id: alert.id, status: 'processing'}});
          onHardwareCommand?.('ALERT_SIGNAL', `alert:${alert.id}`);
        }} className="rounded-2xl bg-amber-100 px-4 py-3 text-sm font-black text-amber-800">處理中</button>
        <button onClick={() => {
          dispatch({type: 'DEPLOY_INTERVENTION', payload: {area: alert.location}});
          onHardwareCommand?.('CARE_DEPLOYED', `care:${alert.id}`);
        }} className="rounded-2xl bg-teal-600 px-4 py-3 text-sm font-black text-white">佈署關懷</button>
        <button onClick={() => dispatch({type: 'UPDATE_ALERT_STATUS', payload: {id: alert.id, status: 'resolved'}})} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white">標記結案</button>
      </div>
    </div>
  );
}

export function NodeRow({node, onRestart}: {key?: unknown; node: GuardianNode; onRestart: () => void}) {
  return (
    <div className="rounded-3xl bg-white/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-black">{node.name}</p>
          <p className="mt-1 text-xs font-semibold text-white/55">{node.location}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-[10px] font-black ${node.status === 'online' ? 'bg-emerald-400 text-emerald-950' : node.status === 'attention' ? 'bg-amber-300 text-amber-950' : 'bg-rose-400 text-rose-950'}`}>
          {node.status === 'online' ? '正常' : node.status === 'attention' ? '注意' : '離線'}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <NodeMetric label="延遲" value={node.latencyMs ? `${node.latencyMs}ms` : '--'} />
        <NodeMetric label="負載" value={`${node.load}%`} />
        <NodeMetric label="訊號" value={`${node.signal}%`} />
      </div>
      <p className="mt-3 text-xs font-semibold leading-5 text-white/55">{node.lastEvent}</p>
      {node.status === 'offline' && (
        <button onClick={onRestart} className="mt-3 w-full rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-900 active:scale-95">重新連線</button>
      )}
    </div>
  );
}

function NodeMetric({label, value}: {label: string; value: string}) {
  return (
    <div className="rounded-2xl bg-white/10 p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">{label}</p>
      <p className="mt-1 text-sm font-black">{value}</p>
    </div>
  );
}

export function RiskPill({level}: {level: GuardianAlert['riskLevel']}) {
  const label = level === 'high' ? '高優先' : level === 'medium' ? '中優先' : '觀察';
  const tone = level === 'high' ? 'bg-rose-100 text-rose-700' : level === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
  return <span className={`rounded-full px-2 py-1 text-[10px] font-black ${tone}`}>{label}</span>;
}

export function TabButton({active, icon: Icon, label, onClick, compact}: {key?: unknown; active: boolean; icon: any; label: string; onClick: () => void; compact?: boolean}) {
  return (
    <button onClick={onClick} className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl px-3 text-xs font-black transition active:scale-95 ${active ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'} ${compact ? 'min-w-24' : 'flex-col'}`}>
      <Icon className="h-5 w-5" />
      {label}
    </button>
  );
}

export function GuardianDemoPanel({
  activeTab,
  onSelectTab,
  openAlertsCount,
  offlineNodesCount,
  privacyMode,
}: {
  activeTab: ViewType;
  onSelectTab: (tab: ViewType) => void;
  openAlertsCount: number;
  offlineNodesCount: number;
  privacyMode: boolean;
}) {
  const steps: Array<{id: ViewType; label: string; detail: string; done: boolean}> = [
    {id: 'dashboard', label: '看總覽', detail: '先說明匿名與非診斷定位', done: true},
    {id: 'alerts', label: '處理提醒', detail: '選一筆提醒並勾處置清單', done: openAlertsCount < 3},
    {id: 'self-care', label: '自我照護', detail: '心情簽到、心情牆、支持聊天', done: activeTab === 'self-care'},
    {id: 'nodes', label: '節點監控', detail: '離線節點可本機重新連線', done: offlineNodesCount === 0},
  ];

  return (
    <section className="mb-6 rounded-[2rem] border border-teal-100 bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-teal-700">3 分鐘評審展示模式</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight">匿名關懷、非診斷、可持續追蹤</h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
            本作品只做校園關懷提醒與輔導建議示範，不收集真實學生個資、不取代導師或輔導老師判斷。
          </p>
        </div>
        <div className="rounded-3xl bg-teal-50 p-4 text-sm font-black text-teal-800">
          {privacyMode ? '匿名展示已啟用' : '完整欄位展示中'}
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-4">
        {steps.map((step) => (
          <button key={step.id} onClick={() => onSelectTab(step.id)} className={`rounded-3xl border p-4 text-left transition active:scale-95 ${step.done ? 'border-teal-100 bg-teal-50 text-teal-800' : 'border-slate-100 bg-slate-50 text-slate-600 hover:bg-white'}`}>
            <MapPin className="h-5 w-5" />
            <p className="mt-3 text-sm font-black">{step.label}</p>
            <p className="mt-1 text-xs font-semibold leading-5 opacity-75">{step.detail}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
