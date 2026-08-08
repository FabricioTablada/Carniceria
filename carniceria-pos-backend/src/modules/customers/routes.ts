/**
 * modules/customers/routes.ts
 * -----------------------------------------------------------------------------
 * Rutas HTTP del modulo de clientes.
 * Se monta bajo el prefijo `/customers` desde `modules/index.ts` (registro
 * central de modulos, ver ARCHITECTURE.md seccion 7).
 *
 * Todas las rutas requieren un usuario autenticado (`authenticate`) y
 * restringen el acceso por permiso (`authorizePermission`), mismo criterio
 * exacto que `modules/suppliers/routes.ts`.
 */
import { Router } from 'express';
import { administrativeRateLimiter, authenticate, authorizePermission } from '@/middlewares';
import { changeStatus, create, findById, findMany, lookup, remove, update } from './controller';

export const customersRoutes = Router();

customersRoutes.post(
  '/',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('customers.create'),
  create,
);

customersRoutes.get(
  '/',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('customers.view'),
  findMany,
);

// Arquitectura de selectores, Bloque 1: registrada ANTES de `GET /:id` para
// que Express no interprete "lookup" como un valor de `:id`.
customersRoutes.get(
  '/lookup',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('customers.view'),
  lookup,
);

customersRoutes.get(
  '/:id',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('customers.view'),
  findById,
);

customersRoutes.patch(
  '/:id',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('customers.update'),
  update,
);

customersRoutes.patch(
  '/:id/status',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('customers.update'),
  changeStatus,
);

customersRoutes.delete(
  '/:id',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('customers.delete'),
  remove,
);
