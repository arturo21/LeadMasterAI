import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  let safeCwd;
  try {
    safeCwd = (process as any).cwd();
  } catch (e) {
    safeCwd = process.env.PWD || '.';
  }

  const env = loadEnv(mode, safeCwd, '');

  return {
    plugins: [react()],
    // CRUCIAL PARA SHARED HOSTING:
    // Permite que la app corra en subdirectorios y resuelve rutas relativas.
    base: './', 
    define: {
      // Inyectamos SOLO la API KEY. No sobrescribimos todo process.env
      'process.env.API_KEY': JSON.stringify(env.API_KEY || env.VITE_API_KEY),
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'esbuild',
      emptyOutDir: true,
    },
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
        }
      }
    }
  };
});