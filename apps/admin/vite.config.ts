import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// In dev the SPA is served from Vite and calls the API on the same origin; Vite proxies to the API.
// (CORS for a separately hosted admin is a P4 hardening task.)
const apiTarget = process.env['API_PROXY_TARGET'] ?? 'http://127.0.0.1:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  server: {
    proxy: {
      '/v1': apiTarget,
      '/healthz': apiTarget,
      '/readyz': apiTarget,
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.spec.{ts,tsx}'],
    css: false,
    // Form tests type into many fields; a loaded CI machine needs more than vitest's 5 s default.
    testTimeout: 20_000,
  },
});
