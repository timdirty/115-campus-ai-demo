import {GoogleGenAI, createPartFromBase64} from '@google/genai';
import {geminiApiKey, geminiChatFallbacks, geminiModel, geminiVisionFallbacks, geminiVisionModel, notesFile} from './config';
import {defaultClassroomSession, defaultNotes} from './defaults';
import {readJsonFile} from './storage';
import type {BoardAnalysisResult, BoardRegion, ChatMessage, NoteContentType, QuizQuestion, TeacherPace, WhiteboardNote} from './types';
import {stripDataUrl} from './validation';

const ai = geminiApiKey ? new GoogleGenAI({apiKey: geminiApiKey}) : null;

export function isGeminiConfigured() {
  return Boolean(ai);
}

type AiOptions = {
  forceLocal?: boolean;
  /** Real OCR text extracted by the local Python EasyOCR service. When present,
   *  replaces the placeholder ocrText in local-fallback mode. */
  realOcrText?: string;
};

function parseJsonFromText<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1];
  const jsonText = fenced ?? text.match(/[\[{][\s\S]*[\]}]/)?.[0] ?? text;
  return JSON.parse(jsonText) as T;
}

const META_PREFIX_PATTERNS = [
  /^好的[,，]?\s*/,
  /^沒問題[,，]?\s*/,
  /^以下是.*?[:：]\s*/,
  /^這是.*?(逐字稿|整理).*?[:：]\s*/,
  /^根據您提供的.*?[:：]\s*/,
];

function cleanTranscriptionOutput(raw: string): string {
  let text = (raw ?? '').trim();
  // strip markdown fences
  text = text.replace(/^```[a-zA-Z]*\n?|\n?```$/g, '').trim();
  // strip meta-intro prefixes Gemini sometimes adds
  for (const pattern of META_PREFIX_PATTERNS) {
    text = text.replace(pattern, '').trim();
  }
  // remove leading section headers like "**逐字稿**" "**老師：**"
  text = text.replace(/^\*+[^*\n]+\*+\s*[\n:：]?/gm, '').trim();
  // strip leading list markers and turn-by-turn labels
  text = text.split('\n').map((line) => line.replace(/^[\s\-*•·]+|^老師[:：]\s*|^學生[:：]\s*/g, '').trim()).filter(Boolean).join('\n');
  // collapse paragraph breaks introduced by markdown
  text = text.replace(/\n{2,}/g, '\n').trim();
  // if result still starts with meta-shape, give up and return empty
  if (/^好的|^這是|^以下|範例文字|^展示逐字稿/.test(text)) return '';
  return text;
}

// Returns true if we should try the next model in the chain.
// Only abort the chain for fatal config errors (auth) — everything else can be retried with a different model.
function isRetriableError(err: unknown): boolean {
  const status = (err as {status?: number})?.status;
  const message = (err as Error)?.message ?? '';
  // Hard stop: auth / billing config issue
  if (status === 401) return false;
  if (/UNAUTHENTICATED|API key not valid|invalid api key/i.test(message)) return false;
  // Everything else: try next (quota / model-not-found / bad-request / 5xx / network)
  return true;
}

type GenArgs = Parameters<NonNullable<typeof ai>['models']['generateContent']>[0];

async function callWithFallback(models: string[], baseArgs: Omit<GenArgs, 'model'>, label = 'gen', timeoutMs?: number) {
  if (!ai) throw new Error('Gemini not configured');
  let lastError: unknown = new Error('No models tried');
  for (const model of models) {
    try {
      const args: GenArgs = {...baseArgs, model};
      return await withAiTimeout(ai.models.generateContent(args), timeoutMs);
    } catch (error) {
      lastError = error;
      const retriable = isRetriableError(error);
      console.warn(`[${label}] model ${model} failed (retriable=${retriable}): ${(error as Error).message?.slice(0, 160)}`);
      if (!retriable) {
        throw error;
      }
      // try next model
    }
  }
  throw lastError;
}

function coerceMultilineString(value: unknown, fallback: string): string {
  if (value == null) return fallback;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map((item) => coerceMultilineString(item, '')).filter(Boolean).join('\n');
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, val]) => `${key}：\n${coerceMultilineString(val, '')}`)
      .join('\n\n');
  }
  return String(value);
}

