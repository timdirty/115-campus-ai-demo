import {useEffect, useRef, useState} from 'react';

type AudioReadyPayload = {
  audioBase64: string;
  mimeType: string;
};

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
  const [cameraReady, setCameraReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mediaBusy, setMediaBusy] = useState('');

  const stopCamera = () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  };

  const enableCamera = async () => {
    setMediaBusy('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {facingMode: 'environment', width: {ideal: 1280}, height: {ideal: 720}},
        audio: false,
      });
      cameraStreamRef.current = stream;
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
      } else {
        stream.getTracks().forEach((t) => t.stop());
        cameraStreamRef.current = null;
        throw new Error('攝影機元件尚未就緒');
      }
    } finally {
      setMediaBusy('');
    }
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
  };
}
