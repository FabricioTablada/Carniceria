/**
 * modules/sales/controller.ts
 * -----------------------------------------------------------------------------
 * Controlador HTTP del modulo de ventas.
 * Solo se encarga de: validar la peticion, invocar la logica de negocio de
 * `sales.service.ts` y responder con el formato estandar de la API. No
 * accede a Prisma ni calcula totales: esa logica vive en el servicio.
 */
import type { Request, Response } from 'express';
import { asyncHandler } from '@/shared/utils/asyncHandler';
import { success } from '@/shared/utils/httpResponse';
import { buildPaginationMeta, resolvePagination } from '@/shared/utils/pagination';
import { HttpStatus } from '@/shared/constants';
import { UnauthorizedError } from '@/shared/errors';
import {
  CorrectSaleSchema,
  CreateSaleSchema,
  ListSalesQuerySchema,
  SaleQuoteSchema,
  UpdateSaleSchema,
  VoidSaleSchema,
} from './validation';
import * as salesService from './service';
import type { CreateSaleDto, CreateSaleQuoteDto } from './types';

/** POST / */
export const create = asyncHandler(async (req: Request, res: Response) => {
  const body = CreateSaleSchema.parse(req.body);

  // `userId` y `sucursalId` NO se aceptan del cliente: se resuelven desde
  // `req.user`, adjuntado por `authenticate.middleware.ts` a partir del
  // JWT. Esta ruta siempre pasa por ese middleware (ver routes.ts), asi
  // que `req.user` esta garantizado; el chequeo de abajo es defensivo.
  if (!req.user) {
    throw new UnauthorizedError('Usuario autenticado no encontrado en la peticion.');
  }

  const dto: CreateSaleDto = {
    ...body,
    userId: req.user.id,
    sucursalId: req.user.sucursalId,
  };

  const result = await salesService.create(dto);

  res.status(HttpStatus.CREATED).json(success(result));
});

/** POST /quote
 * Bloque P.7: cotiza una venta SIN crearla — no persiste nada, no genera
 * movimientos de inventario, no requiere `cashSessionId` (nada se cobra).
 * `sucursalId` se resuelve desde `req.user`, mismo criterio que `create()`:
 * un cajero solo puede cotizar para su propia sucursal. */
export const getQuote = asyncHandler(async (req: Request, res: Response) => {
  const body = SaleQuoteSchema.parse(req.body);

  if (!req.user) {
    throw new UnauthorizedError('Usuario autenticado no encontrado en la peticion.');
  }

  const dto: CreateSaleQuoteDto = {
    ...body,
    sucursalId: req.user.sucursalId,
  };

  const result = await salesService.getQuote(dto);

  res.status(HttpStatus.OK).json(success(result));
});

/** GET /:id */
export const findById = asyncHandler(async (req: Request, res: Response) => {
  const result = await salesService.findById(req.params.id);

  res.status(HttpStatus.OK).json(success(result));
});

/** GET / */
export const findMany = asyncHandler(async (req: Request, res: Response) => {
  const query = ListSalesQuerySchema.parse(req.query);
  const pagination = resolvePagination({ page: query.page, limit: query.limit });

  const result = await salesService.findMany({
    ...pagination,
    filters: {
      sucursalId: query.sucursalId,
      userId: query.userId,
      cashSessionId: query.cashSessionId,
      status: query.status,
    },
  });

  const meta = buildPaginationMeta(result.total, pagination);

  res.status(HttpStatus.OK).json(success(result.items, { ...meta }));
});

/** PATCH /:id */
export const update = asyncHandler(async (req: Request, res: Response) => {
  const dto = UpdateSaleSchema.parse(req.body);

  const result = await salesService.update(req.params.id, dto);

  res.status(HttpStatus.OK).json(success(result));
});

/** POST /:id/void
 * Bloque 3 ("Anulacion/Correccion de Venta"): `performedByUserId` NUNCA se
 * acepta del cliente — se resuelve desde `req.user` (el administrador
 * autenticado), mismo criterio que `userId`/`sucursalId` en `create()`. */
export const voidSale = asyncHandler(async (req: Request, res: Response) => {
  const body = VoidSaleSchema.parse(req.body);

  if (!req.user) {
    throw new UnauthorizedError('Usuario autenticado no encontrado en la peticion.');
  }

  const result = await salesService.voidSale(req.params.id, {
    reason: body.reason,
    performedByUserId: req.user.id,
  });

  res.status(HttpStatus.OK).json(success(result));
});

/** POST /:id/correct
 * Bloque 3: mismo criterio que `voidSale` para `performedByUserId`. La
 * sucursal y la sesion de caja de la venta correctiva las resuelve
 * `salesService.correctSale` a partir de la venta original — no se aceptan
 * aqui, para que no puedan cambiarse en una correccion (ver
 * `CorrectSaleDto` en `types.ts`). */
export const correctSale = asyncHandler(async (req: Request, res: Response) => {
  const body = CorrectSaleSchema.parse(req.body);

  if (!req.user) {
    throw new UnauthorizedError('Usuario autenticado no encontrado en la peticion.');
  }

  const result = await salesService.correctSale(req.params.id, {
    ...body,
    performedByUserId: req.user.id,
  });

  res.status(HttpStatus.OK).json(success(result));
});