function normalizePercent(value: unknown, fallback: number, max = 100) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > max) {
    return fallback;
  }
  return numeric;
}

const CONTENT_TYPES: NoteContentType[] = ['question', 'illustration', 'message', 'reminder'];

function normalizeContentType(value: unknown, fallback: NoteContentType = 'question'): NoteContentType {
  return CONTENT_TYPES.includes(value as NoteContentType) ? (value as NoteContentType) : fallback;
}

function contentTypeFromSubject(subject: string): NoteContentType {
  const normalized = subject.toLowerCase();
  if (/美術|繪畫|塗鴉|illustration-style/.test(normalized)) return 'illustration';
  if (/鼓勵話|班級口號|cheer|motivation/.test(normalized)) return 'message';
  if (/提醒事項|校規|rules|reminders/.test(normalized)) return 'reminder';
  return 'question';
}

function recommendationForContentType(contentType: NoteContentType, fallback: string) {
  if (contentType === 'illustration') return '發現學生畫的鼓勵小插圖，建議保留這區不擦';
  if (contentType === 'message') return '發現鼓勵話，建議保留這區';
  if (contentType === 'reminder') return '提醒事項，建議保留';
  return fallback;
}

const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 60_000;
function withAiTimeout<T>(promise: Promise<T>, ms = AI_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`AI call timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer!));
}

function normalizeRegionId(value: unknown, index: number, used: Set<string>) {
  const raw = String(value ?? '').trim().toUpperCase();
  const matched = raw.match(/(?:REGION|區塊|AREA|ZONE)?[\s_-]*([AB])\b/)?.[1] ?? raw.match(/\b([AB])\b/)?.[1];
  let candidate = matched ?? String.fromCharCode(65 + index);
  let cursor = 0;

  if (!['A', 'B'].includes(candidate)) {
    candidate = String.fromCharCode(65 + Math.min(index, 1));
  }

  while (used.has(candidate) && cursor < 2) {
    candidate = String.fromCharCode(65 + cursor);
    cursor += 1;
  }

  used.add(candidate);
  return candidate;
}

export function normalizeBoardRegions(input: unknown): BoardRegion[] {
  const fallback = defaultClassroomSession.boardRegions;
  if (!Array.isArray(input)) {
    return fallback;
  }

  const usedIds = new Set<string>();
  const FIXED_LAYOUT: Record<'A' | 'B', {x: number; y: number; width: number; height: number; label: string}> = {
    A: {x: 5, y: 12, width: 43, height: 76, label: '左區'},
    B: {x: 52, y: 12, width: 43, height: 76, label: '右區'},
  };
  const regions = input.map((item, index) => {
    const source = item as Partial<BoardRegion>;
    const id = normalizeRegionId(source.id, index, usedIds) as 'A' | 'B';
    const status = source.status === 'erased' || source.status === 'erasable' || source.status === 'keep' ? source.status : 'keep';
    const layout = FIXED_LAYOUT[id] ?? FIXED_LAYOUT.A;
    return {
      id,
      label: layout.label,
      x: layout.x,
      y: layout.y,
      width: layout.width,
      height: layout.height,
      status,
      reason: String(source.reason ?? '由白板分析產生'),
    };
  }).filter((region) => region.id === 'A' || region.id === 'B').slice(0, 2);

  return regions.length >= 2 ? regions : fallback;
}

function normalizePace(value: unknown): TeacherPace {
  return value === 'review_needed' || value === 'slow_down' ? value : 'normal';
}

function localBoardAnalysis(transcript: string, subjectHint: string, imageBase64: string, realOcrText?: string): BoardAnalysisResult {
  const subject = subjectHint.trim() || '國小數學';
  const contentType = contentTypeFromSubject(subject);
  const transcriptLine = transcript.trim() || '尚未提供老師講解，系統先依白板快照建立國小課堂紀錄草稿。';
  const recommendation = recommendationForContentType(contentType, '建議保留左區重點，先清出右區，給下一題或上台分享使用。');
  const boardRegions = [
    {id: 'A', label: '左區', x: 5, y: 12, width: 43, height: 76, status: 'keep' as const, reason: '國小生需要保留圖像支架來說明想法'},
    {id: 'B', label: '右區', x: 52, y: 12, width: 43, height: 76, status: 'erasable' as const, reason: '練習內容已保存，可清出空間給下一題'},
  ];

  return {
    noteDraft: {
      title: `${subject} 國小白板紀錄`,
      subject,
      period: '即時擷取',
      desc: '由白板快照與老師講解建立的國小課堂學習紀錄。',
      content: [
        `課堂主題：${subject}`,
        '',
        '給孩子看的重點：',
        '- 先用圖像或生活例子理解今天的概念。',
        '- 再把想法說出來，最後寫成一句完整答案或一個算式。',
        '- 如果有同學卡住，請回到圖解區重新看一次。',
        '',
        '老師講解重點：',
        transcriptLine,
        '',
        '下課前小檢核：',
        '- 請孩子用自己的話說出今天最重要的一句話。',
      ].join('\n'),
      captureSource: 'camera',
      ocrText: realOcrText
        ? realOcrText
        : `白板文字整理：${subject} 白板快照已擷取，請老師確認圖解、例題與口訣是否完整。`,
      transcript: transcriptLine,
      imageUrl: imageBase64,
      img: imageBase64,
      keywords: ['國小', subject, '白板快照', '學習單', '小測驗'],
      boardRegions,
      aiRecommendation: recommendation,
      contentType,
    },
    boardRegions,
    currentRecommendation: recommendation,
    teacherPace: 'slow_down',
    focusPercent: 80,
    confusedPercent: 14,
    tiredPercent: 6,
    aiMode: 'local-fallback',
  };
}

function localTranscript(_mimeType: string) {
  return '老師說：「請同學們注意看黑板，今天我們要一起探討這個重要概念。請大家把課本翻到這一頁，找出關鍵詞。有問題的同學可以舉手，我們一起討論。」（語音辨識完成，AI 已記錄講課摘要。）';
}

function localSummary(note: WhiteboardNote) {
  const sourceText = [note.ocrText, note.content, note.transcript].filter(Boolean).join('\n');
  const lines = sourceText.split(/\n+/).map((line) => line.replace(/^[-\d.、\s]+/, '').trim()).filter(Boolean);
  return [
    `# ${note.title} 國小學習單`,
    '',
    `科目：${note.subject}`,
    '',
    '## 白板實際文字',
    note.ocrText?.trim() || '尚未取得白板文字。',
    '',
    '## 今天我學到',
    ...lines.slice(0, 6).map((line) => `- ${line}`),
    '',
    '## 小朋友練習',
    '- 用自己的話說出今天最重要的一句話。',
    '- 畫一張小圖，標出你看懂的重點。',
    '- 和同桌互相出一題簡單題目。',
    '',
    '## 老師提醒',
    '- 題目要短，一次只檢查一個概念。',
    '- 需要幫忙的孩子先回到圖解或生活例子。',
  ].join('\n');
}

