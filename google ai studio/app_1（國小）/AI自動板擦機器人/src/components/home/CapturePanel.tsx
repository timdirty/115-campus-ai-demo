import {memo} from 'react';
import type {ChangeEvent, RefObject} from 'react';
import {Bot, Camera, CircleStop, Loader2, LocateFixed, Mic, RefreshCw, Sparkles, Upload} from 'lucide-react';
import {RobotPoseEstimate} from '../../services/robotPose';
import {BoardCalibration, BoardCalibrationMode, CalibrationCornerId} from '../../services/whiteboardCalibration';

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
  boardCalibration: BoardCalibration;
  calibrationMode: BoardCalibrationMode;
  detectionConfidence: number;
  calibrationDirty: boolean;
  robotPose: RobotPoseEstimate;
  onSubjectHintChange: (value: string) => void;
  onTranscriptChange: (value: string) => void;
  onToggleCamera: () => void;
  onCaptureAndAnalyze: () => void;
  onToggleRecording: () => void;
  onUploadImage: (file: File) => void;
  onCalibrationChange: (cornerId: CalibrationCornerId, point: {x: number; y: number}) => void;
  onAutoDetectCalibration: () => void;
  onCalibrationReset: () => void;
  onCalibrationSave: () => void;
};

export const CapturePanel = memo(function CapturePanel({
  videoRef,
  canvasRef,
  cameraReady,
  recording,
  busy,
  mediaBusy,
  previewImage,
  subjectHint,
  transcript,
  boardCalibration,
  calibrationMode,
  detectionConfidence,
  calibrationDirty,
  robotPose,
  onSubjectHintChange,
  onTranscriptChange,
  onToggleCamera,
  onCaptureAndAnalyze,
  onToggleRecording,
  onUploadImage,
  onCalibrationChange,
  onAutoDetectCalibration,
  onCalibrationReset,
  onCalibrationSave,
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
        {(cameraReady || previewImage) && (
          <div className="pointer-events-none absolute inset-0 z-10">
            <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <polygon
                points={`${boardCalibration.topLeft.x},${boardCalibration.topLeft.y} ${boardCalibration.topRight.x},${boardCalibration.topRight.y} ${boardCalibration.bottomRight.x},${boardCalibration.bottomRight.y} ${boardCalibration.bottomLeft.x},${boardCalibration.bottomLeft.y}`}
                fill="rgba(37,99,235,0.12)"
                stroke="rgba(37,99,235,0.85)"
                strokeWidth="0.8"
                strokeDasharray="2 2"
              />
            </svg>
            {([
              ['topLeft', '左上'],
              ['topRight', '右上'],
              ['bottomRight', '右下'],
              ['bottomLeft', '左下'],
            ] as const).map(([cornerId, label]) => (
              <label
                key={cornerId}
                className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2"
                style={{left: `${boardCalibration[cornerId].x}%`, top: `${boardCalibration[cornerId].y}%`}}
              >
                <span className="mb-1 inline-flex rounded-full bg-primary px-2 py-0.5 text-[10px] font-black text-on-primary shadow-md">
                  {label}
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.5}
                  value={boardCalibration[cornerId].x}
                  onChange={(event) => onCalibrationChange(cornerId, {x: Number(event.target.value), y: boardCalibration[cornerId].y})}
                  className="absolute left-0 top-7 hidden w-24 -translate-x-1/2 rotate-0 accent-primary md:block"
                  aria-label={`${label} x`}
                />
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.5}
                  value={boardCalibration[cornerId].y}
                  onChange={(event) => onCalibrationChange(cornerId, {x: boardCalibration[cornerId].x, y: Number(event.target.value)})}
                  className="absolute left-7 top-0 hidden h-24 -translate-y-1/2 rotate-90 accent-primary md:block"
                  aria-label={`${label} y`}
                />
                <button
                  type="button"
                  className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-primary shadow-lg"
                  onClick={(event) => event.preventDefault()}
                  aria-label={`${label} 校正點`}
                />
              </label>
            ))}
            <div
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
              style={{left: `${robotPose.x}%`, top: `${robotPose.y}%`}}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/30 bg-surface-container-lowest text-primary shadow-lg">
                <Bot className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="mt-1 rounded-full bg-primary px-2 py-0.5 text-center text-[10px] font-black text-on-primary shadow">
                {robotPose.targetRegion ? `R-${robotPose.targetRegion}` : '待命'}
              </div>
            </div>
          </div>
        )}
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

      <div className="mt-4 rounded-2xl border border-outline-variant/20 bg-surface-container p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-extrabold">Webcam 白板四角校正</p>
            <p className="mt-1 text-xs font-semibold leading-5 text-on-surface-variant">用現在的 webcam 畫面直接調整白板四角，之後辨識會優先限制在這個範圍內。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onAutoDetectCalibration}
              disabled={!cameraReady && !previewImage}
              className="min-h-10 rounded-xl bg-surface px-3 text-xs font-bold transition-colors hover:bg-primary hover:text-on-primary disabled:opacity-50"
            >
              <span className="inline-flex items-center gap-2">
                <LocateFixed className="h-4 w-4" />
                自動抓白板
              </span>
            </button>
            <button
              type="button"
              onClick={onCalibrationReset}
              className="min-h-10 rounded-xl bg-surface px-3 text-xs font-bold transition-colors hover:bg-primary hover:text-on-primary"
            >
              <span className="inline-flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                重設四角
              </span>
            </button>
            <button
              type="button"
              onClick={onCalibrationSave}
              className="min-h-10 rounded-xl bg-primary px-3 text-xs font-bold text-on-primary transition-colors hover:opacity-90"
            >
              {calibrationDirty ? '保存目前校正' : '校正已保存'}
            </button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] font-bold text-on-surface-variant md:grid-cols-4">
          <div className="rounded-xl bg-surface px-3 py-2">左上：{boardCalibration.topLeft.x}%, {boardCalibration.topLeft.y}%</div>
          <div className="rounded-xl bg-surface px-3 py-2">右上：{boardCalibration.topRight.x}%, {boardCalibration.topRight.y}%</div>
          <div className="rounded-xl bg-surface px-3 py-2">右下：{boardCalibration.bottomRight.x}%, {boardCalibration.bottomRight.y}%</div>
          <div className="rounded-xl bg-surface px-3 py-2">左下：{boardCalibration.bottomLeft.x}%, {boardCalibration.bottomLeft.y}%</div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 text-[11px] font-bold text-on-surface-variant md:grid-cols-3">
          <div className="rounded-xl bg-surface px-3 py-2">校正模式：{calibrationMode === 'auto' ? '自動偵測' : calibrationMode === 'manual' ? '手動微調' : '預設值'}</div>
          <div className="rounded-xl bg-surface px-3 py-2">偵測信心：{detectionConfidence}%</div>
          <div className="rounded-xl bg-surface px-3 py-2">機器人位置：{robotPose.label}</div>
        </div>
      </div>
    </section>
  );
});
