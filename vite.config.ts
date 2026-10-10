import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  let envKey = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY || '';
  if (!envKey) {
    try {
      const rawEnv = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf-8').trim();
      const match = rawEnv.match(/^(?:(?:VITE_)?GEMINI_API_KEY=)?\s*(.+)$/m);
      if (match && match[1]) {
        envKey = match[1].trim();
      } else if (rawEnv.length > 0 && !rawEnv.includes('\n')) {
        envKey = rawEnv;
      }
    } catch {}
  }

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      host: true,
    },
    base: './',
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(envKey),
    },
  };
});
