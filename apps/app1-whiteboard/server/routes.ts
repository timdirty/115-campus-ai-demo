import type {Express, Request} from 'express';
import {broadcast} from './wsBroadcast';
import {baudRate, bridgePort, chatFile, classroomFile, dataDir, isHardwareSimulationEnabled, nodeEnv, notesFile, robotFile, taskLogFile} from './config';
import {analyzeBoardWithAI, chatWithAI, isGeminiConfigured, normalizeBoardRegions, reviewWithAI, transcribeWithAI} from './aiService';
import {isOcrServiceReady, ocrImage} from './ocrBridge';
import {commandCatalog, createNote, defaultClassroomSession, defaultNotes, defaultRobotStatus, supportedCommands, taskActions} from './defaults';
import {ApiError, getErrorMessage, sendError} from './http';
import {buildAppExport, getReadyStatus, importAppData, writeBackupFile} from './opsService';
import {getEV3Status, sendEV3Command} from './ev3Manager';
import {getSpikeStatus, sendSpikeCommand, startSpikeManager} from './spikeManager';
import {getActivePath, isArduinoLikePort, listPorts, recordUnsupportedTask, resolveTaskCommand, sendSerialCommand, sendSerialCommandDrive} from './robotService';
import {assignPortToZone, getAllDetectedPorts, getLiveZoneReadings, unassignPort} from './sensorManager';
import {appendTaskLog, readCalibration, readJsonFile, saveCalibration, updateRobotStatus, writeJsonFile} from './storage';
import type {CalibrationData} from './storage';
import type {ChatMessage, ClassroomSession, RobotStatus, TaskLogItem, WhiteboardNote} from './types';
import {assertMediaPayload, audioPayloadOptions, imagePayloadOptions} from './validation';

function forceLocalAi(req: Request) {
  return req.get('x-ai-mode') === 'local-fallback' || req.get('x-ai-fallback') === '1' || req.body?.forceLocal === true;
}

function normalizeServoAngle(value: unknown, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(0, Math.min(180, Math.round(numeric)));
}

function normalizeBoardPercent(value: unknown, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(0, Math.min(100, Math.round(numeric * 10) / 10));
}

