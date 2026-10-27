import { offlineShell } from './offline-shell';
import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { hostname } from 'os';
import { readFileSync } from 'fs';
import { existsSync } from 'fs';

export default defineConfig({
  plugins: [react(), offlineShell()],
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
      '/config': { target: process.env.VITE_PROXY_TARGET || 'http://localhost:4127', changeOrigin: true },
      '/auth': { target: process.env.VITE_PROXY_TARGET || 'http://localhost:4127', changeOrigin: true },
      '/api/captcha': { target: process.env.VITE_PROXY_TARGET || 'http://localhost:4127', changeOrigin: true },
      // apollo.ts uses the nginx-style /api/graphql path; map it in dev too
      '/api/ops': { target: process.env.VITE_PROXY_TARGET || 'http://localhost:4127', changeOrigin: true },
      '/api/sync': { target: process.env.VITE_PROXY_TARGET || 'http://localhost:8797', changeOrigin: true },
      '/api/agent': { target: process.env.VITE_PROXY_TARGET || 'http://localhost:4127', changeOrigin: true, secure: false },
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
    target: ['es2020', 'chrome87', 'edge88', 'firefox78', 'safari14'],
    // No production source maps — serving .js.map publicly leaks original source.
    // Caught by the live red-team (REDTEAM-SEC). Dev uses the Vite dev server
    // (its own maps), so debugging is unaffected.
    sourcemap: false,
    rollupOptions: {
      output: {
        // Split heavy vendors into separate, independently-cacheable chunks so the
        // entry isn't one monolithic ~1.5MB file (live-audit perf finding).
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          apollo: ['@apollo/client', 'graphql'],
          d3: ['d3'],
          icons: ['lucide-react'],
        },
        // Force new filenames to break cache
        entryFileNames: `assets/[name]-${Date.now()}.js`,
        chunkFileNames: `assets/[name]-${Date.now()}.js`,
        assetFileNames: `assets/[name]-${Date.now()}.[ext]`
      }
    }
  },
  test: {
    maxWorkers: 2,
    exclude: [...configDefaults.exclude, '**/dist/**'],
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}', 'offline-shell.ts'],
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.config.ts'
      ]
    }
  }
});
