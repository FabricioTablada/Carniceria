/**
 * modules/audit/service.ts
 * -----------------------------------------------------------------------------
 * Logica de negocio del modulo de auditoria.
 *
 * Responsabilidades:
 *  - Validar existencia del registro de auditoria antes de consultarlo por
 *    ID.
 *  - Traducir los registros de Prisma a la forma publica
 *    `AuditLogResponse`.
 *
 * Toda consulta a la base de datos se hace a traves de
 * `audit.repository.ts`; este servicio no ejecuta queries de Prisma
 * directamente.
 *
 * NOTA: `AuditLog` es un registro inmutable y de solo agregado (ver
 * DATABASE.md), generado automaticamente por la aplicacion. Este servicio
 * es unicamente de consulta: no expone creacion, actualizacion ni
 * eliminacion.
 *
 * NOTA: el modelo `AuditLog` no tiene ningun campo `Decimal`, por lo que
 * este servicio no realiza conversiones `Prisma.Decimal` / `Number()`.
 */
import { NotFoundError } from '@/shared/errors';
import * as auditRepository from './repository';
import type {
  AuditAction,
  AuditLogResponse,
  ListAuditLogsQuery,
  ListAuditLogsResult,
} from './types';

/** Forma minima que debe tener el registro de Prisma para poder mapearlo. */
type AuditLogRecord = {
  id: string;
  sucursalId: string;
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  ip: string | null;
  before: unknown;
  after: unknown;
  metadata: unknown;
  sucursal: { id: string; code: string; name: string };
  user: { id: string; fullName: string } | null;
  createdAt: Date;
};

/** Traduce un registro de Prisma a la forma publica del registro de
 * auditoria. */
function toAuditLogResponse(auditLog: AuditLogRecord): AuditLogResponse {
  return {
    id: auditLog.id,
    sucursalId: auditLog.sucursalId,
    userId: auditLog.userId,
    action: auditLog.action as AuditAction,
    entity: auditLog.entity,
    entityId: auditLog.entityId,
    ip: auditLog.ip,
    before: auditLog.before,
    after: auditLog.after,
    metadata: auditLog.metadata,
    sucursal: auditLog.sucursal,
    user: auditLog.user,
    createdAt: auditLog.createdAt,
  };
}

export async function findById(id: string): Promise<AuditLogResponse> {
  const auditLog = await auditRepository.findById(id);

  if (!auditLog) {
    throw new NotFoundError('Registro de auditoria');
  }

  return toAuditLogResponse(auditLog);
}

export async function findMany(query: ListAuditLogsQuery): Promise<ListAuditLogsResult> {
  const [items, total] = await auditRepository.findMany({
    skip: query.skip,
    take: query.limit,
    filters: query.filters,
  });

  return {
    items: items.map((item) => toAuditLogResponse(item)),
    total,
  };
}
