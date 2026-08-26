import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@engine': path.resolve(__dirname, './src/engine'),
      '@terrain': path.resolve(__dirname, './src/terrain'),
      '@geo': path.resolve(__dirname, './src/geo'),
      '@ui': path.resolve(__dirname, './src/ui'),
      '@i18n': path.resolve(__dirname, './src/i18n'),
      '@map-bridge': path.resolve(__dirname, './src/map-bridge'),
      '@features': path.resolve(__dirname, './src/features')
    }
  },
  server: {
    port: 8080,
    open: false
  },
  test: {
    globals: true,
    environment: 'node'
  }
} as any);
