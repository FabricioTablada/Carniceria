/**
 * modules/permissions/index.ts
 * -----------------------------------------------------------------------------
 * Punto unico de exportacion del modulo de permisos.
 * Centraliza lo que el resto de la aplicacion puede consumir de este modulo;
 * nada fuera de esta carpeta debe importar los archivos internos
 * (`permissions.controller.ts`, `permissions.service.ts`, etc.) directamente.
 */
export { permissionsRoutes } from './permissions.routes';
export {
  create as createPermissionController,
  findById as findByIdPermissionController,
  findMany as findManyPermissionsController,
  update as updatePermissionController,
} from './permissions.controller';
export {
  create as createPermissionService,
  findById as findByIdPermissionService,
  findMany as findManyPermissionsService,
  update as updatePermissionService,
} from './permissions.service';
export {
  CreatePermissionSchema,
  UpdatePermissionSchema,
  ListPermissionsQuerySchema,
} from './permissions.validation';
export type {
  CreatePermissionDto,
  UpdatePermissionDto,
  ListPermissionsQueryDto,
} from './permissions.validation';
