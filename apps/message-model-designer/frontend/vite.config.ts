import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shell': path.resolve(__dirname, '../../../frontend/react-app/src'),
      '@apps': path.resolve(__dirname, '../../..'),
    },
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'entry.tsx'),
      formats: ['es'],
      fileName: 'entry',
    },
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react-router-dom',
        'react-router',
        'react-icons',
        'react-icons/lu',
        /^@shell\//,
      ],
    },
  },
});
