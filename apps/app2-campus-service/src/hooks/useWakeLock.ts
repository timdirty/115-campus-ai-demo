import {useEffect} from 'react';

/**
 * Keep iPad/mobile screen awake during demo. Auto re-acquires on visibilitychange.
 * Silently no-ops on browsers without wakeLock API.
 */
export function useWakeLock(active: boolean = true): void {
  useEffect(() => {
    if (!active) return;
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let sentinel: any = null;
    let released = false;
    let handler: (() => void) | null = null;
    (async () => {
      try {
        sentinel = await (navigator as any).wakeLock.request('screen');
        handler = async () => {
          if (document.visibilityState === 'visible' && !released) {
            try { sentinel = await (navigator as any).wakeLock.request('screen'); } catch {}
          }
        };
        document.addEventListener('visibilitychange', handler);
      } catch {}
    })();
    return () => {
      released = true;
      if (handler) document.removeEventListener('visibilitychange', handler);
      sentinel?.release?.().catch(() => {});
    };
  }, [active]);
}
