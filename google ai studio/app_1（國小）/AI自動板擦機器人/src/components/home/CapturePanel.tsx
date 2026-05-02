import type {RefObject} from 'react';
import {Camera, CircleStop, Loader2, Mic, Sparkles} from 'lucide-react';

type CapturePanelProps = {
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  cameraReady: boolean;
  recording: boolean;
  busy: string;
  mediaBusy: string;
  previewImage: string;
  subjectHint: string;
  transcript: string;
  onSubjectHintChange: (value: string) => void;
  onTranscriptChange: (value: string) => void;
  onToggleCamera: () => void;
  onCaptureAndAnalyze: () => void;
  onToggleRecording: () => void;
};

export function CapturePanel({
  videoRef,
  canvasRef,
  cameraReady,
  recording,
  busy,
  mediaBusy,
  previewImage,
  subjectHint,
  transcript,
  onSubjectHintChange,
  onTranscriptChange,
  onToggleCamera,
  onCaptureAndAnalyze,
  onToggleRecording,
}: CapturePanelProps) {
  const cameraBusy = mediaBusy === 'camera';
  const transcriptionBusy = mediaBusy === 'transcribe';
  const analyzing = busy === 'analyze';

  return (
    <section className="xl:col-span-7 bg-surface-container-lowest rounded-lg p-4 sm:p-5 border border-outline-variant/20 shadow-premium">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-extrabold">拍下課堂白板</h2>
          <p className="text-sm text-on-surface-variant mt-1">拍下國小課堂板書，整理成孩子看得懂的紀錄。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleCamera}
            disabled={cameraBusy}
            className="min-h-11 px-4 rounded-md bg-surface-container-high hover:bg-primary hover:text-on-primary disabled:opacity-50 transition-all flex items-center gap-2 font-bold"
          >
            {cameraBusy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Camera className="w-4 h-4" aria-hidden="true" />}
            {cameraReady ? '關閉' : '開啟'}
          </button>
          <button
            type="button"
            onClick={onCaptureAndAnalyze}
            disabled={!cameraReady || analyzing}
            className="min-h-11 px-4 rounded-md bg-primary text-on-primary disabled:opacity-50 transition-all active:scale-95 flex items-center gap-2 font-bold"
          >
            {analyzing ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Sparkles className="w-4 h-4" aria-hidden="true" />}
            整理
          </button>
        </div>
      </div>

      <div className="relative aspect-video rounded-lg bg-on-surface overflow-hidden border border-outline-variant/30">
        <video ref={videoRef} muted playsInline className={`absolute inset-0 w-full h-full object-cover ${cameraReady ? 'opacity-100' : 'opacity-0'}`} />
        {!cameraReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center text-on-primary p-8">
            <Camera className="w-12 h-12 mb-4 opacity-80" aria-hidden="true" />
            <p className="text-lg font-extrabold">攝影機尚未開啟</p>
            <p className="text-sm opacity-70 mt-2">開啟後可拍下白板，做成國小課堂紀錄。</p>
          </div>
        )}
        {previewImage && (
          <div className="absolute right-3 bottom-3 w-32 sm:w-44 aspect-video rounded-md overflow-hidden border-2 border-white shadow-lg">
            <img src={previewImage} alt="最近拍下的課堂白板" className="w-full h-full object-cover" />
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-[12rem_1fr] gap-3">
        <label className="block">
          <span className="text-xs font-bold text-on-surface-variant">年級 / 科目</span>
          <input
            value={subjectHint}
            onChange={(event) => onSubjectHintChange(event.target.value)}
            className="mt-2 w-full min-h-11 rounded-md bg-surface-container px-3 outline-none border border-outline-variant/30 font-bold"
          />
        </label>
        <div className="rounded-md bg-surface-container p-3 border border-outline-variant/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-bold text-on-surface-variant">老師講解逐字稿</span>
            <button
              type="button"
              onClick={onToggleRecording}
              disabled={mediaBusy === 'recording' || transcriptionBusy}
              className={`min-h-10 px-3 rounded-md flex items-center gap-2 text-sm font-bold transition-all ${recording ? 'bg-tertiary text-on-tertiary' : 'bg-surface hover:bg-primary hover:text-on-primary'} disabled:opacity-50`}
            >
              {transcriptionBusy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : recording ? <CircleStop className="w-4 h-4" aria-hidden="true" /> : <Mic className="w-4 h-4" aria-hidden="true" />}
              {recording ? '停止錄音' : transcriptionBusy ? '轉寫中' : '錄音'}
            </button>
          </div>
          <textarea
            value={transcript}
            onChange={(event) => onTranscriptChange(event.target.value)}
            rows={3}
            placeholder="錄音後會自動填入，也可手動補上孩子容易卡住的地方。"
            className="mt-2 w-full bg-transparent resize-none outline-none text-sm leading-relaxed"
          />
        </div>
      </div>
    </section>
  );
}
