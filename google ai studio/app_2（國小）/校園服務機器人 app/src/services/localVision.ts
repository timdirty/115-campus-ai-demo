import type {DispatchTaskType} from '../state/appState';
import {analyzeFrameQuality, FrameQualityResult} from './frameQuality';

export type VisionScene = 'delivery' | 'cleaning' | 'crowd' | 'safety' | 'patrol';

export interface CampusVisionResult {
  scene: VisionScene;
  label: string;
  confidence: number;
  zone: string;
  summary: string;
  suggestedAction: string;
  dispatchTaskType: DispatchTaskType;
  command: string;
  tags: string[];
  evidence: string[];
  metrics?: CampusVisionMetrics;
  quality?: FrameQualityResult;
}

export interface CampusVisionMetrics {
  brightness: number;
  saturation: number;
  edgeDensity: number;
  darkArea: number;
  warmArea: number;
}

const sceneProfiles: Record<VisionScene, Omit<CampusVisionResult, 'confidence' | 'zone'>> = {
  delivery: {
    scene: 'delivery',
    label: '物品配送辨識',
    summary: '畫面像是教室或櫃檯取物情境，適合派服務機器人協助配送。',
    suggestedAction: '建立配送提示並讓機器人前往最近服務點',
    dispatchTaskType: 'patrol',
    command: 'VISION_DELIVERY_ROUTE',
    tags: ['取物', '教室', '服務'],
    evidence: [],
  },
  cleaning: {
    scene: 'cleaning',
    label: '清掃需求辨識',
    summary: '畫面可能有走廊或教室地面狀態，建議加入清潔巡邏。',
    suggestedAction: '派清掃路線並回傳完成狀態',
    dispatchTaskType: 'patrol',
    command: 'VISION_CLEAN_SWEEP',
    tags: ['清掃', '走廊', '地面'],
    evidence: [],
  },
  crowd: {
    scene: 'crowd',
    label: '人流疏導辨識',
    summary: '畫面符合下課人流或集合區情境，適合啟動廣播疏導。',
    suggestedAction: '派遣疏導廣播並提示慢行',
    dispatchTaskType: 'broadcast',
    command: 'VISION_CROWD_BROADCAST',
    tags: ['人流', '廣播', '疏導'],
    evidence: [],
  },
  safety: {
    scene: 'safety',
    label: '安全巡查辨識',
    summary: '畫面可能有通道阻塞或需要老師確認的區域，建議保守派巡邏。',
    suggestedAction: '建立安全巡查並保留影像回報',
    dispatchTaskType: 'patrol',
    command: 'VISION_SAFETY_PATROL',
    tags: ['安全', '阻塞', '巡查'],
    evidence: [],
  },
  patrol: {
    scene: 'patrol',
    label: '一般巡邏辨識',
    summary: '畫面沒有明顯急迫事件，適合列入日常巡邏與環境紀錄。',
    suggestedAction: '排入巡邏熱區並持續觀察',
    dispatchTaskType: 'patrol',
    command: 'VISION_PATROL',
    tags: ['巡邏', '紀錄', '觀察'],
    evidence: [],
  },
};

const zonePool = ['A 棟穿堂', 'B 棟走廊', '五年級教室', '操場入口', '福利社前'];

