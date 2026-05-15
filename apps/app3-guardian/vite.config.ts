import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import path from 'path';
import {defineConfig} from 'vite';

const payloadMarker = '__LLM_EMOTION_JSON__';
const macFrameworkPython = '/Library/Frameworks/Python.framework/Versions/3.10/bin/python3';
const pythonBin = process.env.LLM_EMOTION_PYTHON || (existsSync(macFrameworkPython) ? macFrameworkPython : 'python3');

function llmEmotionApi() {
  return {
    name: 'llm-emotion-api',
    configureServer(server) {
      server.middlewares.use('/api/scan-emotion', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({error: 'method not allowed'}));
          return;
        }

        const scriptPath = path.resolve(__dirname, '../robot-app/LLMEmotion.py');
        const child = spawn(pythonBin, [scriptPath, '--once'], {
          cwd: path.dirname(scriptPath),
          env: {...process.env, PYTHONUNBUFFERED: '1'},
        });

        let stdout = '';
        let stderr = '';
        let finished = false;

        const finish = (statusCode: number, body: Record<string, unknown>) => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          res.statusCode = statusCode;
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(body));
        };

        const timer = setTimeout(() => {
          child.kill('SIGTERM');
          finish(504, {error: 'LLMEmotion.py timeout', stderr});
        }, 120000);

        child.stdout.on('data', (chunk) => {
          stdout += chunk.toString();
        });

        child.stderr.on('data', (chunk) => {
          stderr += chunk.toString();
        });

        child.on('error', (error) => {
          finish(500, {error: error.message, stderr});
        });

        child.on('close', (code) => {
          const line = stdout
            .split(/\r?\n/)
            .find((item) => item.startsWith(payloadMarker));

          if (!line) {
            finish(500, {
              error: `LLMEmotion.py exited without frontend payload${code ? ` (code ${code})` : ''}`,
              stdout,
              stderr,
            });
            return;
          }

          try {
            const payload = JSON.parse(line.slice(payloadMarker.length));
            if (payload.error) {
              finish(500, {...payload, stdout, stderr});
              return;
            }
            finish(200, payload);
          } catch (error) {
            finish(500, {error: error instanceof Error ? error.message : String(error), stdout, stderr});
          }
        });
      });
    },
  };
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [llmEmotionApi(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        // The robot display is bundled inside this app; pin React to this app's node_modules
        // so Rollup can resolve react/jsx-runtime during production build.
        'react': path.resolve(__dirname, 'node_modules/react'),
        'react/jsx-runtime': path.resolve(__dirname, 'node_modules/react/jsx-runtime'),
        'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
        'react-dom/client': path.resolve(__dirname, 'node_modules/react-dom/client'),
        'lucide-react': path.resolve(__dirname, 'node_modules/lucide-react'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify; file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          robotDisplay: path.resolve(__dirname, 'robot-display.html'),
        },
        output: {
          manualChunks: {
            'vendor-motion': ['motion/react'],
          },
        },
      },
    },
  };
});
