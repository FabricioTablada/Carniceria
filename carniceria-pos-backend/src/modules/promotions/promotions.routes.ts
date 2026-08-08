/**
 * modules/promotions/promotions.routes.ts
 * -----------------------------------------------------------------------------
 * Rutas HTTP del modulo de Promociones (Bloque P.3, catalogo
 * administrativo). Se monta bajo el prefijo `/promotions` desde
 * `modules/index.ts` (registro central de modulos, ver ARCHITECTURE.md
 * seccion 7).
 *
 * Todas las rutas requieren un usuario autenticado (`authenticate`) y
 * restringen el acceso por permiso (`authorizePermission`), mismo criterio
 * que `taxes.routes.ts`. Sin endpoint de aplicacion/calculo de
 * promociones — eso no existe en este bloque.
 *
 * Fase 19 (Bloque 19.4): Rate Limiter como primer middleware de cada ruta
 * (antes de `authenticate`), mismo criterio que el resto de los modulos.
 */
import { Router } from 'express';
import { administrativeRateLimiter, authenticate, authorizePermission } from '@/middlewares';
import { changeStatus, create, findById, findMany, remove, update } from './promotions.controller';

export const promotionsRoutes = Router();

promotionsRoutes.post(
  '/',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('promotions.create'),
  create,
);

promotionsRoutes.get(
  '/',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('promotions.view'),
  findMany,
);

promotionsRoutes.get(
  '/:id',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('promotions.view'),
  findById,
);

promotionsRoutes.patch(
  '/:id',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('promotions.update'),
  update,
);

promotionsRoutes.patch(
  '/:id/status',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('promotions.update'),
  changeStatus,
);

promotionsRoutes.delete(
  '/:id',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('promotions.delete'),
  remove,
);
