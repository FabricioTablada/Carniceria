/**
 * modules/users/users.controller.ts
 * -----------------------------------------------------------------------------
 * Controlador HTTP del modulo de usuarios.
 * Solo se encarga de: validar la peticion, invocar la logica de negocio de
 * `users.service.ts` y responder con el formato estandar de la API. No
 * accede a Prisma, no hashea contrasenas ni valida duplicados: esa logica
 * vive en el servicio.
 */
import type { Request, Response } from 'express';
import { asyncHandler } from '@/shared/utils/asyncHandler';
import { success } from '@/shared/utils/httpResponse';
import { buildPaginationMeta, resolvePagination } from '@/shared/utils/pagination';
import { resolveLookupParams } from '@/shared/utils/lookup';
import { HttpStatus } from '@/shared/constants';
import { UnauthorizedError } from '@/shared/errors';
import {
  ChangeUserStatusSchema,
  CreateUserSchema,
  ListUsersQuerySchema,
  LookupUsersQuerySchema,
  UpdateUserSchema,
} from './users.validation';
import * as usersService from './users.service';
import type { CreateUserDto } from './users.types';

/** POST /users */
export const create = asyncHandler(async (req: Request, res: Response) => {
  const body = CreateUserSchema.parse(req.body);

  // `sucursalId` NO se acepta del cliente: se resuelve desde `req.user`,
  // adjuntado por `authenticate.middleware.ts` a partir del JWT. Esta
  // ruta siempre pasa por ese middleware (ver users.routes.ts), asi que
  // `req.user` esta garantizado; el chequeo de abajo es defensivo.
  // Mismo criterio ya aplicado en `purchases.controller.ts`.
  if (!req.user) {
    throw new UnauthorizedError('Usuario autenticado no encontrado en la peticion.');
  }

  const dto: CreateUserDto = {
    ...body,
    sucursalId: req.user.sucursalId,
  };

  const result = await usersService.create(dto, req.user.role);

  res.status(HttpStatus.CREATED).json(success(result));
});

/** GET /users/me
 * Devuelve el perfil del usuario autenticado, resuelto siempre desde
 * `req.user.id` (JWT, via `authenticate.middleware.ts`) — nunca desde un
 * parametro de la URL. Reutiliza `usersService.findById()` tal cual (sin
 * modificarlo): el unico cambio es de donde sale el id que se le pasa.
 * Al no depender de ningun `:id` externo, no existe forma de solicitar el
 * perfil de otro usuario a traves de este endpoint. */
export const findMe = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError('Usuario autenticado no encontrado en la peticion.');
  }

  const result = await usersService.findById(req.user.id);

  res.status(HttpStatus.OK).json(success(result));
});

/** GET /users/:id */
export const findById = asyncHandler(async (req: Request, res: Response) => {
  const result = await usersService.findById(req.params.id);

  res.status(HttpStatus.OK).json(success(result));
});

/** GET /users */
export const findMany = asyncHandler(async (req: Request, res: Response) => {
  const query = ListUsersQuerySchema.parse(req.query);
  const pagination = resolvePagination({ page: query.page, limit: query.limit });

  const result = await usersService.findMany({
    ...pagination,
    filters: {
      sucursalId: query.sucursalId,
      roleId: query.roleId,
      active: query.active,
      search: query.search,
    },
  });

  const meta = buildPaginationMeta(result.total, pagination);

  res.status(HttpStatus.OK).json(success(result.items, { ...meta }));
});

/** GET /users/lookup
 * Arquitectura de selectores, Bloque 1: patron de lookup para el selector
 * de usuarios/cajeros — respuesta liviana (`{id,label}[]`, `label` =
 * `fullName`), sin `meta` de paginacion. Registrada antes de `GET /:id` en
 * `users.routes.ts` (mismo criterio que `GET /me`, ya registrada antes de
 * `GET /:id` por la misma razon). */
export const lookup = asyncHandler(async (req: Request, res: Response) => {
  const query = LookupUsersQuerySchema.parse(req.query);
  const { take } = resolveLookupParams({ limit: query.limit });

  const result = await usersService.lookup({
    take,
    filters: {
      search: query.search,
      active: query.active,
    },
  });

  res.status(HttpStatus.OK).json(success(result));
});

/** PATCH /users/:id */
export const update = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError(
      'Usuario autenticado no encontrado en la peticion.',
    );
  }

  const dto = UpdateUserSchema.parse(req.body);

  const result = await usersService.update(
    req.params.id,
    dto,
    req.user.id,
    req.user.role,
  );

  res.status(HttpStatus.OK).json(success(result));
});

/** PATCH /users/:id/status */
export const changeStatus = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new UnauthorizedError('Usuario autenticado no encontrado en la peticion.');
  }

  const dto = ChangeUserStatusSchema.parse(req.body);

  const result = await usersService.changeStatus(req.params.id, dto, req.user.id);

  res.status(HttpStatus.OK).json(success(result));
});