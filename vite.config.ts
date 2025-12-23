
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Em produção, buscamos a chave do window (injetada pelo servidor)
      // Em desenvolvimento, usamos o JSON.stringify do env local
      'process.env.API_KEY': mode === 'production' ? 'window.API_KEY' : JSON.stringify(env.API_KEY || ''),
      'process.env.GOOGLE_CLIENT_ID': mode === 'production' ? 'window.GOOGLE_CLIENT_ID' : JSON.stringify(env.GOOGLE_CLIENT_ID || ''),
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
