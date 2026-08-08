/**
 * config/logger.ts
 * -----------------------------------------------------------------------------
 * Logger estructurado basado en pino. En desarrollo usa pino-pretty para una
 * salida legible; en produccion emite JSON (ideal para agregadores de logs).
 *
 * Este es el UNICO logger de la aplicacion. Ningun archivo debe usar
 * `console.log` para trazas de operacion.
 */
import pino from 'pino';
import { env, isDevelopment } from './env';

export const logger = pino({
  level: env.LOG_LEVEL,
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  base: {
    sucursalId: env.SUCURSAL_ID,
  },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie'],
    censor: '[REDACTED]',
  },
});

export type Logger = typeof logger;
