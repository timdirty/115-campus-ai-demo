function getEnv(key: string, fallback: string): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (import.meta as any).env?.[key] ?? fallback;
  } catch {
    return fallback;
  }
}

export async function askGemini(
  route: string,
  body: Record<string, unknown>
): Promise<Record<string, string>> {
  const PROXY_URL = getEnv('VITE_AI_PROXY_URL', 'http://localhost:3200');
  const PROXY_KEY = getEnv('VITE_AI_PROXY_KEY', '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(`${PROXY_URL}${route}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Proxy-Key': PROXY_KEY,
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
