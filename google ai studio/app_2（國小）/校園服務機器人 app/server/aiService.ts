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

export type VisionSceneLabel = 'crowd' | 'safety' | 'cleaning' | 'delivery' | 'patrol';

const VALID_SCENE_LABELS: VisionSceneLabel[] = ['crowd', 'safety', 'cleaning', 'delivery', 'patrol'];

export async function classifyVisionScene(imageBase64: string): Promise<{scene: VisionSceneLabel; confidence: number; zone: string; summary: string; source: 'gemini' | 'local'}> {
  if (!ai) {
    return {scene: 'patrol', confidence: 60, zone: '校園巡邏區', summary: '（Gemini 未設定，使用預設場景）', source: 'local'};
  }
  const zonePool = ['A 棟穿堂', 'B 棟走廊', '五年級教室', '操場入口', '福利社前'];
  try {
    const prompt = `請分析這張台灣國小校園照片，選出最符合的場景類別，輸出純 JSON（不含任何說明文字）：

類別（只能選一個）：
- crowd   → 走廊擁擠、下課人潮、集合排隊、多人聚集
- safety  → 通道阻塞、地面危險、異常聚集、暗區、跌倒風險
- cleaning → 地面髒污、水漬、廢棄物、明顯清掃需求
- delivery → 便當箱、包裹、取物區、教室發送物品情境
- patrol  → 空曠走廊、操場、無特殊事件的一般環境

{"scene":"<類別>","confidence":<0-100整數，反映你的確信度>,"zone":"<一個繁體中文地點，如「B棟走廊」>","summary":"<一句繁體中文，具體描述畫面情境和建議行動>"}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      config: {systemInstruction: '你是台灣國小校園服務機器人的視覺 AI 模組，專門分析校園安全與服務需求。分析要精確、快速，只回傳 JSON。'},
      contents: [{role: 'user', parts: [
        {text: prompt},
        {inlineData: {mimeType: 'image/jpeg', data: imageBase64}},
      ]}],
    });
    const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    // Strip markdown code fences (```json ... ``` or ``` ... ```) before extracting JSON
    const raw = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
    const jsonMatch = raw.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) throw new Error('no json');
    const parsed = JSON.parse(jsonMatch[0]) as {scene?: string; confidence?: number; zone?: string; summary?: string};
    const scene = VALID_SCENE_LABELS.includes(parsed.scene as VisionSceneLabel) ? parsed.scene as VisionSceneLabel : 'patrol';
    const confidence = typeof parsed.confidence === 'number' ? Math.max(0, Math.min(100, parsed.confidence)) : 75;
    const zone = typeof parsed.zone === 'string' && parsed.zone ? parsed.zone : zonePool[Math.floor(Math.random() * zonePool.length)];
    const summary = typeof parsed.summary === 'string' && parsed.summary ? parsed.summary : '';
    return {scene, confidence, zone, summary, source: 'gemini'};
  } catch {
    return {scene: 'patrol', confidence: 60, zone: zonePool[Math.floor(Math.random() * zonePool.length)], summary: '（辨識失敗，使用預設場景）', source: 'local'};
  }
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
      model: 'gemini-2.5-flash',
      contents: [{role: 'user', parts: [{text: prompt}]}],
    });
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    if (!text) throw new Error('empty response');
    return {reply: text, source: 'gemini'};
  } catch {
    return {reply: localDeliveryReply(), source: 'local'};
  }
}
