/**
 * RobotDisplaySync — App3 主控端機器人情緒同步面板
 *
 * - POST /api/display/emotion → 橋接伺服器 → WebSocket /display → iPad robot_app3
 * - GET /api/display/info    → 取得 LAN IP，自動產生 QR Code 讓 iPad 掃描連線
 */

import {memo, useCallback, useEffect, useRef, useState} from 'react';
import {Bot, Check, Copy, ExternalLink, QrCode, RefreshCw, Smile, Wifi, WifiOff} from 'lucide-react';
import type {MoodType} from '../types';
import {getBridgeBaseUrl, getBridgeHost} from '../services/hardwareBridge';

type RobotEmotion = 'happy' | 'calm' | 'focused' | 'anxious' | 'sad' | 'stressed';

interface EmotionMeta { label: string; color: string; light: string; glow: string; }

const EMOTIONS: Record<RobotEmotion, EmotionMeta> = {
  happy:    { label: '愉悅', color: '#F59E0B', light: '#FEF3C7', glow: 'rgba(245,158,11,0.3)' },
  calm:     { label: '平靜', color: '#14B8A6', light: '#CCFBF1', glow: 'rgba(20,184,166,0.3)' },
  focused:  { label: '專注', color: '#0EA5E9', light: '#E0F2FE', glow: 'rgba(14,165,233,0.3)' },
  anxious:  { label: '焦慮', color: '#F97316', light: '#FFEDD5', glow: 'rgba(249,115,22,0.3)' },
  sad:      { label: '低落', color: '#6366F1', light: '#E0E7FF', glow: 'rgba(99,102,241,0.3)' },
  stressed: { label: '緊張', color: '#EF4444', light: '#FEE2E2', glow: 'rgba(239,68,68,0.35)' },
};

const EMOTION_KEYS = Object.keys(EMOTIONS) as RobotEmotion[];

function moodToRobotEmotion(mood: MoodType | undefined): RobotEmotion {
  switch (mood) {
    case 'happy':   return 'happy';
    case 'steady':  return 'calm';
    case 'tired':   return 'sad';
    case 'worried': return 'anxious';
    default:        return 'calm';
  }
}

interface Props { latestMood?: MoodType; alertCount?: number; focusMode?: boolean; }

function getRobotPreviewUrl(): string {
  const bridgeHost = getBridgeHost();
  if (typeof window === 'undefined') return `robot-display.html?bridge=${encodeURIComponent(bridgeHost)}`;
  const url = new URL('robot-display.html', window.location.href);
  url.searchParams.set('bridge', bridgeHost);
  return url.toString();
}

