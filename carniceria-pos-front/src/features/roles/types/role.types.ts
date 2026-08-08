/**
 * features/roles/types/role.types.ts
 * -----------------------------------------------------------------------------
 * Tipos del modulo Roles. Contrato identico al backend, sin adaptaciones:
 * mismos nombres de propiedad, misma opcionalidad y misma nulabilidad que
 * `modules/roles/roles.types.ts` y `modules/roles/roles.validation.ts`
 * (Zod) del backend.
 *
 * Unica diferencia deliberada: los campos `Date` del backend (`createdAt`,
 * `updatedAt`) se tipan aqui como `string`, porque asi es como llegan
 * realmente por HTTP (JSON no tiene tipo `Date`; Express los serializa a
 * ISO string). No es una traduccion de propiedades ni una capa de
 * adaptacion: es el tipo correcto del dato tal como existe en runtime en
 * el cliente. Mismo criterio ya usado en `features/users/types/user.types.ts`.
 *
 * Solo formas de datos: sin logica de negocio, sin React, sin hooks, sin
 * llamadas a la API.
 */

/** Rol tal como lo expone el backend (`RoleResponse` en roles.types.ts). */
export interface Role {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  active: boolean
  permissions: {
    id: string
    code: string
    description: string | null
  }[]
  createdAt: string
  updatedAt: string
}

/**
 * Datos requeridos para crear un rol.
 * Coincide exactamente con `CreateRoleSchema` (Zod) del backend:
 * `description` es `.nullish()`; `permissionIds` y `active` son
 * `.optional()`.
 */
export interface CreateRoleDto {
  name: string
  description?: string | null
  permissionIds?: string[]
  active?: boolean
}

/**
 * Datos permitidos para actualizar un rol.
 * Coincide exactamente con `UpdateRoleSchema` (Zod) del backend: todos los
 * campos opcionales, sin `active` (el backend maneja el cambio de estado
 * por separado, en `ChangeRoleStatusDto`).
 */
export interface UpdateRoleDto {
  name?: string
  description?: string | null
  permissionIds?: string[]
}

/** Payload de PATCH /roles/:id/status (`ChangeRoleStatusDto` del backend). */
export interface ChangeRoleStatusDto {
  active: boolean
}

/**
 * Payload de PATCH /roles/:id/permissions
 * (`AssignRolePermissionsDto` del backend).
 */
export interface AssignRolePermissionsDto {
  permissionIds: string[]
}

/**
 * Filtros de listado de roles.
 * Coincide exactamente con `ListRolesFilters` del backend: mismos nombres
 * y mismos tipos.
 */
export interface RoleFilters {
  active?: boolean
  isSystem?: boolean
  search?: string
  /** Pagina solicitada (1-indexada). Arquitectura de listados, Bloque 4:
   * mismo criterio ya usado por `ProductFilters`/`CategoryFilters`. */
  page?: number
  /** Tamaño de pagina. */
  limit?: number
}

/**
 * Respuesta real de GET /roles.
 * El controlador (`roles.controller.ts`) responde con
 * `success(result.items, meta)`, que produce exactamente este sobre
 * (`ApiSuccess<T>` de `shared/utils/httpResponse.ts` + `PaginationMeta` de
 * `shared/utils/pagination.ts`). No se renombra `data` ni se envuelve en
 * una forma distinta.
 */
export interface PaginatedRolesResponse {
  success: true
  data: Role[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}