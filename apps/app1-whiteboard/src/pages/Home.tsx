import {useEffect, useState} from 'react';
import {motion} from 'motion/react';
import {ArrowRight, CheckCircle2, Loader2, PlayCircle, RefreshCw} from 'lucide-react';
import {CapturePanel} from '../components/home/CapturePanel';
import {NoticeBar} from '../components/home/NoticeBar';
import {RegionTaskPanel} from '../components/home/RegionTaskPanel';
import {useBridgeStatus} from '../hooks/useBridgeStatus';
import {useMediaCapture} from '../hooks/useMediaCapture';
import {analyzeBoardCapture, analyzeBoardDemoSample, BoardAnalysisResponse, BoardRegion, OcrLocalResult, saveClassroomSession, transcribeAudio} from '../services/classroomApi';
import {DemoProgress, resetDemoProgress, saveDemoProgress} from '../services/demoProgress';
import {addNoteAsync, DEFAULT_NOTES, STAGE_DEMO_NOTE_ID} from '../services/notesStore';
import {defaultRobotPose} from '../services/robotPose';
import {BoardCalibration, BoardCalibrationMode, CalibrationCornerId, defaultBoardCalibration, detectBoardCalibrationFromImage, normalizeBoardCalibration} from '../services/whiteboardCalibration';

const SS_PREFIX = 'app1:home:';
const _ssMem = new Map<string, unknown>();

function ssGet<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(SS_PREFIX + key);
    if (raw !== null) return JSON.parse(raw) as T;
  } catch {}
  const mem = _ssMem.get(key);
  return mem !== undefined ? (mem as T) : fallback;
}

function ssSet(key: string, value: unknown): void {
  if (value === null || value === undefined || value === '') {
    try { sessionStorage.removeItem(SS_PREFIX + key); } catch {}
    _ssMem.delete(key);
    return;
  }
  try {
    sessionStorage.setItem(SS_PREFIX + key, JSON.stringify(value));
    _ssMem.delete(key);
  } catch {
    _ssMem.set(key, value);
  }
}

function notifyWhiteboardState(hasContent: boolean): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('app1:whiteboard-state', {detail: {hasContent}}));
}

const containerVariants: any = {
  hidden: {opacity: 0},
  show: {opacity: 1, transition: {staggerChildren: 0.06, ease: 'easeOut'}},
  exit: {opacity: 0, y: -10, transition: {duration: 0.2}},
};

const itemVariants: any = {
  hidden: {opacity: 0, y: 18},
  show: {opacity: 1, y: 0, transition: {type: 'spring', bounce: 0.18, duration: 0.45}},
};

let _abortController: AbortController | null = null;
let _actionGeneration = 0;

