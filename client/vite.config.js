import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';

  console.log(`\n🔍 [CS2-VETO] Build Context: ${mode.toUpperCase()}`);

  return {
    // 🛡️ ARCHITECTURE FIX: Absolute path resolution for clean imports
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src")
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      // 🛡️ INFRASTRUCTURE FIX: Proxy API and WebSockets to Express backend
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
        },
        '/socket.io': {
          target: 'http://localhost:3001',
          ws: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: !isProd, // Disabled in production to prevent source code leaks
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          // 🛡️ PERFORMANCE FIX: Hyper-Granular Chunking (L3 Caching Strategy)
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom')) return 'vendor-react';
              if (id.includes('socket.io-client') || id.includes('engine.io-client')) return 'vendor-socket';
              return 'vendor-core';
            }
          },
        },
      },
    },
    // 🛡️ SECURITY FIX: Vitest Environment Gate (Unblocks the test suite)
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/setupTests.js',
      css: false, // Disable CSS processing in tests for execution speed
    },
    plugins: [react()],
  };
});
