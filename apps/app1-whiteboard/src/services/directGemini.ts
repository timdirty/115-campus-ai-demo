// Direct browser → Gemini REST calls.
// Used when the local bridge is unreachable (e.g. on GitHub Pages public deploy).
// SECURITY: VITE_GEMINI_API_KEY is baked into the bundle. Restrict the key via
// HTTP referrer in Google Cloud Console to `https://timdirty.github.io/*` only.

import type {BoardAnalysisResponse, BoardRegion} from './classroomApi';

type GenContent = {
  role?: 'user' | 'model';
  parts: Array<{text: string} | {inlineData: {mimeType: string; data: string}}>;
};

const VISION_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-2.5-flash'];
const CHAT_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemma-4-26b-a4b-it', 'gemini-2.5-flash'];

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

async function callModel(model: string, contents: GenContent[], config: Record<string, unknown> = {}, timeoutMs = 30000): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('VITE_GEMINI_API_KEY not configured');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({contents, generationConfig: config}),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const body = await resp.text();
      const err = new Error(`Gemini ${model} ${resp.status}: ${body.slice(0, 200)}`) as Error & {status: number; body: string};
      err.status = resp.status;
      err.body = body;
      throw err;
    }
    const data = await resp.json();
    return data.candidates?.[0]?.content?.parts?.map((p: {text?: string}) => p.text || '').join('') ?? '';
  } finally {
    clearTimeout(timer);
  }
}

async function callWithFallback(models: string[], contents: GenContent[], config: Record<string, unknown> = {}, timeoutMs = 30000): Promise<string> {
  let lastError: unknown = new Error('No models tried');
  for (const model of models) {
    try {
      return await callModel(model, contents, config, timeoutMs);
    } catch (e) {
      lastError = e;
      const status = (e as {status?: number})?.status ?? 0;
      const body = (e as {body?: string})?.body ?? (e as Error).message ?? '';
      if (!isRetriableError(status, body)) throw e;
      console.warn(`[directGemini] ${model} failed: ${(e as Error).message?.slice(0, 120)}`);
    }
  }
  throw lastError;
}

function parseJsonFromText<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1];
  const jsonText = fenced ?? text.match(/[\[{][\s\S]*[\]}]/)?.[0] ?? text;
  return JSON.parse(jsonText) as T;
}

function coerceMultilineString(value: unknown, fallback: string): string {
  if (value == null) return fallback;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((i) => coerceMultilineString(i, '')).filter(Boolean).join('\n');
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).map(([k, v]) => `${k}：\n${coerceMultilineString(v, '')}`).join('\n\n');
  }
  return String(value);
}

function cleanTranscriptionOutput(raw: string): string {
  let t = (raw ?? '').trim();
  t = t.replace(/^```[a-zA-Z]*\n?|\n?```$/g, '').trim();
  for (const p of [/^好的[,，]?\s*/, /^沒問題[,，]?\s*/, /^以下是.*?[:：]\s*/, /^這是.*?(逐字稿|整理).*?[:：]\s*/, /^根據您提供的.*?[:：]\s*/]) {
    t = t.replace(p, '').trim();
  }
  t = t.replace(/^\*+[^*\n]+\*+\s*[\n:：]?/gm, '').trim();
  t = t.split('\n').map((line) => line.replace(/^[\s\-*•·]+|^老師[:：]\s*|^學生[:：]\s*/g, '').trim()).filter(Boolean).join('\n');
  t = t.replace(/\n{2,}/g, '\n').trim();
  if (/^好的|^這是|^以下|範例文字|^展示逐字稿/.test(t)) return '';
  return t;
}

function stripDataUrl(value: string, fallbackMime: string): {mimeType: string; data: string} {
  const match = value.match(/^data:([^;,]+)(?:;[^,]*?)*;base64,(.*)$/s);
  const rawMime = match ? match[1] : fallbackMime;
  const mimeType = rawMime.toLowerCase().split(';')[0].trim();
  const data = (match ? match[2] : value).replace(/\s/g, '');
  return {mimeType, data};
}

const REGION_LAYOUT = {
  A: {x: 5, y: 12, width: 43, height: 76, label: '左區'},
  B: {x: 52, y: 12, width: 43, height: 76, label: '右區'},
} as const;

