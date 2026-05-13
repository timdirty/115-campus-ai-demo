import type {DetectedPort, GuardianAlert, ZoneSensorReading} from '../types';

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

export interface GuardianSnapshotPayload {
  emotion: string;
  stress: number;
  stability: number;
  focus: number;
  fusionScore: number;
  signals: {moodScore: number; soundScore: number; nodeScore: number; alertScore: number};
  riskScore: number;
  riskLabel: string;
  moodLabel: string;
  robotActive: boolean;
}

export interface RobotAssignmentPayload {
  zoneId: string;
  zoneName: string;
  location: string;
  riskLevel: 'low' | 'medium' | 'high';
  statusLabel: string;
  stage: string;
  missionId?: string | null;
  active: boolean;
  moving?: boolean;
  travelStartedAt?: string | null;
  travelEndsAt?: string | null;
  fromZoneId?: string | null;
  fromZoneName?: string | null;
  fromLocation?: string | null;
}

export interface ZoneInsightRequest {
  mode?: 'status' | 'detail';
  zoneId: string;
  zoneName: string;
  location: string;
  currentStatusLabel?: string;
  currentRiskLevel?: string;
  ruleBasedScore?: number;
  alertCount: number;
  nodeStatus: string;
  sensor?: {
    temperature: number | null;
    humidity: number | null;
    light: number | null;
    motion?: boolean;
    status?: string;
  };
}

export interface ZoneInsightResponse {
  ok: boolean;
  source: 'ollama-gemma' | 'fallback' | string;
  model: string | null;
  riskLevel: 'low' | 'medium' | 'high';
  statusLabel: string;
  confidence: number | null;
  summary: string;
  situations: string[];
  suggestions: string[];
  error?: string;
}

export interface CampusEventAssessmentRequest {
  zoneId: string;
  zoneName: string;
  location: string;
  eventText: string;
  source: 'manual' | 'robot-emotion' | string;
}

export interface RobotEmotionEvent {
  id: string;
  zoneId: string;
  zoneName: string;
  location: string;
  emotion: string;
  emotionLabel: string;
  riskLevel: 'medium' | 'high';
  description: string;
  source: string;
  updatedAt: string;
}

export async function fetchZoneInsight(payload: ZoneInsightRequest): Promise<ZoneInsightResponse> {
  const statusOnly = payload.mode === 'status';
  const {signal, clear} = withTimeout(statusOnly ? 7000 : 16000);
  try {
    const response = await fetch(`${BRIDGE_URL}/api/ai/zone-advisor`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload),
      signal,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error || `HTTP ${response.status}`);
    }
    const riskLevel = result.riskLevel === 'high' || result.riskLevel === 'medium' || result.riskLevel === 'low' ? result.riskLevel : 'medium';
    return {
      ok: Boolean(result.ok ?? true),
      source: result.source || 'fallback',
      model: result.model ?? null,
      riskLevel,
      statusLabel: typeof result.statusLabel === 'string' && result.statusLabel ? result.statusLabel : riskLevel === 'high' ? '高風險' : riskLevel === 'low' ? '安全' : '注意',
      confidence: typeof result.confidence === 'number' ? result.confidence : null,
      summary: typeof result.summary === 'string' ? result.summary : statusOnly ? '' : '目前沒有可用的 AI 判讀內容。',
      situations: Array.isArray(result.situations) ? result.situations : [],
      suggestions: Array.isArray(result.suggestions) ? result.suggestions : [],
      error: result.error,
    };
  } catch (error) {
    return {
      ok: true,
      source: 'fallback',
      model: null,
      riskLevel: 'medium',
      statusLabel: '注意',
      confidence: null,
      summary: statusOnly ? '' : 'AI 區域判讀暫時無法連線，請先依目前燈號與現場巡查結果處理。',
      situations: statusOnly ? [] : ['本機橋接或 Ollama 目前沒有回應。'],
      suggestions: statusOnly ? [] : [error instanceof Error && error.name === 'AbortError' ? '確認 Ollama/Gemma 回應時間，或稍後再試。' : '確認 bridge 與 Ollama 已啟動。'],
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clear();
  }
}

