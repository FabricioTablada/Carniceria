/**
 * modules/returns/routes.ts
 * -----------------------------------------------------------------------------
 * Rutas HTTP del modulo de devoluciones (Bloque 4.2). Se monta bajo el
 * prefijo `/returns` desde `modules/index.ts` (registro central de
 * modulos), mismo criterio de un router por modulo que el resto del
 * sistema.
 *
 * Protegidas por los permisos sembrados en el Bloque 4.1
 * (`returns.view`/`returns.create`), via `authorizePermission` — mismo
 * sistema de permisos ya usado por el resto de los modulos migrados
 * (`sales.void`/`sales.correct`), sin reautenticacion nueva.
 *
 * Fase 19 (Bloque 19.4): Rate Limiter como primer middleware de cada ruta
 * (antes de `authenticate`), mismo criterio que el resto de los modulos.
 */
import { Router } from 'express';
import {
  authenticate,
  authorizePermission,
  reportsRateLimiter,
  transactionalRateLimiter,
} from '@/middlewares';
import { create, findById, findMany } from './controller';

export const returnsRoutes = Router();

returnsRoutes.post(
  '/',
  transactionalRateLimiter,
  authenticate,
  authorizePermission('returns.create'),
  create,
);

returnsRoutes.get(
  '/',
  reportsRateLimiter,
  authenticate,
  authorizePermission('returns.view'),
  findMany,
);

returnsRoutes.get(
  '/:id',
  reportsRateLimiter,
  authenticate,
  authorizePermission('returns.view'),
  findById,
);
