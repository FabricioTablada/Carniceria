/**
 * modules/batches/index.ts
 * -----------------------------------------------------------------------------
 * Punto unico de exportacion del modulo de Lotes.
 * Centraliza lo que el resto de la aplicacion puede consumir de este modulo;
 * nada fuera de esta carpeta debe importar los archivos internos
 * (`repository.ts`, `service.ts`, etc.) directamente.
 *
 * `create` se exporta ya en este bloque (LOTES-01) aunque no exista
 * `POST /batches` todavia: Compras (LOTES-02) la invocara internamente,
 * dentro de su propia transaccion, para crear el lote automatico al recibir
 * una compra -- sin pasar por HTTP en ningun momento.
 */
export { batchesRoutes } from './routes';
export {
  create as createBatchService,
  findById as findByIdBatchService,
  findActiveForConsumption as findActiveBatchesForConsumption,
  expireOverdueBatches as expireOverdueBatchesService,
  // Bloque "Eliminación de Mermas": regla 5 de la política de estados
  // (`service.ts`) -- exclusivo para `inventoryWaste/service.ts::deleteWaste`.
  reopenIfRestocked as reopenBatchIfRestockedService,
  // QA.4 (Compras): exclusivo para `purchases/service.ts::update()`, al
  // cancelar una compra ya `RECEIVED` -- ver ese archivo.
  findByPurchaseItemId as findBatchByPurchaseItemIdService,
} from './service';
export type { BatchResponse, CreateBatchDto, UpdateBatchDto } from './types';
