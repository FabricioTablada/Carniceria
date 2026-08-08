/**
 * features/users/types/user.types.ts
 * -----------------------------------------------------------------------------
 * Tipos del modulo Users. Contrato identico al backend, sin adaptaciones:
 * mismos nombres de propiedad, misma opcionalidad y misma nulabilidad que
 * `modules/users/users.types.ts` y `modules/users/users.validation.ts`
 * (Zod) del backend.
 *
 * Unica diferencia deliberada: los campos `Date` del backend (`lastLoginAt`,
 * `createdAt`, `updatedAt`) se tipan aqui como `string`, porque asi es como
 * llegan realmente por HTTP (JSON no tiene tipo `Date`; Express los
 * serializa a ISO string). No es una traduccion de propiedades ni una capa
 * de adaptacion: es el tipo correcto del dato tal como existe en runtime en
 * el cliente.
 *
 * Solo formas de datos: sin logica de negocio, sin React, sin hooks, sin
 * llamadas a la API.
 */

/** Usuario tal como lo expone el backend (`UserResponse` en users.types.ts). */
export interface User {
  id: string
  sucursalId: string
  username: string
  email: string | null
  fullName: string
  active: boolean
  role: {
    id: string
    name: string
  }
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Datos requeridos para crear un usuario.
 * Coincide exactamente con `CreateUserSchema` (Zod) del backend:
 * `email` es `.email().nullish()` -> opcional y nullable; `active` es
 * `.boolean().optional()`.
 *
 * `sucursalId` NO es parte de este DTO: el backend nunca lo acepta del
 * cliente en `POST /users` (lo resuelve del lado del servidor desde
 * `req.user.sucursalId`, ver `users.controller.ts`) — sistema de una sola
 * sucursal.
 */
export interface CreateUserDto {
  roleId: string
  username: string
  email?: string | null
  fullName: string
  password: string
  active?: boolean
}

/**
 * Datos permitidos para actualizar un usuario.
 * Coincide exactamente con `UpdateUserSchema` (Zod) del backend: todos los
 * campos opcionales, sin `active` (el backend maneja el cambio de estado
 * por separado, en `ChangeUserStatusDto`).
 */
export interface UpdateUserDto {
  sucursalId?: string
  roleId?: string
  username?: string
  email?: string | null
  fullName?: string
  password?: string
}

/** Payload de PATCH /users/:id/status (`ChangeUserStatusDto` del backend). */
export interface ChangeUserStatusDto {
  active: boolean
}

/**
 * Filtros de listado de usuarios.
 * Coincide exactamente con `ListUsersFilters` del backend: mismos nombres
 * y mismos tipos, incluyendo `active: boolean` (no se traduce a un estado
 * de UI).
 */
export interface UserFilters {
  sucursalId?: string
  roleId?: string
  active?: boolean
  search?: string
  /** Pagina solicitada (1-indexada). Arquitectura de listados, Bloque 4:
   * mismo criterio ya usado por `ProductFilters`/`CategoryFilters`. */
  page?: number
  /** Tamaño de pagina. */
  limit?: number
}

/**
 * Respuesta real de GET /users.
 * El controlador (`users.controller.ts`) responde con
 * `success(result.items, meta)`, que produce exactamente este sobre
 * (`ApiSuccess<T>` de `shared/utils/httpResponse.ts` + `PaginationMeta` de
 * `shared/utils/pagination.ts`). No se renombra `data` ni se envuelve en
 * una forma distinta.
 */
export interface PaginatedUsersResponse {
  success: true
  data: User[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}