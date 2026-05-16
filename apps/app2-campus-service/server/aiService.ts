import {GoogleGenAI} from '@google/genai';

const geminiApiKey = process.env.GEMINI_API_KEY?.trim() || process.env.VITE_GEMINI_API_KEY?.trim() || '';
const ai = geminiApiKey ? new GoogleGenAI({apiKey: geminiApiKey}) : null;
const defaultHostedModel = 'gemini-2.5-flash';
const visionModel = process.env.GEMINI_VISION_MODEL?.trim() || process.env.GEMINI_MODEL?.trim() || defaultHostedModel;
const textModel = process.env.GEMINI_TEXT_MODEL?.trim() || process.env.GEMINI_MODEL?.trim() || visionModel;

export function isGeminiConfigured(): boolean {
  return Boolean(ai);
}

export function getAiModelName(): string {
  return visionModel;
}

// 自動 strip data: URL prefix — 前端 / FileReader / Canvas 常送 data:image/png;base64,XXX，
// Gemini inline_data.data 只認純 base64。沒 prefix 時保留原值（也支援純 base64）。
function stripDataUrl(input: string): {data: string; mimeType: string} {
  const match = /^data:([^;]+);base64,(.+)$/.exec(input.trim());
  if (match) return {mimeType: match[1] || 'image/jpeg', data: match[2]};
  return {mimeType: 'image/jpeg', data: input.trim()};
}

export function getAiErrorInfo(error: unknown): {message: string; code: string; statusCode: number} {
  const raw = error instanceof Error ? error.message : String(error);
  let status = '';
  let message = raw;
  try {
    const parsed = JSON.parse(raw) as {error?: {status?: string; message?: string; code?: number}};
    status = parsed.error?.status ?? '';
    message = parsed.error?.message ?? raw;
  } catch {
    // SDK errors often arrive as plain Error.message; keep the raw message.
  }
  if (/PERMISSION_DENIED|denied access|403/i.test(`${status} ${message}`)) {
    return {
      message: `Hosted AI model access denied for ${visionModel}. Check this API key/project access or set GEMINI_VISION_MODEL to an allowed model.`,
      code: 'AI_MODEL_PERMISSION_DENIED',
      statusCode: 403,
    };
  }
  if (/NOT_FOUND|not found|404/i.test(`${status} ${message}`)) {
    return {
      message: `Hosted AI model ${visionModel} is not available to this API key/API version.`,
      code: 'AI_MODEL_NOT_FOUND',
      statusCode: 404,
    };
  }
  return {
    message: `Hosted vision request failed for ${visionModel}.`,
    code: 'AI_REQUEST_FAILED',
    statusCode: 502,
  };
}

function withAiTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, ms = 20_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`AI call timed out after ${ms}ms`)), ms);
  return fn(controller.signal).finally(() => clearTimeout(timer));
}

