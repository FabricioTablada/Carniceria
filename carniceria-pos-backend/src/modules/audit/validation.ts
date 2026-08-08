/**
 * modules/audit/validation.ts
 * -----------------------------------------------------------------------------
 * Esquemas de validacion (Zod) para el modulo de auditoria.
 * Define la forma y las reglas de los datos de entrada; no contiene logica
 * de negocio (esa vive en `audit.service.ts`).
 *
 * NOTA: `AuditLog` es un registro inmutable y de solo agregado (ver
 * DATABASE.md), generado automaticamente por la aplicacion. Este modulo es
 * unicamente de consulta, por lo que aqui solo existe el esquema de query
 * params para el listado; no hay esquemas de creacion, actualizacion ni
 * cambio de estado.
 */
import { z } from 'zod';

/** Acciones auditables soportadas (enum `AuditAction` de `schema.prisma`).
 *
 * Sprint QA 3.3 (migracion aditiva): `SALE`/`INVENTORY_MOVEMENT` son valores
 * LEGACY (registros historicos), se mantienen aqui para poder seguir
 * filtrando `GET /audit-logs?action=SALE` sobre esos registros antiguos. */
const AuditActionSchema = z.enum([
  'LOGIN',
  'LOGOUT',
  'CREATE',
  'UPDATE',
  'DELETE',
  'PRICE_CHANGE',
  'CASH_OPEN',
  'CASH_CLOSE',
  'PURCHASE',
  'SALE',
  'INVENTORY_MOVEMENT',
  'SALE_VOID',
  'SALE_CORRECTION',
  'SALE_RETURN',
  'INVENTORY_WASTE',
  'LOGIN_FAILED',
  'ACCESS_DENIED',
]);

/** Validacion de los query params para el listado de registros de
 * auditoria. Cada filtro corresponde a una columna real de `AuditLog`. */
export const ListAuditLogsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  sucursalId: z.string().uuid('La sucursal debe ser un identificador valido.').optional(),
  userId: z.string().uuid('El usuario debe ser un identificador valido.').optional(),
  action: AuditActionSchema.optional(),
  entity: z.string().optional(),
  entityId: z.string().uuid('La entidad debe ser un identificador valido.').optional(),
});

export type ListAuditLogsQueryDto = z.infer<typeof ListAuditLogsQuerySchema>;
