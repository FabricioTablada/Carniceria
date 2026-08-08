/**
 * modules/cashRegister/cashRegister.controller.ts
 * -----------------------------------------------------------------------------
 * Controlador HTTP del modulo de cajas registradoras.
 * Solo se encarga de: validar la peticion, invocar la logica de negocio de
 * `cashRegister.service.ts` y responder con el formato estandar de la API.
 * No accede a Prisma ni valida duplicados/existencia: esa logica vive en el
 * servicio.
 */
import type { Request, Response } from 'express';
import { asyncHandler } from '@/shared/utils/asyncHandler';
import { success } from '@/shared/utils/httpResponse';
import { buildPaginationMeta, resolvePagination } from '@/shared/utils/pagination';
import { HttpStatus } from '@/shared/constants';
import { UnauthorizedError } from '@/shared/errors';
import {
  ChangeCashRegisterStatusSchema,
  CreateCashRegisterSchema,
  ListCashRegistersQuerySchema,
  UpdateCashRegisterSchema,
} from './cashRegister.validation';
import * as cashRegisterService from './cashRegister.service';
import type { CreateCashRegisterDto } from './cashRegister.types';

/** POST /cash-registers */
export const create = asyncHandler(async (req: Request, res: Response) => {
  const body = CreateCashRegisterSchema.parse(req.body);

  // `sucursalId` NO se acepta del cliente: se resuelve desde `req.user`,
  // adjuntado por `authenticate.middleware.ts` a partir del JWT. Esta
  // ruta siempre pasa por ese middleware (ver cashRegister.routes.ts),
  // asi que `req.user` esta garantizado; el chequeo de abajo es
  // defensivo. Mismo criterio ya aplicado en `purchases.controller.ts`
  // y `users.controller.ts`.
  if (!req.user) {
    throw new UnauthorizedError('Usuario autenticado no encontrado en la peticion.');
  }

  const dto: CreateCashRegisterDto = {
    ...body,
    sucursalId: req.user.sucursalId,
  };

  const result = await cashRegisterService.create(dto);

  res.status(HttpStatus.CREATED).json(success(result));
});

/** GET /cash-registers/:id */
export const findById = asyncHandler(async (req: Request, res: Response) => {
  const result = await cashRegisterService.findById(req.params.id);

  res.status(HttpStatus.OK).json(success(result));
});

/** GET /cash-registers */
export const findMany = asyncHandler(async (req: Request, res: Response) => {
  const query = ListCashRegistersQuerySchema.parse(req.query);
  const pagination = resolvePagination({ page: query.page, limit: query.limit });

  const result = await cashRegisterService.findMany({
    ...pagination,
    filters: {
      sucursalId: query.sucursalId,
      active: query.active,
      search: query.search,
    },
  });

  const meta = buildPaginationMeta(result.total, pagination);

  res.status(HttpStatus.OK).json(success(result.items, { ...meta }));
});

/** PATCH /cash-registers/:id */
export const update = asyncHandler(async (req: Request, res: Response) => {
  const dto = UpdateCashRegisterSchema.parse(req.body);

  const result = await cashRegisterService.update(req.params.id, dto);

  res.status(HttpStatus.OK).json(success(result));
});

/** PATCH /cash-registers/:id/status */
export const changeStatus = asyncHandler(async (req: Request, res: Response) => {
  const dto = ChangeCashRegisterStatusSchema.parse(req.body);

  const result = await cashRegisterService.changeStatus(req.params.id, dto);

  res.status(HttpStatus.OK).json(success(result));
});