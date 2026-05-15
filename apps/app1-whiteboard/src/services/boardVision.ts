import type {BoardRegion} from './classroomApi';
import {analyzeFrameQuality, FrameQualityResult} from './frameQuality';
import {BoardCalibration, calibrationBounds} from './whiteboardCalibration';

export interface WhiteboardVisionMetrics {
  inkDensity: number;
  edgeDensity: number;
  blankArea: number;
  contrast: number;
}

export interface WhiteboardVisionResult {
  metrics: WhiteboardVisionMetrics;
  quality: FrameQualityResult;
  regions: BoardRegion[];
  recommendation: string;
  evidence: string[];
}

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

function summarizeMetrics(width: number, height: number, data: Uint8ClampedArray | number[]): WhiteboardVisionMetrics {
  const step = 4;
  let ink = 0;
  let blank = 0;
  let lumaTotal = 0;
  let contrastTotal = 0;
  let edgeTotal = 0;
  let samples = 0;

  const lumaAt = (x: number, y: number) => {
    const index = (y * width + x) * 4;
    return 0.2126 * (data[index] ?? 0) + 0.7152 * (data[index + 1] ?? 0) + 0.0722 * (data[index + 2] ?? 0);
  };

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const luma = lumaAt(x, y);
      const right = x + step < width ? lumaAt(x + step, y) : luma;
      const down = y + step < height ? lumaAt(x, y + step) : luma;
      lumaTotal += luma;
      contrastTotal += Math.abs(luma - 180);
      edgeTotal += Math.abs(luma - right) + Math.abs(luma - down);
      if (luma < 168) ink += 1;
      if (luma > 218) blank += 1;
      samples += 1;
    }
  }

  return {
    inkDensity: clamp((ink / Math.max(1, samples)) * 100),
    edgeDensity: clamp(edgeTotal / Math.max(1, samples) / 2.1),
    blankArea: clamp((blank / Math.max(1, samples)) * 100),
    contrast: clamp((contrastTotal / Math.max(1, samples) / 180) * 100),
  };
}

export function analyzeWhiteboardPixels(width: number, height: number, data: Uint8ClampedArray | number[], calibration?: BoardCalibration): WhiteboardVisionResult {
  const metrics = summarizeMetrics(width, height, data);
  const quality = analyzeFrameQuality(width, height, data);
  const denseInk = metrics.inkDensity >= 34 || metrics.edgeDensity >= 28;
  const mostlyBlank = metrics.blankArea >= 48 && metrics.inkDensity < 22;
  const boardFrame = calibration ? calibrationBounds(calibration) : {x: 6, y: 12, width: 86, height: 80};
  const toBoardX = (offset: number) => boardFrame.x + boardFrame.width * offset;
  const toBoardY = (offset: number) => boardFrame.y + boardFrame.height * offset;
  const toBoardW = (size: number) => boardFrame.width * size;
  const toBoardH = (size: number) => boardFrame.height * size;
  const regions: BoardRegion[] = [
    {
      id: 'A',
      label: denseInk ? '左側重點區' : '左側保留區',
      x: Math.round(toBoardX(0.02) * 10) / 10,
      y: Math.round(toBoardY(0.06) * 10) / 10,
      width: Math.round(toBoardW(0.44) * 10) / 10,
      height: Math.round(toBoardH(0.76) * 10) / 10,
      status: denseInk ? 'keep' : 'erasable',
      reason: denseInk ? '像素顯示此區筆跡與邊緣較多，先保留給學生回看。' : '筆跡密度較低，可先清出空間。',
    },
    {
      id: 'B',
      label: mostlyBlank ? '右側可用留白區' : '右側練習區',
      x: Math.round(toBoardX(0.52) * 10) / 10,
      y: Math.round(toBoardY(0.06) * 10) / 10,
      width: Math.round(toBoardW(0.42) * 10) / 10,
      height: Math.round(toBoardH(0.76) * 10) / 10,
      status: mostlyBlank ? 'keep' : 'erasable',
      reason: mostlyBlank ? '留白比例高，適合作為下一題空間。' : '右側像素變化明顯，判定為可整理的練習內容。',
    },
  ];
  const keepLabels = regions.filter((region) => region.status === 'keep').map((region) => region.label).join('、') || '主要重點';
  const eraseLabels = regions.filter((region) => region.status === 'erasable').map((region) => region.label).join('、') || '空白區';

  return {
    metrics,
    quality,
    regions,
    recommendation: `${quality.level === 'poor' ? `${quality.label}：${quality.hints[0]} ` : ''}白板照片判斷：保留「${keepLabels}」，優先清理「${eraseLabels}」。`,
    evidence: [
      `畫面品質 ${quality.label}`,
      `筆跡密度 ${metrics.inkDensity}`,
      `邊緣密度 ${metrics.edgeDensity}`,
      `留白比例 ${metrics.blankArea}`,
      `對比 ${metrics.contrast}`,
      calibration ? '已套用 webcam 白板四角校正' : '未套用白板四角校正',
    ],
  };
}

export async function analyzeWhiteboardImage(imageDataUrl: string, calibration?: BoardCalibration): Promise<WhiteboardVisionResult> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image-load-failed'));
    img.src = imageDataUrl;
  });
  const canvas = document.createElement('canvas');
  const maxSide = 220;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
  canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
  canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
  const context = canvas.getContext('2d', {willReadFrequently: true});
  if (!context) throw new Error('canvas-unavailable');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const frame = context.getImageData(0, 0, canvas.width, canvas.height);
  const bounds = calibration ? calibrationBounds(calibration) : null;
  if (!bounds) {
    return analyzeWhiteboardPixels(frame.width, frame.height, frame.data);
  }
  const cropX = Math.max(0, Math.floor((bounds.x / 100) * frame.width));
  const cropY = Math.max(0, Math.floor((bounds.y / 100) * frame.height));
  const cropWidth = Math.max(1, Math.floor((bounds.width / 100) * frame.width));
  const cropHeight = Math.max(1, Math.floor((bounds.height / 100) * frame.height));
  const cropped = context.getImageData(cropX, cropY, cropWidth, cropHeight);
  return analyzeWhiteboardPixels(cropped.width, cropped.height, cropped.data, calibration);
}
