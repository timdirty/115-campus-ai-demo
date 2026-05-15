import {apiRequest} from './apiClient';
import {matchTemplate} from './localChatTemplates';

export type QuizQuestion = {
  q: string;
  options: string[];
  ans: number;
  explanation: string;
};

type ChatHistoryItem = {role: 'user' | 'ai'; text: string};

const CHAT_AI_TIMEOUT_MS = 12000;
const REVIEW_AI_TIMEOUT_MS = 8000;

function localSummary(content: string) {
  const lines = content.split(/\n+/).map((l) => l.trim()).filter(Boolean);

  const objectiveLine = lines.find((l) => /目標|學習目標/.test(l));

  const keyPoints = lines
    .filter((l) => /^[1-9][.\s、]/.test(l))
    .map((l) => l.replace(/^[1-9][.\s、]+/, '').trim())
    .slice(0, 6);

  const bulletPoints =
    keyPoints.length > 0
      ? keyPoints
      : lines.filter((l) => !/^[#*=]/.test(l) && l.length > 8).slice(0, 5);

  const exerciseLine = lines.find((l) => /例題|練習|任務|作業|口語/.test(l));

  const result: string[] = ['## 今日課堂學習摘要', ''];

  if (objectiveLine) {
    result.push('### 學習目標');
    result.push(objectiveLine.replace(/.*[:：]\s*/, '').trim() || objectiveLine);
    result.push('');
  }

  if (bulletPoints.length > 0) {
    result.push('### 板書重點');
    bulletPoints.forEach((pt) => result.push(`- ${pt}`));
    result.push('');
  }

  result.push('### 課後練習');
  if (exerciseLine) {
    result.push(`- ${exerciseLine.replace(/.*[:：]\s*/, '').trim() || exerciseLine}`);
  }
  result.push('- 用自己的話說一遍今天最重要的一件事。');
  result.push('- 把關鍵概念畫成一張小圖或一句話紀錄。');

  return result.join('\n');
}

function localQuiz(content: string): QuizQuestion[] {
  const lines = content
    .split(/\n+/)
    .map((l) => l.replace(/^[-\d.、\s]+/, '').trim())
    .filter((l) => l.length >= 6 && !/目標|板書重點|任務|作業/.test(l));

  if (lines.length < 3) {
    const correct = lines[0] ?? '請先新增課堂板書紀錄';
    return [
      {
        q: '以下哪一句最符合今天的學習重點？',
        options: [correct.slice(0, 48), '今天沒有提到這件事', '與課程無關的敘述', '老師說要猜答案'],
        ans: 0,
        explanation: `這是今天的重要重點：「${correct}」。`,
      },
    ];
  }

  const ansPositions = [0, 2, 1, 3];

  return lines.slice(0, 4).map((correctLine, i) => {
    const distractors = lines
      .filter((_, j) => j !== i)
      .slice(0, 3)
      .map((d) => d.slice(0, 48));
    const padOptions = ['今天沒有提到這件事', '與本次課程無關', '不在板書重點內'];
    while (distractors.length < 3) distractors.push(padOptions[distractors.length]);

    const correct = correctLine.slice(0, 48);
    const ansPos = ansPositions[i % ansPositions.length];
    const options = [...distractors];
    options.splice(ansPos, 0, correct);

    return {
      q: `關於今天的學習，哪一句話最正確？（第 ${i + 1} 題）`,
      options: options.slice(0, 4),
      ans: ansPos,
      explanation: `「${correct}」是今天板書的重要重點。`,
    };
  });
}

export async function chatWithAI(message: string, history: ChatHistoryItem[], noteIds: number[] = []) {
  void noteIds;
  try {
    const result = await apiRequest<{reply?: string}>('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({message, history, noteIds}),
      timeoutMs: CHAT_AI_TIMEOUT_MS,
    });
    return result.reply || '目前沒有取得 AI 回覆。';
  } catch {
    return matchTemplate(message);
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
      timeoutMs: REVIEW_AI_TIMEOUT_MS,
    });
    return result.summary || localSummary(fallbackContent);
  } catch {
    return localSummary(fallbackContent);
  }
}

function normalizeQuizQuestion(q: unknown, index: number): QuizQuestion | null {
  if (!q || typeof q !== 'object') return null;
  const item = q as Record<string, unknown>;
  const options = Array.isArray(item.options) ? item.options.filter((o): o is string => typeof o === 'string') : [];
  if (options.length < 2) return null;
  const ans = typeof item.ans === 'number' && Number.isInteger(item.ans) && item.ans >= 0 && item.ans < options.length ? item.ans : 0;
  return {
    q: typeof item.q === 'string' && item.q.trim() ? item.q.trim() : `第 ${index + 1} 題`,
    options,
    ans,
    explanation: typeof item.explanation === 'string' ? item.explanation : '',
  };
}

export async function generateQuizFromNote(noteId: number, fallbackContent: string): Promise<QuizQuestion[]> {
  try {
    const result = await apiRequest<{quiz?: unknown[]}>('/api/ai/review', {
      method: 'POST',
      body: JSON.stringify({noteId, mode: 'quiz'}),
      timeoutMs: REVIEW_AI_TIMEOUT_MS,
    });
    if (Array.isArray(result.quiz) && result.quiz.length) {
      const normalized = result.quiz.map(normalizeQuizQuestion).filter((q): q is QuizQuestion => q !== null);
      if (normalized.length) return normalized;
    }
    return localQuiz(fallbackContent);
  } catch {
    return localQuiz(fallbackContent);
  }
}
