import { useState, useEffect } from 'react';
import { BRIDGE_URL } from '../services/hardwareBridge';

export function useProxyHealth() {
  const [proxyOnline, setProxyOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      fetch(`${BRIDGE_URL}/api/ready`, { signal: controller.signal })
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then((data: {ai?: boolean}) => { if (!cancelled) setProxyOnline(Boolean(data.ai)); })
        .catch(() => { if (!cancelled) setProxyOnline(false); })
        .finally(() => clearTimeout(timeout));
    };
    check();
    const intv = setInterval(check, 15000); // recheck every 15s
    return () => { cancelled = true; clearInterval(intv); };
  }, []);

  return proxyOnline;
}
