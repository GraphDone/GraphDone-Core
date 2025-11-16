import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config specifically for testing the demo server
 * Does NOT start a local dev server - tests against the deployed instance
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/demo-guest-login.spec.ts',

  fullyParallel: false,
  retries: 0,
  workers: 1,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'test-artifacts/reports/demo-report' }]
  ],

  use: {
    trace: 'on',
    screenshot: 'on',
    video: 'on',
  },

  projects: [
    {
      name: 'demo-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // DO NOT start a webServer - we're testing the remote deployed instance
});
