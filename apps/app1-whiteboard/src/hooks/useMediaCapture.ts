import {useEffect, useRef, useState} from 'react';

type AudioReadyPayload = {
  audioBase64: string;
  mimeType: string;
};

export type AudioVolumeSample = {t: number; v: number};

const AUDIO_HISTORY_WINDOW_MS = 30_000;
const AUDIO_HISTORY_MAX_SAMPLES = 240;  // ~8 Hz over 30 s; cheap to render.

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function useMediaCapture() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioRafRef = useRef<number | null>(null);
  const audioBufferRef = useRef<Uint8Array | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mediaBusy, setMediaBusy] = useState('');
  // 即時音量 0..1 與最近 30 秒的取樣歷史，提供「聲音熱度曲線」UI。
  const [audioVolume, setAudioVolume] = useState(0);
  const [audioVolumeHistory, setAudioVolumeHistory] = useState<AudioVolumeSample[]>([]);

  const stopAudioMeter = () => {
    if (audioRafRef.current !== null) {
      cancelAnimationFrame(audioRafRef.current);
      audioRafRef.current = null;
    }
    audioAnalyserRef.current?.disconnect();
    audioAnalyserRef.current = null;
    audioBufferRef.current = null;
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
    }
    audioCtxRef.current = null;
    setAudioVolume(0);
  };

  const startAudioMeter = (stream: MediaStream) => {
    type WebkitWindow = typeof globalThis & {webkitAudioContext?: typeof AudioContext};
    const AudioCtor: typeof AudioContext | undefined =
      typeof window === 'undefined'
        ? undefined
        : window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
    if (!AudioCtor) return;  // 瀏覽器不支援時靜默忽略，不影響錄音與轉文字流程。
    try {
      const ctx = new AudioCtor();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      audioCtxRef.current = ctx;
      audioAnalyserRef.current = analyser;
      audioBufferRef.current = new Uint8Array(analyser.fftSize);
      setAudioVolumeHistory([]);  // 重新錄音時清空歷史，避免上一輪殘留。

      let lastSampleAt = 0;
      const tick = () => {
        const analyserNode = audioAnalyserRef.current;
        const buffer = audioBufferRef.current;
        if (!analyserNode || !buffer) return;
        analyserNode.getByteTimeDomainData(buffer);
        let sumSquares = 0;
        for (let i = 0; i < buffer.length; i += 1) {
          const centred = (buffer[i] - 128) / 128;  // -1..1
          sumSquares += centred * centred;
        }
        const rms = Math.sqrt(sumSquares / buffer.length);  // 0..1
        setAudioVolume(rms);
        const now = performance.now();
        if (now - lastSampleAt >= 125) {  // ~8 Hz 取樣寫入歷史
          lastSampleAt = now;
          setAudioVolumeHistory((prev) => {
            const cutoff = now - AUDIO_HISTORY_WINDOW_MS;
            const trimmed = prev.filter((s) => s.t >= cutoff);
            trimmed.push({t: now, v: rms});
            return trimmed.length > AUDIO_HISTORY_MAX_SAMPLES
              ? trimmed.slice(trimmed.length - AUDIO_HISTORY_MAX_SAMPLES)
              : trimmed;
          });
        }
        audioRafRef.current = requestAnimationFrame(tick);
      };
      audioRafRef.current = requestAnimationFrame(tick);
    } catch {
      // AudioContext 在無使用者手勢/權限下可能拋例外，安全降級。
      stopAudioMeter();
    }
  };

  const stopCamera = () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  };

  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string>('');

  const refreshCameras = async (): Promise<MediaDeviceInfo[]> => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');
      setCameras(videoInputs);
      return videoInputs;
    } catch {
      return [];
    }
  };

  const enableCamera = async (deviceId?: string) => {
    setMediaBusy('camera');
    try {
      // Tear down existing stream before requesting a new one
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;

      const videoConstraint: MediaTrackConstraints = deviceId
        ? {deviceId: {exact: deviceId}, width: {ideal: 1280}, height: {ideal: 720}}
        : {facingMode: 'environment', width: {ideal: 1280}, height: {ideal: 720}};
      const stream = await navigator.mediaDevices.getUserMedia({video: videoConstraint, audio: false});
      cameraStreamRef.current = stream;
      const activeTrack = stream.getVideoTracks()[0];
      const settings = activeTrack?.getSettings?.();
      if (settings?.deviceId) setActiveCameraId(settings.deviceId);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playError) {
          stream.getTracks().forEach((t) => t.stop());
          cameraStreamRef.current = null;
          throw playError;
        }
        setCameraReady(true);
        // Populate the device list once we have permission (labels need permission)
        await refreshCameras();
      } else {
        stream.getTracks().forEach((t) => t.stop());
        cameraStreamRef.current = null;
        throw new Error('攝影機元件尚未就緒');
      }
    } finally {
      setMediaBusy('');
    }
  };

  const switchCamera = async (deviceId: string) => {
    if (!deviceId || deviceId === activeCameraId) return;
    await enableCamera(deviceId);
  };

  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current || !cameraReady) {
      throw new Error('請先開啟攝影機');
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('無法建立影像擷取畫布');
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.86);
  };

  const startRecording = async (onAudioReady: (payload: AudioReadyPayload) => Promise<void>) => {
    setMediaBusy('recording');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio: true});
      audioStreamRef.current = stream;
      audioChunksRef.current = [];
      startAudioMeter(stream);  // 開始即時 RMS 取樣 → 暴露 audioVolume 與 history
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      recorder.onstop = async () => {
        setMediaBusy('transcribe');
        try {
          const blob = new Blob(audioChunksRef.current, {type: recorder.mimeType || 'audio/webm'});
          const audioBase64 = await blobToDataUrl(blob);
          await onAudioReady({audioBase64, mimeType: blob.type || 'audio/webm'});
        } catch {
          // onAudioReady failure is surfaced by the caller's own error handling
        } finally {
          stopAudioMeter();
          audioStreamRef.current?.getTracks().forEach((track) => track.stop());
          audioStreamRef.current = null;
          recorderRef.current = null;
          setMediaBusy('');
        }
      };
      recorder.start();
      setRecording(true);
    } finally {
      setMediaBusy((current) => current === 'recording' ? '' : current);
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  useEffect(() => {
    return () => {
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      audioStreamRef.current?.getTracks().forEach((track) => track.stop());
      stopAudioMeter();
    };
  }, []);

  return {
    videoRef,
    canvasRef,
    cameraReady,
    recording,
    mediaBusy,
    enableCamera,
    stopCamera,
    captureFrame,
    startRecording,
    stopRecording,
    cameras,
    activeCameraId,
    refreshCameras,
    switchCamera,
    audioVolume,
    audioVolumeHistory,
  };
}
