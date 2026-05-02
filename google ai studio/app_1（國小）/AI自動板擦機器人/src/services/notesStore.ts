import {apiRequest} from './apiClient';

export type NoteTheme = 'primary' | 'secondary' | 'tertiary';

export type WhiteboardNote = {
  id: number;
  title: string;
  subject: string;
  period: string;
  desc: string;
  content: string;
  captureSource?: 'camera' | 'upload' | 'quick-note' | 'seed';
  ocrText?: string;
  transcript?: string;
  imageUrl?: string;
  audioUrl?: string;
  keywords?: string[];
  boardRegions?: Array<{
    id: string;
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
    status: 'keep' | 'erasable' | 'erased';
    reason: string;
  }>;
  aiRecommendation?: string;
  linkedTaskIds?: number[];
  date: string;
  time: string;
  theme: NoteTheme;
  img: string;
  createdAt: string;
};

const NOTES_KEY = 'whiteboard-notes:elementary:v1';
const THEMES: NoteTheme[] = ['primary', 'secondary', 'tertiary'];

const svgUri = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`;
const WHITEBOARD_MATH = svgUri(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#F8FAFB"/><rect width="400" height="6" fill="#4a80db"/><line x1="40" y1="50" x2="360" y2="50" stroke="#E2E8F0" stroke-width="1"/><line x1="40" y1="80" x2="360" y2="80" stroke="#E2E8F0" stroke-width="1"/><line x1="40" y1="110" x2="360" y2="110" stroke="#E2E8F0" stroke-width="1"/><line x1="40" y1="140" x2="360" y2="140" stroke="#E2E8F0" stroke-width="1"/><rect x="40" y="56" width="180" height="14" rx="3" fill="#CBD5E1"/><rect x="40" y="86" width="240" height="14" rx="3" fill="#CBD5E1"/><rect x="40" y="116" width="200" height="14" rx="3" fill="#CBD5E1"/><rect x="60" y="146" width="160" height="14" rx="3" fill="#E2E8F0"/><text x="40" y="276" font-family="system-ui" font-size="13" fill="#94A3B8">1/4 + 2/4 = 3/4</text></svg>`,
);
const WHITEBOARD_SCIENCE = svgUri(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#F8FAFB"/><rect width="400" height="6" fill="#F59E0B"/><line x1="40" y1="50" x2="360" y2="50" stroke="#E2E8F0" stroke-width="1"/><line x1="40" y1="80" x2="360" y2="80" stroke="#E2E8F0" stroke-width="1"/><line x1="40" y1="110" x2="360" y2="110" stroke="#E2E8F0" stroke-width="1"/><rect x="40" y="56" width="200" height="14" rx="3" fill="#CBD5E1"/><rect x="40" y="86" width="280" height="14" rx="3" fill="#CBD5E1"/><rect x="40" y="116" width="220" height="14" rx="3" fill="#CBD5E1"/><ellipse cx="200" cy="210" rx="80" ry="48" fill="none" stroke="#F59E0B" stroke-width="2" stroke-dasharray="8 4"/><text x="162" y="214" font-family="system-ui" font-size="13" fill="#F59E0B">水循環</text></svg>`,
);
const WHITEBOARD_LANGUAGE = svgUri(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#F8FAFB"/><rect width="400" height="6" fill="#246b5b"/><line x1="40" y1="50" x2="360" y2="50" stroke="#E2E8F0" stroke-width="1"/><line x1="40" y1="80" x2="360" y2="80" stroke="#E2E8F0" stroke-width="1"/><line x1="40" y1="110" x2="360" y2="110" stroke="#E2E8F0" stroke-width="1"/><line x1="40" y1="140" x2="360" y2="140" stroke="#E2E8F0" stroke-width="1"/><line x1="40" y1="170" x2="360" y2="170" stroke="#E2E8F0" stroke-width="1"/><rect x="40" y="56" width="220" height="14" rx="3" fill="#CBD5E1"/><rect x="60" y="86" width="180" height="14" rx="3" fill="#CBD5E1"/><rect x="60" y="116" width="200" height="14" rx="3" fill="#CBD5E1"/><rect x="60" y="146" width="160" height="14" rx="3" fill="#E2E8F0"/><rect x="60" y="176" width="140" height="14" rx="3" fill="#E2E8F0"/><text x="40" y="216" font-family="system-ui" font-size="11" fill="#94A3B8">① 角色  ② 時間  ③ 地點</text></svg>`,
);
const WHITEBOARD_DEFAULT = svgUri(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#F8FAFB"/><rect width="400" height="6" fill="#64748B"/><line x1="40" y1="50" x2="360" y2="50" stroke="#E2E8F0" stroke-width="1"/><line x1="40" y1="80" x2="360" y2="80" stroke="#E2E8F0" stroke-width="1"/><line x1="40" y1="110" x2="360" y2="110" stroke="#E2E8F0" stroke-width="1"/><rect x="40" y="56" width="200" height="14" rx="3" fill="#CBD5E1"/><rect x="40" y="86" width="260" height="14" rx="3" fill="#CBD5E1"/><rect x="40" y="116" width="180" height="14" rx="3" fill="#E2E8F0"/></svg>`,
);

