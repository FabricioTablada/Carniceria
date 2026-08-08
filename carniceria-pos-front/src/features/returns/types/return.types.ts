/**
 * features/returns/types/return.types.ts
 * -----------------------------------------------------------------------------
 * Tipos del modulo Returns (Bloque 4.3 — integracion frontend). Contrato
 * identico al backend (`modules/returns/types.ts`): mismos nombres de
 * propiedad, misma opcionalidad. Mismo criterio ya usado en
 * `sale.types.ts`/`report.types.ts`: los enums de Prisma se re-declaran
 * localmente como union types, sin import cruzado entre features.
 *
 * `createdAt`/`updatedAt` se tipan como `string` (no `Date`): asi viajan
 * realmente por HTTP, mismo criterio que `sale.types.ts`.
 */

/** Metodo de pago / reembolso (enum `PaymentMethod` de schema.prisma). */
export type PaymentMethod = 'CASH' | 'CARD' | 'SINPE_MOVIL' | 'TRANSFER' | 'MIXED'

/**
 * Datos requeridos para declarar una linea de devolucion. `restock`
 * (decision de negocio todavia no cerrada, ver `modules/returns/types.ts`
 * del backend): si el producto vuelve a stock vendible (`true`, default
 * asumido) o se marca como merma/no reincorporable (`false`) — gobierna
 * si el backend emite o no el movimiento de inventario, sin persistirse
 * todavia por linea.
 */
export interface CreateSaleReturnItemDto {
  saleItemId: string
  quantity: number
  restock?: boolean
}

/**
 * Datos requeridos para registrar una devolucion. `saleId` viaja en el
 * body (el modulo se monta bajo su propio prefijo `/returns`, no anidado
 * bajo `/sales` — mismo criterio que el backend). `cashSessionId`: la
 * sesion que EMITE el reembolso (tipicamente la sesion actualmente
 * abierta), no necesariamente la sesion de la venta original.
 */
export interface CreateSaleReturnDto {
  saleId: string
  cashSessionId: string
  reason: string
  refundMethod: PaymentMethod
  items: CreateSaleReturnItemDto[]
}

/** Linea de una devolucion tal como la expone el backend. `unitPrice`/
 * `lineTotal` son snapshot calculados al momento de la devolucion.
 * `restock` (Bloque 4.4, "Destino del producto"): reconstruido por el
 * backend al leer (no es una columna persistida, ver
 * `modules/returns/types.ts` del backend) — `true` = volvio a inventario,
 * `false` = merma/no reincorporable. */
export interface SaleReturnItem {
  id: string
  saleItemId: string
  quantity: number
  unitPrice: number
  lineTotal: number
  restock: boolean
}

/** Devolucion tal como la expone el backend (`SaleReturnResponse`). */
export interface SaleReturn {
  id: string
  saleId: string
  sucursalId: string
  cashSessionId: string
  userId: string
  reason: string
  refundMethod: PaymentMethod
  totalAmount: number
  sucursal: {
    id: string
    name: string
  }
  user: {
    id: string
    fullName: string
  }
  items: SaleReturnItem[]
  createdAt: string
  updatedAt: string
}

/** Filtros de listado de devoluciones (Bloque 4.4: usado para traer el
 * historial de devoluciones de una venta puntual, `saleId`). Coincide con
 * `ListSaleReturnsFilters` del backend. */
export interface SaleReturnFilters {
  saleId?: string
  sucursalId?: string
  cashSessionId?: string
  userId?: string
  page?: number
  limit?: number
}

/** Respuesta real de GET /returns. */
export interface PaginatedSaleReturnsResponse {
  success: true
  data: SaleReturn[]
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}
