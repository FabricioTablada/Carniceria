/**
 * modules/returns/controller.ts
 * -----------------------------------------------------------------------------
 * Controlador HTTP del modulo de devoluciones (Bloque 4.2). Solo se encarga
 * de: validar la peticion, invocar la logica de negocio de
 * `returns.service.ts` y responder con el formato estandar de la API. No
 * accede a Prisma ni contiene logica de negocio.
 */
import type { Request, Response } from 'express';
import { asyncHandler } from '@/shared/utils/asyncHandler';
import { success } from '@/shared/utils/httpResponse';
import { buildPaginationMeta, resolvePagination } from '@/shared/utils/pagination';
import { HttpStatus } from '@/shared/constants';
import { ForbiddenError, UnauthorizedError } from '@/shared/errors';
import * as rolesService from '@/modules/roles/roles.service';
import { CreateSaleReturnSchema, ListSaleReturnsQuerySchema } from './validation';
import * as returnsService from './service';

/** POST /returns
 * `performedByUserId` NUNCA se acepta del cliente — se resuelve desde
 * `req.user` (el usuario autenticado que procesa la devolucion), mismo
 * criterio que `voidSale`/`correctSale` en `sales/controller.ts`.
 *
 * Sprint QA 3.1 (correccion de autorizacion): `returns.create` (exigido por
 * la ruta via `authorizePermission`) alcanza para una devolucion con
 * `restock: true` en todas sus lineas. Si al menos una linea llega con
 * `restock: false`, el resultado es equivalente a registrar una merma (el
 * producto no reingresa al inventario) — se exige, ADEMAS, el permiso
 * `inventory.waste`, el mismo que ya gobierna esa decision desde el modulo
 * de Inventario. El backend es la autoridad final: esta verificacion ocurre
 * aqui aunque el frontend tambien oculte la opcion sin el permiso. */
export const create = asyncHandler(async (req: Request, res: Response) => {
  const body = CreateSaleReturnSchema.parse(req.body);

  if (!req.user) {
    throw new UnauthorizedError('Usuario autenticado no encontrado en la petición.');
  }

  const hasNonRestockItem = body.items.some((item) => item.restock === false);

  if (hasNonRestockItem) {
    const canRegisterWaste = await rolesService.hasPermission(req.user.role, ['inventory.waste']);

    if (!canRegisterWaste) {
      throw new ForbiddenError(
        'Se requiere el permiso "inventory.waste" para registrar una devolución cuyo producto no reingresa al inventario.',
      );
    }
  }

  const result = await returnsService.createReturn({
    ...body,
    performedByUserId: req.user.id,
  });

  res.status(HttpStatus.CREATED).json(success(result));
});

/** GET /returns/:id */
export const findById = asyncHandler(async (req: Request, res: Response) => {
  const result = await returnsService.findById(req.params.id);

  res.status(HttpStatus.OK).json(success(result));
});

/** GET /returns */
export const findMany = asyncHandler(async (req: Request, res: Response) => {
  const query = ListSaleReturnsQuerySchema.parse(req.query);
  const pagination = resolvePagination({ page: query.page, limit: query.limit });

  const result = await returnsService.findMany({
    ...pagination,
    filters: {
      saleId: query.saleId,
      sucursalId: query.sucursalId,
      cashSessionId: query.cashSessionId,
      userId: query.userId,
    },
  });

  const meta = buildPaginationMeta(result.total, pagination);

  res.status(HttpStatus.OK).json(success(result.items, { ...meta }));
});
