/**
 * modules/inventoryWaste/index.ts
 * -----------------------------------------------------------------------------
 * Punto unico de exportacion del modulo de Mermas.
 * Centraliza lo que el resto de la aplicacion puede consumir de este modulo;
 * nada fuera de esta carpeta debe importar los archivos internos
 * (`controller.ts`, `service.ts`, etc.) directamente.
 *
 * A diferencia de los demas modulos, `inventoryWasteRoutes` NO se registra
 * en `modules/index.ts` con su propio prefijo — lo consume
 * `modules/inventory/routes.ts`, que lo monta bajo `/waste` (ver
 * `inventoryWaste/routes.ts` para la justificacion arquitectonica).
 */
export { inventoryWasteRoutes } from './routes';
