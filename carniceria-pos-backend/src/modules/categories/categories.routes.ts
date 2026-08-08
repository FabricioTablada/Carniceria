/**
 * modules/categories/categories.routes.ts
 * -----------------------------------------------------------------------------
 * Rutas HTTP del modulo de categorias.
 * Se monta bajo el prefijo `/categories` desde `modules/index.ts` (registro
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
import { changeStatus, create, findById, findMany, lookup, remove, update } from './categories.controller';

export const categoriesRoutes = Router();

categoriesRoutes.post(
  '/',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('categories.create'),
  create,
);

categoriesRoutes.get(
  '/',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('categories.view'),
  findMany,
);

// Arquitectura de selectores, Bloque 1: registrada ANTES de `GET /:id` para
// que Express no interprete "lookup" como un valor de `:id`.
categoriesRoutes.get(
  '/lookup',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('categories.view'),
  lookup,
);

categoriesRoutes.get(
  '/:id',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('categories.view'),
  findById,
);

categoriesRoutes.patch(
  '/:id',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('categories.update'),
  update,
);

categoriesRoutes.patch(
  '/:id/status',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('categories.update'),
  changeStatus,
);

categoriesRoutes.delete(
  '/:id',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('categories.delete'),
  remove,
);
