/**
 * modules/categories/categories.controller.ts
 * -----------------------------------------------------------------------------
 * Controlador HTTP del modulo de categorias.
 * Solo se encarga de: validar la peticion, invocar la logica de negocio de
 * `categories.service.ts` y responder con el formato estandar de la API. No
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
  ChangeCategoryStatusSchema,
  CreateCategorySchema,
  ListCategoriesQuerySchema,
  LookupCategoriesQuerySchema,
  UpdateCategorySchema,
} from './categories.validation';
import * as categoriesService from './categories.service';

/** POST /categories */
export const create = asyncHandler(async (req: Request, res: Response) => {
  const dto = CreateCategorySchema.parse(req.body);

  const result = await categoriesService.create(dto);

  res.status(HttpStatus.CREATED).json(success(result));
});

/** GET /categories/:id */
export const findById = asyncHandler(async (req: Request, res: Response) => {
  const result = await categoriesService.findById(req.params.id);

  res.status(HttpStatus.OK).json(success(result));
});

/** GET /categories */
export const findMany = asyncHandler(async (req: Request, res: Response) => {
  const query = ListCategoriesQuerySchema.parse(req.query);
  const pagination = resolvePagination({ page: query.page, limit: query.limit });

  const result = await categoriesService.findMany({
    ...pagination,
    filters: {
      parentId: query.parentId,
      active: query.active,
      search: query.search,
    },
  });

  const meta = buildPaginationMeta(result.total, pagination);

  res.status(HttpStatus.OK).json(success(result.items, { ...meta }));
});

/** GET /categories/lookup
 * Arquitectura de selectores, Bloque 1: patron de lookup para selectores —
 * respuesta liviana (`{id,label}[]`), sin `meta` de paginacion. Registrada
 * antes de `GET /:id` en `categories.routes.ts`. */
export const lookup = asyncHandler(async (req: Request, res: Response) => {
  const query = LookupCategoriesQuerySchema.parse(req.query);
  const { take } = resolveLookupParams({ limit: query.limit });

  const result = await categoriesService.lookup({
    take,
    filters: {
      search: query.search,
      active: query.active,
    },
  });

  res.status(HttpStatus.OK).json(success(result));
});

/** PATCH /categories/:id */
export const update = asyncHandler(async (req: Request, res: Response) => {
  const dto = UpdateCategorySchema.parse(req.body);

  const result = await categoriesService.update(req.params.id, dto);

  res.status(HttpStatus.OK).json(success(result));
});

/** PATCH /categories/:id/status */
export const changeStatus = asyncHandler(async (req: Request, res: Response) => {
  const dto = ChangeCategoryStatusSchema.parse(req.body);

  const result = await categoriesService.changeStatus(req.params.id, dto);

  res.status(HttpStatus.OK).json(success(result));
});

/** DELETE /categories/:id */
export const remove = asyncHandler(async (req: Request, res: Response) => {
  await categoriesService.remove(req.params.id);

  res.status(HttpStatus.NO_CONTENT).send();
});