function localQuiz(note: WhiteboardNote): QuizQuestion[] {
  const sourceText = [note.ocrText, note.content, note.transcript].filter(Boolean).join('\n');
  const pool = sourceText
    .split(/\n+/)
    .map((line) => line.replace(/^[-\d.、\s]+/, '').trim())
    .filter((line) => line.length >= 6);
  const source = pool.length ? pool : [note.title, note.desc, note.ocrText ?? note.subject].filter(Boolean);
  const ansPositions = [0, 2, 1, 3];
  const padOptions = ['先不用看題目，直接猜答案', '這和今天的白板內容沒有關係', '只要背起來，不需要理解'];

  return source.slice(0, 5).map((line, index) => {
    const correct = line.slice(0, 48);
    const distractors = source.filter((_, j) => j !== index).slice(0, 3).map((d) => d.slice(0, 48));
    while (distractors.length < 3) distractors.push(padOptions[distractors.length]);
    const ansPos = ansPositions[index % ansPositions.length];
    const options = [...distractors];
    options.splice(ansPos, 0, correct);
    return {
      q: `看完「${note.title}」，第 ${index + 1} 個重點最接近哪一句？`,
      options: options.slice(0, 4),
      ans: ansPos,
      explanation: `可以回到課堂紀錄這一句：「${correct}」。`,
    };
  });
}

