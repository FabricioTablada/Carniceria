/**
 * modules/suppliers/controller.ts
 * -----------------------------------------------------------------------------
 * Controlador HTTP del modulo de proveedores.
 * Solo se encarga de: validar la peticion, invocar la logica de negocio de
 * `suppliers.service.ts` y responder con el formato estandar de la API. No
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
  ChangeSupplierStatusSchema,
  CreateSupplierSchema,
  ListSuppliersQuerySchema,
  LookupSuppliersQuerySchema,
  UpdateSupplierSchema,
} from './validation';
import * as suppliersService from './service';

/** POST / */
export const create = asyncHandler(async (req: Request, res: Response) => {
  const dto = CreateSupplierSchema.parse(req.body);

  const result = await suppliersService.create(dto);

  res.status(HttpStatus.CREATED).json(success(result));
});

/** GET /:id */
export const findById = asyncHandler(async (req: Request, res: Response) => {
  const result = await suppliersService.findById(req.params.id);

  res.status(HttpStatus.OK).json(success(result));
});

/** GET / */
export const findMany = asyncHandler(async (req: Request, res: Response) => {
  const query = ListSuppliersQuerySchema.parse(req.query);
  const pagination = resolvePagination({ page: query.page, limit: query.limit });

  const result = await suppliersService.findMany({
    ...pagination,
    filters: {
      active: query.active,
      search: query.search,
    },
  });

  const meta = buildPaginationMeta(result.total, pagination);

  res.status(HttpStatus.OK).json(success(result.items, { ...meta }));
});

/** GET /lookup
 * Arquitectura de selectores, Bloque 1: patron de lookup para selectores —
 * respuesta liviana (`{id,label}[]`), sin `meta` de paginacion. Registrada
 * antes de `GET /:id` en `routes.ts`. */
export const lookup = asyncHandler(async (req: Request, res: Response) => {
  const query = LookupSuppliersQuerySchema.parse(req.query);
  const { take } = resolveLookupParams({ limit: query.limit });

  const result = await suppliersService.lookup({
    take,
    filters: {
      search: query.search,
      active: query.active,
    },
  });

  res.status(HttpStatus.OK).json(success(result));
});

/** PATCH /:id */
export const update = asyncHandler(async (req: Request, res: Response) => {
  const dto = UpdateSupplierSchema.parse(req.body);

  const result = await suppliersService.update(req.params.id, dto);

  res.status(HttpStatus.OK).json(success(result));
});

/** PATCH /:id/status */
export const changeStatus = asyncHandler(async (req: Request, res: Response) => {
  const dto = ChangeSupplierStatusSchema.parse(req.body);

  const result = await suppliersService.changeStatus(req.params.id, dto);

  res.status(HttpStatus.OK).json(success(result));
});

/** DELETE /:id */
export const remove = asyncHandler(async (req: Request, res: Response) => {
  await suppliersService.remove(req.params.id);

  res.status(HttpStatus.NO_CONTENT).send();
});
