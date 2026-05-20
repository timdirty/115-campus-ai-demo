import { useState, useEffect } from 'react';

const BRIDGE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ARDUINO_BRIDGE_URL) || 'http://localhost:3203';

export function useProxyHealth() {
  const [llmOnline, setLlmOnline] = useState<boolean | null>(null); // null = checking

  useEffect(() => {
    let cancelled = false;

    const check = () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);

      fetch(`${BRIDGE_URL}/api/llm/health`, { signal: controller.signal })
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then(() => { if (!cancelled) setLlmOnline(true); })
        .catch(() => { if (!cancelled) setLlmOnline(false); })
        .finally(() => clearTimeout(timeout));
    };

    check();
    const interval = setInterval(check, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return llmOnline;
}
