import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { hostname } from 'os';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@graphdone/core': resolve(__dirname, '../core/src')
    }
  },
  server: {
    host: '0.0.0.0', // Allow external connections
    port: Number(process.env.PORT) || 3127,
    strictPort: true, // Exit if port is already in use instead of trying next available
    allowedHosts: ['localhost', hostname(), '*.local', '.tailscale'], // Auto-detect hostname + common patterns
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    },
    proxy: {
      '/graphql': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:4127',
        changeOrigin: true
      },
      '/health': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:4127',
        changeOrigin: true
      },
      '/mcp': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:4127',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        // Force new filenames to break cache
        entryFileNames: `assets/[name]-${Date.now()}.js`,
        chunkFileNames: `assets/[name]-${Date.now()}.js`,
        assetFileNames: `assets/[name]-${Date.now()}.[ext]`
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.config.ts'
      ]
    }
  }
});