function normalizeConfidence(value: unknown, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function normalizeHardwareProfile(input: unknown, fallback = defaultClassroomSession.hardwareProfile) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const servoAngles = source.servoAngles && typeof source.servoAngles === 'object' && !Array.isArray(source.servoAngles)
    ? source.servoAngles as Record<string, unknown>
    : {};
  const boardCalibration = source.boardCalibration && typeof source.boardCalibration === 'object' && !Array.isArray(source.boardCalibration)
    ? source.boardCalibration as Record<string, unknown>
    : {};
  const topLeft = boardCalibration.topLeft && typeof boardCalibration.topLeft === 'object' && !Array.isArray(boardCalibration.topLeft)
    ? boardCalibration.topLeft as Record<string, unknown>
    : {};
  const topRight = boardCalibration.topRight && typeof boardCalibration.topRight === 'object' && !Array.isArray(boardCalibration.topRight)
    ? boardCalibration.topRight as Record<string, unknown>
    : {};
  const bottomRight = boardCalibration.bottomRight && typeof boardCalibration.bottomRight === 'object' && !Array.isArray(boardCalibration.bottomRight)
    ? boardCalibration.bottomRight as Record<string, unknown>
    : {};
  const bottomLeft = boardCalibration.bottomLeft && typeof boardCalibration.bottomLeft === 'object' && !Array.isArray(boardCalibration.bottomLeft)
    ? boardCalibration.bottomLeft as Record<string, unknown>
    : {};
  const robotPose = source.robotPose && typeof source.robotPose === 'object' && !Array.isArray(source.robotPose)
    ? source.robotPose as Record<string, unknown>
    : {};
  return {
    ...fallback,
    servoAngles: {
      regionA: normalizeServoAngle(servoAngles.regionA, fallback.servoAngles.regionA),
      regionB: normalizeServoAngle(servoAngles.regionB, fallback.servoAngles.regionB),
      eraseAll: normalizeServoAngle(servoAngles.eraseAll, fallback.servoAngles.eraseAll),
      standby: normalizeServoAngle(servoAngles.standby, fallback.servoAngles.standby),
    },
    cameraMounted: Boolean(source.cameraMounted),
    boardAnchored: Boolean(source.boardAnchored),
    visionReady: Boolean(source.visionReady),
    boardCalibrationMode: source.boardCalibrationMode === 'manual' || source.boardCalibrationMode === 'auto' ? source.boardCalibrationMode : fallback.boardCalibrationMode,
    boardDetectionConfidence: normalizeConfidence(source.boardDetectionConfidence, fallback.boardDetectionConfidence),
    boardCalibration: {
      topLeft: {
        x: normalizeBoardPercent(topLeft.x, fallback.boardCalibration.topLeft.x),
        y: normalizeBoardPercent(topLeft.y, fallback.boardCalibration.topLeft.y),
      },
      topRight: {
        x: normalizeBoardPercent(topRight.x, fallback.boardCalibration.topRight.x),
        y: normalizeBoardPercent(topRight.y, fallback.boardCalibration.topRight.y),
      },
      bottomRight: {
        x: normalizeBoardPercent(bottomRight.x, fallback.boardCalibration.bottomRight.x),
        y: normalizeBoardPercent(bottomRight.y, fallback.boardCalibration.bottomRight.y),
      },
      bottomLeft: {
        x: normalizeBoardPercent(bottomLeft.x, fallback.boardCalibration.bottomLeft.x),
        y: normalizeBoardPercent(bottomLeft.y, fallback.boardCalibration.bottomLeft.y),
      },
    },
    robotPose: {
      x: normalizeBoardPercent(robotPose.x, fallback.robotPose.x),
      y: normalizeBoardPercent(robotPose.y, fallback.robotPose.y),
      heading: normalizeServoAngle(robotPose.heading, fallback.robotPose.heading),
      stage: ['standby', 'preview', 'moving', 'erasing', 'paused', 'done'].includes(String(robotPose.stage))
        ? String(robotPose.stage) as typeof fallback.robotPose.stage
        : fallback.robotPose.stage,
      label: typeof robotPose.label === 'string' && robotPose.label ? robotPose.label : fallback.robotPose.label,
      targetRegion: typeof robotPose.targetRegion === 'string' && robotPose.targetRegion ? robotPose.targetRegion : undefined,
      command: typeof robotPose.command === 'string' && robotPose.command ? robotPose.command : fallback.robotPose.command,
      updatedAt: typeof robotPose.updatedAt === 'string' ? robotPose.updatedAt : fallback.robotPose.updatedAt,
    },
    notes: typeof source.notes === 'string' ? source.notes : fallback.notes,
    lastCalibratedAt: typeof source.lastCalibratedAt === 'string' && source.lastCalibratedAt ? source.lastCalibratedAt : fallback.lastCalibratedAt,
  };
}

function isExtendedCalibrationCommand(command: string) {
  return /^(SERVO_SET|SET_REGION_A|SET_REGION_B|SET_ERASE_ALL|SET_STANDBY):\d{1,3}$/.test(command)
    || command === 'CALIBRATION_STATUS';
}

function demoFallbackStatus(source: string) {
  const frontendSources = new Set(['app', 'teacher-dashboard', 'robot-control', 'teacher-calibration']);
  return nodeEnv !== 'production' || isHardwareSimulationEnabled() || frontendSources.has(source) ? 200 : 503;
}

function normalizeSessionShape(session: ClassroomSession): ClassroomSession {
  return {
    ...defaultClassroomSession,
    ...session,
    boardRegions: normalizeBoardRegions(session.boardRegions),
    hardwareProfile: normalizeHardwareProfile(session.hardwareProfile, defaultClassroomSession.hardwareProfile),
  };
}

