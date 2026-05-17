function getEnv(key: string, fallback: string): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (import.meta as any).env?.[key] ?? fallback;
  } catch {
    return fallback;
  }
}

function isProxyDisabled(): boolean {
  if (getEnv('VITE_AI_PROXY_DISABLED', '') === '1') return true;

  if (typeof process !== 'undefined') {
    return process.env.VITE_AI_PROXY_DISABLED === '1';
  }

  return false;
}

export async function askGemini(
  route: string,
  body: Record<string, unknown>,
  externalSignal?: AbortSignal,
): Promise<Record<string, string>> {
  if (isProxyDisabled()) {
    throw new Error('proxy disabled');
  }

  // 預設走 bridge（同一台 server），不再依賴額外的 proxy。
  // LAN 存取時自動替換 localhost → 連線主機 IP，讓平板/手機也能呼叫。
  const defaultBridge = (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
    ? `http://${window.location.hostname}:3202`
    : 'http://localhost:3202';
  const PROXY_URL = getEnv('VITE_AI_PROXY_URL', getEnv('VITE_ARDUINO_BRIDGE_URL', defaultBridge));
  const PROXY_KEY = getEnv('VITE_AI_PROXY_KEY', '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  // Compose external signal: 任一 abort 即觸發 controller.abort
  let externalAbortHandler: (() => void) | null = null;
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalAbortHandler = () => controller.abort();
      externalSignal.addEventListener('abort', externalAbortHandler, {once: true});
    }
  }

  try {
    const res = await fetch(`${PROXY_URL}${route}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(PROXY_KEY ? {'X-Proxy-Key': PROXY_KEY} : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`proxy ${res.status}`);

    const data = await res.json() as Record<string, unknown>;
    if (data.fallback) throw new Error('proxy fallback');

    return data as Record<string, string>;
  } finally {
    clearTimeout(timeout);
    if (externalSignal && externalAbortHandler) {
      externalSignal.removeEventListener('abort', externalAbortHandler);
    }
  }
}
