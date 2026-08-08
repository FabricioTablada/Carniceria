/**
 * modules/sync/sync.events.ts
 * -----------------------------------------------------------------------------
 * Senal en memoria, dentro del mismo proceso, para que encolar un trabajo
 * (`sync.service.ts::enqueueSyncJob`) despierte inmediatamente al worker
 * (`sync.worker.ts`) sin esperar su proximo ciclo — ver Bloque 4,
 * observacion 1 (worker permanente en vez de cron periodico).
 */
import { EventEmitter } from 'node:events';

export const syncEvents = new EventEmitter();
export const SYNC_JOB_ENQUEUED_EVENT = 'job-enqueued';
