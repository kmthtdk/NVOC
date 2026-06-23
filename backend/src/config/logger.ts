import pino from 'pino';
import { env, isProd } from './env.js';

/**
 * Structured logger. Pretty-prints in dev, JSON in prod (for log aggregation).
 */
export const logger = pino({
  level: isProd ? 'info' : 'debug',
  transport: isProd
    ? undefined
    : {
        target: 'pino/file',
        options: { destination: 1 }, // stdout; avoids needing pino-pretty as a dep
      },
  base: { service: 'n-voc-backend', env: env.NODE_ENV },
});
