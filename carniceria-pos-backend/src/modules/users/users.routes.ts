/**
 * modules/users/users.routes.ts
 * -----------------------------------------------------------------------------
 * Rutas HTTP del modulo de usuarios.
 * Se monta bajo el prefijo `/users` desde `modules/index.ts` (registro
 * central de modulos, ver ARCHITECTURE.md seccion 7).
 *
 * Todas las rutas requieren un usuario autenticado (`authenticate`) y
 * restringen el acceso por rol (`authorize`), siguiendo el RBAC descrito en
 * `middlewares/authorize.middleware.ts`.
 *
 * EXCEPCION: `GET /me` no restringe por rol (`authorize()` sin argumentos
 * permite a cualquier usuario autenticado) — es el perfil del propio
 * usuario, resuelto siempre desde `req.user.id`, nunca desde un `:id` de
 * la URL. Debe registrarse ANTES que `GET /:id` para que Express no
 * interprete `"me"` como un valor de `:id`.
 *
 * Fase 19 (Bloque 19.4): Rate Limiter como primer middleware de cada ruta
 * (antes de `authenticate`), mismo criterio que el resto de los modulos.
 */
import { Router } from 'express';
import { administrativeRateLimiter, authenticate, authorizePermission, authorize } from '@/middlewares';
import { changeStatus, create, findById, findMany, findMe, lookup, update } from './users.controller';

export const usersRoutes = Router();

usersRoutes.post(
  '/',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('users.manage'),
  create,
);

usersRoutes.get(
  '/',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('users.manage'),
  findMany,
);

usersRoutes.get('/me', administrativeRateLimiter, authenticate, authorize(), findMe);

// Arquitectura de selectores, Bloque 1: registrada ANTES de `GET /:id` para
// que Express no interprete "lookup" como un valor de `:id` (mismo criterio
// que `GET /me` arriba).
usersRoutes.get(
  '/lookup',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('users.manage'),
  lookup,
);

usersRoutes.get(
  '/:id',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('users.manage'),
  findById,
);

usersRoutes.patch(
  '/:id',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('users.manage'),
  update,
);

usersRoutes.patch(
  '/:id/status',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('users.manage'),
  changeStatus,
);
