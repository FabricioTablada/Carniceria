/**
 * modules/cash/controller.ts
 * -----------------------------------------------------------------------------
 * Controlador HTTP del modulo de caja.
 * Solo se encarga de: validar la peticion, invocar la logica de negocio de
 * `cash.service.ts` y responder con el formato estandar de la API. No
 * accede a Prisma ni calcula importes: esa logica vive en el servicio.
 *
 * Los endpoints se agrupan por agregado (`CashSession` / `CashMovement`),
 * siguiendo la misma separacion de responsabilidades de `cash.service.ts`.
 */
import type { Request, Response } from 'express';
import { asyncHandler } from '@/shared/utils/asyncHandler';
import { success } from '@/shared/utils/httpResponse';
import { buildPaginationMeta, resolvePagination } from '@/shared/utils/pagination';
import { HttpStatus } from '@/shared/constants';
import { UnauthorizedError } from '@/shared/errors';
import {
  CloseCashSessionSchema,
  CreateCashMovementSchema,
  ListCashMovementsQuerySchema,
  ListCashSessionsQuerySchema,
  OpenCashSessionSchema,
  UpdateCashSessionSchema,
} from './validation';
import * as cashService from './service';
import type { CreateCashMovementDto, OpenCashSessionDto } from './types';

// -----------------------------------------------------------------------------
// CashSession: sesiones de caja
// -----------------------------------------------------------------------------

/** POST /sessions */
export const openSession = asyncHandler(async (req: Request, res: Response) => {
  const body = OpenCashSessionSchema.parse(req.body);

  if (!req.user) {
    throw new UnauthorizedError('Usuario autenticado no encontrado en la peticion.');
  }

  const dto: OpenCashSessionDto = {
    ...body,
    sucursalId: req.user.sucursalId,
    openedByUserId: req.user.id,
  };

  const result = await cashService.openSession(dto);

  res.status(HttpStatus.CREATED).json(success(result));
});

/** GET /sessions/:id */
export const findSessionById = asyncHandler(async (req: Request, res: Response) => {
  const result = await cashService.findSessionById(req.params.id);

  res.status(HttpStatus.OK).json(success(result));
});

/** GET /sessions */
export const findSessions = asyncHandler(async (req: Request, res: Response) => {
  const query = ListCashSessionsQuerySchema.parse(req.query);
  const pagination = resolvePagination({ page: query.page, limit: query.limit });

  const result = await cashService.findSessions({
    ...pagination,
    filters: {
      sucursalId: query.sucursalId,
      cashRegisterId: query.cashRegisterId,
      status: query.status,
    },
  });

  const meta = buildPaginationMeta(result.total, pagination);

  res.status(HttpStatus.OK).json(success(result.items, { ...meta }));
});

/** PATCH /sessions/:id */
export const updateSession = asyncHandler(async (req: Request, res: Response) => {
  const dto = UpdateCashSessionSchema.parse(req.body);

  const result = await cashService.updateSession(req.params.id, dto);

  res.status(HttpStatus.OK).json(success(result));
});

/** PATCH /sessions/:id/close */
export const closeSession = asyncHandler(async (req: Request, res: Response) => {
  const dto = CloseCashSessionSchema.parse(req.body);

  if (!req.user) {
    throw new UnauthorizedError('Usuario autenticado no encontrado en la peticion.');
  }

  const result = await cashService.closeSession(req.params.id, dto, req.user.id);

  res.status(HttpStatus.OK).json(success(result));
});

// -----------------------------------------------------------------------------
// CashMovement: movimientos de caja
// -----------------------------------------------------------------------------

/** POST /movements */
export const registerMovement = asyncHandler(async (req: Request, res: Response) => {
  const body = CreateCashMovementSchema.parse(req.body);

  // `sucursalId` y `userId` NO se aceptan del cliente: se resuelven desde
  // `req.user`, adjuntado por `authenticate.middleware.ts` a partir del
  // JWT. Esta ruta siempre pasa por ese middleware (ver routes.ts), asi
  // que `req.user` esta garantizado; el chequeo de abajo es defensivo.
  // Mismo criterio ya aplicado en `purchases.controller.ts`,
  // `users.controller.ts` y `cashRegister.controller.ts`.
  if (!req.user) {
    throw new UnauthorizedError('Usuario autenticado no encontrado en la peticion.');
  }

  const dto: CreateCashMovementDto = {
    ...body,
    sucursalId: req.user.sucursalId,
    userId: req.user.id,
  };

  const result = await cashService.registerMovement(dto);

  res.status(HttpStatus.CREATED).json(success(result));
});

/** GET /movements/:id */
export const findMovementById = asyncHandler(async (req: Request, res: Response) => {
  const result = await cashService.findMovementById(req.params.id);

  res.status(HttpStatus.OK).json(success(result));
});

/** GET /movements */
export const findMovements = asyncHandler(async (req: Request, res: Response) => {
  const query = ListCashMovementsQuerySchema.parse(req.query);
  const pagination = resolvePagination({ page: query.page, limit: query.limit });

  const result = await cashService.findMovements({
    ...pagination,
    filters: {
      sucursalId: query.sucursalId,
      cashSessionId: query.cashSessionId,
      userId: query.userId,
      type: query.type,
    },
  });

  const meta = buildPaginationMeta(result.total, pagination);

  res.status(HttpStatus.OK).json(success(result.items, { ...meta }));
});