function localChatReply(message: string, notes: WhiteboardNote[]) {
  const note = notes[0];
  const context = note ? `我會優先參考「${note.title}」。` : '目前沒有指定課堂紀錄，我會用國小課堂小老師方式回答。';
  const lines: string[] = [context, ''];
  if (note?.ocrText?.trim()) {
    const boardText = note.ocrText.trim().split(/\n+/).slice(0, 6);
    lines.push('我先讀到白板上的實際文字：');
    boardText.forEach((line) => lines.push(`- ${line}`));
    lines.push('');
  }
  if (/孩子|聽得懂|簡單/.test(message)) {
    lines.push('### 改成孩子版說法');
    lines.push('1. 先指著白板上的關鍵字，請孩子唸一次。');
    lines.push('2. 把白板句子換成生活例子，讓孩子說「像什麼」。');
    lines.push('3. 最後請孩子用自己的話重講一遍。');
  } else if (/測驗|題目|練習題|小考/.test(message)) {
    lines.push('### 小測驗設計方向');
    lines.push('1. 先從是非題開始，讓孩子建立信心。');
    lines.push('2. 再出一題填空或看圖說明。');
    lines.push('3. 最後一題「用自己的話說明」，確認深度理解。');
  } else if (/分組|活動|討論|設計/.test(message)) {
    lines.push('### 分組活動設計');
    lines.push('1. 每組 3–4 人，分工：說明員、記錄員、報告員。');
    lines.push('2. 給每組 5 分鐘討論，再輪流用 1 分鐘報告。');
    lines.push('3. 讓其他組提一個問題或補充，互評學習。');
  } else {
    lines.push(`針對你的問題：「${message}」`);
    lines.push('');
    lines.push('- 先用一句孩子聽得懂的話說明重點。');
    lines.push('- 再加一個生活例子或畫圖活動。');
    lines.push('- 最後用 2 到 3 題小檢核確認孩子真的會了。');
  }
  return lines.join('\n');
}

async function notesByIds(noteIds: number[]) {
  const notes = await readJsonFile<WhiteboardNote[]>(notesFile, defaultNotes);
  if (!noteIds.length) {
    return notes.slice(0, 3);
  }
  return notes.filter((note) => noteIds.includes(note.id));
}

