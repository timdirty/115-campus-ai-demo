import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {config as loadEnv} from 'dotenv';
import path from 'path';
import {defineConfig} from 'vite';

loadEnv({path: path.resolve(__dirname, '.env.local')});
loadEnv({path: path.resolve(__dirname, '.env')});

const bridgePort = process.env.BRIDGE_PORT ?? '3201';

// Bake VITE_GEMINI_API_KEY into bundle so the deployed (no-bridge) Pages site
// can call Gemini REST directly. Key must be HTTP-referrer restricted in
// Google Cloud Console to the Pages origin only.
const directGeminiKey = process.env.VITE_GEMINI_API_KEY ?? '';

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss()],
    define: {
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(directGeminiKey),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify; file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': `http://localhost:${bridgePort}`,
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
            motion: ['motion'],
            markdown: ['react-markdown'],
          },
        },
      },
    },
  };
});
