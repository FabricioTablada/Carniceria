/**
 * modules/inventoryWaste/routes.ts
 * -----------------------------------------------------------------------------
 * Rutas HTTP del modulo de Mermas (Bloque 5.3). NO se registra en
 * `modules/index.ts` con su propio prefijo: se monta DENTRO de
 * `inventoryRoutes` (`modules/inventory/routes.ts`, bajo `/waste`), para
 * que la superficie de API tambien "se integre con Inventario" tal como
 * exige la arquitectura aprobada (Bloque 5, "NO crear un modulo separado
 * fuera de Inventario") — no solo el modelo de datos, tambien las rutas.
 *
 * Protegidas por el permiso sembrado en el Bloque 5.2 (`inventory.waste`),
 * distinto de `inventory.adjust` a proposito (Ajuste y Merma son
 * conceptos distintos, ver analisis del Bloque 5).
 *
 * Fase 19 (Bloque 19.4): Rate Limiter como primer middleware de cada ruta
 * (antes de `authenticate`), mismo criterio que `inventory/routes.ts`.
 *
 * Bloque "Eliminación de Mermas" (aprobado): `DELETE /:id` usa
 * `authorize(SystemRole.ADMIN)` (chequeo por ROL, no por permiso) — mismo
 * mecanismo exacto que `POST /inventory` (alta manual, ADMIN únicamente,
 * ver `inventory/routes.ts`), no `authorizePermission`: la eliminación es
 * exclusivamente para corregir errores de captura, no un permiso
 * asignable a otros roles.
 */
import { Router } from 'express';
import {
  authenticate,
  authorize,
  authorizePermission,
  reportsRateLimiter,
  transactionalRateLimiter,
} from '@/middlewares';
import { SystemRole } from '@/shared/constants';
import { create, findById, findMany, remove } from './controller';

export const inventoryWasteRoutes = Router();

inventoryWasteRoutes.post(
  '/',
  transactionalRateLimiter,
  authenticate,
  authorizePermission('inventory.waste'),
  create,
);

inventoryWasteRoutes.get(
  '/',
  reportsRateLimiter,
  authenticate,
  authorizePermission('inventory.view'),
  findMany,
);

inventoryWasteRoutes.get(
  '/:id',
  reportsRateLimiter,
  authenticate,
  authorizePermission('inventory.view'),
  findById,
);

inventoryWasteRoutes.delete(
  '/:id',
  transactionalRateLimiter,
  authenticate,
  authorize(SystemRole.ADMIN),
  remove,
);