export function registerRoutes(app: Express) {
  startSpikeManager();
  app.get('/api/arduino/ports', async (_req, res) => {
    try {
      res.json({
        activePath: getActivePath(),
        baudRate,
        ports: await listPorts(),
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      bridgePort,
      baudRate,
      dataDir,
      geminiConfigured: isGeminiConfigured(),
      hardwareSimulation: isHardwareSimulationEnabled(),
      uptimeSeconds: Math.round(process.uptime()),
    });
  });

  app.get('/api/ready', async (_req, res) => {
    try {
      const status = await getReadyStatus(isGeminiConfigured());
      res.status(status.ok ? 200 : 503).json(status);
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get('/api/calibration', async (_req, res) => {
    try {
      const calibration = await readCalibration();
      res.json({ok: true, calibration});
    } catch (error) {
      res.status(500).json({error: getErrorMessage(error)});
    }
  });

  app.put('/api/calibration', async (req, res) => {
    const {topLeft, topRight, bottomRight, bottomLeft} = req.body ?? {};
    const isCorner = (v: unknown): v is {x: number; y: number} =>
      typeof v === 'object' && v !== null &&
      typeof (v as {x?: unknown}).x === 'number' &&
      typeof (v as {y?: unknown}).y === 'number';
    if (!isCorner(topLeft) || !isCorner(topRight) || !isCorner(bottomRight) || !isCorner(bottomLeft)) {
      return res.status(400).json({error: 'topLeft, topRight, bottomRight, bottomLeft with x/y required'});
    }
    const data: CalibrationData = {
      version: 1,
      topLeft: {x: topLeft.x, y: topLeft.y},
      topRight: {x: topRight.x, y: topRight.y},
      bottomRight: {x: bottomRight.x, y: bottomRight.y},
      bottomLeft: {x: bottomLeft.x, y: bottomLeft.y},
      savedAt: '',
    };
    void saveCalibration(data);
    res.json({ok: true, calibration: {...data, savedAt: new Date().toISOString()}});
  });

  app.get('/api/export', async (_req, res) => {
    try {
      res.json(await buildAppExport());
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post('/api/backup', async (_req, res) => {
    try {
      res.json(await writeBackupFile());
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post('/api/import', async (req, res) => {
    try {
      res.json(await importAppData(req.body));
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get('/api/classroom/session', async (_req, res) => {
    try {
      const session = await readJsonFile<ClassroomSession>(classroomFile, defaultClassroomSession);
      const normalized = normalizeSessionShape(session);
      res.json({session: normalized});
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post('/api/classroom/session', async (req, res) => {
    try {
      const current = normalizeSessionShape(await readJsonFile<ClassroomSession>(classroomFile, defaultClassroomSession));
      const next = {
        ...current,
        ...req.body,
        boardRegions: Array.isArray(req.body?.boardRegions) ? normalizeBoardRegions(req.body.boardRegions) : normalizeBoardRegions(current.boardRegions),
        hardwareProfile: normalizeHardwareProfile(req.body?.hardwareProfile, current.hardwareProfile ?? defaultClassroomSession.hardwareProfile),
        updatedAt: new Date().toISOString(),
      };
      await writeJsonFile(classroomFile, next);
      res.json({session: next});
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get('/api/notes', async (_req, res) => {
    try {
      res.json({notes: await readJsonFile<WhiteboardNote[]>(notesFile, defaultNotes)});
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post('/api/notes', async (req, res) => {
    try {
      const title = String(req.body?.title ?? '').trim();
      const subject = String(req.body?.subject ?? '').trim();
      const content = String(req.body?.content ?? '').trim();

      if (!title || !subject || !content) {
        throw new ApiError(400, 'title, subject, and content are required');
      }

      const notes = await readJsonFile<WhiteboardNote[]>(notesFile, defaultNotes);
      const note = createNote({...req.body, title, subject, content});
      const nextNotes = [note, ...notes.filter((item) => item.id !== note.id)];
      await writeJsonFile(notesFile, nextNotes);
      res.json({note, notes: nextNotes});
    } catch (error) {
      sendError(res, error);
    }
  });

  app.put('/api/notes/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const notes = await readJsonFile<WhiteboardNote[]>(notesFile, defaultNotes);
      const current = notes.find((note) => note.id === id);

      if (!current) {
        throw new ApiError(404, 'note not found');
      }

      const title = String(req.body?.title ?? current.title).trim();
      const subject = String(req.body?.subject ?? current.subject).trim();
      const content = String(req.body?.content ?? current.content).trim();

      if (!title || !subject || !content) {
        throw new ApiError(400, 'title, subject, and content are required');
      }

      const nextNote: WhiteboardNote = createNote({
        ...current,
        ...req.body,
        id: current.id,
        title,
        subject,
        content,
        period: String(req.body?.period ?? current.period ?? '即時紀錄'),
        desc: String(req.body?.desc ?? current.desc ?? content.slice(0, 80)),
        createdAt: current.createdAt,
        date: current.date,
        time: current.time,
      });
      const nextNotes = notes.map((note) => note.id === id ? nextNote : note);
      await writeJsonFile(notesFile, nextNotes);
      res.json({note: nextNote, notes: nextNotes});
    } catch (error) {
      sendError(res, error);
    }
  });

  app.delete('/api/notes/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const notes = await readJsonFile<WhiteboardNote[]>(notesFile, defaultNotes);
      const nextNotes = notes.filter((note) => note.id !== id);
      await writeJsonFile(notesFile, nextNotes);
      res.json({ok: true, notes: nextNotes});
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get('/api/chat', async (_req, res) => {
    try {
      res.json({messages: await readJsonFile<ChatMessage[]>(chatFile, [])});
    } catch (error) {
      sendError(res, error);
    }
  });

  app.put('/api/chat', async (req, res) => {
    try {
      const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
      await writeJsonFile(chatFile, messages);
      res.json({ok: true, messages});
    } catch (error) {
      sendError(res, error);
    }
  });

  // ── Local OCR endpoint (Python EasyOCR service) ───────────────────────────
  app.post('/api/ai/ocr-local', async (req, res) => {
    try {
      const imageBase64 = String(req.body?.imageBase64 ?? '').trim();
      assertMediaPayload(imageBase64, imagePayloadOptions);
      const result = await ocrImage(imageBase64);
      res.json(result);
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get('/api/ai/ocr-status', async (_req, res) => {
    res.json({ready: await isOcrServiceReady()});
  });

  app.post('/api/ai/analyze-board', async (req, res) => {
    try {
      const imageBase64 = String(req.body?.imageBase64 ?? '').trim();
      const transcript = String(req.body?.transcript ?? '').trim();
      const subjectHint = String(req.body?.subjectHint ?? '').trim();

      assertMediaPayload(imageBase64, imagePayloadOptions);

      // OCR quick-race: give OCR 2.5 s to respond; if pre-warmed it wins easily.
      // Gemini starts immediately after the quick window regardless, so total
      // latency = max(Gemini, OCR) instead of OCR + Gemini (was up to 17 s).
      const OCR_QUICK_MS = 2_500;
      const ocrPromise = ocrImage(imageBase64);
      const quickOcr = await Promise.race([
        ocrPromise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), OCR_QUICK_MS)),
      ]);
      const realOcrText = quickOcr?.ok ? quickOcr.text : undefined;

      // Start Gemini now; let OCR keep running concurrently so we get full text
      const [result, finalOcr] = await Promise.all([
        analyzeBoardWithAI(imageBase64, transcript, subjectHint, {forceLocal: forceLocalAi(req), realOcrText}),
        ocrPromise.catch(() => null),
      ]);

      const boardOcrText = (finalOcr?.ok ? finalOcr.text : undefined) ?? realOcrText;
      const trimmedBoardOcrText = boardOcrText?.trim() ?? '';
      const noteDraftContent = trimmedBoardOcrText && !result.noteDraft.content.includes(trimmedBoardOcrText)
        ? [
          result.noteDraft.content,
          '',
          '白板實際辨識文字：',
          trimmedBoardOcrText,
        ].filter(Boolean).join('\n')
        : result.noteDraft.content;
      const noteDraft = {
        ...result.noteDraft,
        ocrText: trimmedBoardOcrText || result.noteDraft.ocrText,
        content: noteDraftContent,
        keywords: [
          ...(result.noteDraft.keywords ?? []),
          ...(trimmedBoardOcrText ? ['白板OCR', ...trimmedBoardOcrText.split(/\s+/).slice(0, 6)] : []),
        ],
      };
      const current = normalizeSessionShape(await readJsonFile<ClassroomSession>(classroomFile, defaultClassroomSession));
      const nextSession: ClassroomSession = {
        ...current,
        focusPercent: result.focusPercent,
        confusedPercent: result.confusedPercent,
        tiredPercent: result.tiredPercent,
        teacherPace: result.teacherPace,
        currentRecommendation: result.currentRecommendation,
        boardRegions: result.boardRegions,
        lastCaptureAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        boardOcrText: boardOcrText ?? current.boardOcrText,
      };
      await writeJsonFile(classroomFile, nextSession);
      res.json({...result, noteDraft, session: nextSession});
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post('/api/ai/transcribe', async (req, res) => {
    try {
      const audioBase64 = String(req.body?.audioBase64 ?? '').trim();
      const requestedMimeType = String(req.body?.mimeType ?? 'audio/webm').trim();
      const media = assertMediaPayload(audioBase64, {
        ...audioPayloadOptions,
        fallbackMimeType: requestedMimeType || audioPayloadOptions.fallbackMimeType,
      });

      res.json(await transcribeWithAI(audioBase64, media.mimeType, {forceLocal: forceLocalAi(req)}));
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post('/api/ai/chat', async (req, res) => {
    try {
      const message = String(req.body?.message ?? '').trim();
      const noteIds = Array.isArray(req.body?.noteIds) ? req.body.noteIds.map(Number).filter(Number.isFinite) : [];
      const history = Array.isArray(req.body?.history) ? req.body.history : [];

      if (!message) {
        throw new ApiError(400, 'message is required');
      }

      res.json(await chatWithAI(message, noteIds, history, {forceLocal: forceLocalAi(req)}));
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post('/api/ai/review', async (req, res) => {
    try {
      const noteId = Number(req.body?.noteId);
      const mode = req.body?.mode === 'summary' ? 'summary' : 'quiz';
      const notes = await readJsonFile<WhiteboardNote[]>(notesFile, defaultNotes);
      const note = notes.find((item) => item.id === noteId) ?? notes[0];

      if (!note) {
        throw new ApiError(404, 'note not found');
      }

      res.json(await reviewWithAI(note, mode, {forceLocal: forceLocalAi(req)}));
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post('/api/robot/drive', async (req, res) => {
    const command = String(req.body?.command ?? '').trim().toUpperCase();
    const requestedPath = req.body?.port ? String(req.body.port) : undefined;
    if (!/^(FORWARD|BACKWARD|LEFT|RIGHT|STOP|SPEED:\d+|HEARTBEAT)$/.test(command)) {
      res.status(400).json({error: 'Invalid drive command'});
      return;
    }
    try {
      const result = await sendSerialCommandDrive(command, requestedPath);
      res.json({ok: true, command, port: result.port});
    } catch (error) {
      res.status(503).json({ok: false, error: getErrorMessage(error)});
    }
  });

  app.get('/api/robot/commands', (_req, res) => {
    res.json({commands: commandCatalog, taskActions, baudRate});
  });

  app.get('/api/robot/status', async (_req, res) => {
    try {
      const ports = await listPorts().catch(() => []);
      const current = await readJsonFile<RobotStatus>(robotFile, defaultRobotStatus);
      const activePath = getActivePath();
      const connected = ports.some(isArduinoLikePort);
      const status = await updateRobotStatus({
        connected,
        activePort: activePath || current.activePort,
      });
      res.json({
        status,
        ports,
        taskLog: await readJsonFile<TaskLogItem[]>(taskLogFile, []),
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get('/api/ev3/status', (_req, res) => {
    res.json(getEV3Status());
  });

  app.post('/api/ev3/command', async (req, res) => {
    const command = String(req.body?.command ?? '').trim().toUpperCase();
    if (!command) { res.status(400).json({ok: false, error: 'command required'}); return; }
    const result = await sendEV3Command(command);
    res.json(result);
  });

  app.get('/api/spike/status', (_req, res) => {
    res.json(getSpikeStatus());
  });

  app.post('/api/spike/command', async (req, res) => {
    const command = String(req.body?.command ?? '').trim().toUpperCase();
    if (!command) { res.status(400).json({ok: false, error: 'command required'}); return; }
    const result = await sendSpikeCommand(command);
    res.json(result);
  });

  app.post('/api/robot/task', async (req, res) => {
    const action = String(req.body?.action ?? '').trim();
    const regionId = req.body?.regionId ? String(req.body.regionId) : undefined;
    const source = String(req.body?.source ?? 'task');
    const requestedPath = req.body?.port ? String(req.body.port) : undefined;
    const command = resolveTaskCommand(action, regionId);

    if (!action) {
      res.status(400).json({error: 'Missing action'});
      return;
    }

    if (!command) {
      const result = await recordUnsupportedTask(action, source, 'Unsupported robot task');
      res.status(400).json({error: 'Unsupported robot task', ...result});
      return;
    }

    try {
      const result = await sendSerialCommand(command, requestedPath);
      if (result.timedOut) {
        const timeoutMsg = `命令已送出但機器人未回應確認 (${command})`;
        const status = await updateRobotStatus({connected: false, activePort: result.port, lastCommand: command, lastResponse: timeoutMsg});
        const taskLog = await appendTaskLog({command, source, ok: false, message: timeoutMsg});
        res.status(demoFallbackStatus(source)).json({ok: false, error: 'ack_timeout', message: timeoutMsg, action, regionId, command, status, taskLog});
        broadcast({type: 'command_ack', command, ok: false});
        return;
      }
      const message = result.response || `Sent ${command} to ${result.port}`;
      const status = await updateRobotStatus({
        connected: true,
        activePort: result.port,
        lastCommand: command,
        lastResponse: message,
      });
      const taskLog = await appendTaskLog({command, source, ok: true, message});
      res.json({ok: true, action, regionId, command, port: result.port, response: result.response, status, taskLog});
      broadcast({type: 'command_ack', command, ok: true});
    } catch (error) {
      const message = getErrorMessage(error);
      const status = await updateRobotStatus({
        connected: false,
        activePort: getActivePath(),
        lastCommand: command,
        lastResponse: message,
      });
      const taskLog = await appendTaskLog({command, source, ok: false, message});
      res.status(demoFallbackStatus(source)).json({ok: false, error: message, action, regionId, command, status, taskLog});
      broadcast({type: 'command_ack', command, ok: false});
    }
  });

  app.post('/api/robot/command', async (req, res) => {
    const command = String(req.body?.command ?? '').trim().toUpperCase();
    const requestedPath = req.body?.port ? String(req.body.port) : undefined;
    const source = String(req.body?.source ?? 'manual');

    if (!command) {
      res.status(400).json({error: 'Missing command'});
      return;
    }

    if (!supportedCommands.has(command) && !/^SPEED:\d+$/.test(command) && !isExtendedCalibrationCommand(command)) {
      const result = await recordUnsupportedTask(command, source, 'Unsupported command');
      res.status(400).json({error: 'Unsupported command', ...result});
      return;
    }

    try {
      // Route EV3_ commands to EV3 manager. Response shape mirrors the Arduino
      // path (status + taskLog included) so callers like RobotControl.tsx that
      // dereference result.status keep working.
      if (command.startsWith('EV3_')) {
        const result = await sendEV3Command(command);
        const message = result.response || (result.ok ? `Sent ${command} to EV3` : 'EV3 error');
        const status = await updateRobotStatus({
          connected: result.ok,
          activePort: getActivePath(),
          lastCommand: command,
          lastResponse: message,
        });
        const taskLog = await appendTaskLog({command, source, ok: result.ok, message});
        if (!result.ok) {
          res.status(demoFallbackStatus(source)).json({ok: false, command, error: result.response, status, taskLog});
          return;
        }
        res.json({ok: true, command, response: result.response, status, taskLog});
        broadcast({type: 'command_ack', command, ok: true});
        return;
      }

      // STOP: dual-send to both Arduino and EV3 for safety. ok reflects BOTH
      // devices stopping — partial-success cases (one device stopped, other
      // hung) report ok:false so the UI doesn't claim safety stop succeeded
      // when one device is still moving.
      if (command === 'STOP') {
        const [arduinoResult, ev3Result] = await Promise.allSettled([
          sendSerialCommand(command, requestedPath),
          sendEV3Command('EV3_STOP'),
        ]);
        const arduinoOk = arduinoResult.status === 'fulfilled';
        const ev3Ok = ev3Result.status === 'fulfilled' && ev3Result.value.ok;
        const ok = arduinoOk && ev3Ok;
        const port = arduinoOk ? arduinoResult.value.port : getActivePath();
        const arduinoMsg = arduinoOk
          ? (arduinoResult.value.response || `Sent STOP to ${port}`)
          : ((arduinoResult.reason as Error)?.message ?? 'Arduino error');
        const ev3Msg = ev3Result.status === 'fulfilled'
          ? (ev3Result.value.response || (ev3Ok ? 'EV3 stopped' : 'EV3 error'))
          : ((ev3Result.reason as Error)?.message ?? 'EV3 error');
        const message = `Arduino: ${arduinoMsg} | EV3: ${ev3Msg}`;
        const status = await updateRobotStatus({connected: arduinoOk, activePort: port, lastCommand: command, lastResponse: message});
        const taskLog = await appendTaskLog({command, source, ok, message});
        res.json({ok, command, port, response: message, status, taskLog, arduinoOk, ev3Ok});
        broadcast({type: 'command_ack', command, ok});
        return;
      }

      // All other commands: existing Arduino path (unchanged)
      const result = await sendSerialCommand(command, requestedPath);
      const message = result.response || `Sent ${command} to ${result.port}`;
      const status = await updateRobotStatus({
        connected: true,
        activePort: result.port,
        lastCommand: command,
        lastResponse: message,
      });
      const taskLog = await appendTaskLog({command, source, ok: true, message});
      res.json({ok: true, command, port: result.port, response: result.response, status, taskLog});
      broadcast({type: 'command_ack', command, ok: true});
    } catch (error) {
      const message = getErrorMessage(error);
      const status = await updateRobotStatus({
        connected: false,
        activePort: getActivePath(),
        lastCommand: command,
        lastResponse: message,
      });
      const taskLog = await appendTaskLog({command, source, ok: false, message});
      res.status(demoFallbackStatus(source)).json({ok: false, command, error: message, status, taskLog});
      broadcast({type: 'command_ack', command, ok: false});
    }
  });

  // ── SSE: erase region sequence ────────────────────────────────────────────
  // GET /api/robot/erase-sequence?regions=A,B&gap=2000
  // Streams per-region progress as the robot erases each one in order.
  app.get('/api/robot/erase-sequence', async (req, res) => {
    const regionParam = String(req.query.regions ?? '');
    const gapMs = Math.max(500, Math.min(5000, Number(req.query.gap ?? 2000)));
    const regionIds = regionParam
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter((s) => /^[AB]$/.test(s));

    if (regionIds.length === 0) {
      res.status(400).json({error: 'No valid region IDs (A-B) provided'});
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.write('retry: 3000\n\n');

    const sse = (data: object) => {
      try {res.write(`data: ${JSON.stringify(data)}\n\n`);}
      catch {}
    };

    let okCount = 0;
    let failCount = 0;

    sse({type: 'start', regions: regionIds, gapMs});

    for (const regionId of regionIds) {
      const command = `ERASE_REGION_${regionId}`;
      sse({type: 'sending', region: regionId, command});

      try {
        const result = await sendSerialCommand(command, undefined);
        const timedOut = (result as any).timedOut ?? false;
        const ok = !timedOut;
        const message = ok ? result.response || `${command} sent` : `ACK timeout for ${command}`;
        await appendTaskLog({command, source: 'erase-sequence', ok, message});
        if (ok) {
          okCount++;
          sse({type: 'ok', region: regionId, command, response: message});
        } else {
          failCount++;
          sse({type: 'timeout', region: regionId, command, message});
        }
      } catch (err) {
        failCount++;
        const message = err instanceof Error ? err.message : String(err);
        await appendTaskLog({command, source: 'erase-sequence', ok: false, message});
        sse({type: 'error', region: regionId, command, message});
      }

      // Inter-region gap: gives robot time to move and erase
      if (regionId !== regionIds[regionIds.length - 1]) {
        await new Promise((r) => setTimeout(r, gapMs));
      }
    }

    sse({type: 'done', total: regionIds.length, ok: okCount, failed: failCount});
    res.end();
  });

  app.get('/api/sensors/ports', (_req, res) => {
    res.json({ports: getAllDetectedPorts()});
  });

  app.get('/api/sensors/live', (_req, res) => {
    res.json({zones: getLiveZoneReadings()});
  });

  app.post('/api/sensors/assign', async (req, res) => {
    const portPath = String(req.body?.portPath ?? '').trim();
    const zoneId = String(req.body?.zoneId ?? '').trim();
    const unassign = req.body?.unassign === true;

    if (!portPath) {
      res.status(400).json({error: 'portPath is required'});
      return;
    }

    try {
      if (unassign) {
        await unassignPort(portPath);
        res.json({ok: true, portPath, zoneId: null});
      } else {
        if (!zoneId) {
          res.status(400).json({error: 'zoneId is required'});
          return;
        }
        await assignPortToZone(portPath, zoneId);
        res.json({ok: true, portPath, zoneId});
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      // sensorManager throws descriptive messages for invalid inputs → 400
      if (msg.includes('not in detected') || msg.includes('Invalid zone ID')) {
        res.status(400).json({error: msg});
        return;
      }
      sendError(res, error);
    }
  });

  app.post('/api/arduino/command', async (req, res) => {
    try {
      const command = String(req.body?.command ?? '').trim().toUpperCase();
      const requestedPath = req.body?.port ? String(req.body.port) : undefined;

      if (!command) {
        throw new ApiError(400, 'Missing command');
      }

      if (!supportedCommands.has(command) && !isExtendedCalibrationCommand(command)) {
        const result = await recordUnsupportedTask(command, 'legacy-arduino-api', 'Unsupported command');
        res.status(400).json({ok: false, error: 'Unsupported command', ...result});
        return;
      }

      const result = await sendSerialCommand(command, requestedPath);
      const message = result.response || `Sent ${command} to ${result.port}`;
      await updateRobotStatus({
        connected: true,
        activePort: result.port,
        lastCommand: command,
        lastResponse: message,
      });
      await appendTaskLog({command, source: 'legacy-arduino-api', ok: true, message});

      res.json({ok: true, command, port: result.port, response: result.response});
      broadcast({type: 'command_ack', command, ok: true});
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post('/api/ops/reset', async (_req, res) => {
    try {
      await Promise.all([
        writeJsonFile(robotFile, {...defaultRobotStatus, lastUpdatedAt: new Date().toISOString()}),
        writeJsonFile(taskLogFile, []),
        writeJsonFile(classroomFile, {...defaultClassroomSession, updatedAt: new Date().toISOString()}),
        writeJsonFile(chatFile, []),
        writeJsonFile(notesFile, defaultNotes),
      ]);
      broadcast({type: 'command_ack', command: 'OPS_RESET', ok: true});
      res.json({ok: true, message: 'Demo data reset to defaults'});
    } catch (error) {
      sendError(res, error);
    }
  });
}
