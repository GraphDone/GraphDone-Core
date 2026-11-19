import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

process.env.TEST_URL ||= 'http://localhost:3127';
process.env.VISUAL_RUN_ID ||= new Date().toISOString().replace(/[:.]/g, '-');
const runId = process.env.VISUAL_RUN_ID;
const runDir = resolve('test-artifacts/reports/visual-regression', runId);
const storageState = resolve(runDir, 'playwright-output', 'visual-auth.json');
const fixturePath = resolve(runDir, 'playwright-output', 'fixture-id');

export default defineConfig({
  testDir: '.',
  fullyParallel: true,
  workers: 4,
  retries: 0,
  forbidOnly: true,
  outputDir: resolve(runDir, 'playwright-output'),
  metadata: { screenshotDir: resolve('test-artifacts/visual-regression', runId) },
  reporter: [['line'], ['html', { outputFolder: resolve(runDir, 'report'), open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.TEST_URL,
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'visual-setup',
      testMatch: 'visual.setup.ts',
      metadata: { storageState, fixturePath },
      teardown: 'visual-teardown',
    },
    {
      name: 'visual-regression',
      testMatch: 'visual-regression.spec.ts',
      dependencies: ['visual-setup'],
      use: { storageState },
    },
    {
      name: 'visual-teardown',
      testMatch: 'visual.teardown.ts',
      metadata: { fixturePath },
      use: { storageState },
    },
  ],
});
