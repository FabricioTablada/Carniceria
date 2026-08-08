/**
 * shared/services/audit.service.ts
 * -----------------------------------------------------------------------------
 * Servicio TRANSVERSAL de auditoria (requisito #9).
 *
 * Es el punto unico por el que TODOS los modulos registran acciones
 * importantes (crear/editar/eliminar, cambios de precio, apertura/cierre de
 * caja, compras, ventas, movimientos de inventario, login/logout).
 *
 * Persistencia conectada a la tabla `AuditLog` via Prisma.
 */
import { Prisma } from '@prisma/client';
import { logger } from '@/config';
import { prisma } from '@/database';
import type { DbClient } from '@/database';
import type { AuditActionName } from '@/shared/constants';
import { ValidationError } from '@/shared/errors';

export interface AuditEntry {
  action: AuditActionName;
  /** Entidad afectada, p.ej. "product", "sale". */
  entity: string;
  /** Identificador del registro afectado (si aplica). */
  entityId?: string;
  /** Usuario que ejecuta la accion. */
  userId?: string;
  sucursalId?: string;
  ip?: string;
  /** Estado previo (para ediciones/eliminaciones). */
  before?: unknown;
  /** Estado nuevo (para creaciones/ediciones). */
  after?: unknown;
  metadata?: Record<string, unknown>;
  /** Cliente transaccional del llamador (Bloque 3, "Anulacion/Correccion de
   * Venta"): opcional, por defecto el singleton `prisma`. Se agrega para
   * que el registro de auditoria pueda participar de la MISMA transaccion
   * que anula la venta original/crea la venta correctiva y reversa el
   * inventario — si algo falla despues, el registro de auditoria tambien
   * revierte, en vez de quedar huerfano describiendo una accion que nunca
   * se completo. */
  tx?: DbClient;
}

class AuditService {
  /**
   * Registra una accion auditable, persistiendola en `AuditLog`.
   */
  async log(entry: AuditEntry): Promise<void> {
    logger.info({ audit: entry }, 'AUDIT');

    if (!entry.sucursalId) {
      throw new ValidationError('No se puede registrar auditoria sin sucursalId.');
    }

    const db = entry.tx ?? prisma;

    await db.auditLog.create({
      data: {
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        userId: entry.userId,
        sucursalId: entry.sucursalId,
        ip: entry.ip,
        before: entry.before as Prisma.InputJsonValue,
        after: entry.after as Prisma.InputJsonValue,
        metadata: entry.metadata as Prisma.InputJsonValue,
      },
    });
  }
}

export const auditService = new AuditService();
