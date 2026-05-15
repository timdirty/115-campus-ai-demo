export type CalibrationCornerId = 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft';

export type CalibrationPoint = {
  x: number;
  y: number;
};

export type BoardCalibration = Record<CalibrationCornerId, CalibrationPoint>;

export type BoardCalibrationMode = 'default' | 'manual' | 'auto';

export type BoardCalibrationDetection = {
  calibration: BoardCalibration;
  confidence: number;
  evidence: string[];
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value * 10) / 10));

export function defaultBoardCalibration(): BoardCalibration {
  return {
    topLeft: {x: 10, y: 12},
    topRight: {x: 90, y: 12},
    bottomRight: {x: 90, y: 88},
    bottomLeft: {x: 10, y: 88},
  };
}

export function normalizeBoardCalibration(value: unknown): BoardCalibration {
  const fallback = defaultBoardCalibration();
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

  const normalizePoint = (point: unknown, key: CalibrationCornerId): CalibrationPoint => {
    const fallbackPoint = fallback[key];
    if (!point || typeof point !== 'object' || Array.isArray(point)) {
      return fallbackPoint;
    }
    const record = point as Record<string, unknown>;
    return {
      x: clampPercent(Number.isFinite(Number(record.x)) ? Number(record.x) : fallbackPoint.x),
      y: clampPercent(Number.isFinite(Number(record.y)) ? Number(record.y) : fallbackPoint.y),
    };
  };

  return {
    topLeft: normalizePoint(source.topLeft, 'topLeft'),
    topRight: normalizePoint(source.topRight, 'topRight'),
    bottomRight: normalizePoint(source.bottomRight, 'bottomRight'),
    bottomLeft: normalizePoint(source.bottomLeft, 'bottomLeft'),
  };
}

