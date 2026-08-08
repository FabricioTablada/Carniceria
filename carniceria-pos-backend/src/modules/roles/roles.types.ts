/**
 * modules/roles/roles.types.ts
 * -----------------------------------------------------------------------------
 * Tipos e interfaces del modulo de roles.
 * Define unicamente las formas de datos que consumen `roles.service.ts`,
 * `roles.repository.ts` y `roles.controller.ts`; no contiene logica de
 * negocio, consultas Prisma ni validaciones (eso vive en sus respectivos
 * archivos: `roles.service.ts`, `roles.repository.ts` y `roles.validation.ts`).
 */
import type { PaginationParams } from '@/shared/utils/pagination';

/** Resumen de un permiso, usado dentro de la lista de permisos de un rol. */
export interface PermissionSummary {
  id: string;
  code: string;
  description: string | null;
}

/** Forma de un rol tal como lo expone el modulo hacia el resto de la app. */
export interface RoleResponse {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  active: boolean;
  permissions: PermissionSummary[];
  createdAt: Date;
  updatedAt: Date;
}

/** Datos requeridos para crear un rol. */
export interface CreateRoleDto {
  name: string;
  description?: string | null;
  permissionIds?: string[];
  active?: boolean;
}

/** Datos permitidos para actualizar un rol existente. Todos opcionales. */
export interface UpdateRoleDto {
  name?: string;
  description?: string | null;
  permissionIds?: string[];
}

/** Filtros de busqueda/listado disponibles para roles. */
export interface ListRolesFilters {
  active?: boolean;
  isSystem?: boolean;
  search?: string;
}

/** Parametros combinados para listar roles: filtros + paginacion. */
export interface ListRolesQuery extends PaginationParams {
  filters?: ListRolesFilters;
}

/** Payload para cambiar el estado (activo/inactivo) de un rol. */
export interface ChangeRoleStatusDto {
  active: boolean;
}

/** Payload para reemplazar el conjunto de permisos asignados a un rol. */
export interface AssignRolePermissionsDto {
  permissionIds: string[];
}

/** Resultado de una operacion de listado paginado de roles. */
export interface ListRolesResult {
  items: RoleResponse[];
  total: number;
}

/** Resultado de las operaciones que devuelven un unico rol. */
export interface RoleResult {
  role: RoleResponse;
}
