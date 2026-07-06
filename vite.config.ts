import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    // Frontend source lives in ./frontend; the API server and shared mocks live
    // alongside it under the project root.
    root: path.resolve(__dirname, 'frontend'),
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'frontend'),
      },
    },
    build: {
      outDir: path.resolve(__dirname, 'dist'),
      emptyOutDir: true,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // Allow importing files from the project root (e.g. shared/mocks) even
      // though the Vite root is ./frontend.
      fs: {
        allow: [path.resolve(__dirname)],
      },
      // Proxy API calls to the Express backend so the frontend can use relative
      // /api paths in dev. The client also auto-falls back to local mocks if the
      // backend is not running.
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  };
});
