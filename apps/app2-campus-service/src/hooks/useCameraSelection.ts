import {useCallback, useEffect, useMemo, useRef, useState} from 'react';

const STORAGE_KEY = 'campus-service-camera-device-id:v1';

export interface CameraOption {
  deviceId: string;
  label: string;
}

export interface UseCameraSelectionResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  ready: boolean;
  error: string | null;
  devices: CameraOption[];
  selectedDeviceId: string | null;
  selectDevice: (deviceId: string) => void;
  refresh: () => Promise<void>;
}

function readSavedDeviceId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

function saveDeviceId(id: string | null) {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

function describeError(e: unknown): string {
  if (!(e instanceof Error)) return '相機啟動失敗';
  if (e instanceof DOMException) {
    switch (e.name) {
      case 'NotAllowedError':
      case 'SecurityError':
        return '相機權限被拒絕。請在網址列旁的攝影機圖示開啟權限，或到瀏覽器設定允許此網站使用相機。';
      case 'NotFoundError':
        return '找不到可用的相機。請確認設備已連接且未被其他應用佔用。';
      case 'NotReadableError':
        return '相機被其他應用佔用中（例如 Zoom、Photo Booth、Teams）。請先關閉再重試。';
      case 'OverconstrainedError':
        return '此相機不支援所要求的解析度。已自動嘗試備用設定。';
      default:
        return `相機錯誤：${e.name} ${e.message}`;
    }
  }
  return e.message || '相機啟動失敗';
}

/**
 * Camera selection + lifecycle hook.
 * - Enumerates devices, persists user's choice in localStorage.
 * - Returns clear error messages.
 * - Tries selected deviceId first; falls back to environment / user / any.
 */
export function useCameraSelection(active: boolean): UseCameraSelectionResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [devices, setDevices] = useState<CameraOption[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(() => readSavedDeviceId());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enumerate = useCallback(async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const cams = list
        .filter(d => d.kind === 'videoinput')
        .map((d, i) => ({
          deviceId: d.deviceId,
          label: d.label || `相機 ${i + 1}`,
        }));
      setDevices(cams);
      return cams;
    } catch {
      return [];
    }
  }, []);

  const selectDevice = useCallback((deviceId: string) => {
    saveDeviceId(deviceId);
    setSelectedDeviceId(deviceId);
  }, []);

  useEffect(() => {
    if (!active) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.onloadedmetadata = null;
      }
      setReady(false);
      setError(null);
      return;
    }

    let cancelled = false;

    async function start() {
      setError(null);
      setReady(false);

      // First, request any camera to unlock device labels on enumerateDevices()
      // (browsers hide labels until permission granted).
      const constraintTries: MediaStreamConstraints[] = [];
      if (selectedDeviceId) {
        constraintTries.push({video: {deviceId: {exact: selectedDeviceId}}, audio: false});
      }
      constraintTries.push(
        {video: {facingMode: {ideal: 'environment'}, width: {ideal: 1280}}, audio: false},
        {video: {facingMode: 'user', width: {ideal: 1280}}, audio: false},
        {video: true, audio: false},
      );

      let stream: MediaStream | null = null;
      let lastErr: unknown = null;
      for (const c of constraintTries) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(c);
          break;
        } catch (e) {
          lastErr = e;
          // For NotAllowed / NotReadable, stop trying further constraints
          if (e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'NotReadableError' || e.name === 'SecurityError')) {
            break;
          }
        }
      }

      if (cancelled) {
        stream?.getTracks().forEach(t => t.stop());
        return;
      }

      if (!stream) {
        setError(describeError(lastErr));
        // Still try to enumerate so user can see what's available
        await enumerate();
        return;
      }

      streamRef.current = stream;
      // Now we have permission; enumerate to populate labels
      const cams = await enumerate();
      // If selected one wasn't actually used (fallback), update selection to current track's deviceId
      const trackSettings = stream.getVideoTracks()[0]?.getSettings();
      const actualId = trackSettings?.deviceId;
      if (actualId && actualId !== selectedDeviceId) {
        // Persist whatever the browser actually granted (helps next time)
        if (!selectedDeviceId && cams.some(c => c.deviceId === actualId)) {
          saveDeviceId(actualId);
          setSelectedDeviceId(actualId);
        }
      }

      // Portal rendering may commit the video element after getUserMedia resolves;
      // poll briefly until the ref is available.
      let video = videoRef.current;
      if (!video) {
        for (let i = 0; i < 20 && !cancelled; i++) {
          await new Promise(r => setTimeout(r, 50));
          video = videoRef.current;
          if (video) break;
        }
      }
      if (video && !cancelled) {
        video.srcObject = stream;
        video.onloadedmetadata = () => {
          if (!cancelled && video!.srcObject === stream) setReady(true);
        };
        try {
          await video.play();
        } catch {
          // autoplay may fail; loadedmetadata still sets ready
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.onloadedmetadata = null;
      }
      setReady(false);
    };
  }, [active, selectedDeviceId, enumerate]);

  // Listen to device changes (camera plugged/unplugged)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return;
    const onChange = () => { void enumerate(); };
    navigator.mediaDevices.addEventListener?.('devicechange', onChange);
    return () => navigator.mediaDevices.removeEventListener?.('devicechange', onChange);
  }, [enumerate]);

  return useMemo(() => ({
    videoRef,
    canvasRef,
    ready,
    error,
    devices,
    selectedDeviceId,
    selectDevice,
    refresh: async () => { await enumerate(); },
  }), [ready, error, devices, selectedDeviceId, selectDevice, enumerate]);
}
