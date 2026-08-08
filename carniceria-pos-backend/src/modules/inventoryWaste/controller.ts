/**
 * modules/inventoryWaste/controller.ts
 * -----------------------------------------------------------------------------
 * Controlador HTTP del modulo de Mermas (Bloque 5.3). Solo se encarga de:
 * validar la peticion, invocar la logica de negocio de
 * `inventoryWaste.service.ts` y responder con el formato estandar de la
 * API. No accede a Prisma ni contiene logica de negocio.
 */
import type { Request, Response } from 'express';
import { asyncHandler } from '@/shared/utils/asyncHandler';
import { success } from '@/shared/utils/httpResponse';
import { buildPaginationMeta, resolvePagination } from '@/shared/utils/pagination';
import { HttpStatus } from '@/shared/constants';
import { UnauthorizedError } from '@/shared/errors';
import { CreateInventoryWasteSchema, ListInventoryWastesQuerySchema } from './validation';
import * as inventoryWasteService from './service';

/** POST /inventory/waste
 * `performedByUserId` NUNCA se acepta del cliente — se resuelve desde
 * `req.user` (el usuario autenticado que registra la merma), mismo
 * criterio que `voidSale`/`correctSale`/`createReturn`. */
export const create = asyncHandler(async (req: Request, res: Response) => {
  const body = CreateInventoryWasteSchema.parse(req.body);

  if (!req.user) {
    throw new UnauthorizedError('Usuario autenticado no encontrado en la petición.');
  }

  const result = await inventoryWasteService.createWaste({
    ...body,
    performedByUserId: req.user.id,
  });

  res.status(HttpStatus.CREATED).json(success(result));
});

/** GET /inventory/waste/:id */
export const findById = asyncHandler(async (req: Request, res: Response) => {
  const result = await inventoryWasteService.findById(req.params.id);

  res.status(HttpStatus.OK).json(success(result));
});

/** DELETE /inventory/waste/:id
 * ADMIN únicamente (`inventoryWaste.routes.ts::authorize(SystemRole.ADMIN)`)
 * — mismo patrón de respuesta que `suppliers/controller.ts::remove`
 * (`204 No Content`, sin body). `performedByUserId` se resuelve desde
 * `req.user`, mismo criterio que `create` de arriba. */
export const remove = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError('Usuario autenticado no encontrado en la petición.');
  }

  await inventoryWasteService.deleteWaste(req.params.id, req.user.id);

  res.status(HttpStatus.NO_CONTENT).send();
});

/** GET /inventory/waste */
export const findMany = asyncHandler(async (req: Request, res: Response) => {
  const query = ListInventoryWastesQuerySchema.parse(req.query);
  const pagination = resolvePagination({ page: query.page, limit: query.limit });

  const result = await inventoryWasteService.findMany({
    ...pagination,
    filters: {
      sucursalId: query.sucursalId,
      productId: query.productId,
      userId: query.userId,
      reason: query.reason,
    },
  });

  const meta = buildPaginationMeta(result.total, pagination);

  res.status(HttpStatus.OK).json(success(result.items, { ...meta }));
});
