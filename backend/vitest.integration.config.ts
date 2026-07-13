import { defineConfig } from 'vitest/config';

/**
 * Integration suite — runs against a real MySQL 8.4 container (see
 * src/__tests__/integration/setup-db.ts). Separate from the unit config because
 * it needs Docker and is slower; `npm test` stays fast, `npm run test:integration`
 * is the one that actually executes the SQL.
 */
export default defineConfig({
  test: {
    environment: 'node',
    // Everything: the mocked unit tests AND the integration tests. Running them
    // together is what produces one honest coverage number instead of two
    // partial ones that each flatter a different half of the codebase.
    include: ['src/__tests__/**/*.test.ts'],
    globalSetup: ['src/__tests__/integration/setup-db.ts'],
    // The repos share one module-level pool; parallel files would race on the
    // same rows (device codes, ticket sequence). Run them serially.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 180_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/__tests__/**', 'src/types/**', 'src/models/rows.ts', 'src/index.ts'],
      // Real measured floor for unit + integration together, counting every file
      // (2026-07-13): 27.1% lines, up from 10.4% when every repo was mocked.
      // Note the trap: without the `include` above, v8 only counts files a test
      // imports and this reads ~40% — the same flattering-by-omission bug the
      // frontend config had. Raise these as the device/report surface gets
      // covered; project standard is 80.
      thresholds: {
        lines: 26,
        functions: 33,
        branches: 25,
        statements: 26,
      },
    },
    env: {
      NODE_ENV: 'test',
      DB_HOST: '127.0.0.1',
      DB_PORT: '33061',
      DB_NAME: 'voc_test',
      DB_USER: 'root',
      DB_PASSWORD: '',
      JWT_SECRET: 'integration_test_secret_at_least_16_chars',
    },
  },
});