export const RobotDisplaySync = memo(function RobotDisplaySync({latestMood, alertCount = 0, focusMode = false}: Props) {
  const [connected, setConnected] = useState(false);
  const [robotEmotion, setRobotEmotion] = useState<RobotEmotion>('calm');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [autoSync, setAutoSync] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const statusPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const robotPreviewUrl = getRobotPreviewUrl();

  useEffect(() => {
    if (focusMode) setExpanded(true);
  }, [focusMode]);

  /* ── 輪詢橋接伺服器狀態 ── */
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`${getBridgeBaseUrl()}/api/display/status`, {signal: AbortSignal.timeout(2000)});
        if (res.ok) {
          const json = await res.json() as {clients: number};
          setConnected(json.clients > 0);
        } else setConnected(false);
      } catch { setConnected(false); }
    };
    void poll();
    statusPollRef.current = setInterval(poll, 5000);
    return () => { if (statusPollRef.current) clearInterval(statusPollRef.current); };
  }, []);

  const sendEmotion = useCallback(async (emotion: RobotEmotion) => {
    try {
      const res = await fetch(`${getBridgeBaseUrl()}/api/display/emotion`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({emotion}),
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        const json = await res.json() as {clients: number};
        setConnected(json.clients > 0);
        setRobotEmotion(emotion);
        const now = new Date();
        setLastSync(`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`);
      }
    } catch { /* bridge offline */ }
  }, []);

  /* ── 自動同步 ── */
  useEffect(() => {
    if (!autoSync) return;
    if (alertCount >= 2) { void sendEmotion('stressed'); return; }
    if (alertCount >= 1) { void sendEmotion('anxious'); return; }
    void sendEmotion(moodToRobotEmotion(latestMood));
  }, [latestMood, alertCount, autoSync, sendEmotion]);

  /* ── QR code 產生 ── */
  const generateQr = useCallback(async () => {
    setQrLoading(true);
    try {
      const infoRes = await fetch(`${getBridgeBaseUrl()}/api/display/info`, {signal: AbortSignal.timeout(3000)});
      const info = await infoRes.json().catch(() => ({})) as {robotDisplayUrl?: string};
      const robotDisplayUrl = infoRes.ok && typeof info.robotDisplayUrl === 'string' && info.robotDisplayUrl
        ? info.robotDisplayUrl
        : robotPreviewUrl;
      setQrUrl(robotDisplayUrl);
      const {default: QRCode} = await import('qrcode');
      const dataUrl = await QRCode.toDataURL(robotDisplayUrl, {
        width: 240, margin: 2,
        color: {dark: '#0f172a', light: '#ffffff'},
      });
      setQrSrc(dataUrl);
    } catch {
      setQrUrl(robotPreviewUrl);
      const {default: QRCode} = await import('qrcode');
      const dataUrl = await QRCode.toDataURL(robotPreviewUrl, {
        width: 240, margin: 2,
        color: {dark: '#0f172a', light: '#ffffff'},
      });
      setQrSrc(dataUrl);
    } finally { setQrLoading(false); }
  }, [robotPreviewUrl]);

  useEffect(() => {
    if (!expanded || qrSrc || qrLoading) return;
    void generateQr();
  }, [expanded, generateQr, qrLoading, qrSrc]);

  const copyUrl = useCallback(() => {
    if (!qrUrl) return;
    void navigator.clipboard.writeText(qrUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [qrUrl]);

  const em = EMOTIONS[robotEmotion];

  return (
    <div className="rounded-2xl overflow-hidden border" style={{ borderColor: connected ? `${em.color}40` : 'rgba(0,0,0,0.1)' }}>
      {/* 標頭 */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
        style={{ background: connected ? `${em.light}cc` : 'rgba(241,245,249,0.8)' }}
      >
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: em.light, border: `1.5px solid ${em.color}40` }}>
          <Bot className="h-5 w-5" style={{ color: em.color }} />
          <span className={`absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white ${connected ? 'bg-emerald-500' : 'bg-slate-300'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-black tracking-[0.2em] uppercase" style={{ color: `${em.color}99` }}>機器人顯示 · ROBOT FACE</p>
          <p className="text-sm font-bold" style={{ color: em.color }}>
            {em.label}
            {connected
              ? <span className="ml-1.5 text-[10px] font-mono text-emerald-600">[iPad 已連線]</span>
              : <span className="ml-1.5 text-[10px] font-mono text-slate-400">[等待 iPad]</span>}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {connected ? <Wifi className="h-4 w-4 text-emerald-500" /> : <WifiOff className="h-4 w-4 text-slate-300" />}
          <span className="text-[10px] text-on-surface-variant">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* 展開控制面板 */}
      {expanded && (
        <div className="flex flex-col gap-3 px-4 pb-4 pt-2" style={{ background: `${em.light}44` }}>
          {/* 狀態列 */}
          <div className="flex items-center gap-2 rounded-xl bg-white/70 p-2.5 ring-1 ring-black/5">
            {connected ? <Wifi className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> : <WifiOff className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-stone-700">
                {connected ? 'iPad 機器人顯示端已連線 (LAN WiFi)' : '等待 iPad 透過同一 WiFi 連線'}
              </p>
              {lastSync && <p className="text-[10px] font-mono text-stone-400">最後推送 {lastSync}</p>}
            </div>
          </div>

          {/* QR Code 區塊 */}
          <div className="rounded-xl bg-white/80 ring-1 ring-black/5 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-black/5">
              <div className="flex items-center gap-1.5">
                <QrCode className="h-3 w-3 text-stone-500" />
                <span className="text-[9px] font-black tracking-[0.2em] uppercase text-stone-500">iPad 掃碼連線</span>
              </div>
              <button
                type="button"
                onClick={generateQr}
                disabled={qrLoading}
                className="flex items-center gap-1 text-[9px] font-bold text-teal-700 hover:opacity-70 disabled:opacity-40"
              >
                <RefreshCw className={`h-2.5 w-2.5 ${qrLoading ? 'animate-spin' : ''}`} />
                {qrLoading ? '產生中...' : qrSrc ? '重新產生' : '產生 QR 碼'}
              </button>
            </div>

            {qrSrc ? (
              <div className="flex flex-col items-center gap-2 p-3">
                <img src={qrSrc} alt="Robot Display QR Code" className="w-32 h-32 rounded-lg shadow-sm" />
                <p className="text-[9px] font-mono text-stone-400 text-center break-all leading-relaxed px-1">{qrUrl}</p>
                <button type="button" onClick={copyUrl}
                  className="flex items-center gap-1 text-[9px] font-bold text-teal-700 hover:opacity-70">
                  {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  {copied ? '已複製！' : '複製連結'}
                </button>
              </div>
            ) : (
              <div className="px-3 py-4 text-center">
                <p className="text-[10px] text-stone-500">點「產生 QR 碼」</p>
                <p className="text-[10px] text-stone-400">iPad 用相機掃描即可連線</p>
              </div>
            )}
          </div>

          {/* 自動同步開關 */}
          <button
            type="button"
            onClick={() => setAutoSync((v) => !v)}
            className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2 ring-1 ring-black/5 transition-colors hover:bg-white/90"
          >
            <div className="flex items-center gap-2">
              <Smile className="h-3.5 w-3.5 text-stone-600" />
              <span className="text-xs font-bold text-stone-700">依偵測情緒自動推送</span>
            </div>
            <div className={`w-9 h-5 rounded-full relative shadow-inner transition-colors ${autoSync ? 'bg-teal-500' : 'bg-slate-300'}`}>
              <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 shadow-sm transition-all ${autoSync ? 'right-0.5' : 'left-0.5'}`} />
            </div>
          </button>

          {/* 手動情緒觸發 */}
          <div>
            <p className="text-[9px] font-black tracking-[0.2em] uppercase text-stone-500 mb-2">手動覆寫情緒</p>
            <div className="grid grid-cols-3 gap-1.5">
              {EMOTION_KEYS.map((key) => {
                const meta = EMOTIONS[key];
                const isActive = robotEmotion === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { void sendEmotion(key); setAutoSync(false); }}
                    className="flex flex-col items-center gap-0.5 rounded-xl py-2.5 text-center transition-all active:scale-95 hover:scale-[1.03]"
                    style={{
                      background: isActive ? meta.light : 'rgba(255,255,255,0.6)',
                      border: `1.5px solid ${isActive ? meta.color + '60' : 'rgba(0,0,0,0.08)'}`,
                      boxShadow: isActive ? `0 4px 12px ${meta.glow}` : 'none',
                    }}
                  >
                    <span className="text-[9px] font-black tracking-tight" style={{ color: meta.color }}>{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <a
            href={robotPreviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-white/70 px-4 py-2 text-xs font-bold text-stone-600 ring-1 ring-black/5 transition-colors hover:bg-white/90"
          >
            <Bot className="h-3.5 w-3.5" />
            <span>在新分頁預覽機器人顯示</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
    </div>
  );
});
