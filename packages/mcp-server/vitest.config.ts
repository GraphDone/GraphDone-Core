import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 30000, // Increase timeout for chaos tests from default 5000ms
    pool: 'forks', // Use forked processes for better isolation
    poolOptions: {
      forks: {
        singleFork: false, // Allow parallel execution
        isolate: true, // Isolate each test file
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
      ],
    },
  },
});