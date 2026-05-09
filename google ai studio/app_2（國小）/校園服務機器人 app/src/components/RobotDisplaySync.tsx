/**
 * RobotDisplaySync — App2 主控端機器人表情同步面板
 *
 * - POST /api/display/emotion → 橋接伺服器 → WebSocket /display → iPad robot_app2
 * - GET /api/display/info    → 取得 LAN IP，自動產生 QR Code 讓 iPad 掃描連線
 */

import {memo, useCallback, useEffect, useRef, useState} from 'react';
import {Bot, ChevronDown, ChevronUp, Copy, Check, ExternalLink, QrCode, RefreshCw, Smile, Wifi, WifiOff} from 'lucide-react';
import {useAppState} from '../state/AppStateProvider';

type EmotionKey =
  | 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised'
  | 'love' | 'sleepy' | 'cool' | 'thinking' | 'wink' | 'excited' | 'crying';

interface EmotionMeta { label: string; symbol: string; color: string; bg: string; }

const EMOTIONS: Record<EmotionKey, EmotionMeta> = {
  neutral:   { label: '平靜',  symbol: '○',  color: '#475569', bg: '#e2e8f0' },
  happy:     { label: '開心',  symbol: '✦',  color: '#c2410c', bg: '#fde68a' },
  sad:       { label: '難過',  symbol: '◌',  color: '#1e3a8a', bg: '#cbd5e1' },
  angry:     { label: '生氣',  symbol: '⚡', color: '#7f1d1d', bg: '#fca5a5' },
  surprised: { label: '驚訝',  symbol: '!',  color: '#6d28d9', bg: '#a5f3fc' },
  love:      { label: '愛心',  symbol: '♥',  color: '#9d174d', bg: '#fbcfe8' },
  sleepy:    { label: '想睡',  symbol: 'z',  color: '#a5b4fc', bg: '#312e81' },
  cool:      { label: '酷',    symbol: '◆',  color: '#06b6d4', bg: '#1e293b' },
  thinking:  { label: '思考',  symbol: '?',  color: '#047857', bg: '#bbf7d0' },
  wink:      { label: '眨眼',  symbol: '✦',  color: '#be185d', bg: '#fef9c3' },
  excited:   { label: '興奮',  symbol: '✦',  color: '#9a3412', bg: '#fef08a' },
  crying:    { label: '哭哭',  symbol: '◍',  color: '#1e3a8a', bg: '#bfdbfe' },
};

const EMOTION_KEYS = Object.keys(EMOTIONS) as EmotionKey[];

function autoEmotion(inProgressCount: number, completedToday: number): EmotionKey {
  if (inProgressCount > 2) return 'excited';
  if (inProgressCount > 0) return 'happy';
  if (completedToday > 3) return 'love';
  return 'neutral';
}

const BRIDGE_URL = 'http://localhost:3202';

