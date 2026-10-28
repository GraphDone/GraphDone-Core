import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/visual',
  testMatch: 'schematic-browser.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  timeout: 10000,
  outputDir: 'test-artifacts/schematic-browser',
  use: {
    browserName: 'chromium',
    headless: true,
    serviceWorkers: 'block',
    actionTimeout: 3000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
