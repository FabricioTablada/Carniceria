/**
 * modules/sync/index.ts
 * -----------------------------------------------------------------------------
 * Punto unico de exportacion del modulo de sincronizacion.
 * Centraliza lo que el resto de la aplicacion puede consumir; nada fuera de
 * esta carpeta debe importar los archivos internos directamente.
 *
 * Sin rutas HTTP todavia a proposito (Bloque 4: un endpoint de monitoreo
 * tipo `GET /sync/status` fue marcado como opcional/cosmetico en el
 * analisis, y requeriria agregar un codigo de permiso nuevo al catalogo
 * sembrado + reflejarlo en `carniceria-pos-front` — fuera del alcance
 * aprobado para este bloque).
 */
export { enqueueSyncJob, getSyncStatusCounts } from './sync.service';
export { startSyncWorker, stopSyncWorker } from './sync.worker';
export type { EnqueueSyncJobParams, SyncStatusCounts, SyncJob, SyncJobStatus, SyncJobType } from './sync.types';
