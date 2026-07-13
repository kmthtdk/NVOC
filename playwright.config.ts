// ============================================================================
// Playwright E2E configuration for N-VOC System Service Portal.
// Targets the Vite dev server on port 3000 (backend proxy on port 4000).
// Separate projects for Admin and Requester roles using stored auth state.
// Note: uses import.meta.url instead of __dirname because package.json has
// "type": "module" (ESM project).
// ============================================================================

import { defineConfig, devices } from '@playwright/test';


export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },

  // Single worker keeps DB state predictable across sequential workflow tests.
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'playwright-results.xml' }],
  ],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: true,
    viewport: { width: 1280, height: 720 },
  },

  projects: [
    // Phase 1: authenticate both roles and persist browser storage state.
    {
      name: 'setup',
      testMatch: '**/global.setup.ts',
    },

    // Phase 2: run the four workflow suites with stored auth.
    {
      name: 'e2e',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/*.spec.ts',
    },
  ],
});
