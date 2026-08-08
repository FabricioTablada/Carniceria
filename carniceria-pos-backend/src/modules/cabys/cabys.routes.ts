/**
 * modules/cabys/cabys.routes.ts
 * -----------------------------------------------------------------------------
 * Rutas HTTP del modulo CABYS. Se monta bajo el prefijo `/cabys` desde
 * `modules/index.ts`.
 *
 * Version 1.1, Bloque 2: `GET /cabys/lookup`, protegida con el permiso
 * `products.view` (reutilizado a proposito — el unico consumidor es el
 * asistente de busqueda de `ProductForm.tsx`; no se crea un permiso
 * `cabys.*` nuevo, ver analisis aprobado).
 *
 * Version 1.2, Bloque "Actualizacion inteligente del catalogo CABYS": tres
 * rutas nuevas bajo `/catalog`, protegidas con el permiso ya existente
 * `settings.manage` (administracion del sistema — mismo criterio de
 * reutilizar antes de crear un permiso nuevo). Accion administrativa
 * esporadica, mismo limitador que `/lookup`.
 */
import { Router } from 'express';
import { administrativeRateLimiter, authenticate, authorizePermission } from '@/middlewares';
import { applyCatalogUpdate, checkForCatalogUpdates, lookup, previewCatalogUpdate } from './cabys.controller';

export const cabysRoutes = Router();

cabysRoutes.get(
  '/lookup',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('products.view'),
  lookup,
);

cabysRoutes.get(
  '/catalog/check-updates',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('settings.manage'),
  checkForCatalogUpdates,
);

cabysRoutes.post(
  '/catalog/preview',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('settings.manage'),
  previewCatalogUpdate,
);

cabysRoutes.post(
  '/catalog/apply',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('settings.manage'),
  applyCatalogUpdate,
);
