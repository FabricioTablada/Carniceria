/**
 * modules/audit/controller.ts
 * -----------------------------------------------------------------------------
 * Controlador HTTP del modulo de auditoria.
 * Solo se encarga de: validar la peticion, invocar la logica de negocio de
 * `audit.service.ts` y responder con el formato estandar de la API. No
 * accede a Prisma.
 *
 * NOTA: `AuditLog` es un registro inmutable y de solo agregado (ver
 * DATABASE.md). Este controlador es unicamente de consulta: no expone
 * creacion, actualizacion ni eliminacion.
 */
import type { Request, Response } from 'express';
import { asyncHandler } from '@/shared/utils/asyncHandler';
import { success } from '@/shared/utils/httpResponse';
import { buildPaginationMeta, resolvePagination } from '@/shared/utils/pagination';
import { HttpStatus } from '@/shared/constants';
import { ListAuditLogsQuerySchema } from './validation';
import * as auditService from './service';

/** GET /:id */
export const findById = asyncHandler(async (req: Request, res: Response) => {
  const result = await auditService.findById(req.params.id);

  res.status(HttpStatus.OK).json(success(result));
});

/** GET / */
export const findMany = asyncHandler(async (req: Request, res: Response) => {
  const query = ListAuditLogsQuerySchema.parse(req.query);
  const pagination = resolvePagination({ page: query.page, limit: query.limit });

  const result = await auditService.findMany({
    ...pagination,
    filters: {
      sucursalId: query.sucursalId,
      userId: query.userId,
      action: query.action,
      entity: query.entity,
      entityId: query.entityId,
    },
  });

  const meta = buildPaginationMeta(result.total, pagination);

  res.status(HttpStatus.OK).json(success(result.items, { ...meta }));
});
