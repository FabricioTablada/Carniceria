/**
 * modules/roles/index.ts
 * -----------------------------------------------------------------------------
 * Punto unico de exportacion del modulo de roles.
 * Centraliza lo que el resto de la aplicacion puede consumir de este modulo;
 * nada fuera de esta carpeta debe importar los archivos internos
 * (`roles.controller.ts`, `roles.service.ts`, etc.) directamente.
 */
export { rolesRoutes } from './roles.routes';
export {
  create as createRoleController,
  findById as findByIdRoleController,
  findMany as findManyRolesController,
  update as updateRoleController,
  changeStatus as changeRoleStatusController,
  assignPermissions as assignRolePermissionsController,
} from './roles.controller';
export {
  create as createRoleService,
  findById as findByIdRoleService,
  findMany as findManyRolesService,
  update as updateRoleService,
  changeStatus as changeRoleStatusService,
  assignPermissions as assignRolePermissionsService,
} from './roles.service';
export {
  CreateRoleSchema,
  UpdateRoleSchema,
  ListRolesQuerySchema,
  ChangeRoleStatusSchema,
  AssignRolePermissionsSchema,
} from './roles.validation';
export type {
  CreateRoleDto,
  UpdateRoleDto,
  ListRolesQueryDto,
  ChangeRoleStatusDto,
  AssignRolePermissionsDto,
} from './roles.validation';
