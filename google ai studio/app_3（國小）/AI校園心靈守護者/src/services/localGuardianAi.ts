import {GuardianAlert, GuardianState, MoodType} from '../types';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function generateSupportReply(input: string, mood?: MoodType) {
  await wait(220);
  const text = input.trim();
  if (/傷害自己|不想活|自殺|死掉|危險/.test(text)) {
    return '聽起來你正在承受很大的壓力。這種情況不要自己一個人撐著，請現在就找身邊可信任的大人、導師或輔導室老師；如果有立即危險，請立刻聯絡當地緊急救援。';
  }
  if (/霸凌|被排擠|欺負|同學/.test(text)) {
    return '被排擠或被欺負會很難受。你可以先把發生的時間、地點、人物記下來，找一位你信任的老師一起看，不需要自己單獨處理。';
  }
  if (/考試|成績|壓力|讀書/.test(text)) {
    return '考試壓力可以先拆小一點：今天只選一個最卡的單元，做三題就停下來檢查。完成小步驟，比一直責備自己更有幫助。';
  }
  if (mood === 'worried' || mood === 'tired') {
    return '謝謝你願意說出來。先做一次慢慢吸氣、慢慢吐氣，然後把現在最擔心的一件事寫成一句話，我們再一起想下一步。';
  }
  return '我聽到了。你可以再多說一點今天發生什麼事，也可以先選一個小行動：喝水、找老師說一句話、或把心情寫在心靈森林。';
}

export async function summarizeGuardianState(state: GuardianState) {
  await wait(160);
  const openAlerts = state.alerts.filter((alert) => alert.status !== 'resolved');
  const highAlerts = openAlerts.filter((alert) => alert.riskLevel === 'high');
  return `目前校園穩定度 ${state.stabilityScore}%，仍有 ${openAlerts.length} 則關懷提醒，其中 ${highAlerts.length} 則需優先由導師或輔導室確認。`;
}

export function recommendationForAlert(alert: GuardianAlert) {
  if (alert.riskLevel === 'high') {
    return '先由熟悉學生的老師進行低壓關懷，不公開點名；若學生提到立即危險，再啟動緊急轉介。';
  }
  if (alert.category.includes('課業')) {
    return '建議提供任務拆解表，讓學生先完成最小可行的一步。';
  }
  return '維持觀察並記錄變化，下一次班級活動後再回看趨勢。';
}
