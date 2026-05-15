const OCR_SERVICE_URL = 'http://127.0.0.1:3209';
const TIMEOUT_MS = 5_000;

export type OcrBlock = {text: string; confidence: number; bbox: number[][]};

export type OcrResult = {
  ok: boolean;
  text: string;
  blocks: OcrBlock[];
  engine: string;
  error?: string;
};

export async function ocrImage(imageBase64: string): Promise<OcrResult> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const resp = await fetch(`${OCR_SERVICE_URL}/ocr`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({imageBase64}),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) throw new Error(`OCR service HTTP ${resp.status}`);
    return await resp.json() as OcrResult;
  } catch {
    return {ok: false, text: '', blocks: [], engine: 'none', error: 'service unavailable'};
  }
}

export async function isOcrServiceReady(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2_000);
    const resp = await fetch(`${OCR_SERVICE_URL}/health`, {signal: controller.signal});
    clearTimeout(timer);
    return resp.ok;
  } catch {
    return false;
  }
}
