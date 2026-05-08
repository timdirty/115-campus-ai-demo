import {GoogleGenAI} from '@google/genai';

const geminiApiKey = process.env.GEMINI_API_KEY?.trim() || process.env.VITE_GEMINI_API_KEY?.trim() || '';
const ai = geminiApiKey ? new GoogleGenAI({apiKey: geminiApiKey}) : null;

export function isGeminiConfigured(): boolean {
  return Boolean(ai);
}

const LOCAL_DELIVERY_REPLIES = [
  '建議優先配送保健室，確保藥品及時到達。',
  '請確認配送路線：從中央廚房出發，先到圖書館，再到保健室。',
  '溫度敏感物品請使用保溫袋，並加快配送速度。',
  '建議配送順序：緊急 > 一般 > 定期補給。',
  '目前廊道人流較多，建議等待人群散去後再啟動機器人。',
  '配送任務已記錄，請確認收件老師已就位。',
];

function localDeliveryReply(): string {
  return LOCAL_DELIVERY_REPLIES[Math.floor(Math.random() * LOCAL_DELIVERY_REPLIES.length)];
}

export interface DeliveryContext {
  command?: string;
  destination?: string;
  taskDescription?: string;
  userMessage?: string;
}

export async function analyzeDeliveryTask(context: DeliveryContext): Promise<{reply: string; source: 'gemini' | 'local'}> {
  if (!ai) {
    return {reply: localDeliveryReply(), source: 'local'};
  }
  try {
    const prompt = [
      '你是校園服務機器人 AI 助手，協助老師決策配送任務。請用 1-2 句繁體中文給出配送建議。',
      context.destination ? `目的地：${context.destination}` : '',
      context.command ? `指令：${context.command}` : '',
      context.taskDescription ? `任務描述：${context.taskDescription}` : '',
      context.userMessage ? `老師詢問：${context.userMessage}` : '',
    ].filter(Boolean).join('\n');

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{role: 'user', parts: [{text: prompt}]}],
    });
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    if (!text) throw new Error('empty response');
    return {reply: text, source: 'gemini'};
  } catch {
    return {reply: localDeliveryReply(), source: 'local'};
  }
}
