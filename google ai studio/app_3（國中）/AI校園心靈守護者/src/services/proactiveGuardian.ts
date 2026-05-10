import {GuardianState, RiskLevel} from '../types';

export interface FusionSignal {
  label: string;
  score: number;
  max: number;
}

export interface ProactiveInsight {
  riskLevel: RiskLevel;
  location: string;
  title: string;
  description: string;
  reasons: string[];
  score: number;
  signals: FusionSignal[];
}

export function evaluateProactiveGuardianState(state: GuardianState): ProactiveInsight {
  const reasons: string[] = [];
  let moodScore = 0;
  let soundScore = 0;
  let nodeScore = 0;
  let alertScore = 0;

  const latestMood = state.moodLogs[0];
  if (latestMood?.mood === 'worried') {
    moodScore = 2;
    reasons.push(`最新心情簽到為「${latestMood.label}」`);
  } else if (latestMood?.mood === 'tired') {
    moodScore = 1;
    reasons.push(`最新心情簽到為「${latestMood.label}」`);
  }

  const latestSound = state.acousticSignals[0];
  if (latestSound?.level === 'elevated') {
    soundScore = 3;
    reasons.push(`環境聲量偏高，音量 ${latestSound.volumeIndex}、波動 ${latestSound.volatility}`);
  } else if (latestSound?.level === 'active') {
    soundScore = 1;
    reasons.push(`環境聲量有活動感，音量 ${latestSound.volumeIndex}`);
  }

  const attentionNodes = state.nodes.filter((node) => node.status === 'attention');
  const offlineNodes = state.nodes.filter((node) => node.status === 'offline');
  if (attentionNodes.length > 0) {
    nodeScore += 2;
    reasons.push(`${attentionNodes.length} 個校園節點進入注意狀態`);
  }
  if (offlineNodes.length > 0) {
    nodeScore += 1;
    reasons.push(`${offlineNodes.length} 個節點離線，需確認資料是否中斷`);
  }

  const openHighAlerts = state.alerts.filter((alert) => alert.status !== 'resolved' && alert.riskLevel === 'high');
  if (openHighAlerts.length > 0) {
    alertScore = 2;
    reasons.push(`${openHighAlerts.length} 則高優先關懷提醒尚未結案`);
  }

  const score = moodScore + soundScore + nodeScore + alertScore;
  const riskLevel: RiskLevel = score >= 7 ? 'high' : score >= 4 ? 'medium' : 'low';
  const location = latestSound?.level === 'elevated' ? latestSound.location : attentionNodes[0]?.location ?? openHighAlerts[0]?.location ?? '全校';
  const title = riskLevel === 'high' ? 'AI 主動巡查：優先關懷' : riskLevel === 'medium' ? 'AI 主動巡查：需要觀察' : 'AI 主動巡查：狀態穩定';
  const description =
    reasons.length > 0
      ? `多來源訊號融合結果：${reasons.join('；')}。系統不做心理診斷，只建議老師以低壓方式觀察與關懷。`
      : '目前多來源訊號平穩，維持一般巡查頻率即可。';

  const signals: FusionSignal[] = [
    {label: '心情訊號', score: moodScore, max: 2},
    {label: '聲量訊號', score: soundScore, max: 3},
    {label: '節點狀態', score: nodeScore, max: 3},
    {label: '未結提醒', score: alertScore, max: 2},
  ];

  return {riskLevel, location, title, description, reasons, score, signals};
}
