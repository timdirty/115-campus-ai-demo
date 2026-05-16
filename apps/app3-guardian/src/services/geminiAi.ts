let _proxyUrl: string | undefined;
let _proxyKey: string | undefined;

function getProxyUrl(): string {
  if (_proxyUrl === undefined) {
    // 優先序：VITE_AI_PROXY_URL (顯式 override) → VITE_ARDUINO_BRIDGE_URL (跟 hardwareBridge 共用) → 預設 app3 bridge 3203
    _proxyUrl =
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AI_PROXY_URL) ||
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ARDUINO_BRIDGE_URL) ||
      'http://localhost:3203';
  }
  return _proxyUrl;
}

function getProxyKey(): string {
  if (_proxyKey === undefined) {
    _proxyKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AI_PROXY_KEY) || '';
  }
  return _proxyKey;
}

function isProxyDisabled(): boolean {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_AI_PROXY_DISABLED === '1') {
    return true;
  }

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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  let onExternalAbort: (() => void) | undefined;
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      onExternalAbort = () => controller.abort();
      externalSignal.addEventListener('abort', onExternalAbort, {once: true});
    }
  }

  try {
    const res = await fetch(`${getProxyUrl()}${route}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Proxy-Key': getProxyKey(),
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
    if (externalSignal && onExternalAbort) {
      externalSignal.removeEventListener('abort', onExternalAbort);
    }
  }
}
