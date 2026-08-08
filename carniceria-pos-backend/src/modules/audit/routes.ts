/**
 * modules/audit/routes.ts
 * -----------------------------------------------------------------------------
 * Rutas HTTP del modulo de auditoria.
 * Se monta bajo el prefijo `/audit` desde `modules/index.ts` (registro
 * central de modulos, ver ARCHITECTURE.md seccion 7).
 *
 * Todas las rutas requieren un usuario autenticado (`authenticate`) y
 * restringen el acceso por rol (`authorize`), siguiendo el RBAC descrito en
 * `middlewares/authorize.middleware.ts`. A diferencia del resto de
 * modulos, aqui ambas rutas de lectura estan restringidas unicamente a
 * `ADMIN` (no `ADMIN, MANAGER`), dada la naturaleza sensible del historial
 * de auditoria.
 *
 * NOTA: `AuditLog` es un registro inmutable y de solo agregado (ver
 * DATABASE.md). Este modulo es unicamente de consulta: no registra rutas
 * `POST`, `PATCH` ni `DELETE`.
 *
 * Fase 19 (Bloque 19.4): Rate Limiter como primer middleware de cada ruta
 * (antes de `authenticate`). Categoria "administrative" (no "reports") a
 * proposito: es lectura, pero de naturaleza sensible y bajo volumen, mismo
 * perfil que el resto de los endpoints de solo ADMIN.
 */
import { Router } from 'express';
import { administrativeRateLimiter, authenticate, authorize } from '@/middlewares';
import { SystemRole } from '@/shared/constants';
import { findById, findMany } from './controller';

export const auditRoutes = Router();

auditRoutes.get('/', administrativeRateLimiter, authenticate, authorize(SystemRole.ADMIN), findMany);

auditRoutes.get(
  '/:id',
  administrativeRateLimiter,
  authenticate,
  authorize(SystemRole.ADMIN),
  findById,
);