export function calibrationBounds(calibration: BoardCalibration) {
  const xs = Object.values(calibration).map((point) => point.x);
  const ys = Object.values(calibration).map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    x: clampPercent(minX),
    y: clampPercent(minY),
    width: clampPercent(Math.max(8, maxX - minX)),
    height: clampPercent(Math.max(8, maxY - minY)),
  };
}

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function detectBoardCalibrationFromPixels(width: number, height: number, data: Uint8ClampedArray | number[]): BoardCalibrationDetection {
  const fallback = defaultBoardCalibration();
  const sampleStep = Math.max(1, Math.round(Math.min(width, height) / 120));
  const rows = Math.max(1, Math.ceil(height / sampleStep));
  const cols = Math.max(1, Math.ceil(width / sampleStep));
  const rowBright = new Array(rows).fill(0);
  const colBright = new Array(cols).fill(0);
  const rowInk = new Array(rows).fill(0);
  const colInk = new Array(cols).fill(0);

  let lumaTotal = 0;
  let samples = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const px = Math.min(width - 1, col * sampleStep);
      const py = Math.min(height - 1, row * sampleStep);
      const index = (py * width + px) * 4;
      const luma = 0.2126 * (data[index] ?? 0) + 0.7152 * (data[index + 1] ?? 0) + 0.0722 * (data[index + 2] ?? 0);
      lumaTotal += luma;
      samples += 1;
    }
  }

  const averageLuma = lumaTotal / Math.max(1, samples);
  const brightThreshold = Math.max(156, Math.min(235, averageLuma + 12));
  const inkThreshold = Math.max(72, Math.min(160, averageLuma - 30));

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const px = Math.min(width - 1, col * sampleStep);
      const py = Math.min(height - 1, row * sampleStep);
      const index = (py * width + px) * 4;
      const luma = 0.2126 * (data[index] ?? 0) + 0.7152 * (data[index + 1] ?? 0) + 0.0722 * (data[index + 2] ?? 0);
      if (luma >= brightThreshold) {
        rowBright[row] += 1;
        colBright[col] += 1;
      }
      if (luma <= inkThreshold) {
        rowInk[row] += 1;
        colInk[col] += 1;
      }
    }
  }

  const rowBrightRatio = rowBright.map((count) => count / Math.max(1, cols));
  const colBrightRatio = colBright.map((count) => count / Math.max(1, rows));
  const rowInkRatio = rowInk.map((count) => count / Math.max(1, cols));
  const colInkRatio = colInk.map((count) => count / Math.max(1, rows));

  const findLeadingEdge = (ratios: number[], inkRatios: number[], minIndex: number, maxIndex: number) => {
    let bestIndex = -1;
    let bestScore = -Infinity;
    for (let i = minIndex; i <= maxIndex; i += 1) {
      const inside = (ratios[i] ?? 0) + (ratios[i + 1] ?? ratios[i] ?? 0);
      const outside = (ratios[i - 1] ?? 0) + (ratios[i - 2] ?? 0);
      const nearbyInk = (inkRatios[i + 1] ?? 0) + (inkRatios[i + 2] ?? 0);
      const score = inside * 1.2 - outside + nearbyInk * 0.35;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
    return {index: bestIndex, score: bestScore};
  };

  const findTrailingEdge = (ratios: number[], inkRatios: number[], minIndex: number, maxIndex: number) => {
    let bestIndex = -1;
    let bestScore = -Infinity;
    for (let i = maxIndex; i >= minIndex; i -= 1) {
      const inside = (ratios[i] ?? 0) + (ratios[i - 1] ?? ratios[i] ?? 0);
      const outside = (ratios[i + 1] ?? 0) + (ratios[i + 2] ?? 0);
      const nearbyInk = (inkRatios[i - 1] ?? 0) + (inkRatios[i - 2] ?? 0);
      const score = inside * 1.2 - outside + nearbyInk * 0.35;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
    return {index: bestIndex, score: bestScore};
  };

  const top = findLeadingEdge(rowBrightRatio, rowInkRatio, Math.floor(rows * 0.04), Math.floor(rows * 0.36));
  const bottom = findTrailingEdge(rowBrightRatio, rowInkRatio, Math.floor(rows * 0.58), Math.floor(rows * 0.96));
  const left = findLeadingEdge(colBrightRatio, colInkRatio, Math.floor(cols * 0.02), Math.floor(cols * 0.26));
  const right = findTrailingEdge(colBrightRatio, colInkRatio, Math.floor(cols * 0.7), Math.floor(cols * 0.98));

  const topPercent = clampPercent(((top.index + 1) / rows) * 100);
  const bottomPercent = clampPercent((bottom.index / rows) * 100);
  const leftPercent = clampPercent(((left.index + 1) / cols) * 100);
  const rightPercent = clampPercent((right.index / cols) * 100);

  const widthPercent = rightPercent - leftPercent;
  const heightPercent = bottomPercent - topPercent;
  if (widthPercent < 30 || heightPercent < 24) {
    return {
      calibration: fallback,
      confidence: 0,
      evidence: ['自動偵測沒有找到足夠大的白板矩形，已回到預設四角。'],
    };
  }

  const confidence = clampScore(
    38
      + Math.min(22, Math.max(0, widthPercent - 48))
      + Math.min(18, Math.max(0, heightPercent - 34))
      + Math.max(0, top.score + bottom.score + left.score + right.score) * 9,
  );
  const calibration = normalizeBoardCalibration({
    topLeft: {x: leftPercent, y: topPercent},
    topRight: {x: rightPercent, y: topPercent},
    bottomRight: {x: rightPercent, y: bottomPercent},
    bottomLeft: {x: leftPercent, y: bottomPercent},
  });

  return {
    calibration,
    confidence,
    evidence: [
      `偵測到白板寬度約 ${clampScore(widthPercent)}%`,
      `偵測到白板高度約 ${clampScore(heightPercent)}%`,
      `亮面門檻 ${Math.round(brightThreshold)}`,
    ],
  };
}

export async function detectBoardCalibrationFromImage(imageDataUrl: string): Promise<BoardCalibrationDetection> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image-load-failed'));
    img.src = imageDataUrl;
  });
  const canvas = document.createElement('canvas');
  const maxSide = 240;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
  canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
  canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
  const context = canvas.getContext('2d', {willReadFrequently: true});
  if (!context) {
    throw new Error('canvas-unavailable');
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const frame = context.getImageData(0, 0, canvas.width, canvas.height);
  return detectBoardCalibrationFromPixels(frame.width, frame.height, frame.data);
}
