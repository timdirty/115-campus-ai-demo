import { useState, useEffect } from 'react';

const BRIDGE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ARDUINO_BRIDGE_URL) || 'http://localhost:3203';

export interface ProxyHealth {
  status: 'checking' | 'online' | 'offline';
  online: boolean | null;
  message: string;
  provider?: string;
  model?: string;
}

export function useProxyHealth() {
  const [health, setHealth] = useState<ProxyHealth>({
    status: 'checking',
    online: null,
    message: 'AI 連線檢查中',
  });

  useEffect(() => {
    let cancelled = false;

    const check = () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      fetch(`${BRIDGE_URL}/api/llm/health`, { signal: controller.signal })
        .then(async (response) => {
          const data = await response.json().catch(() => ({}));
          if (!response.ok || data?.ok !== true) {
            throw new Error(typeof data?.error === 'string' ? data.error : `LLM health HTTP ${response.status}`);
          }
          return data as {provider?: string; model?: string};
        })
        .then((data) => {
          if (!cancelled) {
            setHealth({
              status: 'online',
              online: true,
              message: 'AI 已連線',
              provider: data.provider,
              model: data.model,
            });
          }
        })
        .catch((error) => {
          if (!cancelled) {
            setHealth({
              status: 'offline',
              online: false,
              message: error instanceof Error && error.name === 'AbortError'
                ? 'AI 連線逾時，請檢查 Google AI Studio'
                : error instanceof Error && error.message
                  ? error.message
                  : 'AI 無法使用，已切換本機備援',
            });
          }
        })
        .finally(() => clearTimeout(timeout));
    };

    check();
    const interval = setInterval(check, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return health;
}
