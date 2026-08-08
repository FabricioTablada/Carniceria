/**
 * modules/notifications/index.ts
 * -----------------------------------------------------------------------------
 * Punto unico de exportacion del modulo de notificaciones.
 * Centraliza lo que el resto de la aplicacion puede consumir de este modulo;
 * nada fuera de esta carpeta debe importar los archivos internos
 * (`notifications.controller.ts`, `notifications.service.ts`, etc.)
 * directamente.
 */
export { notificationsRoutes } from './notifications.routes';