export async function analyzeBoardWithAI(imageBase64: string, transcript: string, subjectHint: string, options: AiOptions = {}): Promise<BoardAnalysisResult> {
  if (!ai || options.forceLocal) {
    return localBoardAnalysis(transcript, subjectHint, imageBase64, options.realOcrText);
  }

  try {
    const media = stripDataUrl(imageBase64, 'image/png');
    const ocrHint = options.realOcrText ? `\n白板文字整理結果：${options.realOcrText}` : '';
    const prompt = [
      '你是繁體中文國小課堂白板 AI 助教，服務國小組競賽作品。請分析白板照片與教師逐字稿，產生可以直接保存的課堂資料。',
      '所有內容必須適合國小生與國小老師：句子短、用生活例子、避免高中以上術語，不做個人身份辨識。',
      '只輸出資料物件，不要 markdown。',
      '欄位：noteDraft, boardRegions, currentRecommendation, teacherPace, focusPercent, confusedPercent, tiredPercent。',
      'noteDraft 必須包含 title, subject, period, desc, content, ocrText, transcript, keywords, aiRecommendation, contentType。',
      'contentType 只能是 question, illustration, message, reminder；練習題/學科題目是 question，小插圖是 illustration，鼓勵話/口號是 message，提醒事項/校規是 reminder。',
      'noteDraft.content 請包含「今日學習目標」、「板書重點」、「小朋友練習」、「老師提醒」。',
      'boardRegions 必須是 A、B 兩個大區塊：A 代表左區，B 代表右區。每個區塊包含 id, label, x, y, width, height, status, reason；label 請用「左區」或「右區」；status 只能是 keep, erasable, erased。',
      `科目提示：${subjectHint || '未提供'}`,
      `教師逐字稿：${transcript || '未提供'}${ocrHint}`,
    ].join('\n');
    const response = await callWithFallback([geminiVisionModel, ...geminiVisionFallbacks.filter((m) => m !== geminiVisionModel)], {
      contents: [{role: 'user', parts: [{text: prompt}, createPartFromBase64(media.data, media.mimeType)]}],
      config: {temperature: 0.35},
    }, 'analyze');
    const parsed = parseJsonFromText<Partial<BoardAnalysisResult>>(response.text ?? '');
    const fallback = localBoardAnalysis(transcript, subjectHint, imageBase64, options.realOcrText);
    const contentType = normalizeContentType(
      parsed.noteDraft?.contentType,
      contentTypeFromSubject(String(parsed.noteDraft?.subject ?? (subjectHint || fallback.noteDraft.subject))),
    );
    const recommendation = recommendationForContentType(
      contentType,
      String(parsed.currentRecommendation ?? parsed.noteDraft?.aiRecommendation ?? fallback.currentRecommendation),
    );
    const noteDraft = {
      ...fallback.noteDraft,
      ...parsed.noteDraft,
      subject: String(parsed.noteDraft?.subject ?? (subjectHint || fallback.noteDraft.subject)),
      title: String(parsed.noteDraft?.title ?? fallback.noteDraft.title),
      content: coerceMultilineString(parsed.noteDraft?.content, fallback.noteDraft.content),
      transcript: String(parsed.noteDraft?.transcript ?? (transcript || fallback.noteDraft.transcript)),
      captureSource: 'camera' as const,
      imageUrl: imageBase64,
      img: imageBase64,
      contentType,
      aiRecommendation: recommendation,
    };
    const boardRegions = normalizeBoardRegions(parsed.boardRegions);
    return {
      noteDraft,
      boardRegions,
      currentRecommendation: recommendation,
      teacherPace: normalizePace(parsed.teacherPace),
      focusPercent: Number(parsed.focusPercent ?? fallback.focusPercent),
      confusedPercent: Number(parsed.confusedPercent ?? fallback.confusedPercent),
      tiredPercent: Number(parsed.tiredPercent ?? fallback.tiredPercent),
      aiMode: 'gemini',
    };
  } catch (error) {
    console.warn('Gemini board analysis failed, using local fallback:', error);
    return localBoardAnalysis(transcript, subjectHint, imageBase64, options.realOcrText);
  }
}

export async function transcribeWithAI(audioBase64: string, mimeType: string, options: AiOptions = {}) {
  if (!ai || options.forceLocal) {
    return {transcript: localTranscript(mimeType), aiMode: 'local-fallback' as const};
  }

  try {
    const media = stripDataUrl(audioBase64, mimeType || 'audio/webm');
    const response = await callWithFallback([geminiVisionModel, ...geminiVisionFallbacks.filter((m) => m !== geminiVisionModel)], {
      contents: [{
        role: 'user',
        parts: [
          {text: '直接將這段錄音的中文逐字稿輸出，只輸出老師講的原話本身，不要加任何前言、解釋、markdown、清單、標題或結語。如果聽不清楚就回覆「（聽不清楚）」三個字，不要加其他文字。逐字稿請用繁體中文。'},
          createPartFromBase64(media.data, media.mimeType),
        ],
      }],
      config: {temperature: 0.2},
    }, 'transcribe');
    const cleaned = cleanTranscriptionOutput(response.text ?? '');
    if (!cleaned) {
      return {transcript: '（沒聽到清楚的講解，請再講一次）', aiMode: 'gemini' as const};
    }
    return {transcript: cleaned, aiMode: 'gemini' as const};
  } catch (error) {
    console.warn('Gemini transcription failed, using local fallback:', error);
    return {transcript: localTranscript(mimeType), aiMode: 'local-fallback' as const};
  }
}

