/**
 * modules/configuration/controller.ts
 * -----------------------------------------------------------------------------
 * Controlador HTTP del modulo de configuracion funcional del sistema.
 * Solo se encarga de: validar la peticion, invocar la logica de negocio de
 * `configuration.service.ts` y responder con el formato estandar de la
 * API. No accede a Prisma ni valida duplicados/existencia: esa logica vive
 * en el servicio.
 */
import type { Request, Response } from 'express';
import { asyncHandler } from '@/shared/utils/asyncHandler';
import { success } from '@/shared/utils/httpResponse';
import { buildPaginationMeta, resolvePagination } from '@/shared/utils/pagination';
import { HttpStatus } from '@/shared/constants';
import { UnauthorizedError } from '@/shared/errors';
import {
  CreateConfigurationSchema,
  ListConfigurationsQuerySchema,
  UpdateConfigurationSchema,
} from './validation';
import * as configurationService from './service';
import type { CreateConfigurationDto } from './types';

/** POST / */
export const create = asyncHandler(async (req: Request, res: Response) => {
  const body = CreateConfigurationSchema.parse(req.body);

  // `sucursalId` NO se acepta del cliente: se resuelve desde `req.user`,
  // adjuntado por `authenticate.middleware.ts` a partir del JWT. Esta
  // ruta siempre pasa por ese middleware (ver routes.ts), asi que
  // `req.user` esta garantizado; el chequeo de abajo es defensivo.
  // Mismo criterio ya aplicado en `purchases.controller.ts`.
  if (!req.user) {
    throw new UnauthorizedError('Usuario autenticado no encontrado en la peticion.');
  }

  const dto: CreateConfigurationDto = {
    ...body,
    sucursalId: req.user.sucursalId,
  };

  const result = await configurationService.create(dto);

  res.status(HttpStatus.CREATED).json(success(result));
});

/** GET /:id */
export const findById = asyncHandler(async (req: Request, res: Response) => {
  const result = await configurationService.findById(req.params.id);

  res.status(HttpStatus.OK).json(success(result));
});

/** GET / */
export const findMany = asyncHandler(async (req: Request, res: Response) => {
  const query = ListConfigurationsQuerySchema.parse(req.query);
  const pagination = resolvePagination({ page: query.page, limit: query.limit });

  const result = await configurationService.findMany({
    ...pagination,
    filters: {
      sucursalId: query.sucursalId,
      type: query.type,
      search: query.search,
    },
  });

  const meta = buildPaginationMeta(result.total, pagination);

  res.status(HttpStatus.OK).json(success(result.items, { ...meta }));
});

/** PATCH /:id */
export const update = asyncHandler(async (req: Request, res: Response) => {
  const dto = UpdateConfigurationSchema.parse(req.body);

  const result = await configurationService.update(req.params.id, dto);

  res.status(HttpStatus.OK).json(success(result));
});
