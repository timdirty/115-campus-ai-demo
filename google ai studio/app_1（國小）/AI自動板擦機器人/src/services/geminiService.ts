import {apiRequest} from './apiClient';

export type QuizQuestion = {
  q: string;
  options: string[];
  ans: number;
  explanation: string;
};

type ChatHistoryItem = {role: 'user' | 'ai'; text: string};

function localSummary(content: string) {
  const lines = content.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  return [
    '## 本機國小學習單',
    '',
    'Bridge 暫時無法提供 AI 生成，因此先使用前端 fallback 產生孩子看得懂的學習單。',
    '',
    '### 今天我學到',
    ...lines.slice(0, 6).map((line) => `- ${line.replace(/^[-\d.、\s]+/, '')}`),
    '',
    '### 小朋友練習',
    '- 畫一張小圖或寫一句話說明今天的重點。',
    '- 和同桌互相問一題。',
  ].join('\n');
}

function localQuiz(content: string): QuizQuestion[] {
  const pool = content
    .split(/\n+/)
    .map((line) => line.replace(/^[-\d.、\s]+/, '').trim())
    .filter((line) => line.length >= 6);
  const source = pool.length ? pool : ['請先在課堂紀錄本新增完整板書內容。'];

  return source.slice(0, 5).map((line, index) => ({
    q: `第 ${index + 1} 個重點最接近哪一句？`,
    options: [
      line.slice(0, 48),
      '與本次板書無關的敘述',
      '不用理解，只要猜答案',
      '今天沒有提到這件事',
    ],
    ans: 0,
    explanation: `回到課堂紀錄看這一句：「${line}」。`,
  }));
}

export async function chatWithAI(message: string, history: ChatHistoryItem[], noteIds: number[] = []) {
  try {
    const result = await apiRequest<{reply?: string}>('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({message, history, noteIds}),
      timeoutMs: 30000,
    });
    return result.reply || '目前沒有取得 AI 回覆。';
  } catch {
    return [
      'Bridge AI 暫時無法連線，我先用國小小老師本機模式回覆。',
      '',
      `你的問題：「${message}」`,
      '',
      '- 先把重點改成一句孩子聽得懂的話。',
      '- 再加一個生活例子、畫圖或同桌討論。',
      '- 有 Gemini API Key 時，系統會改用伺服器端 AI 分析。',
    ].join('\n');
  }
}

export async function summarizeContent(content: string) {
  return localSummary(content);
}

export async function generateQuizFromContent(content: string): Promise<QuizQuestion[]> {
  return localQuiz(content);
}

export async function summarizeNote(noteId: number, fallbackContent: string) {
  try {
    const result = await apiRequest<{summary?: string}>('/api/ai/review', {
      method: 'POST',
      body: JSON.stringify({noteId, mode: 'summary'}),
      timeoutMs: 30000,
    });
    return result.summary || localSummary(fallbackContent);
  } catch {
    return localSummary(fallbackContent);
  }
}

export async function generateQuizFromNote(noteId: number, fallbackContent: string): Promise<QuizQuestion[]> {
  try {
    const result = await apiRequest<{quiz?: QuizQuestion[]}>('/api/ai/review', {
      method: 'POST',
      body: JSON.stringify({noteId, mode: 'quiz'}),
      timeoutMs: 30000,
    });
    return Array.isArray(result.quiz) && result.quiz.length ? result.quiz : localQuiz(fallbackContent);
  } catch {
    return localQuiz(fallbackContent);
  }
}
