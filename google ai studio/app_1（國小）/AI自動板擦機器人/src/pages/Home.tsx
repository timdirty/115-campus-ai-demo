import {useEffect, useState} from 'react';
import {motion} from 'motion/react';
import {Loader2, RefreshCw} from 'lucide-react';
import {CapturePanel} from '../components/home/CapturePanel';
import {NoticeBar} from '../components/home/NoticeBar';
import {RegionTaskPanel} from '../components/home/RegionTaskPanel';
import {useBridgeStatus} from '../hooks/useBridgeStatus';
import {useMediaCapture} from '../hooks/useMediaCapture';
import {analyzeBoardCapture, BoardAnalysisResponse, BoardRegion, ocrBoardLocal, OcrLocalResult, saveClassroomSession, transcribeAudio} from '../services/classroomApi';
import {addNoteAsync} from '../services/notesStore';
import {defaultRobotPose} from '../services/robotPose';
import {BoardCalibration, BoardCalibrationMode, CalibrationCornerId, defaultBoardCalibration, detectBoardCalibrationFromImage, normalizeBoardCalibration} from '../services/whiteboardCalibration';

const containerVariants: any = {
  hidden: {opacity: 0},
  show: {opacity: 1, transition: {staggerChildren: 0.06, ease: 'easeOut'}},
  exit: {opacity: 0, y: -10, transition: {duration: 0.2}},
};

const itemVariants: any = {
  hidden: {opacity: 0, y: 18},
  show: {opacity: 1, y: 0, transition: {type: 'spring', bounce: 0.18, duration: 0.45}},
};

export default function Home(_props: {onNavigate: (tab: string) => void}) {
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
  const [transcript, setTranscript] = useState('');
  const [previewImage, setPreviewImage] = useState('');
  const [analysis, setAnalysis] = useState<BoardAnalysisResponse | null>(null);
  const [boardCalibration, setBoardCalibration] = useState<BoardCalibration>(defaultBoardCalibration());
  const [calibrationMode, setCalibrationMode] = useState<BoardCalibrationMode>('default');
  const [detectionConfidence, setDetectionConfidence] = useState(0);
  const [calibrationDirty, setCalibrationDirty] = useState(false);
  const [busy, setBusy] = useState('');
  const [ocrResult, setOcrResult] = useState<OcrLocalResult | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);

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
          setNotice(result.aiMode === 'gemini' ? '老師講解逐字稿已由 Gemini 產生' : '已建立國小課堂本機逐字稿');
        } catch (error) {
          setNotice(error instanceof Error ? error.message : '語音轉文字失敗');
        }
      });
      setNotice('正在錄製老師講解');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '無法開啟麥克風權限');
    }
  };

  const runOcr = async (imageBase64: string) => {
    setOcrBusy(true);
    const r = await ocrBoardLocal(imageBase64);
    setOcrResult(r);
    setOcrBusy(false);
    return r;
  };

  const captureAndAnalyze = async () => {
    setBusy('analyze');
    try {
      const imageBase64 = media.captureFrame();
      setPreviewImage(imageBase64);
      setOcrResult(null);
      // OCR runs in parallel; result enriches ocrText in the note
      const [result] = await Promise.all([
        analyzeBoardCapture({imageBase64, transcript, subjectHint, boardCalibration}),
        runOcr(imageBase64),
      ]);
      setAnalysis(result);
      const mergedSession = {
        ...result.session,
        hardwareProfile: {
          ...result.session.hardwareProfile,
          boardCalibration,
          boardCalibrationMode: calibrationMode,
          boardDetectionConfidence: detectionConfidence,
          cameraMounted: media.cameraReady || result.session.hardwareProfile.cameraMounted,
        },
      };
      setClassroom(mergedSession);
      setNotice(result.aiMode === 'gemini' ? '白板分析完成，已整理成國小課堂建議' : '白板分析完成，目前使用本機示範分析');
    } catch (error) {
      setPreviewImage('');
      setNotice(error instanceof Error ? error.message : '白板分析失敗');
    } finally {
      setBusy('');
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setNotice('請選擇圖片檔案（JPEG、PNG 等）');
      return;
    }
    setBusy('analyze');
    try {
      const reader = new FileReader();
      const imageBase64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('圖片讀取失敗'));
        reader.readAsDataURL(file);
      });
      setPreviewImage(imageBase64);
      setOcrResult(null);
      const [result] = await Promise.all([
        analyzeBoardCapture({imageBase64, transcript, subjectHint, boardCalibration}),
        runOcr(imageBase64),
      ]);
      setAnalysis(result);
      const mergedSession = {
        ...result.session,
        hardwareProfile: {
          ...result.session.hardwareProfile,
          boardCalibration,
          boardCalibrationMode: calibrationMode,
          boardDetectionConfidence: detectionConfidence,
        },
      };
      setClassroom(mergedSession);
      setNotice(result.aiMode === 'gemini' ? '白板分析完成，已整理成國小課堂建議' : '白板分析完成，目前使用本機示範分析');
    } catch (error) {
      setPreviewImage('');
      setNotice(error instanceof Error ? error.message : '圖片上傳分析失敗');
    } finally {
      setBusy('');
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
        boardRegions: analysis.boardRegions,
        aiRecommendation: analysis.currentRecommendation,
        img: analysis.noteDraft.img || analysis.noteDraft.imageUrl || previewImage,
        imageUrl: analysis.noteDraft.imageUrl || previewImage,
      });
      setLatestNote(note);
      setNotice('已保存到課堂紀錄本，可用於 AI 小老師與學習單生成');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '保存課堂紀錄失敗');
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
        ? `已自動抓到白板範圍，信心 ${detected.confidence}%`
        : '自動偵測沒有抓穩，已回到預設四角，建議手動微調。');
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
    setNotice('白板四角已重設，請依 webcam 畫面重新微調。');
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
      setNotice('目前 webcam 的白板四角校正已保存，後續辨識會優先使用這個範圍。');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '無法保存白板四角校正');
    }
  };

  const boardRegions = analysis?.boardRegions ?? classroom?.boardRegions ?? [];

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
          <button
            type="button"
            onClick={refreshStatus}
            disabled={statusBusy}
            className="min-h-11 px-4 rounded-md bg-surface-container-high hover:bg-primary hover:text-on-primary transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 font-bold"
          >
            {statusBusy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="w-4 h-4" aria-hidden="true" />}
            重新同步
          </button>
        </motion.section>

        <motion.div variants={itemVariants}>
          <NoticeBar notice={notice} />
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
            classroom={classroom}
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
                <p className="text-sm font-extrabold">白板文字辨識</p>
                <p className="text-xs font-semibold text-on-surface-variant">
                  {ocrBusy ? 'EasyOCR 辨識中…' : `本機 EasyOCR 辨識完成・${ocrResult?.blocks.length ?? 0} 個文字區塊`}
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
      </div>
    </motion.div>
  );
}
