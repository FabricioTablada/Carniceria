/**
 * modules/taxes/taxes.routes.ts
 * -----------------------------------------------------------------------------
 * Rutas HTTP del modulo de impuestos.
 * Se monta bajo el prefijo `/taxes` desde `modules/index.ts` (registro
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
import { changeStatus, create, findById, findMany, lookup, remove, update } from './taxes.controller';

export const taxesRoutes = Router();

taxesRoutes.post(
  '/',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('taxes.create'),
  create,
);

taxesRoutes.get(
  '/',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('taxes.view'),
  findMany,
);

// Arquitectura de selectores, Bloque 1: registrada ANTES de `GET /:id` para
// que Express no interprete "lookup" como un valor de `:id`.
taxesRoutes.get(
  '/lookup',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('taxes.view'),
  lookup,
);

taxesRoutes.get(
  '/:id',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('taxes.view'),
  findById,
);

taxesRoutes.patch(
  '/:id',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('taxes.update'),
  update,
);

taxesRoutes.patch(
  '/:id/status',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('taxes.update'),
  changeStatus,
);

taxesRoutes.delete(
  '/:id',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('taxes.delete'),
  remove,
);
