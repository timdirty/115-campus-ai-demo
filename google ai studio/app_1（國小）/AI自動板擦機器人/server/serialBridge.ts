import express from 'express';
import path from 'node:path';
import {access} from 'node:fs/promises';
import {baudRate, bridgePort, distDir, nodeEnv} from './config';
import {registerRoutes} from './routes';

const app = express();
const distIndex = path.join(distDir, 'index.html');

app.disable('x-powered-by');

app.use((req, res, next) => {
  const origin = req.get('origin') ?? '';
  if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-AI-Mode, X-AI-Fallback');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), serial=(self)');
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});

app.options('*', (_req, res) => {
  res.sendStatus(204);
});

app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    if (nodeEnv !== 'test') {
      console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - startedAt}ms`);
    }
  });
  next();
});

app.use(express.json({limit: '24mb'}));
registerRoutes(app);

app.use('/api', (_req, res) => {
  res.status(404).json({error: 'API route not found'});
});

async function registerStaticFrontend() {
  try {
    await access(distIndex);
    app.use(express.static(distDir, {
      etag: true,
      maxAge: nodeEnv === 'production' ? '1h' : 0,
    }));
    app.get('*', (_req, res) => {
      res.sendFile(distIndex);
    });
    return true;
  } catch {
    app.get('/', (_req, res) => {
      res.status(nodeEnv === 'production' ? 503 : 200).json({
        ok: nodeEnv !== 'production',
        message: nodeEnv === 'production'
          ? 'Production build not found. Run npm run build before npm run start.'
          : 'Bridge is running. Start Vite with npm run dev:web or run npm run build for single-server mode.',
      });
    });
    return false;
  }
}

await registerStaticFrontend();

app.listen(bridgePort, () => {
  console.log(`Arduino serial bridge listening on http://localhost:${bridgePort}`);
  console.log(`Baud rate: ${baudRate}`);
  console.log(`Mode: ${nodeEnv}`);
});
