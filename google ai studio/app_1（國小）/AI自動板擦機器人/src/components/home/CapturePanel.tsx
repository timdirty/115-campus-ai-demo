import type {ChangeEvent, RefObject} from 'react';
import {Camera, CircleStop, Loader2, Mic, Sparkles, Upload} from 'lucide-react';

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
  onUploadImage: (file: File) => void;
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
  onUploadImage,
}: CapturePanelProps) {
  const cameraBusy = mediaBusy === 'camera';
  const transcriptionBusy = mediaBusy === 'transcribe';
  const analyzing = busy === 'analyze';

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && !analyzing) {
      onUploadImage(file);
      // Reset so the same file can be re-selected if needed
      event.target.value = '';
    }
  };

  return (
    <section className="xl:col-span-7 bg-surface-container-lowest rounded-lg p-4 sm:p-5 border border-outline-variant/20 shadow-premium" data-tour="capture-panel">
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

      <div className="relative aspect-video rounded-2xl overflow-hidden border border-outline-variant/20 shadow-inner" style={{background: 'linear-gradient(135deg,#f8f9fc 0%,#f0f2f8 100%)'}}>
        {/* Subtle grid pattern to evoke a whiteboard */}
        <svg className="absolute inset-0 h-full w-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1a1a2e" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
        <video ref={videoRef} muted playsInline className={`absolute inset-0 w-full h-full object-cover ${cameraReady ? 'opacity-100' : 'opacity-0'}`} />
        {!cameraReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 gap-5">
            <div>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/15">
                <Camera className="w-8 h-8 text-primary" aria-hidden="true" />
              </div>
              <p className="text-lg font-extrabold text-on-surface">拍下課堂白板</p>
              <p className="text-sm text-on-surface-variant mt-1.5 max-w-xs mx-auto">點「開啟」授權攝影機，對準黑板即可分析。</p>
            </div>
            <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low px-5 py-3.5 flex flex-col items-center gap-2.5">
              <p className="text-xs font-bold text-on-surface-variant">沒有攝影機？直接上傳圖片</p>
              <label className="cursor-pointer">
                <span className="inline-flex items-center gap-2 rounded-xl bg-primary hover:bg-primary/90 active:scale-95 transition-all px-4 py-2 text-sm font-extrabold text-on-primary shadow-md shadow-primary/20">
                  <Upload className="w-4 h-4" aria-hidden="true" />
                  上傳黑板照片分析
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleFileChange}
                  disabled={analyzing}
                />
              </label>
            </div>
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
          <div className="mt-2 flex flex-wrap gap-1 mb-1.5">
            {(['數學', '語文', '自然', '社會', '英語', '體育', '藝術'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSubjectHintChange(`國小${s}`)}
                className={`px-3 py-2 min-h-11 text-xs rounded-full border transition-colors ${
                  subjectHint === `國小${s}`
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-white text-on-surface-variant border-outline-variant/50 hover:border-primary'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <input
            value={subjectHint}
            onChange={(event) => onSubjectHintChange(event.target.value)}
            className="mt-1 w-full min-h-11 rounded-md bg-surface-container px-3 outline-none border border-outline-variant/30 font-bold"
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
