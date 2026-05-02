import {GuardianState, RiskLevel} from '../types';

export interface ProactiveInsight {
  riskLevel: RiskLevel;
  location: string;
  title: string;
  description: string;
  reasons: string[];
  score: number;
}

export function evaluateProactiveGuardianState(state: GuardianState): ProactiveInsight {
  const reasons: string[] = [];
  let score = 0;

  const latestMood = state.moodLogs[0];
  if (latestMood?.mood === 'worried') {
    score += 2;
    reasons.push(`最新心情簽到為「${latestMood.label}」`);
  } else if (latestMood?.mood === 'tired') {
    score += 1;
    reasons.push(`最新心情簽到為「${latestMood.label}」`);
  }

  const latestSound = state.acousticSignals[0];
  if (latestSound?.level === 'elevated') {
    score += 3;
    reasons.push(`環境聲量偏高，音量 ${latestSound.volumeIndex}、波動 ${latestSound.volatility}`);
  } else if (latestSound?.level === 'active') {
    score += 1;
    reasons.push(`環境聲量有活動感，音量 ${latestSound.volumeIndex}`);
  }

  const attentionNodes = state.nodes.filter((node) => node.status === 'attention');
  const offlineNodes = state.nodes.filter((node) => node.status === 'offline');
  if (attentionNodes.length > 0) {
    score += 2;
    reasons.push(`${attentionNodes.length} 個校園節點進入注意狀態`);
  }
  if (offlineNodes.length > 0) {
    score += 1;
    reasons.push(`${offlineNodes.length} 個節點離線，需確認資料是否中斷`);
  }

  const openHighAlerts = state.alerts.filter((alert) => alert.status !== 'resolved' && alert.riskLevel === 'high');
  if (openHighAlerts.length > 0) {
    score += 2;
    reasons.push(`${openHighAlerts.length} 則高優先關懷提醒尚未結案`);
  }

  const riskLevel: RiskLevel = score >= 7 ? 'high' : score >= 4 ? 'medium' : 'low';
  const location = latestSound?.level === 'elevated' ? latestSound.location : attentionNodes[0]?.location ?? openHighAlerts[0]?.location ?? '全校';
  const title = riskLevel === 'high' ? 'AI 主動巡查：優先關懷' : riskLevel === 'medium' ? 'AI 主動巡查：需要觀察' : 'AI 主動巡查：狀態穩定';
  const description =
    reasons.length > 0
      ? `多來源訊號融合結果：${reasons.join('；')}。系統不做心理診斷，只建議老師以低壓方式觀察與關懷。`
      : '目前多來源訊號平穩，維持一般巡查頻率即可。';

  return {riskLevel, location, title, description, reasons, score};
}
