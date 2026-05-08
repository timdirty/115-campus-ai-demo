import {useEffect, useRef, useState} from 'react';

export interface HardwareSocketStatus {
  connected: boolean;
  port: string;
  simulated: boolean;
  mode: 'ws' | 'polling';
}

export function useHardwareSocket(bridgeBaseUrl: string): HardwareSocketStatus {
  const wsUrl = bridgeBaseUrl.replace(/^http/, 'ws');
  const [status, setStatus] = useState<HardwareSocketStatus>({
    connected: false,
    port: '',
    simulated: false,
    mode: 'polling',
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelayRef = useRef(1000);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  function stopPolling() {
    if (pollingTimerRef.current !== null) {
      clearInterval(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  }

  function startPolling() {
    if (pollingTimerRef.current !== null) return;
    pollingTimerRef.current = setInterval(() => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2500);
      fetch(`${bridgeBaseUrl}/api/health`, {signal: ctrl.signal})
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((data: {arduinoConnected?: boolean; activePath?: string}) => {
          clearTimeout(t);
          if (!mountedRef.current) return;
          setStatus((s) => ({...s, connected: Boolean(data.arduinoConnected), port: data.activePath ?? '', mode: 'polling'}));
        })
        .catch(() => {
          clearTimeout(t);
          if (!mountedRef.current) return;
          setStatus((s) => ({...s, connected: false, mode: 'polling'}));
        });
    }, 3000);
  }

  function connect() {
    if (wsRef.current) {
      const old = wsRef.current;
      old.onopen = null;
      old.onmessage = null;
      old.onclose = null;
      old.onerror = null;
      try { old.close(); } catch { /* ignore */ }
      wsRef.current = null;
    }

    const connectDeadline = setTimeout(() => {
      if (wsRef.current && wsRef.current.readyState !== WebSocket.OPEN) {
        startPolling();
      }
    }, 5000);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      clearTimeout(connectDeadline);
      reconnectDelayRef.current = 1000;
      stopPolling();
      if (mountedRef.current) setStatus((s) => ({...s, mode: 'ws'}));
    };

    ws.onmessage = (evt) => {
      if (!mountedRef.current) return;
      try {
        const event = JSON.parse(String(evt.data)) as {type?: string; connected?: boolean; port?: string; simulated?: boolean};
        if (event.type === 'arduino_status') {
          setStatus((s) => ({
            ...s,
            connected: Boolean(event.connected),
            port: event.port ?? '',
            simulated: Boolean(event.simulated),
            mode: 'ws',
          }));
        }
      } catch { /* ignore malformed */ }
    };

    ws.onclose = () => {
      clearTimeout(connectDeadline);
      wsRef.current = null;
      if (!mountedRef.current) return;
      setStatus((s) => ({...s, mode: 'polling'}));
      startPolling();
      const delay = reconnectDelayRef.current;
      reconnectDelayRef.current = Math.min(delay * 2, 30000);
      reconnectTimerRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        stopPolling();
        connect();
      }, delay);
    };

    ws.onerror = () => { /* onclose fires after onerror */ };
  }

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current !== null) clearTimeout(reconnectTimerRef.current);
      stopPolling();
      if (wsRef.current) {
        const ws = wsRef.current;
        ws.onopen = null;
        ws.onmessage = null;
        ws.onclose = null;
        ws.onerror = null;
        try { ws.close(); } catch { /* ignore */ }
        wsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridgeBaseUrl]);

  return status;
}
