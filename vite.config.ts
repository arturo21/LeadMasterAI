import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carga variables de entorno basado en el modo (development/production)
  // Vercel inyecta variables de entorno en el proceso de build.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    define: {
      // Importante: Mapeamos process.env.API_KEY para que el SDK de Gemini funcione
      // sin necesidad de cambiar el código fuente original.
      'process.env.API_KEY': JSON.stringify(env.API_KEY || env.VITE_API_KEY),
      // Definición de seguridad para evitar crashes si se accede a otras vars
      'process.env': {} 
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'esbuild',
    },
    server: {
      port: 3000
    }
  };
});