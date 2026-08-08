/**
 * features/permissions/types/permission.types.ts
 * -----------------------------------------------------------------------------
 * Tipos del modulo Permissions. Contrato identico al backend, sin
 * adaptaciones: mismos nombres de propiedad, misma opcionalidad y misma
 * nulabilidad que `modules/permissions/permissions.types.ts` y
 * `modules/permissions/permissions.validation.ts` (Zod) del backend.
 *
 * Unica diferencia deliberada: los campos `Date` del backend (`createdAt`,
 * `updatedAt`) se tipan aqui como `string`, porque asi es como llegan
 * realmente por HTTP (JSON no tiene tipo `Date`; Express los serializa a
 * ISO string). No es una traduccion de propiedades ni una capa de
 * adaptacion: es el tipo correcto del dato tal como existe en runtime en
 * el cliente. Mismo criterio ya usado en `user.types.ts` y `role.types.ts`.
 *
 * El backend NO tiene estado (`active`) ni endpoint de cambio de estado
 * para permisos (`permissions.routes.ts` solo define POST /, GET /,
 * GET /:id y PATCH /:id — no hay PATCH /:id/status). Por eso este archivo
 * no incluye `ChangePermissionStatusDto`: no existe ese contrato en el
 * backend.
 *
 * Solo formas de datos: sin logica de negocio, sin React, sin hooks, sin
 * llamadas a la API.
 */

/** Permiso tal como lo expone el backend (`PermissionResponse`). */
export interface Permission {
  id: string
  code: string
  description: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Datos requeridos para crear un permiso.
 * Coincide exactamente con `CreatePermissionSchema` (Zod) del backend:
 * `description` es `.nullish()`.
 */
export interface CreatePermissionDto {
  code: string
  description?: string | null
}

/**
 * Datos permitidos para actualizar un permiso.
 * Coincide exactamente con `UpdatePermissionSchema` (Zod) del backend:
 * todos los campos opcionales.
 */
export interface UpdatePermissionDto {
  code?: string
  description?: string | null
}

/**
 * Filtros/parametros de listado de permisos.
 * `search` coincide con `ListPermissionsFilters` del backend; `limit` es
 * el parametro de paginacion que el backend ya acepta (`page`/`limit` en
 * `permissions.validation.ts`) pero que este tipo no exponia — necesario
 * para pedir el catalogo completo en un solo request (ver EditRolePage.tsx),
 * en vez del default de 20 items por pagina.
 */
export interface PermissionFilters {
  search?: string
  /** Pagina solicitada (1-indexada). Arquitectura de listados, Bloque 4:
   * mismo criterio ya usado por `ProductFilters`/`CategoryFilters`. */
  page?: number
  limit?: number
}

/**
 * Respuesta real de GET /permissions.
 * El controlador (`permissions.controller.ts`) responde con
 * `success(result.items, meta)`, que produce exactamente este sobre
 * (`ApiSuccess<T>` de `shared/utils/httpResponse.ts` + `PaginationMeta` de
 * `shared/utils/pagination.ts`). No se renombra `data` ni se envuelve en
 * una forma distinta.
 */
export interface PaginatedPermissionsResponse {
  success: true
  data: Permission[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}