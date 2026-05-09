import type {DetectedPort, ZoneSensorReading} from '../types';

const BRIDGE_URL =
  ((import.meta as unknown as {env?: Record<string, string>}).env?.VITE_ARDUINO_BRIDGE_URL) ||
  'http://localhost:3203';

function withTimeout(ms: number): {signal: AbortSignal; clear: () => void} {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return {signal: controller.signal, clear: () => clearTimeout(id)};
}

export async function fetchZoneSensors(): Promise<ZoneSensorReading[]> {
  const {signal, clear} = withTimeout(2000);
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

export async function fetchBridgeHealth(): Promise<boolean> {
  const {signal, clear} = withTimeout(1600);
  try {
    const response = await fetch(`${BRIDGE_URL}/api/health`, {signal});
    return response.ok;
  } catch {
    return false;
  } finally {
    clear();
  }
}

export async function fetchSensorPorts(): Promise<DetectedPort[]> {
  const {signal, clear} = withTimeout(2000);
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
  const {signal, clear} = withTimeout(2000);
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

async function doGuardianPost(command: string, source: string) {
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
      statusCode: response.status,
      message: payload.response || payload.error || payload.status?.lastResponse || `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      statusCode: 0,
      message: error instanceof Error && error.name === 'AbortError' ? '硬體橋接請求逾時' : error instanceof Error ? error.message : '無法連接本機硬體服務',
    };
  } finally {
    clear();
  }
}

export async function sendGuardianHardwareCommand(command: string, source: string) {
  const first = await doGuardianPost(command, source);
  // Auto-retry once on transient 503/timeout
  if (!first.ok && (first.statusCode === 503 || first.statusCode === 0)) {
    await new Promise((r) => setTimeout(r, 400));
    return doGuardianPost(command, source);
  }
  return first;
}

export async function sendGuardianDriveCommand(command: string) {
  const {signal, clear} = withTimeout(1800);
  const normalized = command.trim().toUpperCase();
  const driveEndpoint = /^(FORWARD|BACKWARD|LEFT|RIGHT|STOP|SPEED:\d+)$/.test(normalized)
    ? '/api/robot/drive'
    : '/api/robot/command';
  try {
    const response = await fetch(`${BRIDGE_URL}${driveEndpoint}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({command: normalized, source: 'app3:drive-dock'}),
      signal,
    });
    const payload = await response.json().catch(() => ({}));
    return {
      ok: response.ok,
      message: payload.error || payload.response || (response.ok ? `Drive ${normalized}` : `HTTP ${response.status}`),
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error && error.name === 'AbortError' ? '移動指令逾時' : error instanceof Error ? error.message : '無法連接本機硬體服務',
    };
  } finally {
    clear();
  }
}

export async function resetBridgeDemoData(): Promise<boolean> {
  const {signal, clear} = withTimeout(3000);
  try {
    const response = await fetch(`${BRIDGE_URL}/api/ops/reset`, {method: 'POST', signal});
    return response.ok;
  } catch {
    return false;
  } finally {
    clear();
  }
}