function normalizeBoardRegions(input: unknown): BoardRegion[] {
  const fallback: BoardRegion[] = [
    {id: 'A', label: '左區', x: 5, y: 12, width: 43, height: 76, status: 'keep', reason: '建議保留'},
    {id: 'B', label: '右區', x: 52, y: 12, width: 43, height: 76, status: 'erasable', reason: '可清空'},
  ];
  if (!Array.isArray(input)) return fallback;
  const used = new Set<string>();
  const regions = input.map((item, index) => {
    const src = item as Partial<BoardRegion>;
    const raw = String(src.id ?? '').toUpperCase();
    let id: 'A' | 'B' = (raw.match(/[AB]/)?.[0] as 'A' | 'B') ?? (index === 0 ? 'A' : 'B');
    if (used.has(id)) id = id === 'A' ? 'B' : 'A';
    used.add(id);
    const layout = REGION_LAYOUT[id];
    const status = src.status === 'erased' || src.status === 'erasable' || src.status === 'keep' ? src.status : 'keep';
    return {
      id,
      label: layout.label,
      x: layout.x, y: layout.y, width: layout.width, height: layout.height,
      status,
      reason: String(src.reason ?? '由白板分析產生'),
    };
  }).filter((r) => r.id === 'A' || r.id === 'B').slice(0, 2);
  return regions.length >= 2 ? regions : fallback;
}

const localFallbackContent = (subject: string, transcript: string) =>
  `課堂主題：${subject}\n\n給孩子看的重點：\n- 先用圖像或生活例子理解今天的概念。\n- 再把想法說出來，最後寫成一句完整答案或一個算式。\n- 如果有同學卡住，請回到圖解區重新看一次。\n\n老師講解重點：\n${transcript || '尚未提供老師講解'}\n\n下課前小檢核：\n- 請孩子用自己的話說出今天最重要的一句話。`;

export async function directAnalyzeBoard(input: {imageBase64: string; transcript?: string; subjectHint?: string}): Promise<BoardAnalysisResponse> {
  const {imageBase64, transcript = '', subjectHint = '國小數學'} = input;
  const media = stripDataUrl(imageBase64, 'image/jpeg');
  const prompt = [
    '你是繁體中文國小課堂白板 AI 助教，服務國小組競賽作品。請分析白板照片與教師逐字稿，產生可以直接保存的課堂資料。',
    '所有內容必須適合國小生與國小老師：句子短、用生活例子、避免高中以上術語，不做個人身份辨識。',
    '只輸出資料物件，不要 markdown。',
    '欄位：noteDraft, boardRegions, currentRecommendation, focusPercent, confusedPercent, tiredPercent。',
    'noteDraft 必須包含 title, subject, period, desc, content, ocrText, transcript, keywords, aiRecommendation。',
    'noteDraft.content 請包含「今日學習目標」、「板書重點」、「小朋友練習」、「老師提醒」。',
    'boardRegions 必須是 A、B 兩個大區塊：A 代表左區，B 代表右區。每個區塊包含 id, status, reason；status 只能是 keep, erasable, erased。',
    `科目提示：${subjectHint || '未提供'}`,
    `教師逐字稿：${transcript || '未提供'}`,
  ].join('\n');
  try {
    const text = await callWithFallback(VISION_MODELS, [
      {role: 'user', parts: [{text: prompt}, {inlineData: {mimeType: media.mimeType, data: media.data}}]},
    ], {temperature: 0.35}, 60000);
    type Parsed = Partial<BoardAnalysisResponse> & {noteDraft?: {content?: unknown; [k: string]: unknown}};
    const parsed = parseJsonFromText<Parsed>(text);
    const defaultContent = localFallbackContent(subjectHint, transcript);
    const noteDraft = {
      ...(parsed.noteDraft || {}),
      title: String(parsed.noteDraft?.title ?? `${subjectHint} 國小白板紀錄`),
      subject: String(parsed.noteDraft?.subject ?? subjectHint),
      period: String(parsed.noteDraft?.period ?? '即時擷取'),
      desc: String(parsed.noteDraft?.desc ?? '由白板快照與老師講解建立的國小課堂學習紀錄。'),
      content: coerceMultilineString(parsed.noteDraft?.content, defaultContent),
      ocrText: typeof parsed.noteDraft?.ocrText === 'string' ? parsed.noteDraft.ocrText as string : '',
      transcript: String(parsed.noteDraft?.transcript ?? transcript ?? ''),
      keywords: Array.isArray(parsed.noteDraft?.keywords) ? parsed.noteDraft.keywords as string[] : [],
      aiRecommendation: String(parsed.noteDraft?.aiRecommendation ?? ''),
      captureSource: 'camera' as const,
      img: imageBase64,
      imageUrl: imageBase64,
    } as BoardAnalysisResponse['noteDraft'];
    const boardRegions = normalizeBoardRegions(parsed.boardRegions);
    return {
      noteDraft,
      boardRegions,
      session: {
        ...((parsed as {session?: unknown}).session as object || {}),
        boardOcrText: noteDraft.ocrText,
        currentRecommendation: String(parsed.currentRecommendation ?? '建議保留左區重點，先清出右區，給下一題或上台分享使用。'),
        hardwareProfile: {boardCalibration: undefined, boardCalibrationMode: 'default', boardDetectionConfidence: 0, cameraMounted: true, visionReady: true},
      } as BoardAnalysisResponse['session'],
      currentRecommendation: String(parsed.currentRecommendation ?? '建議保留左區重點，先清出右區，給下一題或上台分享使用。'),
      focusPercent: Number(parsed.focusPercent ?? 80),
      confusedPercent: Number(parsed.confusedPercent ?? 14),
      tiredPercent: Number(parsed.tiredPercent ?? 6),
      teacherPace: 'normal',
      aiMode: 'gemini',
    } as BoardAnalysisResponse;
  } catch (e) {
    console.warn('[directGemini] analyzeBoard failed, returning local fallback:', e);
    return {
      noteDraft: {
        title: `${subjectHint} 國小白板紀錄`,
        subject: subjectHint,
        period: '即時擷取',
        desc: '展示模式：未連接 AI，使用範例文字。',
        content: localFallbackContent(subjectHint, transcript),
        ocrText: '',
        transcript,
        keywords: [],
        captureSource: 'camera',
        img: imageBase64,
        imageUrl: imageBase64,
        aiRecommendation: '',
      } as unknown as BoardAnalysisResponse['noteDraft'],
      boardRegions: normalizeBoardRegions(null),
      session: {boardOcrText: '', currentRecommendation: '展示模式', hardwareProfile: {} as never} as unknown as BoardAnalysisResponse['session'],
      currentRecommendation: '展示模式',
      focusPercent: 80, confusedPercent: 14, tiredPercent: 6,
      teacherPace: 'normal',
      aiMode: 'local-fallback',
    } as unknown as BoardAnalysisResponse;
  }
}

