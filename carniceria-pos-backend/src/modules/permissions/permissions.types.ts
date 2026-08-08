/**
 * modules/permissions/permissions.types.ts
 * -----------------------------------------------------------------------------
 * Tipos e interfaces del modulo de permisos.
 * Define unicamente las formas de datos que consumen
 * `permissions.service.ts`, `permissions.repository.ts` y
 * `permissions.controller.ts`; no contiene logica de negocio, consultas
 * Prisma ni validaciones (eso vive en sus respectivos archivos:
 * `permissions.service.ts`, `permissions.repository.ts` y
 * `permissions.validation.ts`).
 */
import type { PaginationParams } from '@/shared/utils/pagination';

/** Forma de un permiso tal como lo expone el modulo hacia el resto de la app. */
export interface PermissionResponse {
  id: string;
  code: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Datos requeridos para crear un permiso. */
export interface CreatePermissionDto {
  code: string;
  description?: string | null;
}

/** Datos permitidos para actualizar un permiso existente. Todos opcionales. */
export interface UpdatePermissionDto {
  code?: string;
  description?: string | null;
}

/** Filtros de busqueda/listado disponibles para permisos. */
export interface ListPermissionsFilters {
  search?: string;
}

/** Parametros combinados para listar permisos: filtros + paginacion. */
export interface ListPermissionsQuery extends PaginationParams {
  filters?: ListPermissionsFilters;
}

/** Resultado de una operacion de listado paginado de permisos. */
export interface ListPermissionsResult {
  items: PermissionResponse[];
  total: number;
}

/** Resultado de las operaciones que devuelven un unico permiso. */
export interface PermissionResult {
  permission: PermissionResponse;
}
