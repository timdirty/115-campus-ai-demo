import { useState, useEffect } from 'react';

const PROXY_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AI_PROXY_URL) || 'http://localhost:3200';

export function useProxyHealth() {
  const [proxyOnline, setProxyOnline] = useState<boolean | null>(null); // null = checking

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    fetch(`${PROXY_URL}/api/health`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(() => setProxyOnline(true))
      .catch(() => setProxyOnline(false))
      .finally(() => clearTimeout(timeout));

    return () => { controller.abort(); clearTimeout(timeout); };
  }, []);

  return proxyOnline;
}
