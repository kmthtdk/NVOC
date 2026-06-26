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
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/index.ts',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/types.ts',
      ],
      // Target: 40%+ overall coverage
      lines: 40,
      functions: 40,
      branches: 35,
      statements: 40,
    },

    // Test file patterns
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'backend/**/*.test.ts'],

    // Exclude patterns
    exclude: ['node_modules', 'dist'],

    // Timeout: 5 seconds per test
    testTimeout: 5000,
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