export async function evaluateCampusEvent(payload: CampusEventAssessmentRequest): Promise<ZoneInsightResponse> {
  const {signal, clear} = withTimeout(14000);
  try {
    const response = await fetch(`${BRIDGE_URL}/api/ai/zone-advisor`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({...payload, mode: 'manual_event'}),
      signal,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(result.error || `HTTP ${response.status}`);
    }
    const riskLevel = result.riskLevel === 'high' ? 'high' : 'medium';
    return {
      ok: Boolean(result.ok ?? true),
      source: result.source || 'fallback',
      model: result.model ?? null,
      riskLevel,
      statusLabel: riskLevel === 'high' ? '高風險' : '注意',
      confidence: typeof result.confidence === 'number' ? result.confidence : null,
      summary: typeof result.summary === 'string' && result.summary.trim() ? result.summary : `${payload.zoneName}新增事件已判定為${riskLevel === 'high' ? '高風險' : '注意'}。`,
      situations: Array.isArray(result.situations) ? result.situations : [],
      suggestions: Array.isArray(result.suggestions) ? result.suggestions : [],
      error: result.error,
    };
  } catch (error) {
    return {
      ok: true,
      source: 'fallback',
      model: null,
      riskLevel: /打架|攻擊|自傷|霸凌|受傷|失控|威脅|生氣|憤怒/.test(payload.eventText) ? 'high' : 'medium',
      statusLabel: /打架|攻擊|自傷|霸凌|受傷|失控|威脅|生氣|憤怒/.test(payload.eventText) ? '高風險' : '注意',
      confidence: null,
      summary: '事件分級 AI 暫時無法連線，已先用本機關鍵詞規則建立提醒。',
      situations: ['橋接或 LLM 服務未在時間內回應。'],
      suggestions: ['先派機器人或值週老師前往確認，稍後可重新判讀。'],
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clear();
  }
}

export async function fetchAlertCareRecommendation(alert: GuardianAlert): Promise<{reply: string; source: string}> {
  const {signal, clear} = withTimeout(12000);
  try {
    const response = await fetch(`${BRIDGE_URL}/api/ai/guardian`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        alertType: alert.type,
        severity: alert.riskLevel,
        zoneName: alert.location,
        category: alert.category,
        className: alert.className,
        studentAlias: alert.studentAlias,
        message: alert.description,
      }),
      signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }
    const reply = typeof payload.reply === 'string' ? payload.reply.trim() : '';
    if (!reply) throw new Error('empty LLM reply');
    return {reply, source: typeof payload.source === 'string' ? payload.source : 'llm'};
  } catch (error) {
    return {
      reply: '',
      source: error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'fallback',
    };
  } finally {
    clear();
  }
}

export async function fetchRobotEmotionEvents(since?: string): Promise<RobotEmotionEvent[]> {
  const {signal, clear} = withTimeout(2000);
  try {
    const qs = since ? `?since=${encodeURIComponent(since)}` : '';
    const response = await fetch(`${BRIDGE_URL}/api/display/emotion-events${qs}`, {signal});
    if (!response.ok) return [];
    const payload = await response.json().catch(() => ({}));
    return Array.isArray(payload.events) ? payload.events.filter((event: Partial<RobotEmotionEvent>) => {
      return typeof event.id === 'string' && typeof event.emotion === 'string';
    }) as RobotEmotionEvent[] : [];
  } catch {
    return [];
  } finally {
    clear();
  }
}

export async function pushGuardianSnapshot(payload: GuardianSnapshotPayload): Promise<void> {
  try {
    await fetch(`${BRIDGE_URL}/api/display/guardian-snapshot`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // Bridge offline is expected during standalone demo — silently ignore
  }
}

export async function pushRobotAssignment(payload: RobotAssignmentPayload): Promise<void> {
  try {
    await fetch(`${BRIDGE_URL}/api/display/robot-assignment`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(1600),
    });
  } catch {
    // Robot display sync is best-effort; the main command center should keep running.
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
