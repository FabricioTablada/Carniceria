/**
 * modules/suppliers/index.ts
 * -----------------------------------------------------------------------------
 * Punto unico de exportacion del modulo de proveedores.
 * Centraliza lo que el resto de la aplicacion puede consumir de este modulo;
 * nada fuera de esta carpeta debe importar los archivos internos
 * (`controller.ts`, `service.ts`, etc.) directamente.
 */
export { suppliersRoutes } from './routes';
