/**
 * modules/roles/roles.routes.ts
 * -----------------------------------------------------------------------------
 * Rutas HTTP del modulo de roles.
 * Se monta bajo el prefijo `/roles` desde `modules/index.ts` (registro
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
import {
  assignPermissions,
  changeStatus,
  create,
  findById,
  findMany,
  update,
} from './roles.controller';

export const rolesRoutes = Router();

rolesRoutes.post(
  '/',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('roles.manage'),
  create,
);

rolesRoutes.get(
  '/',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('roles.manage'),
  findMany,
);

rolesRoutes.get(
  '/:id',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('roles.manage'),
  findById,
);

rolesRoutes.patch(
  '/:id',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('roles.manage'),
  update,
);

rolesRoutes.patch(
  '/:id/status',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('roles.manage'),
  changeStatus,
);

rolesRoutes.patch(
  '/:id/permissions',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('roles.manage'),
  assignPermissions,
);
