/**
 * tests/unit/sync.worker.test.ts
 * -----------------------------------------------------------------------------
 * Bloque 4 (offline/sync), observacion 1 del usuario: el worker debe
 * reaccionar de inmediato, no esperar un intervalo de cron. Cubre
 * `sync.worker.ts`:
 *  - Cola vacia: entra en espera larga (IDLE_DELAY_MS) antes de volver a
 *    consultar.
 *  - Trabajo exitoso: `markProcessing` -> handler -> `markSynced`, y
 *    encadena el siguiente ciclo SIN demora (drena rapido).
 *  - Trabajo fallido: `markFailed` con `attempts` incrementado, y aplica
 *    backoff (no vuelve a intentar antes del retraso esperado).
 *  - `stop()` detiene el bucle — no hay mas llamadas despues.
 *
 * Usa timers falsos: nada de este test espera tiempo real. Cada avance de
 * timer se hace con un `advanceTimersByTimeAsync(N)` de N>0 explicito (no
 * `(0)`): un solo avance no-cero fire+espera de forma confiable la cadena
 * async completa de un timer ya vencido, incluido el `setTimeout` que ese
 * mismo ciclo pueda reprogramar — es el paso minimo determinista para
 * probar el encadenamiento sin acoplarse a detalles internos de los fake
 * timers frente a timers de delay=0 reprogramados a mitad de otro tick.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/database', () => ({ prisma: {} }));

vi.mock('@/modules/sync/sync.repository', () => ({
  findReadyToProcess: vi.fn(),
  markProcessing: vi.fn(),
  markSynced: vi.fn(),
  markFailed: vi.fn(),
}));

vi.mock('@/modules/sync/sync.handlers', () => ({
  getSyncJobHandler: vi.fn(),
}));

import * as syncRepository from '@/modules/sync/sync.repository';
import { getSyncJobHandler } from '@/modules/sync/sync.handlers';
import { startSyncWorker, stopSyncWorker } from '@/modules/sync/sync.worker';

const IDLE_DELAY_MS = 30_000;
const FIRST_BACKOFF_MS = 5_000;

function buildJob(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'job-1',
    sucursalId: 'sucursal-1',
    jobType: 'CLOUD_PUSH',
    entityType: 'Sale',
    entityId: 'sale-1',
    payload: null,
    idempotencyKey: 'CLOUD_PUSH:Sale:sale-1',
    status: 'PENDING',
    attempts: 0,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('sync worker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    vi.mocked(syncRepository.markProcessing).mockResolvedValue(undefined as never);
    vi.mocked(syncRepository.markSynced).mockResolvedValue(undefined as never);
    vi.mocked(syncRepository.markFailed).mockResolvedValue(undefined as never);
  });

  afterEach(async () => {
    await stopSyncWorker();
    vi.useRealTimers();
  });

  it('cola vacia: no vuelve a consultar antes de IDLE_DELAY_MS', async () => {
    vi.mocked(syncRepository.findReadyToProcess).mockResolvedValue([]);

    startSyncWorker();
    await vi.advanceTimersByTimeAsync(1); // pasada de arranque

    expect(syncRepository.findReadyToProcess).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(IDLE_DELAY_MS / 2);
    expect(syncRepository.findReadyToProcess).toHaveBeenCalledTimes(1); // sigue dentro de la espera

    await vi.advanceTimersByTimeAsync(IDLE_DELAY_MS); // cruza de sobra el resto de la espera
    expect(syncRepository.findReadyToProcess).toHaveBeenCalledTimes(2);
  });

  it('trabajo exitoso: markProcessing -> handler -> markSynced, y encadena sin demora', async () => {
    const job = buildJob();
    vi.mocked(syncRepository.findReadyToProcess)
      .mockResolvedValueOnce([job as never])
      .mockResolvedValueOnce([]);
    const handler = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getSyncJobHandler).mockReturnValue(handler);

    startSyncWorker();
    await vi.advanceTimersByTimeAsync(1); // ciclo 1: procesa el trabajo

    expect(syncRepository.markProcessing).toHaveBeenCalledWith('job-1');
    expect(handler).toHaveBeenCalledWith(job);
    expect(syncRepository.markSynced).toHaveBeenCalledWith('job-1');
    expect(syncRepository.markFailed).not.toHaveBeenCalled();

    // Progreso real -> siguiente ciclo sin demora, no espera IDLE_DELAY_MS.
    await vi.advanceTimersByTimeAsync(1); // ciclo 2: encadenado
    expect(syncRepository.findReadyToProcess).toHaveBeenCalledTimes(2);
  });

  it('trabajo fallido: markFailed con attempts incrementado, aplica backoff', async () => {
    const job = buildJob({ attempts: 2 });
    vi.mocked(syncRepository.findReadyToProcess)
      .mockResolvedValueOnce([job as never])
      .mockResolvedValueOnce([]);
    const handler = vi.fn().mockRejectedValue(new Error('sin conectividad'));
    vi.mocked(getSyncJobHandler).mockReturnValue(handler);

    startSyncWorker();
    await vi.advanceTimersByTimeAsync(1); // ciclo 1: falla

    expect(syncRepository.markFailed).toHaveBeenCalledWith('job-1', 'sin conectividad', 3);
    expect(syncRepository.markSynced).not.toHaveBeenCalled();

    // Backoff: no reintenta de inmediato.
    await vi.advanceTimersByTimeAsync(FIRST_BACKOFF_MS / 2);
    expect(syncRepository.findReadyToProcess).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(FIRST_BACKOFF_MS); // cruza de sobra el resto del backoff
    expect(syncRepository.findReadyToProcess).toHaveBeenCalledTimes(2);
  });

  it('stop() detiene el bucle: no hay mas llamadas despues', async () => {
    vi.mocked(syncRepository.findReadyToProcess).mockResolvedValue([]);

    startSyncWorker();
    await vi.advanceTimersByTimeAsync(1);
    expect(syncRepository.findReadyToProcess).toHaveBeenCalledTimes(1);

    await stopSyncWorker();
    await vi.advanceTimersByTimeAsync(IDLE_DELAY_MS * 2);
    expect(syncRepository.findReadyToProcess).toHaveBeenCalledTimes(1);
  });
});
