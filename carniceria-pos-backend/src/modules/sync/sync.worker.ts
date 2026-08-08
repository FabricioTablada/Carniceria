/**
 * modules/sync/sync.worker.ts
 * -----------------------------------------------------------------------------
 * Worker permanente de la cola de sincronizacion (Bloque 4, observacion 1):
 * un `node-cron` de intervalo fijo esperaria hasta su proximo tick para
 * retomar trabajos pendientes despues de que vuelva la conectividad — este
 * worker en cambio es un bucle que se reprograma a si mismo, y:
 *
 * - Se despierta DE INMEDIATO cuando se encola un trabajo nuevo
 *   (`sync.events.ts`), sin esperar ningun intervalo.
 * - Mientras haya trabajo real que procesar, encadena ciclos sin demora
 *   (drena la cola lo mas rapido posible).
 * - Si la cola esta vacia, entra en espera larga (`IDLE_DELAY_MS`).
 * - Si hay trabajos pero fallan todos (tipicamente: sin conectividad),
 *   aplica backoff exponencial acotado (`FAILURE_BACKOFF_MS`) para no
 *   insistir a un destino que ya sabemos que no responde ahora mismo, sin
 *   dejar de reintentar.
 *
 * Deliberadamente NO intenta detectar "se fue/volvio Internet" con eventos
 * del sistema operativo (fragil, especifico de plataforma) — el propio
 * intento real de procesar cada trabajo (via el handler del dispatcher) ES
 * la deteccion de conectividad.
 */
import { logger } from '@/config';
import * as syncRepository from './sync.repository';
import { getSyncJobHandler } from './sync.handlers';
import { SYNC_JOB_ENQUEUED_EVENT, syncEvents } from './sync.events';

const IDLE_DELAY_MS = 30_000;
const FAILURE_BACKOFF_MS = [5_000, 15_000, 30_000, 60_000];
const STALE_PROCESSING_MS = 5 * 60 * 1000;
const BATCH_SIZE = 25;

class SyncWorker {
  private timer: NodeJS.Timeout | null = null;
  private stopped = true;
  private currentCycle: Promise<void> | null = null;
  private consecutiveAllFailedCycles = 0;

  private readonly onEnqueued = (): void => {
    if (this.stopped) return;
    // Cancela la espera actual (idle o backoff) y retoma ya mismo.
    if (this.timer) clearTimeout(this.timer);
    this.scheduleNext(0);
  };

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    syncEvents.on(SYNC_JOB_ENQUEUED_EVENT, this.onEnqueued);
    // Pasada de recuperacion inmediata al arrancar: retoma trabajos que
    // quedaron PENDING o PROCESSING-abandonados de una corrida anterior
    // (ver `sync.repository.ts::findReadyToProcess`).
    this.scheduleNext(0);
    logger.info('Sync worker: iniciado.');
  }

  async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    syncEvents.off(SYNC_JOB_ENQUEUED_EVENT, this.onEnqueued);
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    // Espera a que el ciclo en curso (si lo hay) termine de procesar el
    // trabajo actual antes de resolver — evita cortar un trabajo a medias
    // cuando el proceso se cierra (ver antes-de-antes: antes-quit de
    // Electron detiene el backend antes que Postgres).
    if (this.currentCycle) await this.currentCycle;
    logger.info('Sync worker: detenido.');
  }

  private scheduleNext(delayMs: number): void {
    this.timer = setTimeout(() => {
      this.currentCycle = this.runCycle();
      void this.currentCycle.finally(() => {
        this.currentCycle = null;
      });
    }, delayMs);
  }

  private async runCycle(): Promise<void> {
    if (this.stopped) return;

    const jobs = await syncRepository.findReadyToProcess(STALE_PROCESSING_MS, BATCH_SIZE);

    if (jobs.length === 0) {
      this.consecutiveAllFailedCycles = 0;
      if (!this.stopped) this.scheduleNext(IDLE_DELAY_MS);
      return;
    }

    let anySucceeded = false;
    for (const job of jobs) {
      if (this.stopped) break;

      await syncRepository.markProcessing(job.id);
      try {
        const handler = getSyncJobHandler(job.jobType);
        await handler(job);
        await syncRepository.markSynced(job.id);
        anySucceeded = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await syncRepository.markFailed(job.id, message, job.attempts + 1);
        logger.warn(
          { syncJobId: job.id, jobType: job.jobType, attempts: job.attempts + 1, err: message },
          'Sync: intento de trabajo fallido, reintentara en el proximo ciclo.',
        );
      }
    }

    if (this.stopped) return;

    if (anySucceeded) {
      // Hubo progreso real: probablemente hay conectividad ahora — drena
      // el resto de la cola sin demora en vez de esperar.
      this.consecutiveAllFailedCycles = 0;
      this.scheduleNext(0);
    } else {
      // El ciclo entero fallo (tipicamente: sin conectividad) — backoff
      // exponencial acotado antes de volver a intentar.
      const delay =
        FAILURE_BACKOFF_MS[Math.min(this.consecutiveAllFailedCycles, FAILURE_BACKOFF_MS.length - 1)];
      this.consecutiveAllFailedCycles += 1;
      this.scheduleNext(delay);
    }
  }
}

const syncWorker = new SyncWorker();

export function startSyncWorker(): void {
  syncWorker.start();
}

export function stopSyncWorker(): Promise<void> {
  return syncWorker.stop();
}
