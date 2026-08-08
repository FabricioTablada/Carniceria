/**
 * modules/promotions/promotions.controller.ts
 * -----------------------------------------------------------------------------
 * Controlador HTTP del modulo de Promociones (Bloque P.3, catalogo
 * administrativo). Solo se encarga de: validar la peticion, invocar la
 * logica de negocio de `promotions.service.ts` y responder con el formato
 * estandar de la API. No accede a Prisma ni valida existencia/integridad
 * referencial: esa logica vive en el servicio.
 */
import type { Request, Response } from 'express';
import { asyncHandler } from '@/shared/utils/asyncHandler';
import { success } from '@/shared/utils/httpResponse';
import { buildPaginationMeta, resolvePagination } from '@/shared/utils/pagination';
import { HttpStatus } from '@/shared/constants';
import {
  ChangePromotionStatusSchema,
  CreatePromotionSchema,
  ListPromotionsQuerySchema,
  UpdatePromotionSchema,
} from './promotions.validation';
import * as promotionsService from './promotions.service';

/** POST /promotions */
export const create = asyncHandler(async (req: Request, res: Response) => {
  const dto = CreatePromotionSchema.parse(req.body);

  const result = await promotionsService.create(dto);

  res.status(HttpStatus.CREATED).json(success(result));
});

/** GET /promotions/:id */
export const findById = asyncHandler(async (req: Request, res: Response) => {
  const result = await promotionsService.findById(req.params.id);

  res.status(HttpStatus.OK).json(success(result));
});

/** GET /promotions */
export const findMany = asyncHandler(async (req: Request, res: Response) => {
  const query = ListPromotionsQuerySchema.parse(req.query);
  const pagination = resolvePagination({ page: query.page, limit: query.limit });

  const result = await promotionsService.findMany({
    ...pagination,
    filters: {
      active: query.active,
      scopeType: query.scopeType,
      search: query.search,
    },
  });

  const meta = buildPaginationMeta(result.total, pagination);

  res.status(HttpStatus.OK).json(success(result.items, { ...meta }));
});

/** PATCH /promotions/:id */
export const update = asyncHandler(async (req: Request, res: Response) => {
  const dto = UpdatePromotionSchema.parse(req.body);

  const result = await promotionsService.update(req.params.id, dto);

  res.status(HttpStatus.OK).json(success(result));
});

/** PATCH /promotions/:id/status */
export const changeStatus = asyncHandler(async (req: Request, res: Response) => {
  const dto = ChangePromotionStatusSchema.parse(req.body);

  const result = await promotionsService.changeStatus(req.params.id, dto);

  res.status(HttpStatus.OK).json(success(result));
});

/** DELETE /promotions/:id */
export const remove = asyncHandler(async (req: Request, res: Response) => {
  await promotionsService.remove(req.params.id);

  res.status(HttpStatus.NO_CONTENT).send();
});
