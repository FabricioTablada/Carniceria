/**
 * modules/processing/controller.ts
 * -----------------------------------------------------------------------------
 * Controlador HTTP del modulo de Despiece (Bloque 3 del plan v3 aprobado).
 * Solo se encarga de: validar la peticion, invocar la logica de negocio de
 * `service.ts` y responder con el formato estandar de la API. No accede a
 * Prisma ni contiene logica de negocio.
 *
 * Alcance de este bloque (12 endpoints, ver `routes.ts`): alta, listado,
 * detalle, edicion de cabecera (`notes`), completar y cancelar una
 * operacion, mas la correccion de alcance aprobada que agrega el CRUD de
 * lineas de salida y de merma (`output-items`/`waste-items`) -- expone la
 * logica de `service.ts` ya implementada desde el Bloque 2
 * (`addOutputItem`/`updateOutputItem`/`removeOutputItem`/`addWasteLine`/
 * `updateWasteLine`/`removeWasteLine`), sin duplicar ninguna regla de
 * negocio aca: cada handler solo valida el body (Zod) y delega.
 */
import type { Request, Response } from 'express';
import { asyncHandler } from '@/shared/utils/asyncHandler';
import { success } from '@/shared/utils/httpResponse';
import { buildPaginationMeta, resolvePagination } from '@/shared/utils/pagination';
import { HttpStatus } from '@/shared/constants';
import { UnauthorizedError } from '@/shared/errors';
import {
  AddProcessingOutputItemSchema,
  AddProcessingWasteItemSchema,
  CreateProcessingOperationSchema,
  ListProcessingOperationsQuerySchema,
  UpdateProcessingOperationSchema,
  UpdateProcessingOutputItemSchema,
  UpdateProcessingWasteItemSchema,
} from './validation';
import * as processingService from './service';

/** POST /processing
 * `performedByUserId` NUNCA se acepta del cliente — se resuelve desde
 * `req.user` (el usuario autenticado que registra la operacion), mismo
 * criterio que `inventoryWaste/controller.ts::create`. */
export const create = asyncHandler(async (req: Request, res: Response) => {
  const body = CreateProcessingOperationSchema.parse(req.body);

  if (!req.user) {
    throw new UnauthorizedError('Usuario autenticado no encontrado en la petición.');
  }

  const result = await processingService.create({
    ...body,
    performedByUserId: req.user.id,
  });

  res.status(HttpStatus.CREATED).json(success(result));
});

/** GET /processing */
export const findMany = asyncHandler(async (req: Request, res: Response) => {
  const query = ListProcessingOperationsQuerySchema.parse(req.query);
  const pagination = resolvePagination({ page: query.page, limit: query.limit });

  const result = await processingService.findMany({
    ...pagination,
    filters: {
      sucursalId: query.sucursalId,
      inputProductId: query.inputProductId,
      status: query.status,
    },
  });

  const meta = buildPaginationMeta(result.total, pagination);

  res.status(HttpStatus.OK).json(success(result.items, { ...meta }));
});

/** GET /processing/:id */
export const findById = asyncHandler(async (req: Request, res: Response) => {
  const result = await processingService.findById(req.params.id);

  res.status(HttpStatus.OK).json(success(result));
});

/** PATCH /processing/:id
 * Solo mientras la operacion sigue `DRAFT` -- validado en `service.ts`. */
export const update = asyncHandler(async (req: Request, res: Response) => {
  const body = UpdateProcessingOperationSchema.parse(req.body);

  const result = await processingService.update(req.params.id, body);

  res.status(HttpStatus.OK).json(success(result));
});

/** POST /processing/:id/complete
 * `performedByUserId` se resuelve desde `req.user`, mismo criterio que
 * `create` de arriba. */
export const complete = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError('Usuario autenticado no encontrado en la petición.');
  }

  const result = await processingService.complete(req.params.id, req.user.id);

  res.status(HttpStatus.OK).json(success(result));
});

/** POST /processing/:id/cancel */
export const cancel = asyncHandler(async (req: Request, res: Response) => {
  const result = await processingService.cancel(req.params.id);

  res.status(HttpStatus.OK).json(success(result));
});

/** POST /processing/:id/output-items
 * Solo mientras la operacion sigue `DRAFT` -- validado en
 * `service.ts::addOutputItem` (via `findDraftOrThrow`). */
export const addOutputItem = asyncHandler(async (req: Request, res: Response) => {
  const body = AddProcessingOutputItemSchema.parse(req.body);

  const result = await processingService.addOutputItem(req.params.id, body);

  res.status(HttpStatus.CREATED).json(success(result));
});

/** PATCH /processing/:id/output-items/:itemId */
export const updateOutputItem = asyncHandler(async (req: Request, res: Response) => {
  const body = UpdateProcessingOutputItemSchema.parse(req.body);

  const result = await processingService.updateOutputItem(req.params.id, req.params.itemId, body);

  res.status(HttpStatus.OK).json(success(result));
});

/** DELETE /processing/:id/output-items/:itemId
 * Mismo patron de respuesta que `inventoryWaste/controller.ts::remove`
 * (`204 No Content`, sin body). */
export const removeOutputItem = asyncHandler(async (req: Request, res: Response) => {
  await processingService.removeOutputItem(req.params.id, req.params.itemId);

  res.status(HttpStatus.NO_CONTENT).send();
});

/** POST /processing/:id/waste-items
 * Solo mientras la operacion sigue `DRAFT` -- validado en
 * `service.ts::addWasteLine` (via `findDraftOrThrow`). */
export const addWasteLine = asyncHandler(async (req: Request, res: Response) => {
  const body = AddProcessingWasteItemSchema.parse(req.body);

  const result = await processingService.addWasteLine(req.params.id, body);

  res.status(HttpStatus.CREATED).json(success(result));
});

/** PATCH /processing/:id/waste-items/:itemId */
export const updateWasteLine = asyncHandler(async (req: Request, res: Response) => {
  const body = UpdateProcessingWasteItemSchema.parse(req.body);

  const result = await processingService.updateWasteLine(req.params.id, req.params.itemId, body);

  res.status(HttpStatus.OK).json(success(result));
});

/** DELETE /processing/:id/waste-items/:itemId
 * Mismo patron de respuesta que `removeOutputItem` de arriba. */
export const removeWasteLine = asyncHandler(async (req: Request, res: Response) => {
  await processingService.removeWasteLine(req.params.id, req.params.itemId);

  res.status(HttpStatus.NO_CONTENT).send();
});
