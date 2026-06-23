import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { assertDbConnection, closePool } from './config/db.js';

async function bootstrap(): Promise<void> {
  // Fail fast if the database is unreachable.
  await assertDbConnection();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`N-VOC backend listening on :${env.PORT} (${env.NODE_ENV})`);
  });

  // Graceful shutdown — drain HTTP, then close the pool.
  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down...`);
    server.close(async () => {
      await closePool();
      logger.info('Shutdown complete');
      process.exit(0);
    });
    // Force-exit if graceful close hangs.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Failed to start server');
  process.exit(1);
});
