import {GoogleGenAI} from '@google/genai';

const geminiApiKey = process.env.GEMINI_API_KEY?.trim() || process.env.VITE_GEMINI_API_KEY?.trim() || '';
const ai = geminiApiKey ? new GoogleGenAI({apiKey: geminiApiKey}) : null;

export function isGeminiConfigured(): boolean {
  return Boolean(ai);
}

const LOCAL_GUARDIAN_REPLIES: Record<string, string> = {
  high: '偵測到高風險信號，建議立即通知輔導老師並確認學生狀況。請保持冷靜，先確認學生安全。',
  medium: '注意到異常情緒波動，建議安排老師主動關懷，了解學生近況。',
  low: '感知到輕微壓力信號，可考慮創造輕鬆對話機會，讓學生自然表達。',
  default: '已記錄本次守護事件，建議持續觀察並與輔導系統保持連線。',
};

function localGuardianReply(alertType = 'default'): string {
  return LOCAL_GUARDIAN_REPLIES[alertType] ?? LOCAL_GUARDIAN_REPLIES.default;
}

export interface GuardianAlertContext {
  alertType?: string;
  severity?: 'high' | 'medium' | 'low';
  zoneId?: string;
  zoneName?: string;
  message?: string;
}

export async function analyzeGuardianAlert(context: GuardianAlertContext): Promise<{reply: string; source: 'gemini' | 'local'}> {
  const severity = context.severity ?? 'low';
  if (!ai) {
    return {reply: localGuardianReply(severity), source: 'local'};
  }
  try {
    const prompt = [
      '你是校園心靈守護 AI，協助老師判斷學生情緒風險並給出非診斷式的關懷建議。請用 2-3 句繁體中文回覆，語氣溫暖專業，不做醫療診斷。',
      context.zoneName ? `區域：${context.zoneName}` : '',
      context.alertType ? `預警類型：${context.alertType}` : '',
      `嚴重度：${severity}`,
      context.message ? `觀察到：${context.message}` : '',
    ].filter(Boolean).join('\n');

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{role: 'user', parts: [{text: prompt}]}],
    });
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    if (!text) throw new Error('empty response');
    return {reply: text, source: 'gemini'};
  } catch {
    return {reply: localGuardianReply(severity), source: 'local'};
  }
}
