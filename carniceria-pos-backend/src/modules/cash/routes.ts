/**
 * modules/cash/routes.ts
 * -----------------------------------------------------------------------------
 * Rutas HTTP del modulo de caja.
 * Se monta bajo el prefijo `/cash` desde `modules/index.ts` (registro
 * central de modulos, ver ARCHITECTURE.md seccion 7). Expone dos grupos de
 * rutas segun el agregado (`/sessions` para `CashSession`, `/movements`
 * para `CashMovement`), siguiendo la misma separacion de responsabilidades
 * de `cash.service.ts`.
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
  authenticate,
  authorizePermission,
  authorize,
  reportsRateLimiter,
  transactionalRateLimiter,
} from '@/middlewares';
import { SystemRole } from '@/shared/constants';
import {
  closeSession,
  findMovementById,
  findMovements,
  findSessionById,
  findSessions,
  openSession,
  registerMovement,
  updateSession,
} from './controller';

export const cashRoutes = Router();

// -----------------------------------------------------------------------------
// CashSession: sesiones de caja
// -----------------------------------------------------------------------------

cashRoutes.post(
  '/sessions',
  transactionalRateLimiter,
  authenticate,
  authorizePermission('cash.open'),
  openSession,
);

cashRoutes.get(
  '/sessions',
  reportsRateLimiter,
  authenticate,
  authorize(SystemRole.ADMIN, SystemRole.MANAGER, SystemRole.CASHIER),
  findSessions,
);

cashRoutes.get(
  '/sessions/:id',
  reportsRateLimiter,
  authenticate,
  authorize(SystemRole.ADMIN, SystemRole.MANAGER, SystemRole.CASHIER),
  findSessionById,
);

cashRoutes.patch(
  '/sessions/:id',
  transactionalRateLimiter,
  authenticate,
  authorize(SystemRole.ADMIN),
  updateSession,
);

cashRoutes.patch(
  '/sessions/:id/close',
  transactionalRateLimiter,
  authenticate,
  authorizePermission('cash.close'),
  closeSession,
);

// -----------------------------------------------------------------------------
// CashMovement: movimientos de caja
// -----------------------------------------------------------------------------

cashRoutes.post(
  '/movements',
  transactionalRateLimiter,
  authenticate,
  authorize(SystemRole.ADMIN, SystemRole.MANAGER, SystemRole.CASHIER),
  registerMovement,
);

cashRoutes.get(
  '/movements',
  reportsRateLimiter,
  authenticate,
  authorizePermission('cash-movements.view'),
  findMovements,
);

cashRoutes.get(
  '/movements/:id',
  reportsRateLimiter,
  authenticate,
  authorizePermission('cash-movements.view'),
  findMovementById,
);
