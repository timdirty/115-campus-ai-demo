import {ollamaBaseUrl, ollamaVisionModel} from './config';

const OCR_SERVICE_URL = 'http://127.0.0.1:3209';
const TIMEOUT_MS = 5_000;
const OLLAMA_TIMEOUT_MS = 15_000;

export type OcrBlock = {text: string; confidence: number; bbox: number[][]};

export type OcrResult = {
  ok: boolean;
  text: string;
  blocks: OcrBlock[];
  engine: string;
  error?: string;
};

function stripImageBase64(imageBase64: string) {
  const match = imageBase64.match(/^data:image\/[^;]+;base64,(.+)$/s);
  return (match?.[1] ?? imageBase64).trim();
}

async function ocrWithEasyOcr(imageBase64: string): Promise<OcrResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(`${OCR_SERVICE_URL}/ocr`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({imageBase64}),
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`OCR service HTTP ${resp.status}`);
    return await resp.json() as OcrResult;
  } finally {
    clearTimeout(timer);
  }
}

async function ocrWithOllama(imageBase64: string): Promise<OcrResult> {
  if (!ollamaVisionModel) {
    return {ok: false, text: '', blocks: [], engine: 'none', error: 'OLLAMA_VISION_MODEL not configured'};
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);
  try {
    const resp = await fetch(`${ollamaBaseUrl.replace(/\/$/, '')}/api/generate`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        model: ollamaVisionModel,
        stream: false,
        images: [stripImageBase64(imageBase64)],
        prompt: [
          '請只辨識圖片中白板上的實際文字。',
          '使用繁體中文輸出。',
          '不要解釋、不要摘要、不要補猜不存在的內容。',
          '如果看不清楚，請輸出「辨識不清」。',
        ].join('\n'),
      }),
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`Ollama HTTP ${resp.status}`);
    const data = await resp.json() as {response?: string};
    const text = String(data.response ?? '').trim();
    return {
      ok: Boolean(text) && text !== '辨識不清',
      text,
      blocks: text ? [{text, confidence: 0.6, bbox: []}] : [],
      engine: `ollama:${ollamaVisionModel}`,
      error: text ? undefined : 'empty Ollama response',
    };
  } catch (error) {
    return {ok: false, text: '', blocks: [], engine: `ollama:${ollamaVisionModel}`, error: error instanceof Error ? error.message : String(error)};
  } finally {
    clearTimeout(timer);
  }
}

export async function ocrImage(imageBase64: string): Promise<OcrResult> {
  try {
    const easyOcr = await ocrWithEasyOcr(imageBase64);
    if (easyOcr.ok && easyOcr.text.trim()) {
      return easyOcr;
    }
    const ollama = await ocrWithOllama(imageBase64);
    if (ollama.ok && ollama.text.trim()) {
      return ollama;
    }
    return easyOcr.ok ? easyOcr : ollama;
  } catch (error) {
    const ollama = await ocrWithOllama(imageBase64);
    if (ollama.ok && ollama.text.trim()) {
      return ollama;
    }
    return {ok: false, text: '', blocks: [], engine: 'none', error: error instanceof Error ? error.message : 'service unavailable'};
  }
}

export async function isOcrServiceReady(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2_000);
    const resp = await fetch(`${OCR_SERVICE_URL}/health`, {signal: controller.signal});
    clearTimeout(timer);
    if (resp.ok) return true;
  } catch {
  }

  if (!ollamaVisionModel) return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2_000);
    const resp = await fetch(`${ollamaBaseUrl.replace(/\/$/, '')}/api/tags`, {signal: controller.signal});
    clearTimeout(timer);
    return resp.ok;
  } catch {
    return false;
  }
}
