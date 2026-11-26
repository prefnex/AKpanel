import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  // Assets are served by the panel under /public/build/, so lazy chunks must resolve there too.
  base: '/public/build/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './resources/js'),
    },
  },
  build: {
    outDir: 'public/build',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        app: resolve(__dirname, 'resources/js/main.jsx'),
      },
      output: {
        entryFileNames: 'app.js',
        // Chunks carry a content hash: an open tab from an older build must never load a chunk
        // from a newer one (export names differ between builds). app.js/app.css stay fixed
        // because dashboard.tmpl references them by name.
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'app.css';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
});
