/**
 * modules/sales/routes.ts
 * -----------------------------------------------------------------------------
 * Rutas HTTP del modulo de ventas.
 * Se monta bajo el prefijo `/sales` desde `modules/index.ts` (registro
 * central de modulos, ver ARCHITECTURE.md seccion 7).
 *
 * Todas las rutas requieren un usuario autenticado (`authenticate`) y
 * restringen el acceso por rol (`authorize`), siguiendo el RBAC descrito en
 * `middlewares/authorize.middleware.ts`.
 *
 * NOTA: el modelo `Sale` no tiene campo `active`, por lo que este modulo
 * no registra una ruta de cambio de estado (`PATCH /:id/status`).
 *
 * Fase 19 (Bloque 19.4): Rate Limiter como primer middleware de cada ruta
 * (antes de `authenticate`), mismo criterio que el resto de los modulos.
 */
import { Router } from 'express';
import {
  authenticate,
  authorize,
  authorizePermission,
  reportsRateLimiter,
  salesQuoteRateLimiter,
  transactionalRateLimiter,
} from '@/middlewares';
import { SystemRole } from '@/shared/constants';
import { correctSale, create, findById, findMany, getQuote, update, voidSale } from './controller';

export const salesRoutes = Router();

salesRoutes.post(
  '/',
  transactionalRateLimiter,
  authenticate,
  authorize(SystemRole.ADMIN, SystemRole.MANAGER, SystemRole.CASHIER),
  create,
);

// Bloque P.7 ("Cotizacion de Venta"): mismo criterio de acceso que `create`
// (`POST /`) — quien puede crear una venta puede cotizarla, es una vista
// previa de la misma operacion, sin persistir nada.
//
// Investigacion 429 recurrente (03/08/2026): rate limiter propio
// (`salesQuoteRateLimiter`), separado de `transactionalRateLimiter` — esta
// ruta se llama varias veces por cada venta finalizada (cada edicion del
// carrito), no una vez por venta como `POST /` (create, abajo).
salesRoutes.post(
  '/quote',
  salesQuoteRateLimiter,
  authenticate,
  authorize(SystemRole.ADMIN, SystemRole.MANAGER, SystemRole.CASHIER),
  getQuote,
);

salesRoutes.get('/', reportsRateLimiter, authenticate, authorizePermission('sales.view'), findMany);

salesRoutes.get(
  '/:id',
  reportsRateLimiter,
  authenticate,
  authorizePermission('sales.view'),
  findById,
);

salesRoutes.patch('/:id', transactionalRateLimiter, authenticate, authorize(SystemRole.ADMIN), update);

// Bloque 3 ("Anulacion/Correccion de Venta"): protegidas por el permiso ya
// sembrado `sales.void` (antes existia en el catalogo pero no lo usaba
// ningun endpoint) y el nuevo `sales.correct` — no por `authorize(ADMIN)`
// hardcodeado como `update` de arriba, siguiendo el sistema de permisos ya
// establecido para el resto del modulo (`sales.view`/`sales.create`).
salesRoutes.post(
  '/:id/void',
  transactionalRateLimiter,
  authenticate,
  authorizePermission('sales.void'),
  voidSale,
);

salesRoutes.post(
  '/:id/correct',
  transactionalRateLimiter,
  authenticate,
  authorizePermission('sales.correct'),
  correctSale,
);
