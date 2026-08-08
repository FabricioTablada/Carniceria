/**
 * modules/cashRegister/cashRegister.routes.ts
 * -----------------------------------------------------------------------------
 * Rutas HTTP del modulo de cajas registradoras.
 * Se monta bajo el prefijo `/cash-registers` desde `modules/index.ts`
 * (registro central de modulos, ver ARCHITECTURE.md seccion 7).
 *
 * Todas las rutas requieren un usuario autenticado (`authenticate`) y
 * restringen el acceso por rol (`authorize`), siguiendo el RBAC descrito en
 * `middlewares/authorize.middleware.ts`.
 *
 * Fase 19 (Bloque 19.4): Rate Limiter como primer middleware de cada ruta
 * (antes de `authenticate`), mismo criterio que el resto de los modulos.
 */
import { Router } from 'express';
import {
  administrativeRateLimiter,
  authenticate,
  authorizePermission,
  authorize,
  reportsRateLimiter,
} from '@/middlewares';
import { SystemRole } from '@/shared/constants';
import { changeStatus, create, findById, findMany, update } from './cashRegister.controller';

export const cashRegisterRoutes = Router();

cashRegisterRoutes.post(
  '/',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('cash-registers.create'),
  create,
);

cashRegisterRoutes.get(
  '/',
  reportsRateLimiter,
  authenticate,
  authorize(SystemRole.ADMIN, SystemRole.MANAGER, SystemRole.CASHIER),
  findMany,
);

cashRegisterRoutes.get(
  '/:id',
  reportsRateLimiter,
  authenticate,
  authorize(SystemRole.ADMIN, SystemRole.MANAGER),
  findById,
);

cashRegisterRoutes.patch(
  '/:id',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('cash-registers.update'),
  update,
);

cashRegisterRoutes.patch(
  '/:id/status',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('cash-registers.update'),
  changeStatus,
);
