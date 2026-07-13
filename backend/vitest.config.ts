import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Unit suite only — fast, no Docker. The integration tests live under
    // __tests__/integration and need a real MySQL, so they run from
    // vitest.integration.config.ts (`npm run test:integration`) instead.
    include: ['src/**/*.test.ts'],
    exclude: ['src/__tests__/integration/**'],
    // Satisfy env.ts's zod validation without a real DB. The DB-touching modules
    // are mocked in the tests, so these values are never used to connect.
    env: {
      NODE_ENV: 'test',
      DB_HOST: '127.0.0.1',
      DB_PORT: '3306',
      DB_NAME: 'test',
      DB_USER: 'test',
      DB_PASSWORD: 'test',
      JWT_SECRET: 'test_jwt_secret_at_least_16_chars',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      // See the frontend config: without an explicit `include`, files that no
      // test imports are absent from the report rather than scored 0.
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/types/**', 'src/models/rows.ts', 'src/index.ts'],
      // Real measured floor. Only ticket.controller, approval.engine/service and
      // AppError are exercised; device.repo.ts (887 lines) has zero coverage.
      thresholds: {
        lines: 10,
        functions: 12,
        branches: 10,
        statements: 10,
      },
    },
  },
});