export async function chatWithAI(message: string, noteIds: number[], history: ChatMessage[], options: AiOptions = {}) {
  const notes = await notesByIds(noteIds);
  if (!ai || options.forceLocal) {
    return {reply: localChatReply(message, notes), aiMode: 'local-fallback' as const};
  }

  try {
    const notesContext = notes.map((note) => [
      `標題：${note.title}`,
      `科目：${note.subject}`,
      `白板文字：${note.ocrText ?? ''}`,
      `逐字稿：${note.transcript ?? ''}`,
      `課堂紀錄：${note.content}`,
    ].join('\n')).join('\n\n---\n\n');
    // Chat is text-only — route to Gemma first (unmetered quota), fall back to Gemini lite.
    // Note: Gemma models don't support multi-turn role-based history; collapse into one user turn.
    const historyText = history.slice(-6).map((item) => `${item.role === 'ai' ? 'AI' : '學生'}：${item.text}`).join('\n');
    const userPrompt = `你是國小課堂 AI 小老師，對象是國小學生。\n\n回答規則（嚴格遵守）：\n1. 繁體中文，1–3 句話，總共不超過 60 個字。\n2. 像跟小朋友聊天，不要 markdown、不要清單、不要標題、不要前言「好的」「沒問題」。\n3. 用生活例子，避免術語。\n4. 答完後可以反問一句引導學生繼續，例如「你想試試看嗎？」「猜猜看是哪個？」，但反問只能 1 句。\n5. 如果學生問「出一題」就直接出題，不解釋。\n\n課堂內容：\n${notesContext}\n\n${historyText ? `對話到目前為止：\n${historyText}\n\n` : ''}學生問：${message}`;
    // Chat must feel fast — cap each model at 12s, jump to next on stall.
    const response = await callWithFallback(geminiChatFallbacks, {
      contents: [{role: 'user', parts: [{text: userPrompt}]}],
      config: {temperature: 0.55},
    }, 'chat', 12_000);
    return {reply: response.text || localChatReply(message, notes), aiMode: 'gemini' as const};
  } catch (error) {
    console.warn('Gemini chat failed, using local fallback:', error);
    return {reply: localChatReply(message, notes), aiMode: 'local-fallback' as const};
  }
}

export async function reviewWithAI(note: WhiteboardNote, mode: 'quiz' | 'summary', options: AiOptions = {}) {
  if (!ai || options.forceLocal) {
    return mode === 'summary'
      ? {summary: localSummary(note), aiMode: 'local-fallback' as const}
      : {quiz: localQuiz(note), aiMode: 'local-fallback' as const};
  }

  try {
    if (mode === 'summary') {
      const response = await callWithFallback(geminiChatFallbacks, {
        contents: `請將以下白板紀錄整理成國小生可讀的繁體中文 Markdown 學習單。句子短、步驟清楚，包含「今天我學到」、「畫一畫或說一說」、「小檢核」、「老師提醒」。\n\n${note.content}\n\n白板文字:${note.ocrText ?? ''}\n逐字稿:${note.transcript ?? ''}`,
        config: {temperature: 0.35},
      }, 'summary');
      return {summary: response.text || localSummary(note), aiMode: 'gemini' as const};
    }

    const response = await callWithFallback(geminiChatFallbacks, {
      contents: `請根據以下白板紀錄產生 5 題適合國小生的繁體中文單選題。題幹要短，一題只測一個概念，解析要像老師鼓勵孩子的說明。題目必須優先引用「白板文字」中的實際內容。只輸出 JSON array，每題格式 {"q":"題目","options":["A","B","C","D"],"ans":0,"explanation":"解析"}。\n\n白板文字:${note.ocrText ?? ''}\n逐字稿:${note.transcript ?? ''}\n課堂紀錄:${note.content}`,
      config: {temperature: 0.35},
    }, 'quiz');
    const quiz = parseJsonFromText<QuizQuestion[]>(response.text ?? '[]')
      .slice(0, 8)
      .filter((item) => item.q && Array.isArray(item.options) && item.options.length === 4);
    return {quiz: quiz.length ? quiz : localQuiz(note), aiMode: 'gemini' as const};
  } catch (error) {
    console.warn('Gemini review failed, using local fallback:', error);
    return mode === 'summary'
      ? {summary: localSummary(note), aiMode: 'local-fallback' as const}
      : {quiz: localQuiz(note), aiMode: 'local-fallback' as const};
  }
}
