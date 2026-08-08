/**
 * modules/permissions/permissions.controller.ts
 * -----------------------------------------------------------------------------
 * Controlador HTTP del modulo de permisos.
 * Solo se encarga de: validar la peticion, invocar la logica de negocio de
 * `permissions.service.ts` y responder con el formato estandar de la API.
 * No accede a Prisma ni valida duplicados/existencia: esa logica vive en el
 * servicio.
 */
import type { Request, Response } from 'express';
import { asyncHandler } from '@/shared/utils/asyncHandler';
import { success } from '@/shared/utils/httpResponse';
import { buildPaginationMeta, resolvePagination } from '@/shared/utils/pagination';
import { HttpStatus } from '@/shared/constants';
import {
  CreatePermissionSchema,
  ListPermissionsQuerySchema,
  UpdatePermissionSchema,
} from './permissions.validation';
import * as permissionsService from './permissions.service';

/** POST /permissions */
export const create = asyncHandler(async (req: Request, res: Response) => {
  const dto = CreatePermissionSchema.parse(req.body);

  const result = await permissionsService.create(dto);

  res.status(HttpStatus.CREATED).json(success(result));
});

/** GET /permissions/:id */
export const findById = asyncHandler(async (req: Request, res: Response) => {
  const result = await permissionsService.findById(req.params.id);

  res.status(HttpStatus.OK).json(success(result));
});

/** GET /permissions */
export const findMany = asyncHandler(async (req: Request, res: Response) => {
  const query = ListPermissionsQuerySchema.parse(req.query);
  const pagination = resolvePagination({ page: query.page, limit: query.limit });

  const result = await permissionsService.findMany({
    ...pagination,
    filters: {
      search: query.search,
    },
  });

  const meta = buildPaginationMeta(result.total, pagination);

  res.status(HttpStatus.OK).json(success(result.items, { ...meta }));
});

/** PATCH /permissions/:id */
export const update = asyncHandler(async (req: Request, res: Response) => {
  const dto = UpdatePermissionSchema.parse(req.body);

  const result = await permissionsService.update(req.params.id, dto);

  res.status(HttpStatus.OK).json(success(result));
});
