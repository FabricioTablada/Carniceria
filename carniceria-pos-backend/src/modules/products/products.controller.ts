/**
 * modules/products/products.controller.ts
 * -----------------------------------------------------------------------------
 * Controlador HTTP del modulo de productos.
 * Solo se encarga de: validar la peticion, invocar la logica de negocio de
 * `products.service.ts` y responder con el formato estandar de la API. No
 * accede a Prisma ni valida duplicados/existencia: esa logica vive en el
 * servicio.
 */
import type { Request, Response } from 'express';
import { asyncHandler } from '@/shared/utils/asyncHandler';
import { success } from '@/shared/utils/httpResponse';
import { buildPaginationMeta, resolvePagination } from '@/shared/utils/pagination';
import { resolveLookupParams } from '@/shared/utils/lookup';
import { HttpStatus } from '@/shared/constants';
import { ValidationError } from '@/shared/errors';
import {
  ChangeProductStatusSchema,
  CreateProductSchema,
  ListProductsQuerySchema,
  LookupProductsQuerySchema,
  UpdateProductSchema,
} from './products.validation';
import * as productsService from './products.service';

/** POST /products */
export const create = asyncHandler(async (req: Request, res: Response) => {
  const dto = CreateProductSchema.parse(req.body);

  const result = await productsService.create(dto);

  res.status(HttpStatus.CREATED).json(success(result));
});

/** GET /products/:id */
export const findById = asyncHandler(async (req: Request, res: Response) => {
  const result = await productsService.findById(req.params.id);

  res.status(HttpStatus.OK).json(success(result));
});

/** GET /products */
export const findMany = asyncHandler(async (req: Request, res: Response) => {
  const query = ListProductsQuerySchema.parse(req.query);
  const pagination = resolvePagination({ page: query.page, limit: query.limit });

  const result = await productsService.findMany({
    ...pagination,
    filters: {
      categoryId: query.categoryId,
      taxId: query.taxId,
      active: query.active,
      search: query.search,
      sucursalId: query.sucursalId,
    },
  });

  const meta = buildPaginationMeta(result.total, pagination);

  res.status(HttpStatus.OK).json(success(result.items, { ...meta }));
});

/** GET /products/lookup
 * Arquitectura de selectores, Bloque 1: patron de lookup para selectores —
 * respuesta liviana (`{id,label}[]`), sin `meta` de paginacion (no aplica,
 * ver `shared/utils/lookup.ts`). Registrada antes de `GET /:id` en
 * `products.routes.ts` para que Express no interprete "lookup" como un
 * valor de `:id`. */
export const lookup = asyncHandler(async (req: Request, res: Response) => {
  const query = LookupProductsQuerySchema.parse(req.query);
  const { take } = resolveLookupParams({ limit: query.limit });

  const result = await productsService.lookup({
    take,
    filters: {
      search: query.search,
      active: query.active,
    },
  });

  res.status(HttpStatus.OK).json(success(result));
});

/** PATCH /products/:id */
export const update = asyncHandler(async (req: Request, res: Response) => {
  const dto = UpdateProductSchema.parse(req.body);

  const result = await productsService.update(req.params.id, dto);

  res.status(HttpStatus.OK).json(success(result));
});

/** PATCH /products/:id/status */
export const changeStatus = asyncHandler(async (req: Request, res: Response) => {
  const dto = ChangeProductStatusSchema.parse(req.body);

  const result = await productsService.changeStatus(req.params.id, dto);

  res.status(HttpStatus.OK).json(success(result));
});

/** POST /products/:id/image (Bloque 10)
 * `req.file` lo puebla `productImageUpload` (multer, `products.routes.ts`)
 * — ya validado (mimetype/tamaño) antes de llegar aca. Si el cliente no
 * adjunto ningun archivo bajo el campo `image`, `req.file` es `undefined`. */
export const uploadImage = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw new ValidationError('Debes adjuntar un archivo de imagen.');
  }

  const result = await productsService.uploadImage(req.params.id, {
    mimeType: req.file.mimetype,
    buffer: req.file.buffer,
  });

  res.status(HttpStatus.OK).json(success(result));
});

/** DELETE /products/:id/image (Bloque 10) */
export const deleteImage = asyncHandler(async (req: Request, res: Response) => {
  const result = await productsService.deleteImage(req.params.id);

  res.status(HttpStatus.OK).json(success(result));
});

/** DELETE /products/:id */
export const remove = asyncHandler(async (req: Request, res: Response) => {
  await productsService.remove(req.params.id);

  res.status(HttpStatus.NO_CONTENT).send();
});
