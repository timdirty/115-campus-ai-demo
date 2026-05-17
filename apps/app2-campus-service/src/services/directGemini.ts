// Direct browser → Gemini REST calls.
// Used on GitHub Pages where the local bridge (localhost:3202) is unavailable.
// SECURITY: VITE_GEMINI_API_KEY is baked into the bundle. Restrict the key via
// HTTP referrer in Google Cloud Console to `https://timdirty.github.io/*` only.

const VISION_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-2.5-flash'];

function getApiKey(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((import.meta as any).env?.VITE_GEMINI_API_KEY as string) || '';
  } catch {
    return '';
  }
}

export function isDirectGeminiAvailable(): boolean {
  return Boolean(getApiKey());
}

function isRetriableError(status: number, body: string): boolean {
  if (status === 401) return false;
  if (/UNAUTHENTICATED|API key not valid/i.test(body)) return false;
  return true;
}

type GenPart = {text: string} | {inlineData: {mimeType: string; data: string}};
type GenContent = {role?: 'user' | 'model'; parts: GenPart[]};

async function callModel(model: string, contents: GenContent[], timeoutMs = 30000): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('VITE_GEMINI_API_KEY not configured');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({contents}),
        signal: controller.signal,
      },
    );
    if (!resp.ok) {
      const body = await resp.text();
      const err = new Error(`Gemini ${model} ${resp.status}: ${body.slice(0, 200)}`) as Error & {status: number; body: string};
      err.status = resp.status;
      err.body = body;
      throw err;
    }
    const data = await resp.json() as {candidates?: Array<{content?: {parts?: Array<{text?: string}>}}>};
    return data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') ?? '';
  } finally {
    clearTimeout(timer);
  }
}

async function callWithFallback(models: string[], contents: GenContent[], timeoutMs = 30000): Promise<string> {
  let lastError: unknown = new Error('No models tried');
  for (const model of models) {
    try {
      return await callModel(model, contents, timeoutMs);
    } catch (e) {
      lastError = e;
      const status = (e as {status?: number})?.status ?? 0;
      const body = (e as {body?: string})?.body ?? (e as Error).message ?? '';
      if (!isRetriableError(status, body)) throw e;
    }
  }
  throw lastError;
}

function parseJsonFromText<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1];
  const jsonText = fenced ?? text.match(/\{[\s\S]*\}/)?.[0] ?? text;
  return JSON.parse(jsonText) as T;
}

function stripDataUrl(input: string): {data: string; mimeType: string} {
  const match = /^data:([^;]+);base64,(.+)$/.exec(input.trim());
  if (match) return {mimeType: match[1], data: match[2]};
  return {mimeType: 'image/jpeg', data: input.trim()};
}

// ── Classroom attendance scan ─────────────────────────────────────────────

export type DirectClassroomSignal = {type: 'question' | 'distracted'; description: string};
export type DirectClassroomScanResult = {count: number; rate: number; confidence: number; summary: string; signals: DirectClassroomSignal[]};

export async function directScanClassroom(imageBase64: string): Promise<DirectClassroomScanResult> {
  const prompt = `你是台灣國小教室出缺席 AI 助手。請估算這張教室照片中可見的學生人數，並偵測需要老師關注的學生狀態。假設全班 30 人。
只回傳純 JSON，不含任何說明文字：
{"count":<整數，估算可見學生人數>,"rate":<0-100出席率百分比整數>,"confidence":<0-100你的確信度>,"summary":"<一句繁體中文描述整體教室狀況>","signals":[{"type":"question","description":"<繁體中文，描述哪些學生舉手或提問>"},{"type":"distracted","description":"<繁體中文，描述哪些學生分心或低頭>"}]}
規則：
- signals 只包含 question（舉手/提問）和 distracted（分心/低頭/使用手機）兩種
- 若沒有偵測到該類型的學生，不要加入 signals 陣列
- 若不確定或看不到學生，count 填 0，confidence 填低於 40，signals 填 []`;

  const {mimeType, data} = stripDataUrl(imageBase64);
  const contents: GenContent[] = [{
    role: 'user',
    parts: [{text: prompt}, {inlineData: {mimeType, data}}],
  }];

  const text = await callWithFallback(VISION_MODELS, contents);
  const parsed = parseJsonFromText<Record<string, unknown>>(text);

  const rawSignals = Array.isArray(parsed.signals) ? parsed.signals : [];
  const signals: DirectClassroomSignal[] = rawSignals
    .filter((s): s is {type: unknown; description: unknown} => s !== null && typeof s === 'object')
    .filter((s) => s.type === 'question' || s.type === 'distracted')
    .map((s) => ({type: s.type as 'question' | 'distracted', description: typeof s.description === 'string' ? s.description : ''}));

  return {
    count: typeof parsed.count === 'number' ? Math.max(0, Math.round(parsed.count)) : 0,
    rate: typeof parsed.rate === 'number' ? Math.min(100, Math.max(0, Math.round(parsed.rate))) : 0,
    confidence: typeof parsed.confidence === 'number' ? Math.min(100, Math.max(0, Math.round(parsed.confidence))) : 0,
    summary: typeof parsed.summary === 'string' ? parsed.summary : '無法辨識教室狀況',
    signals,
  };
}

// ── Campus vision scene classification ───────────────────────────────────

export type DirectVisionScene = 'crowd' | 'safety' | 'cleaning' | 'delivery' | 'patrol' | 'other';
export type DirectVisionResult = {scene: DirectVisionScene; confidence: number; zone: string; summary: string};

const VALID_SCENES: DirectVisionScene[] = ['crowd', 'safety', 'cleaning', 'delivery', 'patrol', 'other'];

export async function directClassifyVisionScene(imageDataUrl: string): Promise<DirectVisionResult> {
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

  const {mimeType, data} = stripDataUrl(imageDataUrl);
  const contents: GenContent[] = [{
    role: 'user',
    parts: [{text: prompt}, {inlineData: {mimeType, data}}],
  }];

  const text = await callWithFallback(VISION_MODELS, contents, 15000);
  const parsed = parseJsonFromText<Record<string, unknown>>(text);
  const scene = VALID_SCENES.includes(parsed.scene as DirectVisionScene) ? parsed.scene as DirectVisionScene : 'patrol';

  return {
    scene,
    confidence: typeof parsed.confidence === 'number' ? Math.min(100, Math.max(0, Math.round(parsed.confidence))) : 50,
    zone: typeof parsed.zone === 'string' ? parsed.zone : '一般畫面',
    summary: typeof parsed.summary === 'string' ? parsed.summary : '',
  };
}
