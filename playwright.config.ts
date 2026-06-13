import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [['html', { outputFolder: 'test-artifacts/reports/playwright-report' }]],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.TEST_URL || 'https://localhost:3128',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    /* Screenshot options */
    screenshot: { mode: 'only-on-failure', fullPage: true },
    
    /* Ignore HTTPS errors for self-signed certificates in development */
    ignoreHTTPSErrors: true,
  },

  /* Where Playwright writes per-test artifacts (videos, screenshots, traces).
   * The showcase report generator reads from here. */
  outputDir: 'test-artifacts/playwright-output',

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'GraphDone-Core/dev-neo4j/chromium',
      // The showcase tour runs in its own capture-heavy project below; keep it
      // out of the default (fast) project so the smoke gate stays quick.
      testIgnore: /showcase\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },

    /* Showcase: records web-friendly .webm video + full-page screenshots of
     * every mode of operation, across the responsive viewport matrix. Run via
     * `npm run report:showcase`. Heavy by design — not part of the smoke gate. */
    {
      name: 'showcase',
      testMatch: /showcase\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        video: 'on',
        screenshot: 'on',
        trace: 'retain-on-failure',
      },
    },

    /* Performance budgets (ADAPT-8). Lives in tests/perf, run via
     * `npm run test:perf`. Reads window.__graphPerf / API latency and asserts
     * budgets. Kept separate from the smoke gate so it can have its own
     * thresholds and run cadence. */
    {
      name: 'perf',
      testDir: './tests/perf',
      use: { ...devices['Desktop Chrome'] },
    },

    // Commented out until browsers installed with system dependencies
    // {
    //   name: 'GraphDone-Core/dev-neo4j/firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // {
    //   name: 'GraphDone-Core/dev-neo4j/webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Auto-start a dev server ONLY for bare local runs. When TEST_URL is set
   * (run-pr-tests, CI, ./start test) the stack is externally managed —
   * webServer must stay off, or CI=true makes Playwright refuse the already
   * -running server ("port is already used") and every suite dies at
   * collection. That one interaction silently killed the whole E2E gate. */
  ...(process.env.TEST_URL
    ? {}
    : {
        webServer: {
          command: 'npm run dev',
          url: 'http://localhost:3127',
          reuseExistingServer: !process.env.CI,
        },
      }),
});