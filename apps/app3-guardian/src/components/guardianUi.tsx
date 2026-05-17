import {memo, useEffect, useMemo, useState} from 'react';
import type {Dispatch} from 'react';
import {AlertCircle, CheckCircle2, Sparkles} from 'lucide-react';
import type {LucideIcon} from 'lucide-react';
import {GuardianAlert, GuardianNode} from '../types';
import {fetchAlertCareRecommendation} from '../services/hardwareBridge';
import {recommendationForAlert} from '../services/localGuardianAi';

export const MetricCard = memo(function MetricCard({label, value, tone}: {label: string; value: string; tone: string}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-black ${tone}`}>{value}</p>
    </div>
  );
});

export const AlertRow = memo(function AlertRow({alert, onOpen}: {key?: unknown; alert: GuardianAlert; onOpen: () => void}) {
  return (
    <button onClick={onOpen} className="flex w-full items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-teal-200 hover:bg-teal-50/40">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-black">{alert.studentAlias}</span>
          <RiskPill level={alert.riskLevel} />
          <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-slate-500">{alert.status === 'new' ? '新提醒' : alert.status === 'processing' ? '處理中' : '已結案'}</span>
        </div>
        <p className="mt-2 text-sm font-bold text-slate-700">{alert.type}</p>
      </div>
      <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-black text-teal-700 ring-1 ring-slate-200">{alert.location}</span>
    </button>
  );
});

export function AlertDetail({alert, dispatch, onHardwareCommand}: {alert: GuardianAlert; dispatch: Dispatch<any>; onHardwareCommand?: (command: string, source: string) => void}) {
  const fallbackRecommendation = useMemo(() => recommendationForAlert(alert), [alert]);
  const [careAdvice, setCareAdvice] = useState<{reply: string; source: string; loading: boolean}>({
    reply: fallbackRecommendation,
    source: 'local',
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    setCareAdvice({reply: fallbackRecommendation, source: 'local', loading: true});
    fetchAlertCareRecommendation(alert).then((result) => {
      if (cancelled) return;
      setCareAdvice({
        reply: result.reply || fallbackRecommendation,
        source: result.reply ? result.source : 'local',
        loading: false,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [alert, fallbackRecommendation]);

  const adviceSourceLabel = careAdvice.loading
    ? 'AI 產生中'
    : careAdvice.source !== 'local' && careAdvice.source !== 'fallback' && careAdvice.source !== 'timeout'
      ? 'AI 建議'
      : '本機備援';
  const isLlmAdvice = !careAdvice.loading && careAdvice.source !== 'local' && careAdvice.source !== 'fallback' && careAdvice.source !== 'timeout';

  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-xl bg-slate-50 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-xl font-black">{alert.studentAlias}</h3>
          <RiskPill level={alert.riskLevel} />
        </div>
        <p className="mt-2 text-sm font-bold text-slate-500">{alert.className} · {alert.location} · {alert.time}</p>
        <p className="mt-4 text-sm font-semibold leading-7 text-slate-700">{alert.description}</p>
      </div>

      <div className="rounded-xl border border-teal-100 bg-teal-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-teal-800">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            <p className="font-black">AI 關懷建議</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ring-1 ${careAdvice.loading ? 'bg-white text-teal-700 ring-teal-100' : isLlmAdvice ? 'bg-teal-600 text-white ring-teal-500' : 'bg-white text-slate-500 ring-slate-200'}`}>
            {adviceSourceLabel}
          </span>
        </div>
        <p className="mt-3 text-sm font-semibold leading-7 text-teal-900">{careAdvice.reply}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <button onClick={() => {
          dispatch({type: 'UPDATE_ALERT_STATUS', payload: {id: alert.id, status: 'processing'}});
          onHardwareCommand?.('ALERT_SIGNAL', `alert:${alert.id}`);
        }} className="rounded-2xl bg-amber-100 px-4 py-3 text-sm font-black text-amber-800 transition active:scale-[0.98]">處理中</button>
        <button onClick={() => {
          dispatch({type: 'DEPLOY_INTERVENTION', payload: {area: alert.location}});
          onHardwareCommand?.('CARE_DEPLOYED', `care:${alert.id}`);
        }} className="min-h-11 rounded-2xl bg-teal-600 px-4 py-3 text-sm font-black text-white shadow-sm transition active:scale-[0.98]">佈署關懷</button>
        <button onClick={() => {
          dispatch({
            type: 'COMPLETE_CARE_LOOP',
            payload: {
              area: alert.location,
              note: `${alert.location} 已完成老師確認、低壓關懷與後續追蹤紀錄。`,
            },
          });
        }} className="rounded-2xl bg-emerald-100 px-4 py-3 text-sm font-black text-emerald-800 transition active:scale-[0.98]">完成閉環</button>
        <button onClick={() => dispatch({type: 'UPDATE_ALERT_STATUS', payload: {id: alert.id, status: 'resolved'}})} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition active:scale-[0.98]">標記結案</button>
      </div>
    </div>
  );
}

