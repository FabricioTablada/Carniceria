/**
 * modules/users/users.types.ts
 * -----------------------------------------------------------------------------
 * Tipos e interfaces del modulo de usuarios.
 * Define unicamente las formas de datos que consumen `users.service.ts`,
 * `users.repository.ts` y `users.controller.ts`; no contiene logica de
 * negocio, consultas Prisma ni validaciones (eso vive en sus respectivos
 * archivos: `users.service.ts`, `users.repository.ts` y `users.validation.ts`).
 */
import type { PaginationParams } from '@/shared/utils/pagination';
import type { LookupParams } from '@/shared/utils/lookup';

/** Resumen del rol asociado a un usuario, usado en las respuestas del servicio. */
export interface UserRoleSummary {
  id: string;
  name: string;
}

/** Forma de un usuario tal como lo expone el modulo hacia el resto de la app. */
export interface UserResponse {
  id: string;
  sucursalId: string;
  username: string;
  email: string | null;
  fullName: string;
  active: boolean;
  role: UserRoleSummary;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Datos requeridos para crear un usuario. */
export interface CreateUserDto {
  sucursalId: string;
  roleId: string;
  username: string;
  email?: string | null;
  fullName: string;
  password: string;
  active?: boolean;
}

/** Datos permitidos para actualizar un usuario existente. Todos opcionales. */
export interface UpdateUserDto {
  sucursalId?: string;
  roleId?: string;
  username?: string;
  email?: string | null;
  fullName?: string;
  password?: string;
}

/** Filtros de busqueda/listado disponibles para usuarios. */
export interface ListUsersFilters {
  sucursalId?: string;
  roleId?: string;
  active?: boolean;
  search?: string;
}

/** Parametros combinados para listar usuarios: filtros + paginacion. */
export interface ListUsersQuery extends PaginationParams {
  filters?: ListUsersFilters;
}

/** Filtros del patron de lookup (busqueda acotada para selectores) —
 * deliberadamente mas chico que `ListUsersFilters`, ver
 * `shared/utils/lookup.ts`. */
export interface LookupUsersFilters {
  search?: string;
  active?: boolean;
}

/** Parametros combinados para el lookup de usuarios: filtros + `take`. */
export interface LookupUsersQuery extends LookupParams {
  filters?: LookupUsersFilters;
}

/** Payload para cambiar el estado (activo/inactivo) de un usuario. */
export interface ChangeUserStatusDto {
  active: boolean;
}

/** Resultado de una operacion de listado paginado de usuarios. */
export interface ListUsersResult {
  items: UserResponse[];
  total: number;
}

/** Resultado de las operaciones que devuelven un unico usuario. */
export interface UserResult {
  user: UserResponse;
}
