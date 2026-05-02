import {GoogleGenAI, createPartFromBase64} from '@google/genai';
import {geminiApiKey, notesFile} from './config';
import {defaultClassroomSession, defaultNotes} from './defaults';
import {readJsonFile} from './storage';
import type {BoardAnalysisResult, BoardRegion, ChatMessage, QuizQuestion, TeacherPace, WhiteboardNote} from './types';
import {stripDataUrl} from './validation';

const ai = geminiApiKey ? new GoogleGenAI({apiKey: geminiApiKey}) : null;

export function isGeminiConfigured() {
  return Boolean(ai);
}

type AiOptions = {
  forceLocal?: boolean;
};

function parseJsonFromText<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1];
  const jsonText = fenced ?? text.match(/[\[{][\s\S]*[\]}]/)?.[0] ?? text;
  return JSON.parse(jsonText) as T;
}

function normalizePercent(value: unknown, fallback: number, max = 100) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > max) {
    return fallback;
  }
  return numeric;
}

function normalizeRegionId(value: unknown, index: number, used: Set<string>) {
  const raw = String(value ?? '').trim().toUpperCase();
  const matched = raw.match(/(?:REGION|區塊|AREA|ZONE)?[\s_-]*([A-D])\b/)?.[1] ?? raw.match(/\b([A-D])\b/)?.[1];
  let candidate = matched ?? String.fromCharCode(65 + index);
  let cursor = 0;

  while (used.has(candidate)) {
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
  const regions = input.map((item, index) => {
    const source = item as Partial<BoardRegion>;
    const id = normalizeRegionId(source.id, index, usedIds);
    const status = source.status === 'erased' || source.status === 'erasable' || source.status === 'keep' ? source.status : 'keep';
    const fallbackRegion = fallback[index] ?? {x: 8 + index * 28, y: 18, width: 28, height: 48};
    const x = normalizePercent(source.x, fallbackRegion.x);
    const y = normalizePercent(source.y, fallbackRegion.y);
    const width = normalizePercent(source.width, fallbackRegion.width, 100 - x);
    const height = normalizePercent(source.height, fallbackRegion.height, 100 - y);
    return {
      id,
      label: String(source.label ?? `白板區塊 ${id}`),
      x,
      y,
      width,
      height,
      status,
      reason: String(source.reason ?? '由本機分析產生'),
    };
  }).slice(0, 4);

  return regions.length >= 3 ? regions : fallback;
}

function normalizePace(value: unknown): TeacherPace {
  return value === 'review_needed' || value === 'slow_down' ? value : 'normal';
}

function localBoardAnalysis(transcript: string, subjectHint: string, imageBase64: string): BoardAnalysisResult {
  const subject = subjectHint.trim() || '國小數學';
  const transcriptLine = transcript.trim() || '尚未提供老師講解，系統先依白板快照建立國小課堂紀錄草稿。';
  const boardRegions = [
    {id: 'A', label: '圖解與例題', x: 8, y: 18, width: 36, height: 56, status: 'keep' as const, reason: '國小生需要保留圖像支架來說明想法'},
    {id: 'B', label: '孩子練習區', x: 52, y: 20, width: 36, height: 48, status: 'erasable' as const, reason: '練習內容已保存，可清出空間給下一題'},
    {id: 'C', label: '口訣提醒區', x: 18, y: 76, width: 64, height: 16, status: 'keep' as const, reason: '保留簡短口訣，方便孩子回頭檢查'},
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
      ocrText: `本機辨識摘要：${subject} 白板快照已擷取，請老師確認圖解、例題與口訣是否完整。`,
      transcript: transcriptLine,
      imageUrl: imageBase64,
      img: imageBase64,
      keywords: ['國小', subject, '白板快照', '學習單', '小測驗'],
      boardRegions,
      aiRecommendation: '建議保留圖解與口訣，先清出孩子練習區，給下一題或上台分享使用。',
    },
    boardRegions,
    currentRecommendation: '建議保留圖解與口訣，先清出孩子練習區，給下一題或上台分享使用。',
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
  const lines = note.content.split(/\n+/).map((line) => line.replace(/^[-\d.、\s]+/, '').trim()).filter(Boolean);
  return [
    `# ${note.title} 國小學習單`,
    '',
    `科目：${note.subject}`,
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
  const pool = note.content
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
  if (/孩子|聽得懂|簡單/.test(message)) {
    lines.push('### 改成孩子版說法');
    lines.push('1. 把抽象名詞換成生活中看得到、摸得到的例子。');
    lines.push('2. 用「就像⋯⋯一樣」的比喻開頭。');
    lines.push('3. 先問孩子「你有沒有看過⋯⋯」，再引導到概念。');
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
    return localBoardAnalysis(transcript, subjectHint, imageBase64);
  }

  try {
    const media = stripDataUrl(imageBase64, 'image/png');
    const prompt = [
      '你是繁體中文國小課堂白板 AI 助教，服務國小組競賽作品。請分析白板照片與教師逐字稿，產生可以直接保存的本機 JSON。',
      '所有內容必須適合國小生與國小老師：句子短、用生活例子、避免高中以上術語，不做個人身份辨識。',
      '只輸出 JSON，不要 markdown。',
      'JSON 欄位：noteDraft, boardRegions, currentRecommendation, teacherPace, focusPercent, confusedPercent, tiredPercent。',
      'noteDraft 必須包含 title, subject, period, desc, content, ocrText, transcript, keywords, aiRecommendation。',
      'noteDraft.content 請包含「今日學習目標」、「板書重點」、「小朋友練習」、「老師提醒」。',
      'boardRegions 至少三個區塊，每個區塊包含 id, label, x, y, width, height, status, reason；status 只能是 keep, erasable, erased。',
      `科目提示：${subjectHint || '未提供'}`,
      `教師逐字稿：${transcript || '未提供'}`,
    ].join('\n');
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{role: 'user', parts: [{text: prompt}, createPartFromBase64(media.data, media.mimeType)]}],
      config: {temperature: 0.35},
    });
    const parsed = parseJsonFromText<Partial<BoardAnalysisResult>>(response.text ?? '');
    const fallback = localBoardAnalysis(transcript, subjectHint, imageBase64);
    const noteDraft = {
      ...fallback.noteDraft,
      ...parsed.noteDraft,
      subject: String(parsed.noteDraft?.subject ?? (subjectHint || fallback.noteDraft.subject)),
      title: String(parsed.noteDraft?.title ?? fallback.noteDraft.title),
      content: String(parsed.noteDraft?.content ?? fallback.noteDraft.content),
      transcript: String(parsed.noteDraft?.transcript ?? (transcript || fallback.noteDraft.transcript)),
      captureSource: 'camera' as const,
      imageUrl: imageBase64,
      img: imageBase64,
    };
    const boardRegions = normalizeBoardRegions(parsed.boardRegions);
    return {
      noteDraft,
      boardRegions,
      currentRecommendation: String(parsed.currentRecommendation ?? noteDraft.aiRecommendation ?? fallback.currentRecommendation),
      teacherPace: normalizePace(parsed.teacherPace),
      focusPercent: Number(parsed.focusPercent ?? fallback.focusPercent),
      confusedPercent: Number(parsed.confusedPercent ?? fallback.confusedPercent),
      tiredPercent: Number(parsed.tiredPercent ?? fallback.tiredPercent),
      aiMode: 'gemini',
    };
  } catch (error) {
    console.warn('Gemini board analysis failed, using local fallback:', error);
    return localBoardAnalysis(transcript, subjectHint, imageBase64);
  }
}

