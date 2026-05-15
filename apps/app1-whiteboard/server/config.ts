import {config as loadEnv} from 'dotenv';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const appRoot = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(appRoot, '..');

loadEnv({path: path.join(projectRoot, '.env.local')});
loadEnv({path: path.join(projectRoot, '.env')});

export const nodeEnv = process.env.NODE_ENV ?? 'development';
export const bridgePort = Number(process.env.BRIDGE_PORT ?? 3201) || 3201;
export const baudRate = Number(process.env.ARDUINO_BAUD ?? 115200) || 115200;
export const geminiApiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '';
export const aiProxyKey = process.env.AI_PROXY_KEY ?? '';
export const ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
export const ollamaVisionModel = process.env.OLLAMA_VISION_MODEL ?? process.env.OLLAMA_MODEL ?? '';
export const dataDir = path.resolve(appRoot, '../data');
export const backupsDir = path.join(dataDir, 'backups');
export const distDir = path.join(projectRoot, 'dist');
export const notesFile = path.join(dataDir, 'notes.json');
export const chatFile = path.join(dataDir, 'chat.json');
export const classroomFile = path.join(dataDir, 'classroom-session.json');
export const robotFile = path.join(dataDir, 'robot-status.json');
export const taskLogFile = path.join(dataDir, 'task-log.json');
export const calibrationFile = path.join(dataDir, 'calibration.json');

export function isHardwareSimulationEnabled() {
  return process.env.DEMO_SIMULATE_HARDWARE === '1' || process.env.ARDUINO_SIMULATE === '1' || process.env.EV3_SIMULATE === '1';
}
