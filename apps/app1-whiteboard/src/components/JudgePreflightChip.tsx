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

export function JudgePreflightChip({className = 'fixed top-2 right-2 z-50', pollIntervalMs = 30_000}: JudgePreflightChipProps) {
  const [lights, setLights] = useState<Lights>(INITIAL_LIGHTS);
  const [details, setDetails] = useState<string>('檢查中...');

  useEffect(() => {
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
  }, [pollIntervalMs]);

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
