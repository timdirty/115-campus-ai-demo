import {runEraseWithVerification, residualToQualityLabel} from './eraseVerifier';

function check(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${String(expected)} got ${String(actual)}`);
  }
}

async function run() {
  const attempts: number[] = [];
  const residuals: number[] = [];
  const result = await runEraseWithVerification({
    regionLabel: 'A 區',
    eraseRunner: async (attempt) => {
      attempts.push(attempt);
    },
    callbacks: {
      onResidual: (r) => residuals.push(r),
    },
    analysisDelayMs: 0,
  });

  check(attempts.length, 2, 'default sequence should pass at attempt 2');
  check(result.passed, true, 'default sequence should pass');
  check(result.attempts, 2, 'attempts count = 2');
  check(residuals[0], 0.55, 'first residual matches sequence');
  check(residuals[1], 0.18, 'second residual matches sequence');

  const failResult = await runEraseWithVerification({
    eraseRunner: async () => {},
    simulatedResidualSequence: [0.9, 0.7, 0.5],
    analysisDelayMs: 0,
  });
  check(failResult.passed, false, 'all-high sequence should fail');
  check(failResult.attempts, 3, 'failed after 3 attempts');

  const passEarly = await runEraseWithVerification({
    eraseRunner: async () => {},
    simulatedResidualSequence: [0.1, 0.05, 0.03],
    analysisDelayMs: 0,
  });
  check(passEarly.attempts, 1, 'low first residual passes immediately');

  check(residualToQualityLabel(0.1).includes('非常乾淨'), true, 'quality label very clean');
  check(residualToQualityLabel(0.2).includes('通過'), true, 'quality label pass');
  check(residualToQualityLabel(0.5).includes('殘留明顯'), true, 'quality label residue');

  console.log('eraseVerifier tests passed');
}

await run();
