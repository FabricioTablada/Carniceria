/**
 * modules/audit/types.ts
 * -----------------------------------------------------------------------------
 * Tipos e interfaces del modulo de auditoria.
 * Define unicamente las formas de datos que consumen `audit.service.ts`,
 * `audit.repository.ts` y `audit.controller.ts`; no contiene logica de
 * negocio, consultas Prisma ni validaciones (eso vive en sus respectivos
 * archivos: `audit.service.ts`, `audit.repository.ts` y
 * `audit.validation.ts`).
 *
 * NOTA: el modelo `AuditLog` de `schema.prisma` es un registro INMUTABLE y
 * DE SOLO AGREGADO ("Registro de auditoria... inmutable y de solo
 * agregado", ver DATABASE.md). Por eso no tiene `updatedAt` ni `deletedAt`,
 * y este modulo es unicamente de consulta: no expone creacion, actualizacion
 * ni eliminacion. Los registros los genera automaticamente la aplicacion
 * (`shared/services/audit.service.ts`), no una peticion HTTP de este
 * modulo.
 */
import type { PaginationParams } from '@/shared/utils/pagination';

/** Accion auditada (enum `AuditAction` de `schema.prisma`).
 *
 * Sprint QA 3.3 (migracion aditiva): `SALE`/`INVENTORY_MOVEMENT` son valores
 * LEGACY (registros historicos anteriores a este sprint) — el codigo actual
 * ya no los emite, usa las 4 acciones especificas agregadas al final. */
export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'PRICE_CHANGE'
  | 'CASH_OPEN'
  | 'CASH_CLOSE'
  | 'PURCHASE'
  | 'SALE'
  | 'INVENTORY_MOVEMENT'
  | 'SALE_VOID'
  | 'SALE_CORRECTION'
  | 'SALE_RETURN'
  | 'INVENTORY_WASTE'
  | 'LOGIN_FAILED'
  | 'ACCESS_DENIED';

/** Resumen de la sucursal asociada a un registro de auditoria. */
export interface AuditLogSucursalSummary {
  id: string;
  code: string;
  name: string;
}

/** Resumen del usuario asociado a un registro de auditoria. */
export interface AuditLogUserSummary {
  id: string;
  fullName: string;
}

/** Forma de un registro de auditoria tal como lo expone el modulo.
 * `before`, `after` y `metadata` son JSON de forma libre (`Json?` en
 * `schema.prisma`), por lo que se tipan como `unknown`: el contenido lo
 * define quien genero el registro, no este modulo. */
export interface AuditLogResponse {
  id: string;
  sucursalId: string;
  userId: string | null;
  action: AuditAction;
  entity: string;
  entityId: string | null;
  ip: string | null;
  before: unknown;
  after: unknown;
  metadata: unknown;
  sucursal: AuditLogSucursalSummary;
  user: AuditLogUserSummary | null;
  createdAt: Date;
}

/** Filtros de busqueda/listado disponibles para registros de auditoria.
 * Cada filtro corresponde a una columna real e indexada de `AuditLog`. */
export interface ListAuditLogsFilters {
  sucursalId?: string;
  userId?: string;
  action?: AuditAction;
  entity?: string;
  entityId?: string;
}

/** Parametros combinados para listar registros de auditoria: filtros +
 * paginacion. */
export interface ListAuditLogsQuery extends PaginationParams {
  filters?: ListAuditLogsFilters;
}

/** Resultado de una operacion de listado paginado de registros de
 * auditoria. */
export interface ListAuditLogsResult {
  items: AuditLogResponse[];
  total: number;
}

/** Resultado de las operaciones que devuelven un unico registro de
 * auditoria. */
export interface AuditLogResult {
  auditLog: AuditLogResponse;
}
