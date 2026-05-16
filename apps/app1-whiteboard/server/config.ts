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
export const geminiModel = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash-lite';
export const geminiVisionModel = process.env.GEMINI_VISION_MODEL ?? process.env.GEMINI_MODEL ?? 'gemini-2.5-flash-lite';
// Text-only chat model — defaults to Gemma which has separate (much larger) quota.
export const geminiChatModel = process.env.GEMINI_CHAT_MODEL ?? 'gemma-4-26b-a4b-it';
// Fallback chain when 429 / quota exhausted; tried in order.
export const geminiVisionFallbacks = (process.env.GEMINI_VISION_FALLBACKS ?? 'gemini-2.5-flash-lite,gemini-2.0-flash,gemini-2.5-flash').split(',').map((m) => m.trim()).filter(Boolean);
// Order matters: fast first, unmetered Gemma last as quota backstop.
export const geminiChatFallbacks = (process.env.GEMINI_CHAT_FALLBACKS ?? 'gemini-2.5-flash-lite,gemini-2.0-flash,gemma-4-26b-a4b-it,gemini-2.5-flash').split(',').map((m) => m.trim()).filter(Boolean);
export const aiProxyKey = process.env.AI_PROXY_KEY ?? '';
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
