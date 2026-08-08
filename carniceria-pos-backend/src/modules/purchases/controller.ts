/**
 * modules/purchases/controller.ts
 * -----------------------------------------------------------------------------
 * Controlador HTTP del modulo de compras.
 * Solo se encarga de: validar la peticion, invocar la logica de negocio de
 * `purchases.service.ts` y responder con el formato estandar de la API. No
 * accede a Prisma ni calcula totales: esa logica vive en el servicio.
 */
import type { Request, Response } from 'express';
import { asyncHandler } from '@/shared/utils/asyncHandler';
import { success } from '@/shared/utils/httpResponse';
import { buildPaginationMeta, resolvePagination } from '@/shared/utils/pagination';
import { HttpStatus } from '@/shared/constants';
import { UnauthorizedError } from '@/shared/errors';
import { CreatePurchaseSchema, ListPurchasesQuerySchema, UpdatePurchaseSchema } from './validation';
import * as purchasesService from './service';
import type { CreatePurchaseDto } from './types';

/** POST / */
export const create = asyncHandler(async (req: Request, res: Response) => {
  const body = CreatePurchaseSchema.parse(req.body);

  // `userId` y `sucursalId` NO se aceptan del cliente: se resuelven desde
  // `req.user`, adjuntado por `authenticate.middleware.ts` a partir del
  // JWT. Esta ruta siempre pasa por ese middleware (ver routes.ts), asi
  // que `req.user` esta garantizado; el chequeo de abajo es defensivo.
  // Mismo criterio ya aplicado en `sales.controller.ts` y en
  // `openSession`/`closeSession` de `cash.controller.ts`.
  if (!req.user) {
    throw new UnauthorizedError('Usuario autenticado no encontrado en la peticion.');
  }

  const dto: CreatePurchaseDto = {
    ...body,
    userId: req.user.id,
    sucursalId: req.user.sucursalId,
  };

  const result = await purchasesService.create(dto);

  res.status(HttpStatus.CREATED).json(success(result));
});

/** GET /:id */
export const findById = asyncHandler(async (req: Request, res: Response) => {
  const result = await purchasesService.findById(req.params.id);

  res.status(HttpStatus.OK).json(success(result));
});

/** GET / */
export const findMany = asyncHandler(async (req: Request, res: Response) => {
  const query = ListPurchasesQuerySchema.parse(req.query);
  const pagination = resolvePagination({ page: query.page, limit: query.limit });

  const result = await purchasesService.findMany({
    ...pagination,
    filters: {
      sucursalId: query.sucursalId,
      supplierId: query.supplierId,
      status: query.status,
    },
  });

  const meta = buildPaginationMeta(result.total, pagination);

  res.status(HttpStatus.OK).json(success(result.items, { ...meta }));
});

/** PATCH /:id */
export const update = asyncHandler(async (req: Request, res: Response) => {
  const dto = UpdatePurchaseSchema.parse(req.body);

  const result = await purchasesService.update(req.params.id, dto);

  res.status(HttpStatus.OK).json(success(result));
});
