/**
 * features/suppliers/types/supplier.types.ts
 * -----------------------------------------------------------------------------
 * Tipos del modulo Suppliers. Contrato identico al backend, sin
 * adaptaciones: mismos nombres de propiedad, misma opcionalidad y misma
 * nulabilidad que `modules/suppliers/types.ts` y
 * `modules/suppliers/validation.ts` (Zod) del backend.
 *
 * Unica diferencia deliberada: los campos `Date` del backend (`createdAt`,
 * `updatedAt`) se tipan aqui como `string`, porque asi es como llegan
 * realmente por HTTP (JSON no tiene tipo `Date`; Express los serializa a
 * ISO string). No es una traduccion de propiedades ni una capa de
 * adaptacion: es el tipo correcto del dato tal como existe en runtime en
 * el cliente. Mismo criterio ya usado en `category.types.ts`,
 * `tax.types.ts`, `product.types.ts`, `user.types.ts` y `role.types.ts`.
 *
 * NOTA: `Supplier` es, hoy, el unico modulo con borrado logico (Soft
 * Delete) real y activo en el backend (`SOFT_DELETE_MODELS`, piloto de la
 * auditoria tecnica). Esto no agrega ningun campo nuevo a `Supplier` (no
 * se expone `deletedAt` al cliente, igual que el backend no lo expone en
 * `SupplierResponse`) — el unico efecto visible desde el frontend es que
 * `DELETE /suppliers/:id` existe como endpoint real (ver
 * `suppliers.api.ts`), a diferencia de Categories/Taxes/Products, que no
 * tienen borrado.
 *
 * Solo formas de datos: sin logica de negocio, sin React, sin hooks, sin
 * llamadas a la API.
 */

/** Proveedor tal como lo expone el backend (`SupplierResponse`). */
export interface Supplier {
  id: string
  name: string
  legalId: string | null
  contactName: string | null
  phone: string | null
  email: string | null
  address: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Datos requeridos para crear un proveedor.
 * Coincide exactamente con `CreateSupplierSchema` (Zod) del backend:
 * `legalId`/`contactName`/`phone`/`email`/`address` son `.nullish()`;
 * `active` es `.optional()`.
 */
export interface CreateSupplierDto {
  name: string
  legalId?: string | null
  contactName?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  active?: boolean
}

/**
 * Datos permitidos para actualizar un proveedor.
 * Coincide exactamente con `UpdateSupplierSchema` (Zod) del backend:
 * todos los campos opcionales, sin `active` (el backend maneja el cambio
 * de estado por separado, en `ChangeSupplierStatusDto`).
 */
export interface UpdateSupplierDto {
  name?: string
  legalId?: string | null
  contactName?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
}

/** Payload de PATCH /suppliers/:id/status (`ChangeSupplierStatusDto` del backend). */
export interface ChangeSupplierStatusDto {
  active: boolean
}

/**
 * Filtros de listado de proveedores.
 * Coincide exactamente con `ListSuppliersFilters` del backend.
 */
export interface SupplierFilters {
  active?: boolean
  search?: string
  /** Pagina solicitada (1-indexada). Arquitectura de listados, Bloque 3:
   * mismo criterio ya usado por `ProductFilters`/`ListInventoryWasteFilters`. */
  page?: number
  /** Tamaño de pagina. */
  limit?: number
}

/**
 * Respuesta real de GET /suppliers.
 * El controlador (`suppliers.controller.ts`) responde con
 * `success(result.items, meta)`, que produce exactamente este sobre
 * (`ApiSuccess<T>` de `shared/utils/httpResponse.ts` + `PaginationMeta` de
 * `shared/utils/pagination.ts`). No se renombra `data` ni se envuelve en
 * una forma distinta.
 */
export interface PaginatedSuppliersResponse {
  success: true
  data: Supplier[]
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
 * Arquitectura de selectores, Bloque 3: filtros del lookup de proveedores
 * — mismo criterio que `SupplierFilters`, pero sin `page` (el lookup no es
 * una tabla paginable, ver backend `LookupSuppliersFilters`).
 */
export interface SupplierLookupFilters {
  search?: string
  active?: boolean
  limit?: number
}