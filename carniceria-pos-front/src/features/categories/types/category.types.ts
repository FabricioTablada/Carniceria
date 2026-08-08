/**
 * features/categories/types/category.types.ts
 * -----------------------------------------------------------------------------
 * Tipos del modulo Categories. Contrato identico al backend, sin
 * adaptaciones: mismos nombres de propiedad, misma opcionalidad y misma
 * nulabilidad que `modules/categories/categories.types.ts` y
 * `modules/categories/categories.validation.ts` (Zod) del backend.
 *
 * Unica diferencia deliberada: los campos `Date` del backend (`createdAt`,
 * `updatedAt`) se tipan aqui como `string`, porque asi es como llegan
 * realmente por HTTP (JSON no tiene tipo `Date`; Express los serializa a
 * ISO string). No es una traduccion de propiedades ni una capa de
 * adaptacion: es el tipo correcto del dato tal como existe en runtime en
 * el cliente. Mismo criterio ya usado en `user.types.ts`, `role.types.ts`
 * y `product.types.ts`.
 *
 * Solo formas de datos: sin logica de negocio, sin React, sin hooks, sin
 * llamadas a la API.
 */

/** Categoria tal como lo expone el backend (`CategoryResponse`). */
export interface Category {
  id: string
  name: string
  description: string | null
  /** Color personalizado (hex, ej. `"#3B82F6"`) — `null` si la categoria
   * no tiene uno propio. Resolver SIEMPRE via `resolveCategoryColor`
   * (`lib/categoryColor.ts`), nunca leer este campo directo en un
   * componente: esa funcion es el unico punto que decide el fallback
   * determinístico cuando es `null`. */
  color: string | null
  parentId: string | null
  parent: {
    id: string
    name: string
    color: string | null
  } | null
  active: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Datos requeridos para crear una categoria.
 * Coincide exactamente con `CreateCategorySchema` (Zod) del backend:
 * `description`/`color`/`parentId` son `.nullish()`; `active` es `.optional()`.
 */
export interface CreateCategoryDto {
  name: string
  description?: string | null
  color?: string | null
  parentId?: string | null
  active?: boolean
}

/**
 * Datos permitidos para actualizar una categoria.
 * Coincide exactamente con `UpdateCategorySchema` (Zod) del backend: todos
 * los campos opcionales, sin `active` (el backend maneja el cambio de
 * estado por separado, en `ChangeCategoryStatusDto`).
 */
export interface UpdateCategoryDto {
  name?: string
  description?: string | null
  color?: string | null
  parentId?: string | null
}

/** Payload de PATCH /categories/:id/status (`ChangeCategoryStatusDto` del backend). */
export interface ChangeCategoryStatusDto {
  active: boolean
}

/**
 * Filtros de listado de categorias.
 * Coincide exactamente con `ListCategoriesFilters` del backend: mismos
 * nombres y mismos tipos, incluyendo `parentId?: string | null` (permite
 * filtrar explicitamente por categorias raiz enviando `null`).
 */
export interface CategoryFilters {
  parentId?: string | null
  active?: boolean
  search?: string
  /** Pagina solicitada (1-indexada). Arquitectura de listados, Bloque 3:
   * mismo criterio ya usado por `ProductFilters`/`ListInventoryWasteFilters`. */
  page?: number
  /** Tamaño de pagina. */
  limit?: number
}

/**
 * Respuesta real de GET /categories.
 * El controlador (`categories.controller.ts`) responde con
 * `success(result.items, meta)`, que produce exactamente este sobre
 * (`ApiSuccess<T>` de `shared/utils/httpResponse.ts` + `PaginationMeta` de
 * `shared/utils/pagination.ts`). No se renombra `data` ni se envuelve en
 * una forma distinta.
 */
export interface PaginatedCategoriesResponse {
  success: true
  data: Category[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

/**
 * Arquitectura de selectores, Bloque 2: filtros del lookup de categorias —
 * mismo criterio que `CategoryFilters`, pero sin `page`/`limit`/`parentId`
 * (el lookup no es una tabla paginable, ver backend
 * `LookupCategoriesFilters`).
 */
export interface CategoryLookupFilters {
  search?: string
  active?: boolean
  /** Tamaño de resultados (techo real: `LOOKUP_MAX_LIMIT` del backend,
   * hoy 50 — ver `shared/utils/lookup.ts`). */
  limit?: number
}

/**
 * Item de resultado de GET /categories/lookup — coincide exactamente con
 * `CategoryLookupItem` del backend. Deliberadamente mas rico que un
 * lookup generico `{id,label}`: trae los campos puntuales que
 * `CategorySearchDialog.tsx` pinta en su fila de resultado (categoria
 * padre, descripcion), pero sigue sin ser el recurso completo `Category`
 * (sin `parentId`, `active`, timestamps, ni el objeto `parent` completo).
 */
export interface CategoryLookupItem {
  id: string
  label: string
  parentName: string | null
  description: string | null
  color: string | null
}

/** Respuesta real de GET /categories/lookup — sin `meta` de paginacion. */
export interface LookupCategoriesResponse {
  success: true
  data: CategoryLookupItem[]
}