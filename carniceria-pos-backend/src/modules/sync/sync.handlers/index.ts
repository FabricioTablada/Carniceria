/**
 * modules/sync/sync.handlers/index.ts
 * -----------------------------------------------------------------------------
 * Dispatcher: un handler por `SyncJobType`. Agregar un tipo nuevo (ej.
 * facturacion electronica a Hacienda, `HACIENDA_SUBMIT`) es agregar un
 * valor al enum `SyncJobType` (`prisma/schema.prisma`) + un archivo de
 * handler + una linea aca — nunca requiere tocar `sync.worker.ts`.
 */
import type { SyncJobType } from '@prisma/client';
import type { SyncJobHandler } from '../sync.types';
import { cloudPushStubHandler } from './cloudPush.stub.handler';

const handlers: Record<SyncJobType, SyncJobHandler> = {
  CLOUD_PUSH: cloudPushStubHandler,
};

export function getSyncJobHandler(jobType: SyncJobType): SyncJobHandler {
  return handlers[jobType];
}
