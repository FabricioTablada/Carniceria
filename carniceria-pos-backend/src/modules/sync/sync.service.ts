/**
 * modules/sync/sync.service.ts
 * -----------------------------------------------------------------------------
 * Logica de negocio del modulo de sincronizacion. `enqueueSyncJob` es lo que
 * otros modulos llaman (ej. `modules/sales/service.ts`) dentro de su propia
 * transaccion de Prisma, para encolar un trabajo atomicamente junto con el
 * dato de negocio que lo origina (patron outbox).
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/database';
import type { DbClient } from '@/database';
import { logger } from '@/config';
import * as syncRepository from './sync.repository';
import { SYNC_JOB_ENQUEUED_EVENT, syncEvents } from './sync.events';
import type { EnqueueSyncJobParams, SyncStatusCounts } from './sync.types';

/** Idempotente: si ya existe un trabajo con la misma `idempotencyKey`
 * (mismo `jobType`+`entityType`+`entityId`), no crea uno nuevo — evita
 * duplicados si el mutation que origina esto se reintenta (frontend, o un
 * "reintentar" manual). La violacion de la restriccion unica (P2002) es el
 * mecanismo de deduplicacion, no un error real. */
export async function enqueueSyncJob(params: EnqueueSyncJobParams, db: DbClient = prisma): Promise<void> {
  const idempotencyKey = `${params.jobType}:${params.entityType}:${params.entityId}`;

  try {
    await syncRepository.create(
      {
        sucursalId: params.sucursalId,
        jobType: params.jobType,
        entityType: params.entityType,
        entityId: params.entityId,
        payload: params.payload === undefined ? Prisma.JsonNull : (params.payload as Prisma.InputJsonValue),
        idempotencyKey,
      },
      db,
    );
    // Puede emitirse un instante antes de que la transaccion externa (si
    // `db` es un `tx`) haga commit — el worker en ese caso simplemente no
    // encuentra nada todavia y vuelve a quedar en espera; el ciclo de
    // fallback (`sync.worker.ts`, IDLE_DELAY_MS) igual lo recoge poco
    // despues. Sin impacto de correctitud, solo una espera minima extra.
    syncEvents.emit(SYNC_JOB_ENQUEUED_EVENT);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      logger.debug({ idempotencyKey }, 'Sync: trabajo ya encolado, se omite (idempotente).');
      return;
    }
    throw error;
  }
}

export async function getSyncStatusCounts(sucursalId?: string): Promise<SyncStatusCounts> {
  const grouped = await syncRepository.countByStatus(sucursalId);

  const counts: SyncStatusCounts = { pending: 0, processing: 0, synced: 0, failed: 0 };
  for (const row of grouped) {
    const key = row.status.toLowerCase() as keyof SyncStatusCounts;
    counts[key] = row._count._all;
  }
  return counts;
}