export const NodeRow = memo(function NodeRow({node, onRestart}: {key?: unknown; node: GuardianNode; onRestart: () => void}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-black text-slate-950">{node.name}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{node.location}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-[10px] font-black ${node.status === 'online' ? 'bg-emerald-100 text-emerald-700' : node.status === 'attention' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
          {node.status === 'online' ? '正常' : node.status === 'attention' ? '注意' : '離線'}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <NodeMetric label="延遲" value={node.latencyMs ? `${node.latencyMs}ms` : '--'} />
        <NodeMetric label="負載" value={`${node.load}%`} />
        <NodeMetric label="訊號" value={`${node.signal}%`} />
      </div>
      <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">{node.lastEvent}</p>
      {node.status === 'offline' && (
        <button onClick={onRestart} className="mt-3 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition active:scale-[0.98]">重新連線</button>
      )}
    </div>
  );
});

function NodeMetric({label, value}: {label: string; value: string}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[10px] font-black text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

export const RiskPill = memo(function RiskPill({level}: {level: GuardianAlert['riskLevel']}) {
  const config = {
    high:   {label: '高風險', tone: 'bg-red-100 text-red-700 ring-1 ring-red-200'},
    medium: {label: '中風險', tone: 'bg-orange-100 text-orange-700 ring-1 ring-orange-200'},
    low:    {label: '低風險', tone: 'bg-yellow-100 text-yellow-700 ring-1 ring-yellow-200'},
  } as const;
  const {label, tone} = config[level] ?? config.low;
  return <span className={`rounded-full px-2 py-1 text-[10px] font-black ${tone}`}>{label}</span>;
});

export const SeverityBadge = memo(function SeverityBadge({severity}: {severity: 'high' | 'medium' | 'low'}) {
  const config = {
    high:   {label: '高', bg: '#fef2f2', color: '#dc2626', border: '#fecaca'},
    medium: {label: '中', bg: '#fff7ed', color: '#ea580c', border: '#fed7aa'},
    low:    {label: '低', bg: '#fefce8', color: '#ca8a04', border: '#fde68a'},
  } as const;
  const c = config[severity];
  return (
    <span style={{backgroundColor: c.bg, color: c.color, border: `1px solid ${c.border}`, borderRadius: 8, padding: '2px 8px', fontSize: 11, fontWeight: 700}}>
      {c.label}
    </span>
  );
});

export const TabButton = memo(function TabButton({active, icon: Icon, label, onClick, compact}: {key?: unknown; active: boolean; icon: LucideIcon; label: string; onClick: () => void; compact?: boolean}) {
  return (
    <button onClick={onClick} className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl px-3 text-xs font-black transition active:scale-95 ${active ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'} ${compact ? 'min-w-24' : 'flex-col'}`}>
      <Icon className="h-5 w-5" />
      {label}
    </button>
  );
});
