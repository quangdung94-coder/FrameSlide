import { resolve } from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Standalone browser Vite config for developing & testing `src/engine` and UI
 * directly in Chrome/Playwright without launching Electron.
 */
export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer'),
      '@engine': resolve(__dirname, 'src/engine'),
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
  },
});