function hashInput(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

function inferScene(text: string, hash: number): VisionScene {
  const lower = text.toLowerCase();
  if (/便當|餐|飲|取物|配送|package|delivery|food/.test(lower)) return 'delivery';
  if (/垃圾|髒|清掃|地板|走廊|clean|trash|floor/.test(lower)) return 'cleaning';
  if (/人流|擁擠|集合|crowd|busy|hall/.test(lower)) return 'crowd';
  if (/危險|跌倒|阻塞|安全|safety|fall|block/.test(lower)) return 'safety';
  return (['delivery', 'cleaning', 'crowd', 'safety', 'patrol'] as VisionScene[])[hash % 5];
}

export function analyzeCampusFrame(input = 'demo-campus-frame'): CampusVisionResult {
  const hash = hashInput(input || 'demo-campus-frame');
  const scene = inferScene(input, hash);
  const confidence = 72 + (hash % 21);
  const zone = zonePool[hash % zonePool.length];
  return {
    ...sceneProfiles[scene],
    confidence,
    zone,
    evidence: ['示範文字情境', `樣本代碼 ${hash % 1000}`],
  };
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function classifyByPixels(metrics: CampusVisionMetrics): {scene: VisionScene; evidence: string[]} {
  const evidence: string[] = [
    `亮度 ${metrics.brightness}`,
    `邊緣 ${metrics.edgeDensity}`,
    `暗區 ${metrics.darkArea}`,
  ];

  // crowd: 走廊人潮 — 多人體邊緣 + 暖色衣物 (門檻降低以匹配實測數據)
  if (metrics.edgeDensity >= 28 && metrics.warmArea >= 13) {
    evidence.push('走廊人員熱區與邊緣偏高');
    return {scene: 'crowd', evidence};
  }
  // delivery: 室內取餐 — 先於 safety 判斷，避免暗教室被誤判
  if (metrics.saturation >= 28 && metrics.warmArea >= 20 && metrics.darkArea >= 30) {
    evidence.push('色彩飽和且暗區偏高，疑似室內配送情境');
    return {scene: 'delivery', evidence};
  }
  // safety: 阻塞/暗區 (門檻提高避免誤判 delivery)
  if (metrics.darkArea >= 42 || (metrics.edgeDensity >= 42 && metrics.brightness < 46)) {
    evidence.push('暗區或阻塞感偏高');
    return {scene: 'safety', evidence};
  }
  // cleaning: 低彩度明亮走廊 (edgeDensity 門檻降低)
  if (metrics.saturation <= 22 && metrics.brightness >= 44 && metrics.edgeDensity >= 15) {
    evidence.push('低彩度平面與細碎邊緣');
    return {scene: 'cleaning', evidence};
  }
  evidence.push('未達高風險門檻');
  return {scene: 'patrol', evidence};
}

export function analyzeCampusPixels(width: number, height: number, data: Uint8ClampedArray | number[]): CampusVisionResult {
  const step = 4;
  let brightnessTotal = 0;
  let saturationTotal = 0;
  let darkPixels = 0;
  let warmPixels = 0;
  let edgeTotal = 0;
  let samples = 0;

  const pixelAt = (x: number, y: number) => {
    const index = (y * width + x) * 4;
    const r = data[index] ?? 0;
    const g = data[index + 1] ?? 0;
    const b = data[index + 2] ?? 0;
    return {r, g, b, luma: 0.2126 * r + 0.7152 * g + 0.0722 * b};
  };

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const p = pixelAt(x, y);
      const max = Math.max(p.r, p.g, p.b);
      const min = Math.min(p.r, p.g, p.b);
      brightnessTotal += p.luma;
      saturationTotal += max === 0 ? 0 : ((max - min) / max) * 100;
      if (p.luma < 72) darkPixels += 1;
      if (p.r > 95 && p.r > p.b * 1.18 && p.g > p.b * 0.82) warmPixels += 1;
      if (x + step < width && y + step < height) {
        const right = pixelAt(x + step, y).luma;
        const down = pixelAt(x, y + step).luma;
        edgeTotal += Math.abs(p.luma - right) + Math.abs(p.luma - down);
      }
      samples += 1;
    }
  }

  const metrics: CampusVisionMetrics = {
    brightness: clampScore((brightnessTotal / Math.max(1, samples) / 255) * 100),
    saturation: clampScore(saturationTotal / Math.max(1, samples)),
    edgeDensity: clampScore(edgeTotal / Math.max(1, samples) / 2.2),
    darkArea: clampScore((darkPixels / Math.max(1, samples)) * 100),
    warmArea: clampScore((warmPixels / Math.max(1, samples)) * 100),
  };
  const quality = analyzeFrameQuality(width, height, data);
  const {scene, evidence} = classifyByPixels(metrics);
  const confidence = clampScore(58 + Math.max(metrics.edgeDensity, metrics.darkArea, metrics.saturation) * 0.42);
  const zone = zonePool[(width + height + metrics.edgeDensity + metrics.darkArea) % zonePool.length];

  return {
    ...sceneProfiles[scene],
    confidence,
    zone,
    evidence: [`畫面品質 ${quality.label}`, ...quality.hints, ...evidence],
    metrics,
    quality,
  };
}

export async function analyzeCampusImage(imageDataUrl: string): Promise<CampusVisionResult> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image-load-failed'));
    img.src = imageDataUrl;
  });
  const canvas = document.createElement('canvas');
  const maxSide = 180;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
  canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
  canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
  const context = canvas.getContext('2d', {willReadFrequently: true});
  if (!context) throw new Error('canvas-unavailable');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const frame = context.getImageData(0, 0, canvas.width, canvas.height);
  return analyzeCampusPixels(frame.width, frame.height, frame.data);
}
