/**
 * features/taxes/types/tax.types.ts
 * -----------------------------------------------------------------------------
 * Tipos del modulo Taxes. Contrato identico al backend, sin adaptaciones:
 * mismos nombres de propiedad, misma opcionalidad y misma nulabilidad que
 * `modules/taxes/taxes.types.ts` y `modules/taxes/taxes.validation.ts`
 * (Zod) del backend.
 *
 * Unica diferencia deliberada: los campos `Date` del backend (`createdAt`,
 * `updatedAt`) se tipan aqui como `string`, porque asi es como llegan
 * realmente por HTTP (JSON no tiene tipo `Date`; Express los serializa a
 * ISO string). No es una traduccion de propiedades ni una capa de
 * adaptacion: es el tipo correcto del dato tal como existe en runtime en
 * el cliente. Mismo criterio ya usado en `category.types.ts`,
 * `product.types.ts`, `user.types.ts` y `role.types.ts`.
 *
 * Solo formas de datos: sin logica de negocio, sin React, sin hooks, sin
 * llamadas a la API.
 */

/** Impuesto tal como lo expone el backend (`TaxResponse`). */
export interface Tax {
  id: string
  code: string
  name: string
  rate: number
  isDefault: boolean
  active: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Datos requeridos para crear un impuesto.
 * Coincide exactamente con `CreateTaxSchema` (Zod) del backend:
 * `isDefault`/`active` son `.optional()`.
 */
export interface CreateTaxDto {
  code: string
  name: string
  rate: number
  isDefault?: boolean
  active?: boolean
}

/**
 * Datos permitidos para actualizar un impuesto.
 * Coincide exactamente con `UpdateTaxSchema` (Zod) del backend: todos los
 * campos opcionales, sin `active` (el backend maneja el cambio de estado
 * por separado, en `ChangeTaxStatusDto`).
 */
export interface UpdateTaxDto {
  code?: string
  name?: string
  rate?: number
  isDefault?: boolean
}

/** Payload de PATCH /taxes/:id/status (`ChangeTaxStatusDto` del backend). */
export interface ChangeTaxStatusDto {
  active: boolean
}

/**
 * Filtros de listado de impuestos.
 * Coincide exactamente con `ListTaxesFilters` del backend.
 */
export interface TaxFilters {
  active?: boolean
  isDefault?: boolean
  search?: string
  /** Pagina solicitada (1-indexada). Arquitectura de listados, Bloque 3:
   * mismo criterio ya usado por `ProductFilters`/`ListInventoryWasteFilters`. */
  page?: number
  /** Tamaño de pagina. */
  limit?: number
}

/**
 * Respuesta real de GET /taxes.
 * El controlador (`taxes.controller.ts`) responde con
 * `success(result.items, meta)`, que produce exactamente este sobre
 * (`ApiSuccess<T>` de `shared/utils/httpResponse.ts` + `PaginationMeta` de
 * `shared/utils/pagination.ts`). No se renombra `data` ni se envuelve en
 * una forma distinta.
 */
export interface PaginatedTaxesResponse {
  success: true
  data: Tax[]
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
 * Arquitectura de selectores, Bloque 3: filtros del lookup de impuestos —
 * mismo criterio que `TaxFilters`, pero sin `page` (el lookup no es una
 * tabla paginable, ver backend `LookupTaxesFilters`). Impuestos se trata
 * como catalogo de referencia acotado (decision del sprint): el `<Select>`
 * existente se queda igual, solo cambia su fuente de datos de
 * `GET /taxes` a `GET /taxes/lookup` — no se construye un dialogo de
 * busqueda para esta entidad.
 */
export interface TaxLookupFilters {
  search?: string
  active?: boolean
  limit?: number
}