export async function checkAiAccess(): Promise<{ok: boolean; model: string; error?: string; errorCode?: string}> {
  if (!ai) {
    return {ok: false, model: visionModel, error: 'GEMINI_API_KEY is missing', errorCode: 'GEMINI_KEY_MISSING'};
  }
  try {
    await withAiTimeout((signal) => ai.models.generateContent({
      model: visionModel,
      config: {abortSignal: signal},
      contents: 'Return exactly OK.',
    }));
    return {ok: true, model: visionModel};
  } catch (error) {
    const info = getAiErrorInfo(error);
    return {ok: false, model: visionModel, error: info.message, errorCode: info.code};
  }
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

export type VisionSceneLabel = 'crowd' | 'safety' | 'cleaning' | 'delivery' | 'patrol' | 'other';

const VALID_SCENE_LABELS: VisionSceneLabel[] = ['crowd', 'safety', 'cleaning', 'delivery', 'patrol', 'other'];
const VISION_SUMMARIES: Record<VisionSceneLabel, string> = {
  crowd: '畫面出現多名學生或走廊人流，建議啟動廣播疏導並提醒慢行。',
  safety: '畫面可能有通道阻塞或安全風險，建議派遣巡查並保留紀錄。',
  cleaning: '畫面可能有地面或環境清潔需求，建議加入清掃路線。',
  delivery: '畫面接近教室取物或配送情境，建議建立配送任務。',
  patrol: '畫面未見明顯事件，建議列入日常巡邏觀察。',
  other: '畫面不像校園任務場景，先不派遣機器人，請重新對準校園場景。',
};

function clampConfidence(value: unknown, fallback: number): number {
  return typeof value === 'number' ? Math.max(0, Math.min(100, Math.round(value))) : fallback;
}

function inferZoneFromVisionText(text: string, fallback: string): string {
  const lower = text.toLowerCase();
  if (/一般畫面|不是校園|非校園|person|face|selfie|phone|desk|chair|seat|room|bedroom|office/.test(lower)) return '一般畫面';
  if (/操場|playground|field/.test(lower)) return '操場入口';
  if (/教室|classroom/.test(lower)) return '五年級教室';
  if (/福利社|canteen|cafeteria|lunch|meal|food/.test(lower)) return '福利社前';
  if (/走廊|corridor|hallway|hall\b/.test(lower)) return 'B 棟走廊';
  if (/入口|穿堂|entrance/.test(lower)) return 'A 棟穿堂';
  return fallback;
}

function inferSceneFromVisionText(text: string): VisionSceneLabel {
  const lower = text.toLowerCase();
  if (/單人|一個人|人臉|臉|自拍|手機|桌面|椅子|座椅|房間|辦公室|person|face|selfie|phone|desk|chair|seat|room|bedroom|office/.test(lower)) return 'other';
  if (/便當|餐|飲|包裹|取物|配送|package|delivery|food|lunch|meal/.test(lower)) return 'delivery';
  if (/垃圾|髒|清掃|地板|水漬|clean|trash|litter|dirty|floor|spill/.test(lower)) return 'cleaning';
  if (/書包|水壺|障礙|絆倒|跌倒|阻塞|危險|blocked|obstacle|hazard|fall|fallen|trip/.test(lower)) return 'safety';
  if (/人流|擁擠|集合|學生|多人|crowd|busy|children|students|many people|group/.test(lower)) return 'crowd';
  if (/安全巡查|安全風險|safety risk/.test(lower)) return 'safety';
  return 'other';
}

function parseVisionResponse(rawText: string, zonePool: string[]): {scene: VisionSceneLabel; confidence: number; zone: string; summary: string} {
  const raw = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  const jsonMatch = raw.match(/\{[\s\S]*?\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as {scene?: string; confidence?: number; zone?: string; summary?: string};
      const scene = VALID_SCENE_LABELS.includes(parsed.scene as VisionSceneLabel) ? parsed.scene as VisionSceneLabel : inferSceneFromVisionText(raw);
      return {
        scene,
        confidence: clampConfidence(parsed.confidence, 82),
        zone: typeof parsed.zone === 'string' && parsed.zone ? parsed.zone : inferZoneFromVisionText(raw, zonePool[0]),
        summary: typeof parsed.summary === 'string' && parsed.summary ? parsed.summary : VISION_SUMMARIES[scene],
      };
    } catch {
      // Hosted models may describe the requested schema before answering; fall through to text parsing.
    }
  }
  const scene = inferSceneFromVisionText(raw);
  return {
    scene,
    confidence: scene === 'other' ? 54 : scene === 'patrol' ? 72 : 84,
    zone: inferZoneFromVisionText(raw, zonePool[0]),
    summary: VISION_SUMMARIES[scene],
  };
}

export async function classifyVisionScene(imageBase64: string): Promise<{scene: VisionSceneLabel; confidence: number; zone: string; summary: string; source: 'gemini' | 'local'; model?: string}> {
  if (!ai) {
    throw new Error('GEMINI_API_KEY is missing');
  }
  const zonePool = ['A 棟穿堂', 'B 棟走廊', '五年級教室', '操場入口', '福利社前'];
  try {
    const prompt = `請分析這張照片，判斷它是否真的適合派遣台灣國小校園服務機器人。輸出純 JSON（不含任何說明文字）：

類別（只能選一個）：
- crowd   → 走廊擁擠、下課人潮、集合排隊、多人聚集
- safety  → 通道阻塞、地面危險、異常聚集、暗區、跌倒風險
- cleaning → 地面髒污、水漬、廢棄物、明顯清掃需求
- delivery → 便當箱、包裹、取物區、教室發送物品情境
- patrol  → 空曠走廊、操場、無特殊事件的一般環境
- other   → 單人、自拍、人臉、桌面、手機、椅子、房間、辦公室，或任何不像校園任務的畫面

重要規則：
- 不要硬把畫面套進校園任務。若只有一個人、臉、椅子、手機或桌面，scene 必須是 "other"。
- confidence 要反映確信度；不確定就低於 70。
- zone 只能寫你在畫面中能合理看出的地點；看不出校園地點時寫「一般畫面」。

{"scene":"<類別>","confidence":<0-100整數，反映你的確信度>,"zone":"<一個繁體中文地點，如「B棟走廊」>","summary":"<一句繁體中文，具體描述畫面情境和建議行動>"}`;

    const media = stripDataUrl(imageBase64);
    const response = await withAiTimeout((signal) => ai.models.generateContent({
      model: visionModel,
      config: {systemInstruction: '你是台灣國小校園服務機器人的視覺 AI 模組。你必須保守判斷，不可以把非校園任務畫面硬分類成校園任務。只回傳 JSON。', abortSignal: signal},
      contents: [{role: 'user', parts: [
        {text: prompt},
        {inlineData: {mimeType: media.mimeType, data: media.data}},
      ]}],
    }));
    const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    if (!rawText) throw new Error('empty response');
    const {scene, confidence, zone, summary} = parseVisionResponse(rawText, zonePool);
    return {scene, confidence, zone, summary, source: 'gemini', model: visionModel};
  } catch (error) {
    console.warn('[ai] Hosted vision failed:', error instanceof Error ? error.message : String(error));
    throw error;
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

    const response = await withAiTimeout((signal) => ai.models.generateContent({
      model: textModel,
      config: {abortSignal: signal},
      contents: [{role: 'user', parts: [{text: prompt}]}],
    }));
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    if (!text) throw new Error('empty response');
    return {reply: text, source: 'gemini'};
  } catch {
    return {reply: localDeliveryReply(), source: 'local'};
  }
}

export async function generateTeacherReply(question: string, subject?: string): Promise<{reply: string; source: 'gemini' | 'local'}> {
  if (!ai) return {reply: '', source: 'local'};
  try {
    const prompt = `你是台灣國小老師的 AI 助教。學生提問：「${question}」${subject ? `\n科目：${subject}` : ''}\n用 2-3 句繁體中文回答，語氣親切但專業，可以鼓勵學生思考。`;
    const response = await withAiTimeout((signal) => ai.models.generateContent({
      model: textModel,
      config: {abortSignal: signal},
      contents: [{role: 'user', parts: [{text: prompt}]}],
    }));
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    if (!text) throw new Error('empty response');
    return {reply: text, source: 'gemini'};
  } catch {
    return {reply: '', source: 'local'};
  }
}

export async function generateDispatchRecommendation(zone: string, taskType: string): Promise<{recommendation: string; source: 'gemini' | 'local'}> {
  if (!ai) return {recommendation: '', source: 'local'};
  try {
    const prompt = `你是校園服務機器人派遣 AI。請給出派遣建議。\n區域：${zone}\n任務類型：${taskType}\n用 1-2 句繁體中文回答，提示風險、優先順序或注意事項。`;
    const response = await withAiTimeout((signal) => ai.models.generateContent({
      model: textModel,
      config: {abortSignal: signal},
      contents: [{role: 'user', parts: [{text: prompt}]}],
    }));
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    if (!text) throw new Error('empty response');
    return {recommendation: text, source: 'gemini'};
  } catch {
    return {recommendation: '', source: 'local'};
  }
}

export async function generateStudentReport(name: string, data: Record<string, unknown>): Promise<{report: string; source: 'gemini' | 'local'}> {
  if (!ai) return {report: '', source: 'local'};
  try {
    const prompt = `你是台灣國小導師的 AI 助手，幫忙撰寫學生學習狀態報告。\n學生：${name}\n數據：${JSON.stringify(data).slice(0, 800)}\n用 3-4 句繁體中文總結，重點放在學習表現、互動狀況、建議方向。`;
    const response = await withAiTimeout((signal) => ai.models.generateContent({
      model: textModel,
      config: {abortSignal: signal},
      contents: [{role: 'user', parts: [{text: prompt}]}],
    }));
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    if (!text) throw new Error('empty response');
    return {report: text, source: 'gemini'};
  } catch {
    return {report: '', source: 'local'};
  }
}

export type ClassroomScanResult = {count: number; rate: number; confidence: number; summary: string};

export async function estimateClassroomAttendance(imageBase64: string): Promise<ClassroomScanResult> {
  if (!ai) throw new Error('GEMINI_API_KEY is missing');

  const prompt = `你是台灣國小教室出缺席 AI 助手。請估算這張教室照片中可見的學生人數。假設全班 30 人，根據可見人數計算出席率。
只回傳純 JSON，不含任何說明文字：
{"count":<整數，估算可見學生人數>,"rate":<0-100出席率百分比整數>,"confidence":<0-100你的確信度>,"summary":"<一句繁體中文描述教室狀況>"}
規則：若不確定或看不到學生，count 填 0，confidence 填低於 40。`;

  const media = stripDataUrl(imageBase64);
  const response = await withAiTimeout((signal) => ai.models.generateContent({
    model: visionModel,
    config: {systemInstruction: '你是教室出缺席估算 AI。只回傳 JSON。', abortSignal: signal},
    contents: [{role: 'user', parts: [
      {text: prompt},
      {inlineData: {mimeType: media.mimeType, data: media.data}},
    ]}],
  }));

  const rawText = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
  if (!rawText) throw new Error('empty response');

  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('no JSON in response');

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error('invalid JSON response');
  }

  return {
    count: typeof parsed.count === 'number' ? Math.max(0, Math.round(parsed.count)) : 0,
    rate: typeof parsed.rate === 'number' ? Math.min(100, Math.max(0, Math.round(parsed.rate))) : 0,
    confidence: typeof parsed.confidence === 'number' ? Math.min(100, Math.max(0, Math.round(parsed.confidence))) : 0,
    summary: typeof parsed.summary === 'string' && parsed.summary ? parsed.summary : '無法判斷',
  };
}
