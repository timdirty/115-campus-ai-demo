const PROXY_URL = import.meta.env.VITE_AI_PROXY_URL ?? 'http://localhost:3200';
const PROXY_KEY = import.meta.env.VITE_AI_PROXY_KEY ?? '';

export async function askGemini(
  route: string,
  body: Record<string, unknown>
): Promise<Record<string, string>> {
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
