import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
export default defineConfig({
  plugins: [react()],
  // Versión visible en la esquina inferior derecha (sale de package.json).
  define: { __APP_VERSION__: JSON.stringify(version) },
  server: { port: 5173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:3000' } },
  // La escena 3D (three.js) es un chunk diferido de ~250 KB gzip que sólo carga la página del reproductor (D10).
  build: { chunkSizeWarningLimit: 1000 },
});
