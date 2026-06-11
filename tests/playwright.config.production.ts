import { defineConfig, devices } from '@playwright/test';

/**
 * Production-aware Playwright Configuration
 * This configuration is designed to test against the production deployment
 * running at https://localhost:3128
 */
export default defineConfig({
  testDir: './tests/e2e',
  
  /* Run tests in files in parallel */
  fullyParallel: true,
  
  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,
  
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 1,
  
  /* Opt out of parallel tests on CI */
  workers: process.env.CI ? 1 : undefined,
  
  /* Reporter to use */
  reporter: [
    ['html', { outputFolder: 'test-results/html-report' }],
    ['list'],
    ['junit', { outputFile: 'test-results/junit-results.xml' }]
  ],
  
  /* Shared settings for all the projects below */
  use: {
    /* Base URL for production deployment */
    baseURL: 'https://localhost:3128',
    
    /* Collect trace when retrying the failed test */
    trace: 'retain-on-failure',
    
    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
    
    /* Accept self-signed certificates for local HTTPS testing */
    ignoreHTTPSErrors: true,
    
    /* Increase timeouts for production environment */
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  /* Test timeout for production testing */
  timeout: 120000,
  expect: {
    timeout: 15000
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'GraphDone-Production/chromium',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 }
      },
    },

    {
      name: 'GraphDone-Production/firefox',
      use: { 
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 720 }
      },
    },

    {
      name: 'GraphDone-Production/webkit',
      use: { 
        ...devices['Desktop Safari'],
        viewport: { width: 1280, height: 720 }
      },
    },

    /* Test against mobile viewports */
    {
      name: 'GraphDone-Production/Mobile Chrome',
      use: { 
        ...devices['Pixel 5'],
      },
    },
    {
      name: 'GraphDone-Production/Mobile Safari',
      use: { 
        ...devices['iPhone 12'],
      },
    },
  ],

  /* Global test setup */
  globalSetup: require.resolve('./tests/global-setup-production.js'),
  
  /* Output directory */
  outputDir: 'test-results/',
});

/* Environment-specific configuration */
if (process.env.TEST_ENV === 'production') {
  console.log('🌐 Running E2E tests against production deployment (https://localhost:3128)');
} else {
  console.log('⚠️  Using production config but TEST_ENV not set to production');
}