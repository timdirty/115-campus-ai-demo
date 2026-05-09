const BRIDGE_HOST_KEY = 'app1:bridgeHost';

export function getBridgeBase(): string {
  try {
    const stored = localStorage.getItem(BRIDGE_HOST_KEY)?.trim();
    if (stored) return `http://${stored}`;
  } catch {
    // localStorage not available (SSR/test env)
  }
  return `http://${window.location.hostname}:3201`;
}

export function setBridgeHost(host: string): void {
  try {
    if (host.trim()) {
      localStorage.setItem(BRIDGE_HOST_KEY, host.trim());
    } else {
      localStorage.removeItem(BRIDGE_HOST_KEY);
    }
  } catch { /* ignore */ }
}

export function getStoredBridgeHost(): string {
  try {
    return localStorage.getItem(BRIDGE_HOST_KEY) ?? '';
  } catch {
    return '';
  }
}

export class ApiClientError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.details = details;
  }
}

type ApiRequestOptions = RequestInit & {
  timeoutMs?: number;
  allowStatuses?: number[];
};

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const {timeoutMs = 12000, allowStatuses = [], headers, signal, ...requestOptions} = options;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  const abortForward = () => controller.abort();
  if (signal) {
    signal.addEventListener('abort', abortForward, {once: true});
  }

  try {
    const response = await fetch(path, {
      ...requestOptions,
      signal: controller.signal,
      headers: {
        ...(requestOptions.body ? {'Content-Type': 'application/json'} : {}),
        ...(headers ?? {}),
      },
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok && !allowStatuses.includes(response.status)) {
      throw new ApiClientError(result.error || `Request failed: ${response.status}`, response.status, result.details);
    }

    return result as T;
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiClientError('本機硬體連線回應逾時', 0);
    }
    throw new ApiClientError(error instanceof Error ? error.message : '無法連接本機硬體服務', 0);
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener('abort', abortForward);
  }
}
