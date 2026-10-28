import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/integration', testMatch: 'captcha-browser.spec.ts',
  workers: 1, retries: 0, timeout: 60000, forbidOnly: true,
  outputDir: 'test-artifacts/captcha-browser', reporter: [['line']],
  use: {
    ...devices['Desktop Chrome'], baseURL: process.env.TEST_URL,
    ...(process.env.QC_BROWSER_PORT ? { channel: 'chrome', launchOptions: { args: [`--remote-debugging-port=${process.env.QC_BROWSER_PORT}`] } } : {}),
    screenshot: 'only-on-failure', trace: 'retain-on-failure',
  },
});
