import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, path.resolve(__dirname, '.'), '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            const normalized = id.replace(/\\/g, '/');
            if (
              normalized.includes('/node_modules/react/')
              || normalized.includes('/node_modules/react-dom/')
              || normalized.includes('/node_modules/scheduler/')
              || normalized.includes('/node_modules/react-router/')
              || normalized.includes('/node_modules/react-router-dom/')
            ) return 'react-vendor';
            if (id.includes('framer-motion') || id.includes('motion')) return 'motion-vendor';
            if (id.includes('recharts')) return 'charts-vendor';
            if (id.includes('lucide-react')) return 'icons-vendor';
            return undefined;
          },
        },
      },
    },
  };
});
