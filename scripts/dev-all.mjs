#!/usr/bin/env node
import concurrently from 'concurrently';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const APP1 = path.join(root, 'google ai studio/app_1（國小）/AI自動板擦機器人');
const APP2 = path.join(root, 'google ai studio/app_2（國小）/校園服務機器人 app');
const APP3 = path.join(root, 'google ai studio/app_3（國中）/AI校園心靈守護者');

const {result} = concurrently(
  [
    {command: 'npm run dev:web -- --port 11501', cwd: APP1, name: 'App1-Web', prefixColor: 'green'},
    {command: 'npm run dev:bridge', cwd: APP1, name: 'App1-Bridge', prefixColor: 'cyan'},
    {command: 'npm run dev -- --port 11502', cwd: APP2, name: 'App2', prefixColor: 'blue'},
    {command: 'npm run dev -- --port 11503', cwd: APP3, name: 'App3', prefixColor: 'magenta'},
  ],
  {
    killOthers: ['failure'],
    prefix: 'name',
    timestampFormat: 'HH:mm:ss',
  },
);

result.then(() => process.exit(0)).catch(() => process.exit(1));
