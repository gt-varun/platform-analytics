import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3001,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        // Recharts is the single largest dependency and changes far less often
        // than the dashboard code, so splitting it lets it stay cached across
        // deploys instead of being re-downloaded with every app edit.
        manualChunks: {
          charts: ['recharts'],
        },
      },
    },
  },
});
