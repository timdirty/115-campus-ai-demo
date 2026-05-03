import {GuardianState, RiskLevel, SchoolZone, ZoneSensorReading} from '../types';

export interface SchoolZoneStatus extends SchoolZone {
  nodeStatus: string;
  stability: number;
  soundIndex: number;
  alertCount: number;
  riskScore: number;
  riskLevel: RiskLevel;
  summary: string;
  sensor?: ZoneSensorReading;
}

export const schoolZones: SchoolZone[] = [
  {id: 'zone-library', name: '圖書館', location: '圖書館走廊', nodeId: 'node-library', x: 4, y: 6},
  {id: 'zone-hall', name: '穿堂', location: '行政大樓 1F', nodeId: 'node-hall', x: 44, y: 6},
  {id: 'zone-field', name: '操場', location: '操場', nodeId: 'node-restroom', x: 72, y: 28},
];

export function buildSchoolZoneStatuses(state: GuardianState, sensorReadings: ZoneSensorReading[] = []): SchoolZoneStatus[] {
  return schoolZones.map((zone) => {
    const node = state.nodes.find((item) => item.id === zone.nodeId);
    const zoneAlerts = state.alerts.filter((alert) => alert.status !== 'resolved' && matchesZone(alert.location, zone));
    const sound = state.acousticSignals.find((signal) => matchesZone(signal.location, zone));
    const sensor = sensorReadings.find((s) => s.zoneId === zone.id);
    const soundIndex = sound?.volumeIndex ?? Math.max(18, Math.min(92, node?.load ?? 30));
    const alertWeight = zoneAlerts.reduce((total, alert) => total + (alert.riskLevel === 'high' ? 22 : alert.riskLevel === 'medium' ? 14 : 7), 0);
    const nodeWeight = node?.status === 'offline' ? 18 : node?.status === 'attention' ? 12 : 0;
    const soundWeight = sound?.level === 'elevated' ? 18 : sound?.level === 'active' ? 9 : 0;
    const sensorWeight = sensor?.connected
      ? (sensor.temp !== null && sensor.temp > 30 ? 12 : 0) +
        (sensor.light !== null && sensor.light < 150 ? 10 : 0)
      : 0;
    const riskScore = Math.max(0, Math.min(100, Math.round(20 + alertWeight + nodeWeight + soundWeight + sensorWeight + soundIndex * 0.28)));
    const riskLevel: RiskLevel = riskScore >= 72 ? 'high' : riskScore >= 48 ? 'medium' : 'low';
    const stability = Math.max(0, 100 - riskScore);
    const summary =
      riskLevel === 'high'
        ? '建議立即派老師或機器人前往提示與引導。'
        : riskLevel === 'medium'
          ? '建議值週老師觀察，必要時派機器人前往。'
          : '維持一般巡查。';

    return {
      ...zone,
      nodeStatus: node?.status ?? 'unknown',
      stability,
      soundIndex,
      alertCount: zoneAlerts.length,
      riskScore,
      riskLevel,
      summary,
      sensor,
    };
  });
}

function matchesZone(location: string, zone: SchoolZone) {
  return location.includes(zone.name) || zone.location.includes(location) || location.includes(zone.location);
}
