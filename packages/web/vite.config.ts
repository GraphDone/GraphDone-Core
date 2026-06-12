import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { hostname } from 'os';
import { readFileSync } from 'fs';
import { existsSync } from 'fs';

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
    https: process.env.VITE_HTTPS === 'true' ? (() => {
      const certPath = resolve(__dirname, '../../deployment/certs/server-cert.pem');
      const keyPath = resolve(__dirname, '../../deployment/certs/server-key.pem');

      if (existsSync(certPath) && existsSync(keyPath)) {
        return {
          cert: readFileSync(certPath),
          key: readFileSync(keyPath)
        };
      }
      return false;
    })() : undefined,
    allowedHosts: ['localhost', hostname(), '*.local', '.tailscale', '*.ts.net', '.chocolate-perch.ts.net'], // Auto-detect hostname + common patterns + Tailscale
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    },
    proxy: {
      // apollo.ts uses the nginx-style /api/graphql path; map it in dev too
      '/api/graphql': {
        target: process.env.VITE_PROXY_TARGET || (process.env.VITE_HTTPS === 'true' ? 'https://localhost:4128' : 'http://localhost:4127'),
        changeOrigin: true,
        secure: false,
        ws: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      '/graphql': {
        target: process.env.VITE_PROXY_TARGET || (process.env.VITE_HTTPS === 'true' ? 'https://localhost:4128' : 'http://localhost:4127'),
        changeOrigin: true,
        secure: false
      },
      '/health': {
        target: process.env.VITE_PROXY_TARGET || (process.env.VITE_HTTPS === 'true' ? 'https://localhost:4128' : 'http://localhost:4127'),
        changeOrigin: true,
        secure: false
      },
      '/mcp': {
        target: process.env.VITE_PROXY_TARGET || (process.env.VITE_HTTPS === 'true' ? 'https://localhost:4128' : 'http://localhost:4127'),
        changeOrigin: true,
        secure: false
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
