import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:3000' } },
  // La escena 3D (three.js) es un chunk diferido de ~250 KB gzip que sólo carga la página del reproductor (D10).
  build: { chunkSizeWarningLimit: 1000 },
});
