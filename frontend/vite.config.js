import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// During development the Java server runs on 7070 and Vite proxies /api to it.
// `npm run build` writes the finished web app into the Java project, so one JAR serves everything.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:7070' },
  },
  build: {
    outDir: '../backend/src/main/resources/public',
    emptyOutDir: true,
    assetsInlineLimit: 0,
  },
});
