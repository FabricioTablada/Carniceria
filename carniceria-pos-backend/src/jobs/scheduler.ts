/**
 * jobs/scheduler.ts
 * -----------------------------------------------------------------------------
 * Registra y controla las tareas programadas (node-cron). Se inicia desde
 * server.ts tras arrancar la aplicacion.
 */
import cron, { type ScheduledTask } from 'node-cron';
import { env, logger } from '@/config';
import { runBackupJob } from './backup.job';

const tasks: ScheduledTask[] = [];

export function startScheduler(): void {
  if (env.BACKUP_ENABLED) {
    if (!cron.validate(env.BACKUP_CRON)) {
      logger.error(`Expresion cron de respaldo invalida: "${env.BACKUP_CRON}".`);
    } else {
      const backupTask = cron.schedule(env.BACKUP_CRON, () => {
        void runBackupJob();
      });
      tasks.push(backupTask);
      logger.info(`Respaldo automatico programado: "${env.BACKUP_CRON}".`);
    }
  }

  // La sincronizacion (Bloque 4) NO usa este scheduler de cron — corre
  // como un worker permanente propio (`modules/sync/sync.worker.ts`,
  // iniciado/detenido directamente desde `server.ts`), porque necesita
  // reaccionar de inmediato a un trabajo nuevo o a que vuelva la
  // conectividad, no esperar al proximo tick de un horario fijo.
}

export function stopScheduler(): void {
  for (const task of tasks) {
    task.stop();
  }
  logger.info('Tareas programadas detenidas.');
}
