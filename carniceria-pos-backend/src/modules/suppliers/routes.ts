/**
 * modules/suppliers/routes.ts
 * -----------------------------------------------------------------------------
 * Rutas HTTP del modulo de proveedores.
 * Se monta bajo el prefijo `/suppliers` desde `modules/index.ts` (registro
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
import { changeStatus, create, findById, findMany, lookup, remove, update } from './controller';

export const suppliersRoutes = Router();

suppliersRoutes.post(
  '/',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('suppliers.create'),
  create,
);

suppliersRoutes.get(
  '/',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('suppliers.view'),
  findMany,
);

// Arquitectura de selectores, Bloque 1: registrada ANTES de `GET /:id` para
// que Express no interprete "lookup" como un valor de `:id`.
suppliersRoutes.get(
  '/lookup',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('suppliers.view'),
  lookup,
);

suppliersRoutes.get(
  '/:id',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('suppliers.view'),
  findById,
);

suppliersRoutes.patch(
  '/:id',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('suppliers.update'),
  update,
);

suppliersRoutes.patch(
  '/:id/status',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('suppliers.update'),
  changeStatus,
);

suppliersRoutes.delete(
  '/:id',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('suppliers.delete'),
  remove,
);