export const DEFAULT_NOTES: WhiteboardNote[] = [
  {
    id: 1,
    title: '分數加法：披薩切片一起算',
    subject: '國小數學',
    period: '三年級 第二節',
    desc: '用披薩圖理解同分母分數加法，讓孩子能看圖、說想法、寫算式。',
    content: '今日學習目標：看懂同分母分數加法。\n\n板書重點：\n1. 分母代表一個東西被平均分成幾份。\n2. 分子代表拿了其中幾份。\n3. 同分母相加時，分母不變，只把分子加起來。\n4. 例題：1/4 + 2/4 = 3/4。\n\n給孩子的檢核：請畫一個圓形披薩，塗出 3/4，並用一句話說明自己的算法。',
    captureSource: 'seed',
    ocrText: '同分母分數加法、分母不變、分子相加、1/4 + 2/4 = 3/4',
    transcript: '老師用披薩切片說明分母和分子的意思，請孩子先看圖，再把圖轉成算式。',
    keywords: ['國小', '數學', '分數', '披薩圖', '同分母加法'],
    date: '4月29日',
    time: '上午 09:20',
    theme: 'secondary',
    img: WHITEBOARD_MATH,
    imageUrl: WHITEBOARD_MATH,
    createdAt: '2026-04-29T09:20:00+08:00',
  },
  {
    id: 2,
    title: '自然觀察：水循環小旅行',
    subject: '國小自然',
    period: '四年級 第三節',
    desc: '用水滴旅行故事理解蒸發、凝結、降水與流回大海。',
    content: '今日學習目標：說出水循環的四個步驟。\n\n板書重點：\n1. 太陽讓水變成水蒸氣，叫做蒸發。\n2. 水蒸氣遇冷變成小水滴，聚在一起形成雲，叫做凝結。\n3. 雲裡的小水滴變重，就會落下來，叫做降水。\n4. 雨水流到河流、湖泊或大海，水循環又開始。\n\n小組任務：每組畫出一滴水的旅行路線，並標出四個關鍵詞。',
    captureSource: 'seed',
    ocrText: '水循環、蒸發、凝結、降水、流回大海',
    transcript: '老師把水滴想像成小旅人，從大海出發到天空，再變成雨回到地面。',
    keywords: ['國小', '自然', '水循環', '蒸發', '凝結', '降水'],
    date: '4月28日',
    time: '下午 01:35',
    theme: 'tertiary',
    img: WHITEBOARD_SCIENCE,
    imageUrl: WHITEBOARD_SCIENCE,
    createdAt: '2026-04-28T13:35:00+08:00',
  },
  {
    id: 3,
    title: '國語閱讀：故事六要素',
    subject: '國小國語',
    period: '五年級 第一節',
    desc: '把故事拆成角色、時間、地點、起因、經過、結果，練習完整表達。',
    content: '今日學習目標：用六要素說清楚一個故事。\n\n板書重點：\n1. 角色：故事中出現的人物或動物。\n2. 時間：事情發生在什麼時候。\n3. 地點：事情發生在哪裡。\n4. 起因：為什麼會發生這件事。\n5. 經過：中間發生了哪些重要事情。\n6. 結果：最後怎麼解決，角色有什麼改變。\n\n口語練習：和同桌互說一個校園小故事，至少說出四個要素。',
    captureSource: 'seed',
    ocrText: '故事六要素、角色、時間、地點、起因、經過、結果',
    transcript: '老師提醒孩子不要只說好玩，要說清楚誰、在哪裡、發生什麼事。',
    keywords: ['國小', '國語', '閱讀', '故事六要素', '口語表達'],
    date: '4月27日',
    time: '上午 10:10',
    theme: 'primary',
    img: WHITEBOARD_LANGUAGE,
    imageUrl: WHITEBOARD_LANGUAGE,
    createdAt: '2026-04-27T10:10:00+08:00',
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function safeText(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function normalizeNote(input: unknown, index: number): WhiteboardNote | null {
  if (!isRecord(input)) return null;

  const fallback = DEFAULT_NOTES[index % DEFAULT_NOTES.length];
  const id = typeof input.id === 'number' && Number.isFinite(input.id) ? input.id : Date.now() + index;
  const title = safeText(input.title, fallback.title);
  const subject = safeText(input.subject, fallback.subject);
  const content = safeText(input.content, safeText(input.desc, fallback.content));
  const image = safeText(input.img, safeText(input.imageUrl, fallback.img));
  const theme = THEMES.includes(input.theme as NoteTheme) ? (input.theme as NoteTheme) : fallback.theme;

  return {
    id,
    title,
    subject,
    period: safeText(input.period, fallback.period),
    desc: safeText(input.desc, content.slice(0, 80)),
    content,
    captureSource: input.captureSource === 'camera' || input.captureSource === 'upload' || input.captureSource === 'quick-note' || input.captureSource === 'seed'
      ? input.captureSource
      : fallback.captureSource,
    ocrText: safeText(input.ocrText, content),
    transcript: safeText(input.transcript, fallback.transcript ?? '尚未匯入老師講解逐字稿。'),
    imageUrl: image,
    audioUrl: safeText(input.audioUrl, ''),
    keywords: Array.isArray(input.keywords) ? input.keywords.filter((keyword): keyword is string => typeof keyword === 'string') : fallback.keywords,
    boardRegions: Array.isArray(input.boardRegions) ? input.boardRegions as WhiteboardNote['boardRegions'] : [],
    aiRecommendation: safeText(input.aiRecommendation, ''),
    linkedTaskIds: Array.isArray(input.linkedTaskIds) ? input.linkedTaskIds.filter((id): id is number => typeof id === 'number') : [],
    date: safeText(input.date, fallback.date),
    time: safeText(input.time, fallback.time),
    theme,
    img: image,
    createdAt: safeText(input.createdAt, new Date().toISOString()),
  };
}

export function normalizeNotes(input: unknown): WhiteboardNote[] {
  if (!Array.isArray(input)) return DEFAULT_NOTES;
  const notes = input.map(normalizeNote).filter((note): note is WhiteboardNote => Boolean(note));
  return notes.length > 0 ? notes : DEFAULT_NOTES;
}

export function loadNotes(): WhiteboardNote[] {
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    if (!raw) {
      saveNotes(DEFAULT_NOTES);
      return DEFAULT_NOTES;
    }

    const parsed = JSON.parse(raw);
    const notes = normalizeNotes(parsed);
    if (notes !== parsed) {
      saveNotes(notes);
    }
    return notes;
  } catch {
    saveNotes(DEFAULT_NOTES);
    return DEFAULT_NOTES;
  }
}

export function saveNotes(notes: WhiteboardNote[]) {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  window.dispatchEvent(new CustomEvent('whiteboard-notes-updated'));
}

export function addNote(input: Pick<WhiteboardNote, 'title' | 'subject' | 'content'> & Partial<WhiteboardNote>) {
  const now = new Date();
  const note: WhiteboardNote = {
    id: now.getTime(),
    title: input.title,
    subject: input.subject,
    period: input.period ?? '即時紀錄',
    desc: input.desc ?? input.content.slice(0, 80),
    content: input.content,
    captureSource: input.captureSource ?? 'quick-note',
    ocrText: input.ocrText ?? input.content,
    transcript: input.transcript ?? '尚未匯入老師講解逐字稿。',
    imageUrl: input.imageUrl ?? input.img,
    audioUrl: input.audioUrl ?? '',
    keywords: input.keywords ?? [input.subject, input.title].filter(Boolean),
    boardRegions: input.boardRegions ?? [],
    aiRecommendation: input.aiRecommendation ?? '',
    linkedTaskIds: input.linkedTaskIds ?? [],
    date: now.toLocaleDateString('zh-TW', {month: 'long', day: 'numeric'}),
    time: now.toLocaleTimeString('zh-TW', {hour: '2-digit', minute: '2-digit'}),
    theme: input.theme ?? 'primary',
    img: input.img ?? WHITEBOARD_DEFAULT,
    createdAt: now.toISOString(),
  };

  const notes = [note, ...loadNotes()];
  saveNotes(notes);
  return note;
}

export function updateNote(id: number, input: Partial<WhiteboardNote>) {
  let updated: WhiteboardNote | null = null;
  const notes = loadNotes().map((note) => {
    if (note.id !== id) {
      return note;
    }

    updated = {
      ...note,
      ...input,
      id: note.id,
      title: input.title ?? note.title,
      subject: input.subject ?? note.subject,
      content: input.content ?? note.content,
      period: input.period ?? note.period,
      desc: input.desc ?? note.desc,
      ocrText: input.ocrText ?? note.ocrText,
      transcript: input.transcript ?? note.transcript,
      keywords: input.keywords ?? note.keywords,
      boardRegions: input.boardRegions ?? note.boardRegions,
      aiRecommendation: input.aiRecommendation ?? note.aiRecommendation,
      img: input.img ?? input.imageUrl ?? note.img,
      imageUrl: input.imageUrl ?? input.img ?? note.imageUrl,
      createdAt: note.createdAt,
      date: note.date,
      time: note.time,
    };
    return updated;
  });

  if (!updated) {
    throw new Error('note not found');
  }

  saveNotes(notes);
  return updated;
}

export function deleteNote(id: number) {
  saveNotes(loadNotes().filter((note) => note.id !== id));
}

export async function loadNotesAsync(): Promise<WhiteboardNote[]> {
  try {
    const result = await apiRequest<{notes: WhiteboardNote[]}>('/api/notes');
    const notes = normalizeNotes(result.notes);
    saveNotes(notes);
    return notes;
  } catch {
    return loadNotes();
  }
}

export async function addNoteAsync(input: Pick<WhiteboardNote, 'title' | 'subject' | 'content'> & Partial<WhiteboardNote>) {
  try {
    const result = await apiRequest<{note: WhiteboardNote; notes: WhiteboardNote[]}>('/api/notes', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    const notes = Array.isArray(result.notes) ? result.notes : [result.note, ...loadNotes()];
    saveNotes(notes);
    return result.note as WhiteboardNote;
  } catch {
    return addNote(input);
  }
}

export async function updateNoteAsync(id: number, input: Partial<WhiteboardNote>) {
  try {
    const result = await apiRequest<{note: WhiteboardNote; notes: WhiteboardNote[]}>(`/api/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
    const notes = Array.isArray(result.notes) ? result.notes : loadNotes().map((note) => note.id === id ? result.note : note);
    saveNotes(notes);
    return result.note as WhiteboardNote;
  } catch {
    return updateNote(id, input);
  }
}

export async function deleteNoteAsync(id: number) {
  try {
    const result = await apiRequest<{notes: WhiteboardNote[]}>(`/api/notes/${id}`, {method: 'DELETE'});
    const notes = Array.isArray(result.notes) ? result.notes : loadNotes().filter((note) => note.id !== id);
    saveNotes(notes);
    return notes;
  } catch {
    deleteNote(id);
    return loadNotes();
  }
}

export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], {type: 'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
