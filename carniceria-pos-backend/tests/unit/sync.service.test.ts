/**
 * tests/unit/sync.service.test.ts
 * -----------------------------------------------------------------------------
 * Bloque 4 (offline/sync). Cubre `enqueueSyncJob` (modules/sync/sync.service.ts):
 *  - Camino feliz: crea el `SyncJob` con la `idempotencyKey` esperada y
 *    emite la senal de "trabajo encolado" para despertar al worker.
 *  - Idempotencia: una violacion de restriccion unica (P2002, mismo
 *    trabajo ya encolado) se traga en silencio — no es un error real, y
 *    NO debe emitir la senal de nuevo (no hay nada nuevo que procesar).
 *  - Cualquier otro error de Prisma se propaga tal cual.
 *
 * Todas las dependencias externas se mockean — logica de negocio, no
 * integracion con Postgres real (mismo criterio que el resto de la suite).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';

vi.mock('@/database', () => ({
  prisma: {},
}));

vi.mock('@/modules/sync/sync.repository', () => ({
  create: vi.fn(),
}));

import * as syncRepository from '@/modules/sync/sync.repository';
import { syncEvents, SYNC_JOB_ENQUEUED_EVENT } from '@/modules/sync/sync.events';
import { enqueueSyncJob } from '@/modules/sync/sync.service';

describe('enqueueSyncJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    syncEvents.removeAllListeners(SYNC_JOB_ENQUEUED_EVENT);
  });

  it('crea el SyncJob con la idempotencyKey determinista y emite la senal de encolado', async () => {
    vi.mocked(syncRepository.create).mockResolvedValue({} as never);
    const listener = vi.fn();
    syncEvents.on(SYNC_JOB_ENQUEUED_EVENT, listener);

    await enqueueSyncJob({
      sucursalId: 'sucursal-1',
      jobType: 'CLOUD_PUSH',
      entityType: 'Sale',
      entityId: 'sale-1',
    });

    expect(syncRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        sucursalId: 'sucursal-1',
        jobType: 'CLOUD_PUSH',
        entityType: 'Sale',
        entityId: 'sale-1',
        idempotencyKey: 'CLOUD_PUSH:Sale:sale-1',
      }),
      expect.anything(),
    );
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('trabajo ya encolado (P2002): no lanza error y no emite la senal', async () => {
    vi.mocked(syncRepository.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    const listener = vi.fn();
    syncEvents.on(SYNC_JOB_ENQUEUED_EVENT, listener);

    await expect(
      enqueueSyncJob({
        sucursalId: 'sucursal-1',
        jobType: 'CLOUD_PUSH',
        entityType: 'Sale',
        entityId: 'sale-1',
      }),
    ).resolves.toBeUndefined();

    expect(listener).not.toHaveBeenCalled();
  });

  it('cualquier otro error de Prisma se propaga', async () => {
    vi.mocked(syncRepository.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Otra falla', {
        code: 'P2025',
        clientVersion: 'test',
      }),
    );

    await expect(
      enqueueSyncJob({
        sucursalId: 'sucursal-1',
        jobType: 'CLOUD_PUSH',
        entityType: 'Sale',
        entityId: 'sale-1',
      }),
    ).rejects.toThrow();
  });
});
