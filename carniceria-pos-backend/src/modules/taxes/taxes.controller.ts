/**
 * modules/taxes/taxes.controller.ts
 * -----------------------------------------------------------------------------
 * Controlador HTTP del modulo de impuestos.
 * Solo se encarga de: validar la peticion, invocar la logica de negocio de
 * `taxes.service.ts` y responder con el formato estandar de la API. No
 * accede a Prisma ni valida duplicados/existencia: esa logica vive en el
 * servicio.
 */
import type { Request, Response } from 'express';
import { asyncHandler } from '@/shared/utils/asyncHandler';
import { success } from '@/shared/utils/httpResponse';
import { buildPaginationMeta, resolvePagination } from '@/shared/utils/pagination';
import { resolveLookupParams } from '@/shared/utils/lookup';
import { HttpStatus } from '@/shared/constants';
import {
  ChangeTaxStatusSchema,
  CreateTaxSchema,
  ListTaxesQuerySchema,
  LookupTaxesQuerySchema,
  UpdateTaxSchema,
} from './taxes.validation';
import * as taxesService from './taxes.service';

/** POST /taxes */
export const create = asyncHandler(async (req: Request, res: Response) => {
  const dto = CreateTaxSchema.parse(req.body);

  const result = await taxesService.create(dto);

  res.status(HttpStatus.CREATED).json(success(result));
});

/** GET /taxes/:id */
export const findById = asyncHandler(async (req: Request, res: Response) => {
  const result = await taxesService.findById(req.params.id);

  res.status(HttpStatus.OK).json(success(result));
});

/** GET /taxes */
export const findMany = asyncHandler(async (req: Request, res: Response) => {
  const query = ListTaxesQuerySchema.parse(req.query);
  const pagination = resolvePagination({ page: query.page, limit: query.limit });

  const result = await taxesService.findMany({
    ...pagination,
    filters: {
      active: query.active,
      isDefault: query.isDefault,
      search: query.search,
    },
  });

  const meta = buildPaginationMeta(result.total, pagination);

  res.status(HttpStatus.OK).json(success(result.items, { ...meta }));
});

/** GET /taxes/lookup
 * Arquitectura de selectores, Bloque 1: patron de lookup para selectores —
 * respuesta liviana (`{id,label}[]`), sin `meta` de paginacion. Registrada
 * antes de `GET /:id` en `taxes.routes.ts`. */
export const lookup = asyncHandler(async (req: Request, res: Response) => {
  const query = LookupTaxesQuerySchema.parse(req.query);
  const { take } = resolveLookupParams({ limit: query.limit });

  const result = await taxesService.lookup({
    take,
    filters: {
      search: query.search,
      active: query.active,
    },
  });

  res.status(HttpStatus.OK).json(success(result));
});

/** PATCH /taxes/:id */
export const update = asyncHandler(async (req: Request, res: Response) => {
  const dto = UpdateTaxSchema.parse(req.body);

  const result = await taxesService.update(req.params.id, dto);

  res.status(HttpStatus.OK).json(success(result));
});

/** PATCH /taxes/:id/status */
export const changeStatus = asyncHandler(async (req: Request, res: Response) => {
  const dto = ChangeTaxStatusSchema.parse(req.body);

  const result = await taxesService.changeStatus(req.params.id, dto);

  res.status(HttpStatus.OK).json(success(result));
});

/** DELETE /taxes/:id */
export const remove = asyncHandler(async (req: Request, res: Response) => {
  await taxesService.remove(req.params.id);

  res.status(HttpStatus.NO_CONTENT).send();
});
