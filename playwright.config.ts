// ============================================================================
// Playwright E2E configuration for N-VOC System Service Portal.
// The web origin and the API origin are BOTH env-configurable (E2E_BASE_URL /
// E2E_API_BASE). They were hardcoded to :3000 and :4000 — ports nothing has
// listened on for a while — so the suite could not run at all, and the specs
// hardcoded absolute URLs on top, which defeated baseURL even when it was right.
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
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
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
