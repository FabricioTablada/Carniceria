/**
 * modules/customers/controller.ts
 * -----------------------------------------------------------------------------
 * Controlador HTTP del modulo de clientes.
 * Solo se encarga de: validar la peticion, invocar la logica de negocio de
 * `customers.service.ts` y responder con el formato estandar de la API. No
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
  ChangeCustomerStatusSchema,
  CreateCustomerSchema,
  ListCustomersQuerySchema,
  LookupCustomersQuerySchema,
  UpdateCustomerSchema,
} from './validation';
import * as customersService from './service';

/** POST / */
export const create = asyncHandler(async (req: Request, res: Response) => {
  const dto = CreateCustomerSchema.parse(req.body);

  const result = await customersService.create(dto);

  res.status(HttpStatus.CREATED).json(success(result));
});

/** GET /:id */
export const findById = asyncHandler(async (req: Request, res: Response) => {
  const result = await customersService.findById(req.params.id);

  res.status(HttpStatus.OK).json(success(result));
});

/** GET / */
export const findMany = asyncHandler(async (req: Request, res: Response) => {
  const query = ListCustomersQuerySchema.parse(req.query);
  const pagination = resolvePagination({ page: query.page, limit: query.limit });

  const result = await customersService.findMany({
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
  const query = LookupCustomersQuerySchema.parse(req.query);
  const { take } = resolveLookupParams({ limit: query.limit });

  const result = await customersService.lookup({
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
  const dto = UpdateCustomerSchema.parse(req.body);

  const result = await customersService.update(req.params.id, dto);

  res.status(HttpStatus.OK).json(success(result));
});

/** PATCH /:id/status */
export const changeStatus = asyncHandler(async (req: Request, res: Response) => {
  const dto = ChangeCustomerStatusSchema.parse(req.body);

  const result = await customersService.changeStatus(req.params.id, dto);

  res.status(HttpStatus.OK).json(success(result));
});

/** DELETE /:id */
export const remove = asyncHandler(async (req: Request, res: Response) => {
  await customersService.remove(req.params.id);

  res.status(HttpStatus.NO_CONTENT).send();
});
