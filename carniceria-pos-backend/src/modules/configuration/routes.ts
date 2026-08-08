/**
 * modules/configuration/routes.ts
 * -----------------------------------------------------------------------------
 * Rutas HTTP del modulo de configuracion funcional del sistema.
 * Se monta bajo el prefijo `/configuration` desde `modules/index.ts`
 * (registro central de modulos, ver ARCHITECTURE.md seccion 7).
 *
 * Todas las rutas requieren un usuario autenticado (`authenticate`) y
 * restringen el acceso por rol (`authorize`), siguiendo el RBAC descrito en
 * `middlewares/authorize.middleware.ts`.
 *
 * NOTA: el modelo `Configuration` no tiene campo `active`, por lo que este
 * modulo no registra una ruta de cambio de estado (`PATCH /:id/status`).
 *
 * Fase 19 (Bloque 19.4): Rate Limiter como primer middleware de cada ruta
 * (antes de `authenticate`), mismo criterio que el resto de los modulos.
 */
import { Router } from 'express';
import { administrativeRateLimiter, authenticate, authorizePermission } from '@/middlewares';
import { create, findById, findMany, update } from './controller';

export const configurationRoutes = Router();

configurationRoutes.post(
  '/',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('settings.manage'),
  create,
);

configurationRoutes.get(
  '/',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('settings.manage'),
  findMany,
);

configurationRoutes.get(
  '/:id',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('settings.manage'),
  findById,
);

configurationRoutes.patch(
  '/:id',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('settings.manage'),
  update,
);
