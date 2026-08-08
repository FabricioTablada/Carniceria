/**
 * modules/purchases/routes.ts
 * -----------------------------------------------------------------------------
 * Rutas HTTP del modulo de compras.
 * Se monta bajo el prefijo `/purchases` desde `modules/index.ts` (registro
 * central de modulos, ver ARCHITECTURE.md seccion 7).
 *
 * Todas las rutas requieren un usuario autenticado (`authenticate`) y
 * restringen el acceso por rol (`authorize`), siguiendo el RBAC descrito en
 * `middlewares/authorize.middleware.ts`.
 *
 * NOTA: el modelo `Purchase` no tiene campo `active`, por lo que este modulo
 * no registra una ruta de cambio de estado (`PATCH /:id/status`).
 *
 * Fase 19 (Bloque 19.4): Rate Limiter como primer middleware de cada ruta
 * (antes de `authenticate`), mismo criterio que el resto de los modulos.
 */
import { Router } from 'express';
import {
  authenticate,
  authorizePermission,
  authorize,
  reportsRateLimiter,
  transactionalRateLimiter,
} from '@/middlewares';
import { SystemRole } from '@/shared/constants';
import { create, findById, findMany, update } from './controller';

export const purchaseRoutes = Router();

purchaseRoutes.post(
  '/',
  transactionalRateLimiter,
  authenticate,
  authorizePermission('purchases.create'),
  create,
);

purchaseRoutes.get(
  '/',
  reportsRateLimiter,
  authenticate,
  authorizePermission('purchases.view'),
  findMany,
);

purchaseRoutes.get(
  '/:id',
  reportsRateLimiter,
  authenticate,
  authorizePermission('purchases.view'),
  findById,
);

purchaseRoutes.patch(
  '/:id',
  transactionalRateLimiter,
  authenticate,
  authorize(SystemRole.ADMIN),
  update,
);