export const RobotDisplaySync = memo(function RobotDisplaySync() {
  const state = useAppState();
  const [expanded, setExpanded] = useState(false);
  const [connected, setConnected] = useState(false);
  const [robotEmotion, setRobotEmotion] = useState<EmotionKey>('neutral');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [autoSync, setAutoSync] = useState(true);
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const statusPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── 輪詢橋接伺服器狀態 ── */
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`${BRIDGE_URL}/api/display/status`, {signal: AbortSignal.timeout(2000)});
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

  const sendEmotion = useCallback(async (emotion: EmotionKey) => {
    try {
      const res = await fetch(`${BRIDGE_URL}/api/display/emotion`, {
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
    const inProgress = state.tasks.filter((t) => t.status === 'in_progress').length;
    const completed = state.tasks.filter((t) => t.status === 'completed').length;
    void sendEmotion(autoEmotion(inProgress, completed));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.tasks, autoSync]);

  /* ── QR code 產生 ── */
  const generateQr = useCallback(async () => {
    setQrLoading(true);
    try {
      const infoRes = await fetch(`${BRIDGE_URL}/api/display/info`, {signal: AbortSignal.timeout(3000)});
      const info = await infoRes.json() as {robotDisplayUrl: string};
      setQrUrl(info.robotDisplayUrl);
      const {default: QRCode} = await import('qrcode');
      const dataUrl = await QRCode.toDataURL(info.robotDisplayUrl, {
        width: 240, margin: 2,
        color: {dark: '#0f172a', light: '#ffffff'},
      });
      setQrSrc(dataUrl);
    } catch { /* ignore */ } finally { setQrLoading(false); }
  }, []);

  const copyUrl = useCallback(() => {
    if (!qrUrl) return;
    void navigator.clipboard.writeText(qrUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [qrUrl]);

  const current = EMOTIONS[robotEmotion];

  return (
    <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low/40 overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 p-4 text-left active:bg-surface-container-high/30 transition-colors"
      >
        <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: current.bg }}>
          <span className="text-base font-black" style={{ color: current.color }}>{current.symbol}</span>
          <span className={`absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-background ${connected ? 'bg-emerald-500' : 'bg-slate-300'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-black tracking-widest text-on-surface-variant uppercase">機器人顯示面板</p>
          <p className="text-sm font-bold text-on-surface flex items-center gap-1.5">
            <span>{current.label}</span>
            {connected
              ? <span className="text-[10px] text-emerald-600 font-mono">[iPad 已連線]</span>
              : <span className="text-[10px] text-slate-400 font-mono">[等待 iPad]</span>}
          </p>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-on-surface-variant" /> : <ChevronDown className="h-4 w-4 text-on-surface-variant" />}
      </button>

      {expanded && (
        <div className="flex flex-col gap-4 px-4 pb-4">
          {/* 狀態列 */}
          <div className="flex items-center gap-2 rounded-xl bg-surface-container-lowest p-2.5 ring-1 ring-outline-variant/20">
            {connected ? <Wifi className="h-4 w-4 text-emerald-500 shrink-0" /> : <WifiOff className="h-4 w-4 text-slate-400 shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-on-surface-variant">
                {connected ? 'iPad 機器人顯示端已連線 (LAN WiFi)' : '等待 iPad 透過 WiFi 連線'}
              </p>
              {lastSync && <p className="text-[10px] font-mono text-on-surface-variant/60">最後推送 {lastSync}</p>}
            </div>
          </div>

          {/* QR Code 區塊 */}
          <div className="rounded-xl bg-surface-container-lowest ring-1 ring-outline-variant/20 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-outline-variant/10">
              <div className="flex items-center gap-1.5">
                <QrCode className="h-3.5 w-3.5 text-on-surface-variant" />
                <span className="text-[10px] font-black tracking-widest text-on-surface-variant uppercase">iPad 掃碼連線</span>
              </div>
              <button
                type="button"
                onClick={generateQr}
                disabled={qrLoading}
                className="flex items-center gap-1 text-[10px] font-bold text-primary hover:opacity-70 disabled:opacity-40 transition-opacity"
              >
                <RefreshCw className={`h-2.5 w-2.5 ${qrLoading ? 'animate-spin' : ''}`} />
                {qrLoading ? '產生中...' : qrSrc ? '重新產生' : '產生 QR 碼'}
              </button>
            </div>

            {qrSrc ? (
              <div className="flex flex-col items-center gap-2 p-3">
                <img src={qrSrc} alt="Robot Display QR Code" className="w-32 h-32 rounded-lg shadow-sm" />
                <p className="text-[9px] font-mono text-on-surface-variant/60 text-center break-all leading-relaxed px-1">{qrUrl}</p>
                <button
                  type="button"
                  onClick={copyUrl}
                  className="flex items-center gap-1 text-[10px] font-bold text-primary hover:opacity-70 transition-all"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  {copied ? '已複製！' : '複製連結'}
                </button>
              </div>
            ) : (
              <div className="px-3 py-4 text-center">
                <p className="text-[10px] text-on-surface-variant/70">點「產生 QR 碼」</p>
                <p className="text-[10px] text-on-surface-variant/50">iPad 用相機掃描即可連線</p>
              </div>
            )}
          </div>

          {/* 自動同步開關 */}
          <button
            type="button"
            onClick={() => setAutoSync((v) => !v)}
            className="flex items-center justify-between rounded-xl bg-surface-container-lowest px-3 py-2.5 ring-1 ring-outline-variant/20 transition-colors hover:bg-surface-container-low"
          >
            <div className="flex items-center gap-2">
              <Smile className="h-4 w-4 text-on-surface-variant" />
              <span className="text-xs font-bold text-on-surface">依任務狀態自動推送情緒</span>
            </div>
            <div className={`w-9 h-5 rounded-full relative shadow-inner transition-colors ${autoSync ? 'bg-primary' : 'bg-outline-variant'}`}>
              <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 shadow-sm transition-all ${autoSync ? 'right-0.5' : 'left-0.5'}`} />
            </div>
          </button>

          {/* 手動情緒觸發 */}
          <div>
            <p className="text-[10px] font-black tracking-widest text-on-surface-variant uppercase mb-2">手動送出情緒</p>
            <div className="grid grid-cols-4 gap-1.5">
              {EMOTION_KEYS.map((key) => {
                const em = EMOTIONS[key];
                const isActive = robotEmotion === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { void sendEmotion(key); setAutoSync(false); }}
                    className="flex flex-col items-center gap-0.5 rounded-xl py-2.5 text-center transition-all active:scale-95 hover:scale-[1.03]"
                    style={{
                      background: isActive ? em.bg : 'transparent',
                      border: `1.5px solid ${isActive ? em.color + '80' : 'rgba(0,0,0,0.08)'}`,
                      boxShadow: isActive ? `0 4px 12px ${em.color}30` : 'none',
                    }}
                    title={em.label}
                  >
                    <span className="text-sm leading-none" style={{ color: em.color }}>{em.symbol}</span>
                    <span className="text-[9px] font-black tracking-tight leading-tight" style={{ color: em.color }}>{em.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <a
            href="/robot-display.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-xl bg-surface-container-lowest px-4 py-2.5 text-xs font-bold text-on-surface-variant ring-1 ring-outline-variant/30 transition-colors hover:bg-surface-container-low hover:text-on-surface"
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
