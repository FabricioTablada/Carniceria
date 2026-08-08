/**
 * modules/cash/index.ts
 * -----------------------------------------------------------------------------
 * Punto unico de exportacion del modulo de caja.
 * Centraliza lo que el resto de la aplicacion puede consumir de este modulo;
 * nada fuera de esta carpeta debe importar los archivos internos
 * (`controller.ts`, `service.ts`, etc.) directamente.
 */
export { cashRoutes } from './routes';

export { findSessions } from './service';

export type { CashSessionResponse, ListCashSessionsResult } from './types';
