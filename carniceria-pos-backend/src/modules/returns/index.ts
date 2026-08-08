/**
 * modules/returns/index.ts
 * -----------------------------------------------------------------------------
 * Punto unico de exportacion del modulo de devoluciones.
 * Centraliza lo que el resto de la aplicacion puede consumir de este modulo;
 * nada fuera de esta carpeta debe importar los archivos internos
 * (`controller.ts`, `service.ts`, etc.) directamente.
 */
export { returnsRoutes } from './routes';
