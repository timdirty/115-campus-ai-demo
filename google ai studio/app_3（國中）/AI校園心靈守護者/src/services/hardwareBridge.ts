import type {DetectedPort, ZoneSensorReading} from '../types';

const BRIDGE_URL =
  ((import.meta as unknown as {env?: Record<string, string>}).env?.VITE_ARDUINO_BRIDGE_URL) ||
  'http://localhost:3200';

export async function fetchZoneSensors(): Promise<ZoneSensorReading[]> {
  try {
    const response = await fetch(`${BRIDGE_URL}/api/sensors/live`);
    if (!response.ok) return [];
    const payload = await response.json().catch(() => ({}));
    return Array.isArray(payload.zones) ? payload.zones : [];
  } catch {
    return [];
  }
}

export async function fetchSensorPorts(): Promise<DetectedPort[]> {
  try {
    const response = await fetch(`${BRIDGE_URL}/api/sensors/ports`);
    if (!response.ok) return [];
    const payload = await response.json().catch(() => ({}));
    return Array.isArray(payload.ports) ? payload.ports : [];
  } catch {
    return [];
  }
}

export async function assignSensorPort(portPath: string, zoneId: string | null): Promise<boolean> {
  try {
    const response = await fetch(`${BRIDGE_URL}/api/sensors/assign`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(zoneId ? {portPath, zoneId} : {portPath, unassign: true}),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function sendGuardianHardwareCommand(command: string, source: string) {
  try {
    const response = await fetch(`${BRIDGE_URL}/api/robot/command`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({command, source}),
    });
    const payload = await response.json().catch(() => ({}));
    return {
      ok: response.ok,
      message: payload.response || payload.error || payload.status?.lastResponse || `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : '無法連接本機硬體服務',
    };
  }
}
