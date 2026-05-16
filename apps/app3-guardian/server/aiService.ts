import {GoogleGenAI, createPartFromBase64} from '@google/genai';

const geminiApiKey = process.env.GEMINI_API_KEY?.trim() || process.env.VITE_GEMINI_API_KEY?.trim() || '';
const ai = geminiApiKey ? new GoogleGenAI({apiKey: geminiApiKey}) : null;
const visionModel = process.env.GEMINI_VISION_MODEL?.trim() || process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash';

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
  category?: string;
  className?: string;
  studentAlias?: string;
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
      context.className ? `班級/場域：${context.className}` : '',
      context.studentAlias ? `對象：${context.studentAlias}` : '',
      context.alertType ? `預警類型：${context.alertType}` : '',
      context.category ? `分類：${context.category}` : '',
      `嚴重度：${severity}`,
      context.message ? `觀察到：${context.message}` : '',
      '請給老師可執行的關懷建議，包含第一步怎麼接近、現場要確認什麼、何時需要轉介。避免診斷或貼標籤。',
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

const VALID_EMOTIONS = new Set(['happy', 'calm', 'focused', 'anxious', 'sad', 'stressed']);

export interface EmotionAnalysis {
  emotion: string;
  response: string;
  advice: string;
  stress: number;
  stability: number;
  focus: number;
  moodLabel: string;
  riskLabel: string;
  fusionScore: number;
  source: 'gemini' | 'local';
  error?: string;
}

function stripDataUrl(input: string): {data: string; mimeType: string} {
  const match = /^data:([^;]+);base64,(.+)$/.exec(input.trim());
  if (match) return {mimeType: match[1] || 'image/jpeg', data: match[2]};
  return {mimeType: 'image/jpeg', data: input.trim()};
}

function parseJsonLoose<T>(text: string): T | null {
  try { return JSON.parse(text) as T; } catch { /* noop */ }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1];
  if (fenced) { try { return JSON.parse(fenced) as T; } catch { /* noop */ } }
  const braced = text.match(/[\[{][\s\S]*[\]}]/)?.[0];
  if (braced) { try { return JSON.parse(braced) as T; } catch { /* noop */ } }
  return null;
}

function clampInt(value: unknown, fallback: number, min = 0, max = 100): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
}

function localEmotionFallback(): EmotionAnalysis {
  return {
    emotion: 'calm',
    response: '目前狀態看起來平穩，保持自然觀察即可。',
    advice: '繼續關注學生互動情況，必要時主動關懷。',
    stress: 25,
    stability: 80,
    focus: 70,
    moodLabel: '平穩',
    riskLabel: '穩定',
    fusionScore: 7.5,
    source: 'local',
  };
}

export async function analyzeEmotionFromImage(imageBase64: string): Promise<EmotionAnalysis> {
  if (!ai) {
    return {...localEmotionFallback(), error: 'GEMINI_API_KEY 未設定，使用本地預設值'};
  }
  try {
    const media = stripDataUrl(imageBase64);
    const prompt = [
      '你是國中校園裡的「AI 心靈守護機器人」，正在用鏡頭做低壓、非診斷式的情緒觀察。',
      '請觀察畫面中學生的狀態（姿勢、頭部方向、表情線索、專注程度）。',
      '前端只支援這六種情緒，請務必選其中一種：',
      '- happy：愉悅。表情明亮、放鬆、有互動意願。',
      '- calm：平靜。狀態穩定、沒有明顯壓力。',
      '- focused：專注。注意力集中、投入學習。',
      '- anxious：焦慮。緊張、不安、注意力飄移。',
      '- sad：低落。疲倦、沮喪、趴桌、退縮。',
      '- stressed：緊張。高壓、明顯煩躁。',
      '請只輸出 JSON，不要 markdown 不要說明。格式：',
      '{"emotion":"...","stress":0-100,"stability":0-100,"focus":0-100,"moodLabel":"自然短標籤","riskLabel":"穩定/需留意/高關注","response":"機器人要說的一句話","advice":"給老師的一句建議"}',
    ].join('\n');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    let text = '';
    try {
      const response = await ai.models.generateContent({
        model: visionModel,
        contents: [{role: 'user', parts: [{text: prompt}, createPartFromBase64(media.data, media.mimeType)]}],
        config: {temperature: 0.3},
      });
      text = response.text?.trim() ?? response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    } finally {
      clearTimeout(timer);
    }

    const parsed = parseJsonLoose<Partial<EmotionAnalysis>>(text);
    if (!parsed) throw new Error('parse failed');

    const fallback = localEmotionFallback();
    const emotion = typeof parsed.emotion === 'string' && VALID_EMOTIONS.has(parsed.emotion) ? parsed.emotion : fallback.emotion;
    const stress = clampInt(parsed.stress, fallback.stress);
    const stability = clampInt(parsed.stability, fallback.stability);
    const focus = clampInt(parsed.focus, fallback.focus);
    return {
      emotion,
      response: String(parsed.response ?? fallback.response).slice(0, 120),
      advice: String(parsed.advice ?? fallback.advice).slice(0, 120),
      stress,
      stability,
      focus,
      moodLabel: String(parsed.moodLabel ?? fallback.moodLabel).slice(0, 30),
      riskLabel: String(parsed.riskLabel ?? fallback.riskLabel).slice(0, 30),
      fusionScore: Math.round((focus + stability + (100 - stress)) / 30 * 10) / 10,
      source: 'gemini',
    };
  } catch (err) {
    return {...localEmotionFallback(), error: err instanceof Error ? err.message : String(err)};
  }
}
