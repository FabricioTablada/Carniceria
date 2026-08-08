/**
 * modules/roles/roles.controller.ts
 * -----------------------------------------------------------------------------
 * Controlador HTTP del modulo de roles.
 * Solo se encarga de: validar la peticion, invocar la logica de negocio de
 * `roles.service.ts` y responder con el formato estandar de la API. No
 * accede a Prisma ni valida duplicados/existencia: esa logica vive en el
 * servicio.
 */
import type { Request, Response } from 'express';
import { asyncHandler } from '@/shared/utils/asyncHandler';
import { success } from '@/shared/utils/httpResponse';
import { buildPaginationMeta, resolvePagination } from '@/shared/utils/pagination';
import { HttpStatus } from '@/shared/constants';
import {
  AssignRolePermissionsSchema,
  ChangeRoleStatusSchema,
  CreateRoleSchema,
  ListRolesQuerySchema,
  UpdateRoleSchema,
} from './roles.validation';
import * as rolesService from './roles.service';

/** POST /roles */
export const create = asyncHandler(async (req: Request, res: Response) => {
  const dto = CreateRoleSchema.parse(req.body);

  const result = await rolesService.create(dto);

  res.status(HttpStatus.CREATED).json(success(result));
});

/** GET /roles/:id */
export const findById = asyncHandler(async (req: Request, res: Response) => {
  const result = await rolesService.findById(req.params.id);

  res.status(HttpStatus.OK).json(success(result));
});

/** GET /roles */
export const findMany = asyncHandler(async (req: Request, res: Response) => {
  const query = ListRolesQuerySchema.parse(req.query);
  const pagination = resolvePagination({ page: query.page, limit: query.limit });

  const result = await rolesService.findMany({
    ...pagination,
    filters: {
      active: query.active,
      isSystem: query.isSystem,
      search: query.search,
    },
  });

  const meta = buildPaginationMeta(result.total, pagination);

  res.status(HttpStatus.OK).json(success(result.items, { ...meta }));
});

/** PATCH /roles/:id */
export const update = asyncHandler(async (req: Request, res: Response) => {
  const dto = UpdateRoleSchema.parse(req.body);

  const result = await rolesService.update(req.params.id, dto);

  res.status(HttpStatus.OK).json(success(result));
});

/** PATCH /roles/:id/status */
export const changeStatus = asyncHandler(async (req: Request, res: Response) => {
  const dto = ChangeRoleStatusSchema.parse(req.body);

  const result = await rolesService.changeStatus(req.params.id, dto);

  res.status(HttpStatus.OK).json(success(result));
});

/** PATCH /roles/:id/permissions */
export const assignPermissions = asyncHandler(async (req: Request, res: Response) => {
  const dto = AssignRolePermissionsSchema.parse(req.body);

  const result = await rolesService.assignPermissions(req.params.id, dto);

  res.status(HttpStatus.OK).json(success(result));
});
