/**
 * server.ts
 * -----------------------------------------------------------------------------
 * Punto de entrada del proceso. Verifica la base de datos, arranca el servidor
 * HTTP, inicia las tareas programadas y gestiona el apagado ordenado (graceful
 * shutdown) ante SIGINT/SIGTERM.
 */
import type { Server } from 'node:http';
import { createApp } from './app';
import { env, logger } from '@/config';
import { connectDatabase, disconnectDatabase } from '@/database';
import { startScheduler, stopScheduler } from '@/jobs';
import { startSyncWorker, stopSyncWorker } from '@/modules/sync';

/**
 * Red de seguridad para errores que ocurren FUERA del ciclo request/response
 * (los de dentro ya los captura `asyncHandler` -> `errorHandler.middleware.ts`
 * sin tumbar el proceso). Sin esto, una promesa rechazada sin `.catch()` en
 * cualquier codigo futuro (un job, un `void algo()`) mata el proceso Node de
 * forma silenciosa -- sin log, sin pista de la causa -- y el sintoma que ve
 * el usuario es "el sistema deja de responder y hay que reiniciar".
 *
 * Node ya trata ambos casos como fatales por defecto (crashea el proceso);
 * estos handlers no evitan el crash -- solo lo hacen visible antes de morir,
 * y fuerzan una salida explicita en vez de dejar el proceso en un estado
 * indeterminado.
 */
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'unhandledRejection: promesa rechazada sin manejar.');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'uncaughtException: error no capturado.');
  process.exit(1);
});

async function bootstrap(): Promise<void> {
  await connectDatabase();

  const app = createApp();
  const server: Server = app.listen(env.PORT, () => {
    logger.info(
      `Servidor POS escuchando en http://localhost:${env.PORT}${env.API_PREFIX} (${env.NODE_ENV}).`,
    );
  });

  startScheduler();
  // Worker permanente de la cola de sincronizacion (Bloque 4) — no es un
  // cron, es un bucle propio que se reprograma a si mismo (ver
  // `modules/sync/sync.worker.ts`). `SYNC_ENABLED` sigue el mismo patron
  // de interruptor que `BACKUP_ENABLED`.
  if (env.SYNC_ENABLED) {
    startSyncWorker();
  }

  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`Senal ${signal} recibida. Cerrando de forma ordenada...`);
    stopScheduler();
    // Antes de cerrar el servidor/BD: espera a que cualquier trabajo de
    // sync en curso termine, para no cortarlo a medias (riesgo ya
    // documentado en Bloque 4 contra el orden de apagado de Electron).
    await stopSyncWorker();
    server.close(() => logger.info('Servidor HTTP cerrado.'));
    await disconnectDatabase();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((error) => {
  logger.error({ err: error }, 'Fallo al iniciar la aplicacion.');
  process.exit(1);
});