export async function directTranscribe(input: {audioBase64: string; mimeType: string}): Promise<{transcript: string; aiMode: 'gemini' | 'local-fallback'}> {
  const media = stripDataUrl(input.audioBase64, input.mimeType || 'audio/webm');
  try {
    const text = await callWithFallback(VISION_MODELS, [
      {role: 'user', parts: [
        {text: '直接將這段錄音的中文逐字稿輸出，只輸出老師講的原話本身，不要加任何前言、解釋、markdown、清單、標題或結語。如果聽不清楚就回覆「（聽不清楚）」三個字，不要加其他文字。逐字稿請用繁體中文。'},
        {inlineData: {mimeType: media.mimeType, data: media.data}},
      ]},
    ], {temperature: 0.2}, 60000);
    const cleaned = cleanTranscriptionOutput(text);
    return {transcript: cleaned || '（沒聽到清楚的講解，請再講一次）', aiMode: 'gemini'};
  } catch (e) {
    console.warn('[directGemini] transcribe failed:', e);
    return {transcript: '展示模式：錄音功能需要連接 AI 才能轉錄。', aiMode: 'local-fallback'};
  }
}

type ChatHistoryItem = {role: 'ai' | 'user'; text: string};
type NoteContext = {title?: string; subject?: string; ocrText?: string; transcript?: string; content?: string};

export async function directChat(input: {message: string; notes: NoteContext[]; history: ChatHistoryItem[]}): Promise<{reply: string; aiMode: 'gemini' | 'local-fallback'}> {
  const notesContext = (input.notes || []).map((n) => [
    `標題：${n.title || ''}`, `科目：${n.subject || ''}`, `白板文字：${n.ocrText ?? ''}`,
    `逐字稿：${n.transcript ?? ''}`, `課堂紀錄：${n.content ?? ''}`,
  ].join('\n')).join('\n\n---\n\n');
  const historyText = (input.history || []).slice(-6).map((i) => `${i.role === 'ai' ? 'AI' : '學生'}：${i.text}`).join('\n');
  const userPrompt = `你是國小課堂 AI 小老師，對象是國小學生。\n\n回答規則（嚴格遵守）：\n1. 繁體中文，1–3 句話，總共不超過 60 個字。\n2. 像跟小朋友聊天，不要 markdown、不要清單、不要標題、不要前言「好的」「沒問題」。\n3. 用生活例子，避免術語。\n4. 答完後可以反問一句引導學生繼續，例如「你想試試看嗎？」「猜猜看是哪個？」，但反問只能 1 句。\n5. 如果學生問「出一題」就直接出題，不解釋。\n\n課堂內容：\n${notesContext}\n\n${historyText ? `對話到目前為止：\n${historyText}\n\n` : ''}學生問：${input.message}`;
  try {
    const text = await callWithFallback(CHAT_MODELS, [{role: 'user', parts: [{text: userPrompt}]}], {temperature: 0.55}, 12000);
    return {reply: text || '我想想看，可以再問一次嗎？', aiMode: 'gemini'};
  } catch (e) {
    console.warn('[directGemini] chat failed:', e);
    return {reply: '展示模式：AI 小老師需要連接 AI key 才能回答。', aiMode: 'local-fallback'};
  }
}
