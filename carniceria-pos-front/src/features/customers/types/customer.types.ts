// src/features/customers/types/customer.types.ts
/**
 * features/customers/types/customer.types.ts
 * -----------------------------------------------------------------------------
 * Tipos del modulo Customers. Contrato identico al backend, sin
 * adaptaciones: mismos nombres de propiedad, misma opcionalidad y misma
 * nulabilidad que `modules/customers/types.ts` y
 * `modules/customers/validation.ts` (Zod) del backend.
 *
 * Bloque 8.2: mismo criterio exacto que `supplier.types.ts` — catalogo
 * UNICO para toda la empresa (el ERP opera con una unica sucursal), sin
 * `sucursalId` en ningun lado.
 *
 * Unica diferencia deliberada: los campos `Date` del backend (`createdAt`,
 * `updatedAt`) se tipan aqui como `string`, porque asi es como llegan
 * realmente por HTTP (JSON no tiene tipo `Date`; Express los serializa a
 * ISO string). Mismo criterio ya usado en `supplier.types.ts`.
 */

/** Tipo de identificacion soportado (enum `CustomerIdentificationType` del
 * backend) — mismo catalogo real de Alegra Costa Rica confirmado en el
 * Bloque 7.13. */
export type CustomerIdentificationType = 'CF' | 'CJ' | 'DIMEX' | 'NITE' | 'PE'

/** Cliente tal como lo expone el backend (`CustomerResponse`). */
export interface Customer {
  id: string
  name: string
  identificationType: CustomerIdentificationType
  identificationNumber: string
  email: string | null
  phone: string | null
  address: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Datos requeridos para crear un cliente.
 * Coincide exactamente con `CreateCustomerSchema` (Zod) del backend.
 */
export interface CreateCustomerDto {
  name: string
  identificationType: CustomerIdentificationType
  identificationNumber: string
  email?: string | null
  phone?: string | null
  address?: string | null
  active?: boolean
}

/**
 * Datos permitidos para actualizar un cliente.
 * Coincide exactamente con `UpdateCustomerSchema` (Zod) del backend: todos
 * los campos opcionales, sin `active` (el backend maneja el cambio de
 * estado por separado, en `ChangeCustomerStatusDto`).
 */
export interface UpdateCustomerDto {
  name?: string
  identificationType?: CustomerIdentificationType
  identificationNumber?: string
  email?: string | null
  phone?: string | null
  address?: string | null
}

/** Payload de PATCH /customers/:id/status (`ChangeCustomerStatusDto` del backend). */
export interface ChangeCustomerStatusDto {
  active: boolean
}

/**
 * Filtros de listado de clientes.
 * Coincide exactamente con `ListCustomersFilters` del backend.
 */
export interface CustomerFilters {
  active?: boolean
  search?: string
  /** Pagina solicitada (1-indexada). */
  page?: number
  /** Tamaño de pagina. */
  limit?: number
}

/**
 * Respuesta real de GET /customers.
 * El controlador (`customers.controller.ts`) responde con
 * `success(result.items, meta)`, que produce exactamente este sobre
 * (`ApiSuccess<T>` de `shared/utils/httpResponse.ts` + `PaginationMeta` de
 * `shared/utils/pagination.ts`).
 */
export interface PaginatedCustomersResponse {
  success: true
  data: Customer[]
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
 * Arquitectura de selectores, Bloque 1: filtros del lookup de clientes —
 * mismo criterio que `CustomerFilters`, pero sin `page` (el lookup no es
 * una tabla paginable, ver backend `LookupCustomersFilters`). Sin
 * consumidor todavia (la seleccion de clientes en Ventas es Bloque 8.3).
 */
export interface CustomerLookupFilters {
  search?: string
  active?: boolean
  limit?: number
}
