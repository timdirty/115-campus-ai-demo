import {useRef} from 'react';

/**
 * Per-handler abort controller with race-guarded end().
 *
 * Usage:
 *   const captureAbort = useActionAbort();
 *   async function handleCapture() {
 *     const {signal, token} = captureAbort.begin();
 *     try { await analyze({...}, signal); }
 *     catch (e) { if (e instanceof Error && e.name === 'AbortError') return; throw e; }
 *     finally { captureAbort.end(token); }  // 只有 token 匹配才清
 *   }
 *
 * Why token guard: 舊 handler 的 finally end() 可能在新 controller 已經 begin 之後執行，
 * 不加 guard 會把新的 controller 也清掉。token 對齊才清才安全。
 *
 * Note: app3 重複實作（不抽共用 lib），避免 app2/app3 互相依賴造成循環。
 */
export function useActionAbort() {
  const ref = useRef<{controller: AbortController; token: number} | null>(null);
  const tokenSeq = useRef(0);
  return {
    begin(): {signal: AbortSignal; token: number} {
      ref.current?.controller.abort();
      const controller = new AbortController();
      const token = ++tokenSeq.current;
      ref.current = {controller, token};
      return {signal: controller.signal, token};
    },
    end(token: number): void {
      if (ref.current?.token === token) ref.current = null;
    },
    abort(): void {
      ref.current?.controller.abort();
      ref.current = null;
    },
  };
}
