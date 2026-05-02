const BRIDGE_URL =
  ((import.meta as unknown as {env?: Record<string, string>}).env?.VITE_ARDUINO_BRIDGE_URL) ||
  'http://localhost:3200';

export type HardwareBridgeResult = {
  ok: boolean;
  statusCode: number;
  message: string;
};

export async function sendHardwareCommand(command: string, source: string): Promise<HardwareBridgeResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`${BRIDGE_URL}/api/robot/command`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({command, source}),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    const message = payload.response || payload.error || payload.status?.lastResponse || `HTTP ${response.status}`;
    return {ok: response.ok, statusCode: response.status, message};
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {ok: false, statusCode: 0, message: '硬體橋接請求逾時（5 秒）'};
    }
    return {
      ok: false,
      statusCode: 0,
      message: error instanceof Error ? error.message : '無法連接硬體橋接',
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
