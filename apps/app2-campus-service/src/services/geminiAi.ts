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
  body: Record<string, unknown>
): Promise<Record<string, string>> {
  if (isProxyDisabled()) {
    throw new Error('proxy disabled');
  }

  // 預設走 bridge（同一台 server），不再依賴額外的 proxy。
  // 如環境變數 VITE_AI_PROXY_URL 有設，仍可指向不同位置。
  const PROXY_URL = getEnv('VITE_AI_PROXY_URL', getEnv('VITE_ARDUINO_BRIDGE_URL', 'http://localhost:3202'));
  const PROXY_KEY = getEnv('VITE_AI_PROXY_KEY', '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

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
  }
}
