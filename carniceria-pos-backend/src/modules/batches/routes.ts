/**
 * modules/batches/routes.ts
 * -----------------------------------------------------------------------------
 * Rutas HTTP del modulo de Lotes (Bloque LOTES-01).
 * Se monta bajo el prefijo `/inventory/batches` desde `inventory/routes.ts`
 * (mismo criterio ya usado para `inventoryWasteRoutes` bajo `/inventory/waste`
 * -- Lotes es conceptualmente subordinado a Inventario, no un modulo de
 * primer nivel).
 *
 * Todas las rutas requieren un usuario autenticado (`authenticate`) y
 * restringen el acceso por permiso (`authorizePermission`), siguiendo el RBAC
 * descrito en `middlewares/authorize.middleware.ts`.
 *
 * Fase 19 (Bloque 19.4): el Rate Limiter de cada ruta se declara como PRIMER
 * middleware (antes de `authenticate`), mismo criterio que el resto de los
 * modulos.
 *
 * Sin `POST /`: en este bloque los lotes solo se crean automaticamente desde
 * Compras (LOTES-02), nunca via este modulo -- ver `controller.ts`/
 * `validation.ts`/`types.ts` para la nota completa. `batchesService.create()`
 * ya existe y esta listo para conectarse a un futuro `POST /` sin ningun
 * cambio de firma, si alguna vez se decide permitir la creacion manual.
 */
import { Router } from 'express';
import { authenticate, authorizePermission, reportsRateLimiter, transactionalRateLimiter } from '@/middlewares';
import { findById, findMany, update } from './controller';

export const batchesRoutes = Router();

batchesRoutes.get(
  '/',
  reportsRateLimiter,
  authenticate,
  authorizePermission('batches.view'),
  findMany,
);

batchesRoutes.get(
  '/:id',
  reportsRateLimiter,
  authenticate,
  authorizePermission('batches.view'),
  findById,
);

batchesRoutes.patch(
  '/:id',
  transactionalRateLimiter,
  authenticate,
  authorizePermission('batches.adjust'),
  update,
);
