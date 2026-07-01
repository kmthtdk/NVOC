import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
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
  },
});
