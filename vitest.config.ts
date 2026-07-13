import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Use jsdom for DOM testing in React components
    environment: 'jsdom',

    // Global test setup
    globals: true,

    // Setup files
    setupFiles: ['./src/test/setup.ts'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      // Without an explicit `include`, v8 only counts files a test actually
      // imports — untested files vanish from the report instead of scoring 0,
      // which made the old headline (~60%) a measure of one file, not the app.
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/index.ts',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/types.ts',
        'src/test/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
      ],
      // Thresholds must live under `thresholds` — Vitest 2+ ignores them at the
      // top level, so the previous 40/35 numbers were never actually enforced.
      // These are set to the real measured floor so the build fails on a
      // regression; raise them as coverage is added (project standard: 80).
      // Real measured coverage as of 2026-07-13: 5.94% lines. api/client.ts and
      // StatusDashboard are exercised; the other 19 components are not. This is
      // the honest floor, not the goal — the project standard is 80.
      thresholds: {
        lines: 5,
        functions: 6,
        branches: 3,
        statements: 5,
      },
    },

    // Test file patterns — only our src/test files, never node_modules
    include: ['src/test/**/*.test.ts', 'src/test/**/*.test.tsx'],

    // Exclude patterns — be explicit
    exclude: ['node_modules/**', 'dist/**', 'backend/**'],

    // Timeout: 5 seconds per test
    testTimeout: 5000,
  },

  resolve: {
    alias: {
      // Must match vite.config.ts and tsconfig.json, which both map '@' to the
      // project root. Pointing it at ./src here would resolve under Vitest but
      // break the Vite build for the same import.
      '@': path.resolve(__dirname, '.'),
    },
  },
});
