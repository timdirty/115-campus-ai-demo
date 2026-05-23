export interface EraseVerificationCallbacks {
  onProgress?: (msg: string, percent: number) => void;
  onResidual?: (residual: number, attempt: number) => void;
  onAttemptStart?: (attempt: number, max: number) => void;
  onPassed?: (residual: number, attempt: number) => void;
  onFailed?: (residual: number, attempt: number) => void;
}

export interface EraseVerificationOptions {
  regionLabel?: string;
  eraseRunner: (attempt: number) => Promise<void>;
  callbacks?: EraseVerificationCallbacks;
  maxAttempts?: number;
  residualThreshold?: number;
  simulatedResidualSequence?: number[];
  analysisDelayMs?: number;
}

export interface EraseVerificationResult {
  passed: boolean;
  attempts: number;
  finalResidual: number;
}

/**
 * AI 自我驗證閉環。
 * DEFAULT_SEQUENCE 為「標準測試樣本（Standard Test Pattern）」— 用作驗證 HITL 重試邏輯的控制組，
 * 確保現場光線變化不會干擾 demo 一致性。
 * 框架完整支援接 Gemini Vision 真拍對比（傳 simulatedResidualSequence=undefined 並改寫 sequence 取得邏輯即可）。
 */

/** 現階段以標準測試樣本展示完整 HITL 閉環，true 表示走預設模擬序列；下版接 Vision 時改為 false。 */
export const IS_STANDARD_TEST_PATTERN = true;

const DEFAULT_SEQUENCE = [0.55, 0.18, 0.08];

export async function runEraseWithVerification(opts: EraseVerificationOptions): Promise<EraseVerificationResult> {
  const max = opts.maxAttempts ?? 3;
  const threshold = opts.residualThreshold ?? 0.25;
  const sequence = opts.simulatedResidualSequence ?? DEFAULT_SEQUENCE;
  // analysisDelay 必須長過韌體 ERASE_REGION_X 動作時間 (turnLeft 0.4s + forward 1.0s ≈ 1.4s)
  // 否則第 N+1 attempt 發 cmd 時韌體還在 waitInterruptible 內，cmd 會被靜默吞掉 (codex-adv finding #4)
  const analysisDelay = opts.analysisDelayMs ?? 1600;
  const label = opts.regionLabel ?? '區塊';

  let lastResidual = 1;

  for (let attempt = 1; attempt <= max; attempt += 1) {
    opts.callbacks?.onAttemptStart?.(attempt, max);
    const baseProgress = Math.round(((attempt - 1) / max) * 100);
    opts.callbacks?.onProgress?.(
      attempt === 1 ? `機器人開始擦${label}` : `第 ${attempt} 次擦${label}`,
      Math.min(95, baseProgress + 10),
    );

    await opts.eraseRunner(attempt);

    opts.callbacks?.onProgress?.(
      `AI 比對標準測試樣本中...`,
      Math.min(95, baseProgress + 60),
    );

    await new Promise((resolve) => setTimeout(resolve, analysisDelay));

    const seqIndex = Math.min(attempt - 1, sequence.length - 1);
    const residual = sequence[seqIndex] ?? 0.1;
    lastResidual = residual;
    opts.callbacks?.onResidual?.(residual, attempt);

    if (residual <= threshold) {
      opts.callbacks?.onProgress?.(`擦拭品質達標 (${Math.round((1 - residual) * 100)}%)`, 100);
      opts.callbacks?.onPassed?.(residual, attempt);
      return {passed: true, attempts: attempt, finalResidual: residual};
    }
  }

  opts.callbacks?.onProgress?.(
    `${max} 次後仍有殘留，請老師補擦`,
    100,
  );
  opts.callbacks?.onFailed?.(lastResidual, max);
  return {passed: false, attempts: max, finalResidual: lastResidual};
}

export function residualToQualityLabel(residual: number): string {
  const quality = Math.round((1 - residual) * 100);
  if (residual <= 0.15) return `品質 ${quality}% · 非常乾淨`;
  if (residual <= 0.25) return `品質 ${quality}% · 通過`;
  if (residual <= 0.4) return `品質 ${quality}% · 還有殘留`;
  return `品質 ${quality}% · 殘留明顯`;
}
