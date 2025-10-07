// Playwright E2E Test Configuration
// Constitutional Compliance: 1280x1024 resolution enforced for all tests

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    // Base URL for tests
    baseURL: 'http://localhost:6060',

    // Constitutional requirement: 1280x1024 resolution
    viewport: { width: 1280, height: 1024 },

    // Trace on first retry
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Override viewport to constitutional requirement
        viewport: { width: 1280, height: 1024 },
      },
    },
  ],

  // Development server
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:6060',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
