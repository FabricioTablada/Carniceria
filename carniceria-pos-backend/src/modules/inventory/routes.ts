/**
 * modules/inventory/routes.ts
 * -----------------------------------------------------------------------------
 * Rutas HTTP del modulo de inventario.
 * Se monta bajo el prefijo `/inventory` desde `modules/index.ts` (registro
 * central de modulos, ver ARCHITECTURE.md seccion 7).
 *
 * Todas las rutas requieren un usuario autenticado (`authenticate`) y
 * restringen el acceso por rol (`authorize`), siguiendo el RBAC descrito en
 * `middlewares/authorize.middleware.ts`.
 *
 * NOTA: el modelo `Inventory` no tiene campo `active`, por lo que este modulo
 * no registra una ruta de cambio de estado (`PATCH /:id/status`).
 *
 * Bloque 5.3 ("Modulo de Mermas"): `inventoryWasteRoutes` (modulo separado
 * `modules/inventoryWaste/`, por responsabilidad unica de codigo) se monta
 * AQUI, bajo `/waste`, para que la API tambien "se integre con Inventario"
 * (arquitectura aprobada en el Bloque 5) — no solo el modelo de datos.
 * Montado ANTES de `GET/PATCH /:id`: si fuera despues, esas rutas con
 * parametro capturarian `/inventory/waste` como si `:id` fuera literalmente
 * "waste" (Express resuelve por orden de registro).
 *
 * Bloque LOTES-01 ("Modulo de Lotes"): `batchesRoutes` (modulo separado
 * `modules/batches/`, mismo criterio de responsabilidad unica que
 * `inventoryWaste`) se monta AQUI, bajo `/batches`, mismo motivo y mismo
 * orden (ANTES de `GET/PATCH /:id`).
 *
 * Fase 19 (Bloque 19.4): el Rate Limiter de cada ruta se declara como
 * PRIMER middleware (antes de `authenticate`), igual que el antiguo limiter
 * global se aplicaba antes de cualquier autenticacion — asi una rafaga de
 * peticiones sin token valido sigue consumiendo cupo y recibiendo 429 tras
 * el limite, en vez de agotarse solo en `authenticate` sin nunca activar el
 * limiter (comportamiento sin cambios respecto a bloques anteriores).
 */
import { Router } from 'express';
import {
  administrativeRateLimiter,
  authenticate,
  authorizePermission,
  authorize,
  reportsRateLimiter,
  transactionalRateLimiter,
} from '@/middlewares';
import { SystemRole } from '@/shared/constants';
import { inventoryWasteRoutes } from '@/modules/inventoryWaste';
import { batchesRoutes } from '@/modules/batches';
import { create, findById, findMany, update } from './controller';

export const inventoryRoutes = Router();

inventoryRoutes.use('/waste', inventoryWasteRoutes);
inventoryRoutes.use('/batches', batchesRoutes);

// Alta manual de una fila de Inventory (ADMIN, baja frecuencia): naturaleza
// administrativa, no transaccional (Fase 19, Bloque 19.4).
inventoryRoutes.post('/', administrativeRateLimiter, authenticate, authorize(SystemRole.ADMIN), create);

inventoryRoutes.get(
  '/',
  reportsRateLimiter,
  authenticate,
  authorizePermission('inventory.view'),
  findMany,
);

inventoryRoutes.get(
  '/:id',
  reportsRateLimiter,
  authenticate,
  authorizePermission('inventory.view'),
  findById,
);

// Ajuste de existencia: escritura transaccional real (Fase 19, Bloque 19.4).
inventoryRoutes.patch(
  '/:id',
  transactionalRateLimiter,
  authenticate,
  authorizePermission('inventory.adjust'),
  update,
);
