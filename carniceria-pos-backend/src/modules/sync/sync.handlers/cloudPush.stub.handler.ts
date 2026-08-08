/**
 * modules/sync/sync.handlers/cloudPush.stub.handler.ts
 * -----------------------------------------------------------------------------
 * Handler de reemplazo (stub) para `SyncJobType.CLOUD_PUSH`, mientras no
 * exista todavia un contrato real de API en la nube (Fase 2, sin definir
 * — ver Bloque 4, "riesgos"). Prueba de punta a punta el mecanismo real de
 * la cola (encolado atomico, worker, reintentos, recuperacion tras
 * reinicio) sin depender de un destino remoto que todavia no existe.
 *
 * Cuando exista el contrato real, este archivo se reemplaza por un handler
 * real (ej. `cloudPush.handler.ts`) registrado en el mismo lugar
 * (`sync.handlers/index.ts`) — el motor de la cola no cambia.
 */
import { logger } from '@/config';
import type { SyncJobHandler } from '../sync.types';

export const cloudPushStubHandler: SyncJobHandler = async (job) => {
  logger.debug(
    { syncJobId: job.id, entityType: job.entityType, entityId: job.entityId },
    'Sync (stub): trabajo CLOUD_PUSH procesado sin destino real todavia (Fase 2 sin definir).',
  );
  return Promise.resolve();
};
