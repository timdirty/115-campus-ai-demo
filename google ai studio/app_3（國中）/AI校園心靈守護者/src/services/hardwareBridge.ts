import type {DetectedPort, ZoneSensorReading} from '../types';

const BRIDGE_URL =
  ((import.meta as unknown as {env?: Record<string, string>}).env?.VITE_ARDUINO_BRIDGE_URL) ||
  'http://localhost:3200';

function withTimeout(ms: number): {signal: AbortSignal; clear: () => void} {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return {signal: controller.signal, clear: () => clearTimeout(id)};
}

export async function fetchZoneSensors(): Promise<ZoneSensorReading[]> {
  const {signal, clear} = withTimeout(8000);
  try {
    const response = await fetch(`${BRIDGE_URL}/api/sensors/live`, {signal});
    if (!response.ok) return [];
    const payload = await response.json().catch(() => ({}));
    return Array.isArray(payload.zones) ? payload.zones : [];
  } catch {
    return [];
  } finally {
    clear();
  }
}

export async function fetchSensorPorts(): Promise<DetectedPort[]> {
  const {signal, clear} = withTimeout(8000);
  try {
    const response = await fetch(`${BRIDGE_URL}/api/sensors/ports`, {signal});
    if (!response.ok) return [];
    const payload = await response.json().catch(() => ({}));
    return Array.isArray(payload.ports) ? payload.ports : [];
  } catch {
    return [];
  } finally {
    clear();
  }
}

export async function assignSensorPort(portPath: string, zoneId: string | null): Promise<boolean> {
  const {signal, clear} = withTimeout(8000);
  try {
    const response = await fetch(`${BRIDGE_URL}/api/sensors/assign`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(zoneId ? {portPath, zoneId} : {portPath, unassign: true}),
      signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clear();
  }
}

export async function sendGuardianHardwareCommand(command: string, source: string) {
  const {signal, clear} = withTimeout(5000);
  try {
    const response = await fetch(`${BRIDGE_URL}/api/robot/command`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({command, source}),
      signal,
    });
    const payload = await response.json().catch(() => ({}));
    return {
      ok: response.ok,
      message: payload.response || payload.error || payload.status?.lastResponse || `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error && error.name === 'AbortError' ? '硬體橋接請求逾時' : error instanceof Error ? error.message : '無法連接本機硬體服務',
    };
  } finally {
    clear();
  }
}
