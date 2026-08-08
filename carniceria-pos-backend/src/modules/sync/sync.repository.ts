/**
 * modules/sync/sync.repository.ts
 * -----------------------------------------------------------------------------
 * Acceso a datos de la cola de salida (`SyncJob`). Infraestructura pura, sin
 * reglas de negocio (eso vive en `sync.service.ts`/`sync.worker.ts`) — ni
 * siquiera la logica de idempotencia (violacion de `idempotencyKey` unico)
 * vive aca, la decide quien llama.
 */
import { Prisma, type SyncJobStatus } from '@prisma/client';
import { prisma } from '@/database';
import type { DbClient } from '@/database';

export function create(data: Prisma.SyncJobUncheckedCreateInput, db: DbClient = prisma) {
  return db.syncJob.create({ data });
}

/** Trabajos listos para procesar: `PENDING`, o `PROCESSING` abandonados
 * (proceso caido/cerrado a medio intento) hace mas de `staleAfterMs` — ver
 * `sync.worker.ts` para el criterio exacto de "abandonado". Orden FIFO por
 * `createdAt`: no hay razon de negocio para reordenar. */
export function findReadyToProcess(staleAfterMs: number, take: number) {
  const staleThreshold = new Date(Date.now() - staleAfterMs);

  return prisma.syncJob.findMany({
    where: {
      OR: [{ status: 'PENDING' }, { status: 'PROCESSING', updatedAt: { lt: staleThreshold } }],
    },
    orderBy: { createdAt: 'asc' },
    take,
  });
}

export function markProcessing(id: string) {
  return prisma.syncJob.update({
    where: { id },
    data: { status: 'PROCESSING' },
  });
}

export function markSynced(id: string) {
  return prisma.syncJob.update({
    where: { id },
    data: { status: 'SYNCED', lastError: null },
  });
}

export function markFailed(id: string, error: string, attempts: number) {
  return prisma.syncJob.update({
    where: { id },
    data: { status: 'FAILED', lastError: error, attempts },
  });
}

export function countByStatus(sucursalId?: string) {
  return prisma.syncJob.groupBy({
    by: ['status'],
    _count: { _all: true },
    where: sucursalId ? { sucursalId } : undefined,
  });
}

export type { SyncJobStatus };
