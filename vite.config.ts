import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // The API client calls a relative /api (same-origin behind nginx in prod).
      // Without this proxy the dev server has nothing on that path, so every
      // request 404s and local dev cannot reach the backend at all.
      proxy: {
        '/api': {
          target: process.env.VITE_DEV_API_TARGET ?? 'http://127.0.0.1:4001',
          changeOrigin: true,
        },
      },
    },
  };
});
