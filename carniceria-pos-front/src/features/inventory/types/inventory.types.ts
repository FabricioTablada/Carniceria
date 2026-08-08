/**
 * features/inventory/types/inventory.types.ts
 * -----------------------------------------------------------------------------
 * Tipos del modulo Inventory. Contrato identico al backend, sin
 * adaptaciones: mismos nombres de propiedad, misma opcionalidad y misma
 * nulabilidad que `modules/inventory/types.ts` y
 * `modules/inventory/validation.ts` (Zod) del backend.
 *
 * Unica diferencia deliberada: los campos `Date` del backend (`createdAt`,
 * `updatedAt`) se tipan aqui como `string`, porque asi es como viajan
 * realmente por HTTP (JSON no tiene tipo `Date`; se serializan a ISO
 * string). Mismo criterio ya usado en `user.types.ts`, `role.types.ts`,
 * `product.types.ts`, `category.types.ts` y `sale.types.ts`.
 *
 * NOTA (igual que en el backend): `Inventory` no tiene campo `active` ni
 * endpoint de cambio de estado.
 *
 * NOTA: `InventoryResult` (backend) esta declarado en
 * `modules/inventory/types.ts` pero `inventory.service.ts` nunca lo
 * retorna (`create`/`findById`/`update` devuelven `InventoryResponse`
 * directo) — mismo caso ya detectado con `SaleResult` en Sales y
 * `ProductResult` en Products. No se copia al frontend.
 *
 * Solo formas de datos: sin logica de negocio, sin React, sin hooks, sin
 * llamadas a la API.
 */

/** Unidad de medida del producto asociado (enum `UnitOfMeasure` de schema.prisma). */
export type UnitOfMeasure = 'KILOGRAM' | 'UNIT'

/**
 * Existencia de inventario tal como la expone el backend
 * (`InventoryResponse`).
 */
export interface Inventory {
  id: string
  sucursalId: string
  productId: string
  quantity: number
  reorderPoint: number | null
  sucursal: {
    id: string
    code: string
    name: string
  }
  product: {
    id: string
    name: string
    sku: string | null
    unitOfMeasure: UnitOfMeasure
  }
  createdAt: string
  updatedAt: string
}

/**
 * Datos requeridos para crear una existencia de inventario.
 * Coincide exactamente con `CreateInventorySchema` (Zod) del backend:
 * `quantity` es `.optional()`; `reorderPoint` es `.nullish()`.
 */
export interface CreateInventoryDto {
  sucursalId: string
  productId: string
  quantity?: number
  reorderPoint?: number | null
}

/**
 * Datos permitidos para actualizar una existencia de inventario.
 * Coincide exactamente con `UpdateInventorySchema` (Zod) del backend:
 * todos los campos opcionales.
 */
export interface UpdateInventoryDto {
  sucursalId?: string
  productId?: string
  quantity?: number
  reorderPoint?: number | null
}

/**
 * Filtros de listado de inventario.
 * Coincide exactamente con `ListInventoryFilters` del backend: mismos
 * nombres y mismos tipos.
 */
export interface InventoryFilters {
  sucursalId?: string
  productId?: string
  /** Bloque 7.29A: busqueda por nombre/SKU/codigo de barras del producto
   * asociado -- el backend ya la soporta (`ListInventoryQuerySchema`),
   * mismo nombre de parametro que `ProductFilters.search`. */
  search?: string
  /** Pagina solicitada (1-indexada). Arquitectura de listados, Bloque 3:
   * mismo criterio ya usado por `ProductFilters`/`ListInventoryWasteFilters`. */
  page?: number
  /** Tamaño de pagina. */
  limit?: number
}

/**
 * Respuesta real de GET /inventory.
 * El controlador (`inventory/controller.ts`) responde con
 * `success(result.items, meta)`, que produce exactamente este sobre
 * (`ApiSuccess<T>` de `shared/utils/httpResponse.ts` + `PaginationMeta` de
 * `shared/utils/pagination.ts`). No se renombra `data` ni se envuelve en
 * una forma distinta.
 */
export interface PaginatedInventoryResponse {
  success: true
  data: Inventory[]
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
 * Bloque 5.4 ("Modulo de Mermas", integracion frontend). Contrato
 * identico a `modules/inventoryWaste/types.ts` del backend — mismo
 * criterio que el resto de este archivo: sin adaptaciones.
 */

/** Origen/causa de una merma (enum `WasteReason` de schema.prisma). */
export type WasteReason =
  | 'RETURNED_NOT_RESTOCKED'
  | 'EXPIRED'
  | 'DAMAGED'
  | 'PRODUCTION_ERROR'
  | 'CUTTING_ERROR'
  | 'PACKAGING_ERROR'
  | 'COLD_CHAIN_FAILURE'
  | 'OTHER'

/**
 * Datos requeridos para registrar una merma. `sourceReturnItemId` queda
 * preparado (arquitectura del Bloque 5.3) pero esta pantalla nunca lo
 * envia — el registro MANUAL desde Inventario no tiene devolucion de
 * origen; el automatico (todavia sin implementar) es responsabilidad de
 * un bloque futuro que modifique el flujo de Devoluciones, no este.
 */
export interface CreateInventoryWasteDto {
  sucursalId: string
  productId: string
  reason: WasteReason
  notes?: string | null
  quantity: number
  sourceReturnItemId?: string | null
  /** Corrección de sincronización Mermas/Lotes (aprobada): el backend ya
   * soportaba este campo (`CreateInventoryWasteDto` real,
   * `modules/inventoryWaste/types.ts`) — faltaba únicamente en el tipo
   * frontend, que nunca lo enviaba. Obligatorio en la práctica para
   * productos `requiresBatch: true` (`InventoryWasteForm.tsx` lo exige),
   * opcional para el resto. */
  batchId?: string | null
}

/** Merma tal como la expone el backend (`InventoryWasteResponse`). */
export interface InventoryWaste {
  id: string
  sucursalId: string
  productId: string
  userId: string
  reason: WasteReason
  notes: string | null
  quantity: number
  unitValue: number
  totalValue: number
  sourceReturnItemId: string | null
  sucursal: {
    id: string
    name: string
  }
  product: {
    id: string
    name: string
    sku: string | null
    unitOfMeasure: UnitOfMeasure
  }
  user: {
    id: string
    fullName: string
  }
  createdAt: string
  updatedAt: string
}

/**
 * Filtros de listado de mermas.
 * Coincide exactamente con `ListInventoryWastesQuerySchema` (Zod) del
 * backend: mismos nombres y mismos tipos, mismo criterio que
 * `InventoryFilters`/`ProductFilters` (pagina/limite junto a los filtros
 * reales, todos opcionales, pasados directo como query params).
 */
export interface ListInventoryWasteFilters {
  sucursalId?: string
  productId?: string
  userId?: string
  reason?: WasteReason
  /** Pagina solicitada (1-indexada). */
  page?: number
  /** Tamaño de pagina. */
  limit?: number
}

/**
 * Respuesta real de GET /inventory/waste.
 * El controlador (`inventoryWaste/controller.ts`) responde con
 * `success(result.items, meta)`, mismo sobre exacto que
 * `PaginatedInventoryResponse`.
 */
export interface PaginatedInventoryWasteResponse {
  success: true
  data: InventoryWaste[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

