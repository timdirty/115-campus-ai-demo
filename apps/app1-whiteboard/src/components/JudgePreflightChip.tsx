import {useEffect, useState} from 'react';
import {loadBridgeHealth, loadReadyStatus, type BridgeHealth, type ReadyStatus} from '../services/classroomApi';

export interface JudgePreflightChipProps {
  className?: string;
  pollIntervalMs?: number;
}

type LightStatus = 'green' | 'yellow' | 'red' | 'unknown';

interface Lights {
  gemini: LightStatus;
  arduino: LightStatus;
  storage: LightStatus;
}

const INITIAL_LIGHTS: Lights = {gemini: 'unknown', arduino: 'unknown', storage: 'unknown'};

function computeLights(ready: ReadyStatus | null, health: BridgeHealth | null): Lights {
  if (!ready && !health) return INITIAL_LIGHTS;
  return {
    gemini: ready?.geminiConfigured || health?.geminiConfigured ? 'green' : 'yellow',
    arduino: health?.arduinoConnected ? 'green' : 'yellow',
    storage: ready?.ok ? 'green' : 'red',
  };
}

const LIGHT_COLOR: Record<LightStatus, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-400',
  red: 'bg-red-500',
  unknown: 'bg-gray-300',
};

// 線上公開展示 host (GitHub Pages / Vercel / Pages.dev) 沒 bridge server，
// fetch /api/health + WebSocket :3201 被 Mixed Content 阻擋。
// 偵測 host → 跳過 polling，render「線上展示模式」alt chip。
function isProductionDemoHost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  return host.endsWith('github.io') || host.endsWith('pages.dev') || host.endsWith('vercel.app');
}

export function JudgePreflightChip({className = 'fixed top-2 right-2 z-50', pollIntervalMs = 30_000}: JudgePreflightChipProps) {
  const [lights, setLights] = useState<Lights>(INITIAL_LIGHTS);
  const [details, setDetails] = useState<string>('檢查中...');
  const productionDemo = isProductionDemoHost();

  useEffect(() => {
    if (productionDemo) return; // 線上展示版本不 poll bridge
    let cancelled = false;

    async function poll() {
      const [ready, health] = await Promise.all([
        loadReadyStatus().catch(() => null),
        loadBridgeHealth().catch(() => null),
      ]);
      if (cancelled) return;
      setLights(computeLights(ready, health));
      setDetails(
        `Gemini: ${ready?.geminiConfigured ? '已設定' : '展示模式'} | Arduino: ${health?.arduinoConnected ? '已連線' : '未連線（展示模式可完整跑流程）'} | Storage: ${ready?.ok ? '正常' : '異常'}`,
      );
    }

    poll();
    const id = window.setInterval(poll, pollIntervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [pollIntervalMs, productionDemo]);

  if (productionDemo) {
    // 線上 production demo 用 inline 全寬 banner（不 fixed-position 避免撞 header 按鈕）
    return (
      <div
        className="w-full bg-amber-50/95 dark:bg-amber-900/40 border-b border-amber-300 dark:border-amber-700 px-4 py-1.5 text-xs text-amber-900 dark:text-amber-100 flex items-center justify-center gap-2"
        title="線上公開展示版本不連硬體 bridge。5/25 現場 demo 在筆電 local 跑會接 Arduino，三燈狀態即時顯示。"
      >
        <span className="inline-block w-2 h-2 rounded-full bg-amber-400 shrink-0" aria-label="線上展示模式" />
        <span>📡 線上展示模式 · 5/25 現場 demo 接 Arduino 後三燈會即時顯示</span>
      </div>
    );
  }

  return (
    <div className={`${className} flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 dark:bg-gray-800/90 backdrop-blur shadow-md border border-gray-200 dark:border-gray-700 text-xs font-medium`} title={details}>
      <span className={`w-2 h-2 rounded-full ${LIGHT_COLOR[lights.gemini]}`} aria-label={`Gemini ${lights.gemini}`} />
      <span>Gemini</span>
      <span className="text-gray-300">·</span>
      <span className={`w-2 h-2 rounded-full ${LIGHT_COLOR[lights.arduino]}`} aria-label={`Arduino ${lights.arduino}`} />
      <span>Arduino</span>
      <span className="text-gray-300">·</span>
      <span className={`w-2 h-2 rounded-full ${LIGHT_COLOR[lights.storage]}`} aria-label={`Storage ${lights.storage}`} />
      <span>Ready</span>
    </div>
  );
}
