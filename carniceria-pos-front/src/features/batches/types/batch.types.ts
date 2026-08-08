/**
 * features/batches/types/batch.types.ts
 * -----------------------------------------------------------------------------
 * Tipos del modulo Lotes (Batch Management). Contrato identico al backend,
 * sin adaptaciones: mismos nombres de propiedad, misma opcionalidad y misma
 * nulabilidad que `modules/batches/types.ts` y `modules/batches/validation.ts`
 * (Zod) del backend (Bloque LOTES-01/02/03).
 *
 * Unica diferencia deliberada: los campos `Date` del backend (`receivedAt`,
 * `productionDate`, `expiryDate`, `closedAt`, `createdAt`, `updatedAt`) se
 * tipan aqui como `string | null`/`string`, porque asi es como viajan
 * realmente por HTTP (JSON no tiene tipo `Date`; se serializan a ISO
 * string) — mismo criterio ya usado en `inventory.types.ts`, `sale.types.ts`,
 * `purchase.types.ts`.
 *
 * Sin `CreateBatchDto`: no existe `POST /batches` en el backend (los lotes
 * solo se crean automaticamente desde Compras) — ver nota de archivo en
 * `modules/batches/types.ts`/`routes.ts` del backend.
 *
 * Solo formas de datos: sin logica de negocio, sin React, sin hooks, sin
 * llamadas a la API.
 */

/** Estado de un lote (enum `BatchStatus` de schema.prisma). */
export type BatchStatus = 'ACTIVE' | 'DEPLETED' | 'EXPIRED' | 'BLOCKED'

/** Unidad de medida del producto asociado (enum `UnitOfMeasure` de schema.prisma). */
export type BatchUnitOfMeasure = 'KILOGRAM' | 'UNIT'

/** Resumen del producto asociado a un lote. */
export interface BatchProductSummary {
  id: string
  name: string
  sku: string | null
  unitOfMeasure: BatchUnitOfMeasure
}

/** Resumen de la sucursal asociada a un lote. */
export interface BatchSucursalSummary {
  id: string
  code: string
  name: string
}

/** Resumen del proveedor asociado a un lote (puede ser `null`). */
export interface BatchSupplierSummary {
  id: string
  name: string
}

/** Lote tal como lo expone el backend (`BatchResponse`). */
export interface Batch {
  id: string
  code: string
  supplierLotCode: string | null
  productId: string
  sucursalId: string
  purchaseItemId: string | null
  supplierId: string | null
  receivedAt: string
  productionDate: string | null
  expiryDate: string | null
  initialQuantity: number
  availableQuantity: number
  unitCost: number
  expectedWastePercent: number | null
  status: BatchStatus
  closedAt: string | null
  notes: string | null
  product: BatchProductSummary
  sucursal: BatchSucursalSummary
  supplier: BatchSupplierSummary | null
  createdAt: string
  updatedAt: string
}

/**
 * Datos permitidos para ajustar un lote (`PATCH /inventory/batches/:id`) —
 * cantidad disponible y/o estado (bloqueo/cierre), nunca los campos de
 * origen/snapshot. Coincide exactamente con `UpdateBatchDto`/
 * `UpdateBatchSchema` del backend.
 */
export interface UpdateBatchDto {
  availableQuantity?: number
  status?: BatchStatus
  notes?: string | null
}

/**
 * Filtros de listado de lotes. Coincide exactamente con `ListBatchFilters`
 * del backend: mismos nombres y mismos tipos. Pagina/limite viajan junto a
 * los filtros reales en un solo objeto, mismo criterio que
 * `InventoryFilters`/`ListInventoryWasteFilters`.
 */
export interface BatchFilters {
  productId?: string
  sucursalId?: string
  supplierId?: string
  status?: BatchStatus
  /** Pagina solicitada (1-indexada). */
  page?: number
  /** Tamaño de pagina. */
  limit?: number
}

/**
 * Respuesta real de GET /inventory/batches. El controlador
 * (`batches/controller.ts`) responde con `success(result.items, meta)`,
 * mismo sobre exacto que `PaginatedInventoryResponse`.
 */
export interface PaginatedBatchesResponse {
  success: true
  data: Batch[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}
