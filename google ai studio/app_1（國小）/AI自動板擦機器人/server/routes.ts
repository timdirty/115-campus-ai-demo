import type {Express, Request} from 'express';
import {baudRate, bridgePort, chatFile, classroomFile, dataDir, notesFile, robotFile, taskLogFile} from './config';
import {analyzeBoardWithAI, chatWithAI, isGeminiConfigured, normalizeBoardRegions, reviewWithAI, transcribeWithAI} from './aiService';
import {commandCatalog, createNote, defaultClassroomSession, defaultNotes, defaultRobotStatus, supportedCommands, taskActions} from './defaults';
import {ApiError, getErrorMessage, sendError} from './http';
import {buildAppExport, getReadyStatus, importAppData, writeBackupFile} from './opsService';
import {getActivePath, isArduinoLikePort, listPorts, recordUnsupportedTask, resolveTaskCommand, sendSerialCommand} from './robotService';
import {assignPortToZone, getAllDetectedPorts, getLiveZoneReadings, unassignPort} from './sensorManager';
import {appendTaskLog, readJsonFile, updateRobotStatus, writeJsonFile} from './storage';
import type {ChatMessage, ClassroomSession, RobotStatus, TaskLogItem, WhiteboardNote} from './types';
import {assertMediaPayload, audioPayloadOptions, imagePayloadOptions} from './validation';

function forceLocalAi(req: Request) {
  return req.get('x-ai-mode') === 'local-fallback' || req.get('x-ai-fallback') === '1' || req.body?.forceLocal === true;
}

export function registerRoutes(app: Express) {
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
    res.json({ok: true, bridgePort, baudRate, dataDir, geminiConfigured: isGeminiConfigured(), uptimeSeconds: Math.round(process.uptime())});
  });

  app.get('/api/ready', async (_req, res) => {
    try {
      const status = await getReadyStatus(isGeminiConfigured());
      res.status(status.ok ? 200 : 503).json(status);
    } catch (error) {
      sendError(res, error);
    }
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
      const normalized = {...session, boardRegions: normalizeBoardRegions(session.boardRegions)};
      res.json({session: normalized});
    } catch (error) {
      sendError(res, error);
    }
  });

  app.post('/api/classroom/session', async (req, res) => {
    try {
      const current = await readJsonFile<ClassroomSession>(classroomFile, defaultClassroomSession);
      const next = {
        ...current,
        ...req.body,
        boardRegions: Array.isArray(req.body?.boardRegions) ? normalizeBoardRegions(req.body.boardRegions) : normalizeBoardRegions(current.boardRegions),
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
      const nextNotes = [note, ...notes];
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

  app.post('/api/ai/analyze-board', async (req, res) => {
    try {
      const imageBase64 = String(req.body?.imageBase64 ?? '').trim();
      const transcript = String(req.body?.transcript ?? '').trim();
      const subjectHint = String(req.body?.subjectHint ?? '').trim();

      assertMediaPayload(imageBase64, imagePayloadOptions);

      const result = await analyzeBoardWithAI(imageBase64, transcript, subjectHint, {forceLocal: forceLocalAi(req)});
      const current = await readJsonFile<ClassroomSession>(classroomFile, defaultClassroomSession);
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
      };
      await writeJsonFile(classroomFile, nextSession);
      res.json({...result, session: nextSession});
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
      const message = result.response || `Sent ${command} to ${result.port}`;
      const status = await updateRobotStatus({
        connected: true,
        activePort: result.port,
        lastCommand: command,
        lastResponse: message,
      });
      const taskLog = await appendTaskLog({command, source, ok: true, message});
      res.json({ok: true, action, regionId, command, port: result.port, response: result.response, status, taskLog});
    } catch (error) {
      const message = getErrorMessage(error);
      const status = await updateRobotStatus({
        connected: false,
        activePort: getActivePath(),
        lastCommand: command,
        lastResponse: message,
      });
      const taskLog = await appendTaskLog({command, source, ok: false, message});
      res.status(503).json({error: message, action, regionId, command, status, taskLog});
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

    if (!supportedCommands.has(command)) {
      const result = await recordUnsupportedTask(command, source, 'Unsupported command');
      res.status(400).json({error: 'Unsupported command', ...result});
      return;
    }

    try {
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
    } catch (error) {
      const message = getErrorMessage(error);
      const status = await updateRobotStatus({
        connected: false,
        activePort: getActivePath(),
        lastCommand: command,
        lastResponse: message,
      });
      const taskLog = await appendTaskLog({command, source, ok: false, message});
      res.status(503).json({error: message, status, taskLog});
    }
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

      if (!supportedCommands.has(command)) {
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
    } catch (error) {
      sendError(res, error);
    }
  });
}
