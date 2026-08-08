/**
 * modules/permissions/permissions.routes.ts
 * -----------------------------------------------------------------------------
 * Rutas HTTP del modulo de permisos.
 * Se monta bajo el prefijo `/permissions` desde `modules/index.ts` (registro
 * central de modulos, ver ARCHITECTURE.md seccion 7).
 *
 * Todas las rutas requieren un usuario autenticado (`authenticate`) y
 * restringen el acceso por rol (`authorize`), siguiendo el RBAC descrito en
 * `middlewares/authorize.middleware.ts`.
 *
 * Fase 19 (Bloque 19.4): Rate Limiter como primer middleware de cada ruta
 * (antes de `authenticate`), mismo criterio que el resto de los modulos.
 */
import { Router } from 'express';
import { administrativeRateLimiter, authenticate, authorizePermission } from '@/middlewares';
import { create, findById, findMany, update } from './permissions.controller';

export const permissionsRoutes = Router();

permissionsRoutes.post(
  '/',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('roles.manage'),
  create,
);

permissionsRoutes.get(
  '/',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('roles.manage'),
  findMany,
);

permissionsRoutes.get(
  '/:id',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('roles.manage'),
  findById,
);

permissionsRoutes.patch(
  '/:id',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('roles.manage'),
  update,
);
