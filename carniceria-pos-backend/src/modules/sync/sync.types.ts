/**
 * modules/sync/sync.types.ts
 * -----------------------------------------------------------------------------
 * Formas de datos del modulo de sincronizacion (Bloque 4 — cola de salida /
 * outbox). Sin logica: eso vive en `sync.service.ts`/`sync.worker.ts`.
 */
import type { SyncJob, SyncJobStatus, SyncJobType } from '@prisma/client';

export type { SyncJob, SyncJobStatus, SyncJobType };

/** Datos minimos para encolar un trabajo — usado por otros modulos (ej.
 * `modules/sales/service.ts`) dentro de su propia transaccion de Prisma. */
export interface EnqueueSyncJobParams {
  sucursalId: string;
  jobType: SyncJobType;
  entityType: string;
  entityId: string;
  payload?: unknown;
}

/** Contrato que debe cumplir cada handler del dispatcher
 * (`sync.handlers/index.ts`) — uno por `SyncJobType`. */
export interface SyncJobHandler {
  (job: SyncJob): Promise<void>;
}

export interface SyncStatusCounts {
  pending: number;
  processing: number;
  synced: number;
  failed: number;
}
