/**
 * modules/processing/routes.ts
 * -----------------------------------------------------------------------------
 * Rutas HTTP del modulo de Despiece (Bloque 3 del plan v3 aprobado). Se
 * monta bajo el prefijo `/processing` desde `modules/index.ts` (registro
 * central de modulos) -- modulo de primer nivel, no subordinado a Inventario
 * (a diferencia de `batches`/`inventoryWaste`): el plan v3 lo trata como su
 * propio dominio de negocio (transformacion de canal -> cortes/subproductos),
 * mismo criterio que Compras/Ventas/Devoluciones.
 *
 * Todas las rutas requieren un usuario autenticado (`authenticate`) y
 * restringen el acceso por permiso (`authorizePermission`), siguiendo el
 * RBAC descrito en `middlewares/authorize.middleware.ts` -- nunca
 * `authorize(SystemRole...)` hardcodeado, mismo criterio que
 * `batches/routes.ts`/`inventoryWaste/routes.ts`.
 *
 * Permisos (sembrados en `prisma/permissionsBootstrap.ts`):
 *  - `processing.view` — listar/ver el detalle de una operacion.
 *  - `processing.create` — crear una operacion y administrar su borrador
 *    (`PATCH /:id`, `POST /:id/cancel`, y el CRUD de lineas de salida/merma
 *    bajo `/:id/output-items`/`/:id/waste-items` -- todo parte del ciclo de
 *    vida del `DRAFT`, no requiere el permiso elevado de completar).
 *  - `processing.complete` — completar una operacion (`POST /:id/complete`,
 *    la unica accion que efectivamente descuenta/acredita inventario real)
 *    -- permiso separado, mismo criterio que `sales.void`/`sales.correct`
 *    siendo distintos de `sales.create`.
 *
 * Rate Limiter como primer middleware de cada ruta (antes de `authenticate`),
 * mismo criterio que el resto de los modulos (Fase 19, Bloque 19.4).
 */
import { Router } from 'express';
import {
  authenticate,
  authorizePermission,
  reportsRateLimiter,
  transactionalRateLimiter,
} from '@/middlewares';
import {
  addOutputItem,
  addWasteLine,
  cancel,
  complete,
  create,
  findById,
  findMany,
  removeOutputItem,
  removeWasteLine,
  update,
  updateOutputItem,
  updateWasteLine,
} from './controller';

export const processingRoutes = Router();

processingRoutes.post(
  '/',
  transactionalRateLimiter,
  authenticate,
  authorizePermission('processing.create'),
  create,
);

processingRoutes.get(
  '/',
  reportsRateLimiter,
  authenticate,
  authorizePermission('processing.view'),
  findMany,
);

processingRoutes.get(
  '/:id',
  reportsRateLimiter,
  authenticate,
  authorizePermission('processing.view'),
  findById,
);

processingRoutes.patch(
  '/:id',
  transactionalRateLimiter,
  authenticate,
  authorizePermission('processing.create'),
  update,
);

processingRoutes.post(
  '/:id/complete',
  transactionalRateLimiter,
  authenticate,
  authorizePermission('processing.complete'),
  complete,
);

processingRoutes.post(
  '/:id/cancel',
  transactionalRateLimiter,
  authenticate,
  authorizePermission('processing.create'),
  cancel,
);

// Correccion de alcance (aprobada): expone el CRUD de lineas de salida
// (cortes/subproductos), ya implementado en `service.ts` desde el Bloque 2
// -- mismo permiso `processing.create` que el resto de las mutaciones del
// ciclo de vida del `DRAFT` (`addOutputItem`/`updateOutputItem`/
// `removeOutputItem` ya validan por su cuenta, via `findDraftOrThrow`, que
// la operacion siga `DRAFT`).
processingRoutes.post(
  '/:id/output-items',
  transactionalRateLimiter,
  authenticate,
  authorizePermission('processing.create'),
  addOutputItem,
);

processingRoutes.patch(
  '/:id/output-items/:itemId',
  transactionalRateLimiter,
  authenticate,
  authorizePermission('processing.create'),
  updateOutputItem,
);

processingRoutes.delete(
  '/:id/output-items/:itemId',
  transactionalRateLimiter,
  authenticate,
  authorizePermission('processing.create'),
  removeOutputItem,
);

// Mismo criterio de arriba, para las lineas de merma
// (`addWasteLine`/`updateWasteLine`/`removeWasteLine`, `service.ts`).
processingRoutes.post(
  '/:id/waste-items',
  transactionalRateLimiter,
  authenticate,
  authorizePermission('processing.create'),
  addWasteLine,
);

processingRoutes.patch(
  '/:id/waste-items/:itemId',
  transactionalRateLimiter,
  authenticate,
  authorizePermission('processing.create'),
  updateWasteLine,
);

processingRoutes.delete(
  '/:id/waste-items/:itemId',
  transactionalRateLimiter,
  authenticate,
  authorizePermission('processing.create'),
  removeWasteLine,
);
