/**
 * modules/products/products.routes.ts
 * -----------------------------------------------------------------------------
 * Rutas HTTP del modulo de productos.
 * Se monta bajo el prefijo `/products` desde `modules/index.ts` (registro
 * central de modulos, ver ARCHITECTURE.md seccion 7).
 *
 * Todas las rutas requieren un usuario autenticado (`authenticate`) y
 * restringen el acceso por rol (`authorize`), siguiendo el RBAC descrito en
 * `middlewares/authorize.middleware.ts`.
 *
 * Fase 19 (Bloque 19.4): Rate Limiter como primer middleware de cada ruta
 * (antes de `authenticate`) — asi una rafaga sin token valido sigue
 * consumiendo cupo y no elude el limiter (comportamiento sin cambios
 * respecto al antiguo limiter global).
 */
import { Router } from 'express';
import {
  administrativeRateLimiter,
  authenticate,
  authorizePermission,
  reportsRateLimiter,
} from '@/middlewares';
import {
  changeStatus,
  create,
  deleteImage,
  findById,
  findMany,
  lookup,
  remove,
  update,
  uploadImage,
} from './products.controller';
import { productImageUpload } from './productImage.middleware';

export const productsRoutes = Router();

// Altas/ediciones de catalogo: bajo volumen, naturaleza administrativa.
productsRoutes.post(
  '/',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('products.create'),
  create,
);

// Lecturas del catalogo: alto volumen (consultado por el POS, Fase 18),
// naturaleza de consulta, no de escritura transaccional (Fase 19, 19.4).
productsRoutes.get(
  '/',
  reportsRateLimiter,
  authenticate,
  authorizePermission('products.view'),
  findMany,
);

// Arquitectura de selectores, Bloque 1: registrada ANTES de `GET /:id` para
// que Express no interprete "lookup" como un valor de `:id` (mismo criterio
// ya usado por `GET /users/me` en `users.routes.ts`).
productsRoutes.get(
  '/lookup',
  reportsRateLimiter,
  authenticate,
  authorizePermission('products.view'),
  lookup,
);

productsRoutes.get(
  '/:id',
  reportsRateLimiter,
  authenticate,
  authorizePermission('products.view'),
  findById,
);

productsRoutes.patch(
  '/:id',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('products.update'),
  update,
);

productsRoutes.patch(
  '/:id/status',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('products.update'),
  changeStatus,
);

productsRoutes.delete(
  '/:id',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('products.delete'),
  remove,
);

// Gestion de imagenes (Bloque 10): mismo endpoint crea o reemplaza (el
// nombre de archivo es deterministico por producto, ver
// `productImageStorage.ts`) — no hace falta distinguir POST/PUT. Mismo
// permiso que el resto de las ediciones de catalogo (`products.update`).
productsRoutes.post(
  '/:id/image',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('products.update'),
  productImageUpload,
  uploadImage,
);

productsRoutes.delete(
  '/:id/image',
  administrativeRateLimiter,
  authenticate,
  authorizePermission('products.update'),
  deleteImage,
);