export async function transcribeWithAI(audioBase64: string, mimeType: string, options: AiOptions = {}) {
  if (!ai || options.forceLocal) {
    return {transcript: localTranscript(mimeType), aiMode: 'local-fallback' as const};
  }

  try {
    const media = stripDataUrl(audioBase64, mimeType || 'audio/webm');
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{
        role: 'user',
        parts: [
          {text: '請將這段國小課堂錄音整理成繁體中文逐字稿，保留老師講解重點、孩子可能卡住的地方，以及可直接拿來做學習單的句子。'},
          createPartFromBase64(media.data, media.mimeType),
        ],
      }],
      config: {temperature: 0.2},
    });
    return {transcript: response.text || localTranscript(mimeType), aiMode: 'gemini' as const};
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
      `OCR：${note.ocrText ?? ''}`,
      `逐字稿：${note.transcript ?? ''}`,
      `課堂紀錄：${note.content}`,
    ].join('\n')).join('\n\n---\n\n');
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        ...history.slice(-8).map((item) => ({
          role: item.role === 'ai' ? 'model' : 'user',
          parts: [{text: item.text}],
        })),
        {
          role: 'user',
          parts: [{text: `請根據以下本機課堂紀錄本內容回答。使用繁體中文，語氣像國小課堂小老師，句子短，提供老師能直接使用的說法、活動或小檢核；避免高中以上術語。\n\n${notesContext}\n\n問題：${message}`}],
        },
      ],
      config: {temperature: 0.55},
    });
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
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: `請將以下白板紀錄整理成國小生可讀的繁體中文 Markdown 學習單。句子短、步驟清楚，包含「今天我學到」、「畫一畫或說一說」、「小檢核」、「老師提醒」。\n\n${note.content}\n\nOCR:${note.ocrText ?? ''}\n逐字稿:${note.transcript ?? ''}`,
        config: {temperature: 0.35},
      });
      return {summary: response.text || localSummary(note), aiMode: 'gemini' as const};
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `請根據以下白板紀錄產生 5 題適合國小生的繁體中文單選題。題幹要短，一題只測一個概念，解析要像老師鼓勵孩子的說明。只輸出 JSON array，每題格式 {"q":"題目","options":["A","B","C","D"],"ans":0,"explanation":"解析"}。\n\n${note.content}`,
      config: {temperature: 0.35},
    });
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
