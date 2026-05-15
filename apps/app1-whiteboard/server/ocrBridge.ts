import {GoogleGenAI, createPartFromBase64} from '@google/genai';
import {geminiApiKey, geminiVisionModel} from './config';
import {stripDataUrl} from './validation';

const OCR_SERVICE_URL = 'http://127.0.0.1:3209';
const TIMEOUT_MS = 5_000;
const GEMINI_TIMEOUT_MS = 20_000;
const gemini = geminiApiKey ? new GoogleGenAI({apiKey: geminiApiKey}) : null;

export type OcrBlock = {text: string; confidence: number; bbox: number[][]};

export type OcrResult = {
  ok: boolean;
  text: string;
  blocks: OcrBlock[];
  engine: string;
  error?: string;
};

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

async function ocrWithGemini(imageBase64: string): Promise<OcrResult> {
  if (!gemini) {
    return {ok: false, text: '', blocks: [], engine: 'none', error: 'GEMINI_API_KEY not configured'};
  }

  const media = stripDataUrl(imageBase64, 'image/png');
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Gemini OCR timeout')), GEMINI_TIMEOUT_MS);
  });

  try {
    const response = await Promise.race([
      gemini.models.generateContent({
        model: geminiVisionModel,
        contents: [{
          role: 'user',
          parts: [
            {
              text: [
                '請只辨識圖片中白板上的實際文字。',
                '使用繁體中文輸出。',
                '保留換行與原本順序。',
                '不要解釋、不要摘要、不要補猜不存在的內容。',
                '如果看不清楚，請只輸出「辨識不清」。',
              ].join('\n'),
            },
            createPartFromBase64(media.data, media.mimeType),
          ],
        }],
        config: {temperature: 0},
      }),
      timeout,
    ]);
    const text = String(response.text ?? '').trim();
    return {
      ok: Boolean(text) && text !== '辨識不清',
      text,
      blocks: text ? [{text, confidence: 0.85, bbox: []}] : [],
      engine: `gemini:${geminiVisionModel}`,
      error: text ? undefined : 'empty Gemini response',
    };
  } catch (error) {
    return {ok: false, text: '', blocks: [], engine: `gemini:${geminiVisionModel}`, error: error instanceof Error ? error.message : String(error)};
  }
}

export async function ocrImage(imageBase64: string): Promise<OcrResult> {
  const geminiOcr = await ocrWithGemini(imageBase64);
  if (geminiOcr.ok && geminiOcr.text.trim()) {
    return geminiOcr;
  }

  try {
    const easyOcr = await ocrWithEasyOcr(imageBase64);
    if (easyOcr.ok && easyOcr.text.trim()) {
      return easyOcr;
    }
    return easyOcr.ok ? easyOcr : geminiOcr;
  } catch (error) {
    return geminiOcr.ok
      ? geminiOcr
      : {ok: false, text: '', blocks: [], engine: 'none', error: error instanceof Error ? error.message : geminiOcr.error ?? 'service unavailable'};
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

  return Boolean(gemini);
}
