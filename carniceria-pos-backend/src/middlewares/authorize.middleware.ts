/**
 * middlewares/authorize.middleware.ts
 * -----------------------------------------------------------------------------
 * Control de acceso basado en roles y permisos (RBAC). Se usa despues de
 * `authenticate`.
 *
 * Expone dos mecanismos, pensados para convivir:
 *  - `authorize(...allowedRoles)`: verifica que el rol del usuario
 *    autenticado este dentro de una lista fija de roles (`SystemRole` u
 *    otro nombre de rol). Mecanismo original, sin cambios de comportamiento.
 *  - `authorizePermission(...requiredPermissions)`: verifica que el rol del
 *    usuario autenticado tenga asignado al menos uno de los codigos de
 *    permiso indicados (p.ej. "users.create", "roles.assign_permissions").
 *    La consulta vive en el modulo `roles` (`roles.service.ts` ->
 *    `roles.repository.ts` -> Prisma); este middleware unicamente invoca
 *    `rolesService.hasPermission(...)` y no accede a Prisma ni a ninguna
 *    otra fuente de datos directamente, respetando la arquitectura por
 *    capas del proyecto (Middleware -> Service -> Repository -> Prisma).
 *
 * Ejemplo de uso futuro en una ruta:
 *   authorize('ADMIN', 'MANAGER')
 *   authorizePermission('users.create')
 */
import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '@/shared/errors';
import * as rolesService from '@/modules/roles/roles.service';

export function authorize(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError();
    }
    if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError();
    }
    next();
  };
}

/**
 * Autoriza segun los permisos asignados al rol del usuario autenticado
 * (RBAC basado en permisos), en lugar de nombres de rol fijos. Permite el
 * acceso si el usuario cuenta con al menos uno de los permisos indicados.
 */
export function authorizePermission(...requiredPermissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError();
    }

    rolesService
      .hasPermission(req.user.role, requiredPermissions)
      .then((hasPermission) => {
        if (!hasPermission) {
          throw new ForbiddenError();
        }
        next();
      })
      .catch(next);
  };
}
