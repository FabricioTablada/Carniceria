/**
 * modules/batches/controller.ts
 * -----------------------------------------------------------------------------
 * Controlador HTTP del modulo de Lotes (Bloque LOTES-01).
 * Solo se encarga de: validar la peticion, invocar la logica de negocio de
 * `service.ts` y responder con el formato estandar de la API. No accede a
 * Prisma ni contiene logica de negocio.
 *
 * Sin `create`: no existe `POST /batches` en este bloque (ver `routes.ts` y
 * la nota de archivo en `validation.ts`/`types.ts`) -- los lotes solo se
 * crean automaticamente desde Compras (LOTES-02), nunca via este modulo.
 */
import type { Request, Response } from 'express';
import { asyncHandler } from '@/shared/utils/asyncHandler';
import { success } from '@/shared/utils/httpResponse';
import { buildPaginationMeta, resolvePagination } from '@/shared/utils/pagination';
import { HttpStatus } from '@/shared/constants';
import { UnauthorizedError } from '@/shared/errors';
import { ListBatchQuerySchema, UpdateBatchSchema } from './validation';
import * as batchesService from './service';

/** GET /batches */
export const findMany = asyncHandler(async (req: Request, res: Response) => {
  const query = ListBatchQuerySchema.parse(req.query);
  const pagination = resolvePagination({ page: query.page, limit: query.limit });

  const result = await batchesService.findMany({
    ...pagination,
    filters: {
      productId: query.productId,
      sucursalId: query.sucursalId,
      supplierId: query.supplierId,
      status: query.status,
    },
  });

  const meta = buildPaginationMeta(result.total, pagination);

  res.status(HttpStatus.OK).json(success(result.items, { ...meta }));
});

/** GET /batches/:id */
export const findById = asyncHandler(async (req: Request, res: Response) => {
  const result = await batchesService.findById(req.params.id);

  res.status(HttpStatus.OK).json(success(result));
});

/** PATCH /batches/:id */
export const update = asyncHandler(async (req: Request, res: Response) => {
  const dto = UpdateBatchSchema.parse(req.body);

  // `userId` (quien hizo el ajuste) se resuelve desde `req.user`, adjuntado
  // por `authenticate.middleware.ts` a partir del JWT -- mismo patron que
  // `inventory/controller.ts::update`. Solo es obligatorio cuando el body
  // incluye `availableQuantity` (`batches/service.ts` lo valida), pero se
  // resuelve siempre por consistencia con el resto del proyecto.
  if (!req.user) {
    throw new UnauthorizedError('Usuario autenticado no encontrado en la petición.');
  }

  const result = await batchesService.update(req.params.id, dto, req.user.id);

  res.status(HttpStatus.OK).json(success(result));
});
