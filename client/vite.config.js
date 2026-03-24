import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';

  // 🛡️ SECURITY FIX: Suppress build logs in CI/CD pipelines to prevent fingerprinting
  if (!isProd) {
    console.log(`\n🔍 [CS2-VETO] Build Context: ${mode.toUpperCase()}`);
  }

  return {
    // Explicitly define the base path to prevent asset 404s if deployed to a subfolder
    base: '/',
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src")
      },
    },
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          secure: false, // ⚠️ DEV ONLY: Bypasses self-signed TLS errors during local dev
        },
        '/socket.io': {
          target: 'http://localhost:3001',
          ws: true,
          changeOrigin: true, // 🛡️ ARCHITECTURE FIX: Inject host header to pass backend CORS
        },
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: !isProd, // Disabled in production to prevent source code leaks
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          // 🛡️ RELIABILITY FIX: Removed manualChunks to prevent 'createContext' undefined errors 
          // caused by chunk isolation in React 19 + React Router 7 environments.
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/setupTests.js',
      css: false,
    },
    plugins: [react()],
  };
});