export default function Home({onNavigate, demoProgress}: {onNavigate: (tab: string) => void; demoProgress: DemoProgress}) {
  const {
    classroom,
    notice,
    statusBusy,
    refreshStatus,
    setClassroom,
    setLatestNote,
    setNotice,
  } = useBridgeStatus();
  const media = useMediaCapture();
  const [subjectHint, setSubjectHint] = useState('國小數學');
  const [transcript, setTranscript] = useState<string>(() => ssGet('transcript', ''));
  const [previewImage, setPreviewImage] = useState<string>(() => ssGet('previewImage', ''));
  const [analysis, setAnalysis] = useState<BoardAnalysisResponse | null>(() => ssGet<BoardAnalysisResponse | null>('analysis', null));
  const [boardCalibration, setBoardCalibration] = useState<BoardCalibration>(defaultBoardCalibration());
  const [calibrationMode, setCalibrationMode] = useState<BoardCalibrationMode>('default');
  const [detectionConfidence, setDetectionConfidence] = useState(0);
  const [calibrationDirty, setCalibrationDirty] = useState(false);
  const [busy, setBusy] = useState('');
  const [ocrResult, setOcrResult] = useState<OcrLocalResult | null>(() => ssGet<OcrLocalResult | null>('ocrResult', null));
  const [ocrBusy] = useState(false);

  const beginAction = (busyKey: string): {signal: AbortSignal; gen: number} => {
    _abortController?.abort();
    const controller = new AbortController();
    _abortController = controller;
    const gen = ++_actionGeneration;
    setBusy(busyKey);
    return {signal: controller.signal, gen};
  };
  const endAction = (gen: number) => {
    if (_actionGeneration === gen) {
      _abortController = null;
      setBusy('');
    }
  };
  const [practiceCardOpen, setPracticeCardOpen] = useState(() => {
    try {
      return localStorage.getItem('app1:practiceCardCollapsed') !== 'true';
    } catch {
      return true;
    }
  });

  useEffect(() => { ssSet('transcript', transcript); }, [transcript]);
  useEffect(() => { ssSet('previewImage', previewImage); }, [previewImage]);
  useEffect(() => { ssSet('analysis', analysis); }, [analysis]);
  useEffect(() => { ssSet('ocrResult', ocrResult); }, [ocrResult]);

  const handleToggleCamera = async () => {
    if (media.cameraReady) {
      media.stopCamera();
      setNotice('攝影機已關閉');
      return;
    }

    try {
      await media.enableCamera();
      setNotice('攝影機已就緒，可以拍下國小課堂白板');
    } catch (error) {
      if (error instanceof Error && error.name === 'NotAllowedError') {
        setNotice('請允許瀏覽器使用攝影機權限，再重試一次');
      } else {
        setNotice(error instanceof Error ? error.message : '無法開啟攝影機權限');
      }
    }
  };

  const handleToggleRecording = async () => {
    if (media.recording) {
      media.stopRecording();
      return;
    }

    try {
      await media.startRecording(async ({audioBase64, mimeType}) => {
        try {
          const result = await transcribeAudio({audioBase64, mimeType});
          setTranscript(result.transcript);
          setNotice('老師講解已整理成文字，可以一起放進課堂紀錄');
        } catch (error) {
          setNotice(error instanceof Error ? error.message : '語音轉文字失敗');
        }
      });
      setNotice('正在錄製老師講解');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '無法開啟麥克風權限');
    }
  };

  const captureAndAnalyze = async () => {
    const {signal, gen} = beginAction('analyze');
    try {
      const imageBase64 = media.captureFrame();
      setPreviewImage(imageBase64);
      setOcrResult(null);
      const result = await analyzeBoardCapture({imageBase64, transcript, subjectHint, boardCalibration}, signal);
      const serverOcrText = result.noteDraft?.ocrText?.trim() ?? '';
      if (serverOcrText) {
        setOcrResult({ok: true, text: serverOcrText, blocks: [], engine: 'server-embedded'});
      }
      setAnalysis(result);
      const mergedSession = {
        ...result.session,
        boardOcrText: serverOcrText || result.session.boardOcrText,
        hardwareProfile: {
          ...result.session.hardwareProfile,
          boardCalibration,
          boardCalibrationMode: calibrationMode,
          boardDetectionConfidence: detectionConfidence,
          cameraMounted: media.cameraReady || result.session.hardwareProfile.cameraMounted,
        },
      };
      setClassroom(mergedSession);
      saveDemoProgress({whiteboard: true});
      setNotice('白板整理完成，下一步請確認哪一區可以擦');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        endAction(gen);
        return;
      }
      setPreviewImage('');
      setNotice(error instanceof Error ? error.message : '白板分析失敗');
    } finally {
      endAction(gen);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setNotice('請選擇圖片檔案（JPEG、PNG 等）');
      return;
    }
    const {signal, gen} = beginAction('analyze');
    try {
      const reader = new FileReader();
      const imageBase64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('圖片讀取失敗'));
        reader.readAsDataURL(file);
      });
      setPreviewImage(imageBase64);
      setOcrResult(null);
      const result = await analyzeBoardCapture({imageBase64, transcript, subjectHint, boardCalibration}, signal);
      const serverOcrText = result.noteDraft?.ocrText?.trim() ?? '';
      if (serverOcrText) {
        setOcrResult({ok: true, text: serverOcrText, blocks: [], engine: 'server-embedded'});
      }
      setAnalysis(result);
      const mergedSession = {
        ...result.session,
        boardOcrText: serverOcrText || result.session.boardOcrText,
        hardwareProfile: {
          ...result.session.hardwareProfile,
          boardCalibration,
          boardCalibrationMode: calibrationMode,
          boardDetectionConfidence: detectionConfidence,
        },
      };
      setClassroom(mergedSession);
      saveDemoProgress({whiteboard: true});
      setNotice('白板整理完成，下一步請確認哪一區可以擦');
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        endAction(gen);
        return;
      }
      setPreviewImage('');
      setNotice(error instanceof Error ? error.message : '圖片上傳分析失敗');
    } finally {
      endAction(gen);
    }
  };

  const saveAnalysisNote = async () => {
    if (!analysis) {
      return;
    }
    setBusy('save');
    try {
      const note = await addNoteAsync({
        ...analysis.noteDraft,
        subject: analysis.noteDraft.subject || subjectHint || '國小課堂紀錄',
        title: analysis.noteDraft.title,
        content: analysis.noteDraft.content,
        ocrText: ocrResult?.ok && ocrResult.text.trim() ? ocrResult.text.trim() : analysis.noteDraft.ocrText,
        boardRegions: analysis.boardRegions,
        aiRecommendation: analysis.currentRecommendation,
        img: analysis.noteDraft.img || analysis.noteDraft.imageUrl || previewImage,
        imageUrl: analysis.noteDraft.imageUrl || previewImage,
      });
      setLatestNote(note);
      saveDemoProgress({whiteboard: true});
      setNotice('已保存到課堂紀錄本，可用於 AI 小老師與學習單生成');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '保存課堂紀錄失敗');
    } finally {
      setBusy('');
    }
  };

  const runDemoSample = async () => {
    const sample = DEFAULT_NOTES[0];
    const imageBase64 = sample.imageUrl || sample.img;
    const sampleTranscript = sample.transcript || '';
    setBusy('demo');
    try {
      setSubjectHint(sample.subject);
      setTranscript(sampleTranscript);
      setPreviewImage(imageBase64);
      setOcrResult({
        ok: true,
        text: sample.ocrText || sample.content,
        blocks: [],
        engine: 'demo-sample',
      });
      const result = await analyzeBoardDemoSample({
        imageBase64,
        transcript: sampleTranscript,
        subjectHint: sample.subject,
        boardCalibration,
      });
      const mergedSession = {
        ...result.session,
        hardwareProfile: {
          ...result.session.hardwareProfile,
          boardCalibration,
          boardCalibrationMode: calibrationMode,
          boardDetectionConfidence: detectionConfidence,
          visionReady: true,
        },
      };
      const boardOcrText = result.noteDraft.ocrText || sample.ocrText || sample.content;
      const savedSession = await saveClassroomSession({
        ...mergedSession,
        boardRegions: result.boardRegions,
        currentRecommendation: result.currentRecommendation,
        boardOcrText,
        lastCaptureAt: new Date().toISOString(),
      });
      setAnalysis({...result, session: savedSession});
      setClassroom(savedSession);
      const note = await addNoteAsync({
        ...result.noteDraft,
        id: STAGE_DEMO_NOTE_ID,
        subject: result.noteDraft.subject || sample.subject,
        title: `${result.noteDraft.title || sample.title}（展示）`,
        content: result.noteDraft.content || sample.content,
        desc: result.noteDraft.desc || sample.desc,
        ocrText: boardOcrText,
        transcript: result.noteDraft.transcript || sampleTranscript,
        captureSource: 'seed',
        keywords: [...new Set([...(result.noteDraft.keywords ?? sample.keywords ?? []), '展示流程', '上台示範'])],
        boardRegions: result.boardRegions,
        aiRecommendation: result.currentRecommendation,
        img: result.noteDraft.img || imageBase64,
        imageUrl: result.noteDraft.imageUrl || imageBase64,
      });
      setLatestNote(note);
      saveDemoProgress({whiteboard: true});
      setNotice('示範白板已建立並保存，下一步請到教師看板確認區塊。');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '示範白板建立失敗');
    } finally {
      setBusy('');
    }
  };

  const applyRegions = async (regions: BoardRegion[], recommendation: string) => {
    const nextSession = await saveClassroomSession({boardRegions: regions, currentRecommendation: recommendation});
    setClassroom(nextSession);
    setAnalysis((current) => current ? {...current, boardRegions: regions, currentRecommendation: recommendation, session: nextSession} : current);
  };

  const runRegionTask = async (status: string, regionId: string) => {
    setBusy(`task-${regionId}`);
    try {
      const nextStatus = status === 'erasable' ? 'erased' : 'keep';
      const nextRegions = boardRegions.map((region) => region.id === regionId
        ? {
          ...region,
          status: nextStatus as BoardRegion['status'],
          reason: nextStatus === 'erased' ? '老師已標記為可清空，準備給下一個活動' : '老師已標記保留，方便孩子繼續看',
        }
        : region);
      await applyRegions(nextRegions, `區塊 ${regionId} 已更新為「${nextStatus === 'erased' ? '可清空' : '保留'}」，目前只保存決策。`);
      saveDemoProgress({teacher: true});
      setNotice(`區塊 ${regionId} 已保存為國小課堂白板決策`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '區塊決策保存失敗');
    } finally {
      setBusy('');
    }
  };

  const keepAllRegions = async () => {
    setBusy('keep-all');
    try {
      const nextRegions = boardRegions.map((region) => ({...region, status: 'keep' as const, reason: '老師已標記全部保留，讓孩子繼續看白板'}));
      await applyRegions(nextRegions, '老師已標記全部白板區塊保留，讓孩子繼續抄寫或討論。');
      saveDemoProgress({teacher: true});
      setNotice('全部區塊已保存為保留狀態');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '保留全部失敗');
    } finally {
      setBusy('');
    }
  };

  const handleCalibrationChange = (cornerId: CalibrationCornerId, point: {x: number; y: number}) => {
    setBoardCalibration((current) => normalizeBoardCalibration({...current, [cornerId]: point}));
    setCalibrationMode('manual');
    setCalibrationDirty(true);
  };

  const handleAutoDetectCalibration = async () => {
    try {
      setBusy('calibration');
      const imageBase64 = previewImage || media.captureFrame();
      if (!previewImage) {
        setPreviewImage(imageBase64);
      }
      const detected = await detectBoardCalibrationFromImage(imageBase64);
      setBoardCalibration(detected.calibration);
      setCalibrationMode('auto');
      setDetectionConfidence(detected.confidence);
      setCalibrationDirty(true);
      setNotice(detected.confidence > 0
        ? '已抓到白板範圍，準備整理內容'
        : '還沒抓到清楚白板範圍，仍可先用左區 / 右區完成展示流程。');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '無法自動偵測白板四角');
    } finally {
      setBusy('');
    }
  };

  const handleCalibrationReset = () => {
    setBoardCalibration(defaultBoardCalibration());
    setCalibrationMode('default');
    setDetectionConfidence(0);
    setCalibrationDirty(true);
    setNotice('白板範圍已回到預設左區 / 右區。');
  };

  const resetWhiteboardDemoState = () => {
    ['app1:home:transcript', 'app1:home:previewImage', 'app1:home:analysis', 'app1:home:ocrResult'].forEach((k) => {
      try { sessionStorage.removeItem(k); } catch { /* ignore */ }
    });
    setTranscript('');
    setPreviewImage('');
    setAnalysis(null);
    setOcrResult(null);
    resetDemoProgress();
    notifyWhiteboardState(false);
    setNotice('展示資料已重置，可重新開始練習');
  };

  const handleCalibrationSave = async () => {
    try {
      const nextSession = await saveClassroomSession({
        hardwareProfile: {
          ...(classroom?.hardwareProfile ?? analysis?.session.hardwareProfile),
          boardCalibration,
          boardCalibrationMode: calibrationMode,
          boardDetectionConfidence: detectionConfidence,
          cameraMounted: media.cameraReady || classroom?.hardwareProfile.cameraMounted || false,
          visionReady: true,
        },
      });
      setClassroom(nextSession);
      setAnalysis((current) => current ? {...current, session: nextSession} : current);
      setCalibrationDirty(false);
      setNotice('白板範圍已保存，後續整理會優先看這一塊。');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '無法保存白板範圍');
    }
  };

  const hasGeneratedBoard = Boolean(analysis || previewImage || classroom?.lastCaptureAt);
  const boardRegions = analysis?.boardRegions ?? (hasGeneratedBoard ? classroom?.boardRegions ?? [] : []);
  const livePracticeSteps = [
    ['1', '按「一鍵示範」建立白板故事', hasGeneratedBoard],
    ['2', '到教師看板確認哪一區可以擦', demoProgress.teacher],
    ['3', '送出機器人任務，看見任務回饋', demoProgress.robot || boardRegions.some((region) => region.status === 'erased')],
    ['4', '到紀錄本、AI 小老師或學習單收尾', demoProgress.library || demoProgress.chat || demoProgress.review],
  ] as const;
  const allDone = livePracticeSteps.every(([, , done]) => done);

  useEffect(() => {
    notifyWhiteboardState(hasGeneratedBoard);
  }, [hasGeneratedBoard]);

  useEffect(() => {
    if (hasGeneratedBoard) {
      saveDemoProgress({whiteboard: true});
    }
  }, [hasGeneratedBoard]);

  useEffect(() => {
    const handleRunDemoSample = () => {
      document.querySelector<HTMLButtonElement>('[data-stage-demo-button="true"]')?.click();
    };
    window.addEventListener('app1:run-demo-sample', handleRunDemoSample);
    return () => window.removeEventListener('app1:run-demo-sample', handleRunDemoSample);
  }, []);

  useEffect(() => {
    const calibration = classroom?.hardwareProfile?.boardCalibration ?? analysis?.session.hardwareProfile.boardCalibration;
    if (calibration) {
      setBoardCalibration(normalizeBoardCalibration(calibration));
    }
    setCalibrationMode(classroom?.hardwareProfile?.boardCalibrationMode ?? analysis?.session.hardwareProfile.boardCalibrationMode ?? 'default');
    setDetectionConfidence(classroom?.hardwareProfile?.boardDetectionConfidence ?? analysis?.session.hardwareProfile.boardDetectionConfidence ?? 0);
  }, [analysis?.session.hardwareProfile.boardCalibration, classroom?.hardwareProfile?.boardCalibration]);

  const robotPose = classroom?.hardwareProfile?.robotPose ?? analysis?.session.hardwareProfile.robotPose ?? defaultRobotPose();

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" exit="exit" className="absolute inset-0 w-full h-full overflow-y-auto hide-scrollbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-8 pb-36">
        <motion.section variants={itemVariants} className="mb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-primary mb-2">國小課堂中控</p>
            <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight">國小 AI 白板助教</h1>
            <p className="text-on-surface-variant mt-3 max-w-2xl leading-relaxed">拍白板、選區塊、派機器人。</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              data-stage-demo-button="true"
              data-demo-primary="whiteboard"
              onClick={runDemoSample}
              disabled={Boolean(busy)}
              className="min-h-11 px-4 rounded-md bg-primary text-on-primary hover:bg-primary-dim transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 font-bold text-sm"
            >
              {busy === 'demo' ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <PlayCircle className="w-4 h-4" aria-hidden="true" />}
              一鍵示範
            </button>
            {boardRegions.length > 0 && (
              <button
                type="button"
                onClick={() => onNavigate('teacher')}
                className="min-h-11 px-4 rounded-md bg-surface-container-high hover:bg-primary hover:text-on-primary transition-all active:scale-95 flex items-center justify-center gap-2 font-bold text-sm"
              >
                到教師看板
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={resetWhiteboardDemoState}
              className="min-h-11 px-4 rounded-md bg-surface-container-high hover:bg-error hover:text-on-error transition-all active:scale-95 flex items-center justify-center gap-2 font-bold text-sm"
            >
              重置展示資料
            </button>
            <button
              type="button"
              onClick={refreshStatus}
              disabled={statusBusy}
              className="min-h-11 px-4 rounded-md bg-surface-container-high hover:bg-primary hover:text-on-primary transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 font-bold"
            >
              {statusBusy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="w-4 h-4" aria-hidden="true" />}
              重新同步
            </button>
          </div>
        </motion.section>

        <motion.div variants={itemVariants}>
          <NoticeBar notice={notice} />
        </motion.div>

        <motion.div variants={itemVariants} className="mb-5">
          <StudentStageCard
            hasBoard={hasGeneratedBoard}
            hasTeacherDecision={demoProgress.teacher}
            hasRobotTask={demoProgress.robot || boardRegions.some((region) => region.status === 'erased')}
            hasWrapUp={demoProgress.library || demoProgress.chat || demoProgress.review}
            busy={busy}
            onDemo={runDemoSample}
            onTeacher={() => onNavigate('teacher')}
            onRobot={() => onNavigate('robot')}
            onWrapUp={() => onNavigate('library')}
          />
        </motion.div>

        <motion.div variants={itemVariants} className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <CapturePanel
            videoRef={media.videoRef}
            canvasRef={media.canvasRef}
            cameraReady={media.cameraReady}
            recording={media.recording}
            busy={busy}
            mediaBusy={media.mediaBusy}
            previewImage={previewImage}
            subjectHint={subjectHint}
            transcript={transcript}
            boardCalibration={boardCalibration}
            calibrationMode={calibrationMode}
            detectionConfidence={detectionConfidence}
            calibrationDirty={calibrationDirty}
            robotPose={robotPose}
            onSubjectHintChange={setSubjectHint}
            onTranscriptChange={setTranscript}
            onToggleCamera={handleToggleCamera}
            onCaptureAndAnalyze={captureAndAnalyze}
            onToggleRecording={handleToggleRecording}
            onUploadImage={handleImageUpload}
            onCalibrationChange={handleCalibrationChange}
            onAutoDetectCalibration={handleAutoDetectCalibration}
            onCalibrationReset={handleCalibrationReset}
            onCalibrationSave={handleCalibrationSave}
          />
          <RegionTaskPanel
            analysis={analysis}
            classroom={hasGeneratedBoard ? classroom : null}
            boardRegions={boardRegions}
            busy={busy}
            onSaveAnalysis={saveAnalysisNote}
            onRunRegionTask={runRegionTask}
            onKeepAll={keepAllRegions}
          />
        </motion.div>

        {/* OCR result panel */}
        {(ocrBusy || (ocrResult && ocrResult.ok)) && (
          <motion.section
            variants={itemVariants}
            className="mt-5 rounded-3xl border border-primary/10 bg-surface-container-low p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-on-primary text-sm font-black">文</div>
              <div>
                <p className="text-sm font-extrabold">白板文字整理</p>
                <p className="text-xs font-semibold text-on-surface-variant">
                  {ocrBusy ? '正在讀白板文字…' : `已讀到 ${ocrResult?.blocks.length ?? 0} 個重點`}
                </p>
              </div>
            </div>
            {ocrBusy ? (
              <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                <Loader2 className="w-3 h-3 animate-spin" />辨識中，請稍候…
              </div>
            ) : (
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-on-surface-variant bg-surface rounded-xl p-4 max-h-48 overflow-y-auto">
                {ocrResult?.text || '（未辨識到文字）'}
              </pre>
            )}
          </motion.section>
        )}

        {/* 學生練習卡 */}
        <motion.div variants={itemVariants} className="mt-5 rounded-lg border border-primary/20 bg-primary-container/20 overflow-hidden">
          <button
            onClick={() => {
              const next = !practiceCardOpen;
              setPracticeCardOpen(next);
              try { localStorage.setItem('app1:practiceCardCollapsed', next ? 'false' : 'true'); } catch { /* ignore */ }
            }}
            className="w-full flex items-center justify-between px-4 py-3 text-left"
          >
            <span className="text-sm font-extrabold text-primary">學生練習卡</span>
            <span className="text-xs text-on-surface-variant">{practiceCardOpen ? '收合' : '展開'}</span>
          </button>
          {practiceCardOpen && (
            <div className="px-4 pb-4 space-y-2">
              {livePracticeSteps.map(([index, step, done]) => (
                <div
                  key={index}
                  className={`w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-left ${done ? 'bg-primary/10 text-primary' : 'bg-surface text-on-surface'}`}
                >
                  <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-bold ${done ? 'border-primary bg-primary text-on-primary' : 'border-outline-variant'}`}>
                    {done ? '✓' : index}
                  </span>
                  <span className="text-sm font-medium leading-snug">{step}</span>
                </div>
              ))}
              {allDone && (
                <div className="mt-3 rounded-md bg-primary px-4 py-3 text-center text-sm font-extrabold text-on-primary">
                  完成完整流程，準備上台。
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}

function StudentStageCard({
  hasBoard,
  hasTeacherDecision,
  hasRobotTask,
  hasWrapUp,
  busy,
  onDemo,
  onTeacher,
  onRobot,
  onWrapUp,
}: {
  hasBoard: boolean;
  hasTeacherDecision: boolean;
  hasRobotTask: boolean;
  hasWrapUp: boolean;
  busy: string;
  onDemo: () => void;
  onTeacher: () => void;
  onRobot: () => void;
  onWrapUp: () => void;
}) {
  const doneCount = [hasBoard, hasTeacherDecision, hasRobotTask, hasWrapUp].filter(Boolean).length;
  const nextAction = !hasBoard
    ? {label: '先按一鍵示範', onClick: onDemo}
    : !hasTeacherDecision
      ? {label: '去教師看板', onClick: onTeacher}
      : !hasRobotTask
        ? {label: '看機器人任務', onClick: onRobot}
        : !hasWrapUp
          ? {label: '到紀錄本收尾', onClick: onWrapUp}
          : {label: '再看收尾紀錄', onClick: onWrapUp};

  return (
    <section className="rounded-lg border border-primary/15 bg-surface-container-lowest p-4 sm:p-5 shadow-sm" data-demo-stage-card="true">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-black text-primary">學生上台只記四步 · 完成 {doneCount}/4</p>
          <h2 className="mt-1 text-xl font-extrabold">一鍵示範、老師確認、機器人執行、收尾展示</h2>
          <p className="mt-1 text-sm font-bold text-on-surface-variant">
            每完成一步就會變成勾勾；全部完成後，就是可以上台交付的完整閉環。
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4 lg:min-w-[42rem]">
          {[
            ['1', '建立白板', hasBoard],
            ['2', '確認可擦區', hasTeacherDecision],
            ['3', '送機器人', hasRobotTask],
            ['4', '展示收尾', hasWrapUp],
          ].map(([index, label, done]) => (
            <div key={String(label)} className={`rounded-md border px-3 py-2.5 ${done ? 'border-primary/20 bg-primary-container/45 text-primary' : 'border-outline-variant/20 bg-surface text-on-surface-variant'}`}>
              <div className="flex items-center gap-2">
                {done ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-xs font-black">{index}</span>}
                <span className="text-sm font-extrabold">{label}</span>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          data-demo-primary="whiteboard"
          onClick={nextAction.onClick}
          disabled={busy === 'demo'}
          className="min-h-11 shrink-0 rounded-md bg-primary px-4 text-sm font-black text-on-primary transition-all hover:bg-primary-dim active:scale-95 disabled:opacity-50"
        >
          {busy === 'demo' ? '示範建立中…' : doneCount === 4 ? '看完成紀錄' : nextAction.label}
        </button>
      </div>
    </section>
  );
}
