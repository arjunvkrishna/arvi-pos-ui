/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served at the site root (the classic app is retired; see docs/react-migration/TRACKER.md).
export default defineConfig({
  base: '/',
  // Shown in the sidebar; comes from package.json (kept equal to pom.xml and the image tag by tools/check-all.sh).
  define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? 'dev') },
  plugins: [
    react({
      // React Compiler: automatic memoisation, so we do not hand-write useMemo / useCallback.
      babel: { plugins: [['babel-plugin-react-compiler', {}]] },
    }),
  ],
  server: {
    port: 5173,
    // `npm run dev` talks to the isolated e2e stack (or any backend) through the same /api path the nginx proxy provides.
    proxy: { '/api': { target: process.env.VITE_API_PROXY ?? 'http://localhost:3300', changeOrigin: true } },
  },
  build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 600 },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    restoreMocks: true,
    testTimeout: 20_000,   // the routing tests render whole screens; under a full parallel run they can pass the 5 s default
  },
});
