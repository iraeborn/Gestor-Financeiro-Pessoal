
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Fix: Property 'cwd' does not exist on type 'Process'.
  // Accessing cwd() from the process global with a type assertion to any as this file runs in a Node.js environment.
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      'process.env.GOOGLE_CLIENT_ID': JSON.stringify(env.GOOGLE_CLIENT_ID),
      'process.env.NODE_ENV': JSON.stringify(mode)
    },
    build: {
      outDir: 'dist',
      sourcemap: mode === 'development',
      chunkSizeWarningLimit: 1600,
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true
        },
        '/socket.io': {
          target: 'http://localhost:8080',
          ws: true
        }
      }
    }
  };
});
