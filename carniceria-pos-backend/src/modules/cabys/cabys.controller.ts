/**
 * modules/cabys/cabys.controller.ts
 * -----------------------------------------------------------------------------
 * Controlador HTTP del modulo CABYS. Una unica ruta en este bloque.
 */
import type { Request, Response } from 'express';
import { asyncHandler } from '@/shared/utils/asyncHandler';
import { success } from '@/shared/utils/httpResponse';
import { resolveLookupParams } from '@/shared/utils/lookup';
import { HttpStatus } from '@/shared/constants';
import { UnauthorizedError } from '@/shared/errors';
import { ApplyCabysCatalogUpdateSchema, LookupCabysQuerySchema } from './cabys.validation';
import * as cabysService from './cabys.service';
import * as catalogSyncService from './catalogSync.service';

/** GET /cabys/lookup */
export const lookup = asyncHandler(async (req: Request, res: Response) => {
  const query = LookupCabysQuerySchema.parse(req.query);
  const { take } = resolveLookupParams({ limit: query.limit });

  const result = await cabysService.lookup({
    take,
    filters: { search: query.search },
  });

  res.status(HttpStatus.OK).json(success(result));
});

/** GET /cabys/catalog/check-updates — liviano, nunca descarga el archivo
 * completo (ver `catalogImport.ts::checkRemoteCatalogVersion`). */
export const checkForCatalogUpdates = asyncHandler(async (_req: Request, res: Response) => {
  const result = await catalogSyncService.checkForUpdates();

  res.status(HttpStatus.OK).json(success(result));
});

/** POST /cabys/catalog/preview — descarga a un archivo temporal, valida y
 * compara; nunca escribe en la base de datos. */
export const previewCatalogUpdate = asyncHandler(async (_req: Request, res: Response) => {
  const result = await catalogSyncService.previewUpdate();

  res.status(HttpStatus.OK).json(success(result));
});

/** POST /cabys/catalog/apply — aplica exactamente el diff identificado por
 * el `previewToken` ya mostrado al usuario. */
export const applyCatalogUpdate = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError('Usuario autenticado no encontrado en la petición.');
  }

  const body = ApplyCabysCatalogUpdateSchema.parse(req.body);

  const result = await catalogSyncService.applyUpdate({
    previewToken: body.previewToken,
    userId: req.user.id,
    sucursalId: req.user.sucursalId,
  });

  res.status(HttpStatus.OK).json(success(result));
});
