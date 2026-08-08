/**
 * modules/inventory/controller.ts
 * -----------------------------------------------------------------------------
 * Controlador HTTP del modulo de inventario.
 * Solo se encarga de: validar la peticion, invocar la logica de negocio de
 * `inventory.service.ts` y responder con el formato estandar de la API. No
 * accede a Prisma ni valida duplicados/existencia: esa logica vive en el
 * servicio.
 */
import type { Request, Response } from 'express';
import { asyncHandler } from '@/shared/utils/asyncHandler';
import { success } from '@/shared/utils/httpResponse';
import { buildPaginationMeta, resolvePagination } from '@/shared/utils/pagination';
import { HttpStatus } from '@/shared/constants';
import { UnauthorizedError } from '@/shared/errors';
import {
  CreateInventorySchema,
  ListInventoryQuerySchema,
  UpdateInventorySchema,
} from './validation';
import * as inventoryService from './service';

/** POST / */
export const create = asyncHandler(async (req: Request, res: Response) => {
  const dto = CreateInventorySchema.parse(req.body);

  const result = await inventoryService.create(dto);

  res.status(HttpStatus.CREATED).json(success(result));
});

/** GET /:id */
export const findById = asyncHandler(async (req: Request, res: Response) => {
  const result = await inventoryService.findById(req.params.id);

  res.status(HttpStatus.OK).json(success(result));
});

/** GET / */
export const findMany = asyncHandler(async (req: Request, res: Response) => {
  const query = ListInventoryQuerySchema.parse(req.query);
  const pagination = resolvePagination({ page: query.page, limit: query.limit });

  const result = await inventoryService.findMany({
    ...pagination,
    filters: {
      sucursalId: query.sucursalId,
      productId: query.productId,
      search: query.search,
    },
  });

  const meta = buildPaginationMeta(result.total, pagination);

  res.status(HttpStatus.OK).json(success(result.items, { ...meta }));
});

/** PATCH /:id */
export const update = asyncHandler(async (req: Request, res: Response) => {
  const dto = UpdateInventorySchema.parse(req.body);

  // `userId` (quien hizo el ajuste) se resuelve desde `req.user`,
  // adjuntado por `authenticate.middleware.ts` a partir del JWT. Esta
  // ruta siempre pasa por ese middleware (ver routes.ts), asi que
  // `req.user` esta garantizado; el chequeo de abajo es defensivo, mismo
  // patron que sales/controller.ts y cash/controller.ts.
  if (!req.user) {
    throw new UnauthorizedError('Usuario autenticado no encontrado en la peticion.');
  }

  const result = await inventoryService.update(req.params.id, dto, req.user.id);

  res.status(HttpStatus.OK).json(success(result));
});
