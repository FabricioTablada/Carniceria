/**
 * features/reports/types/report.types.ts
 * -----------------------------------------------------------------------------
 * Tipos del modulo Reports. Contrato identico al backend, sin
 * adaptaciones: mismos nombres de propiedad, misma opcionalidad y misma
 * nulabilidad que `modules/reports/reports.types.ts` del backend.
 *
 * Unica diferencia deliberada: los campos `Date` del backend (`dateFrom`,
 * `dateTo`, `saleDate`, `purchaseDate`, `openedAt`, `closedAt`,
 * `createdAt`, `updatedAt`) se tipan aqui como `string`, porque asi es
 * como viajan realmente por HTTP. Mismo criterio ya usado en
 * `purchase.types.ts`, `inventory.types.ts` y `cashSession.types.ts`.
 *
 * HALLAZGO: a diferencia de los demas modulos, el backend de Reports NO
 * tiene tipos nombrados para las filas de los 5 reportes paginados
 * (`sales`, `purchases`, `inventory`, `profit`, `cash`) —
 * `reports.service.ts` las devuelve como `Promise<ReportResult<unknown>>`,
 * sin pasar por ningun mapper `toXResponse`. Para esos 5 casos, las
 * interfaces de fila de este archivo (`SalesReportItem`,
 * `PurchasesReportItem`, `InventoryReportItem`, `ProfitReportItem`,
 * `CashReportItem`) se derivaron directamente de los `include` reales de
 * `reports.repository.ts` (`saleReportInclude`, `purchaseReportInclude`,
 * `inventoryReportInclude`, `profitReportInclude`, `cashReportInclude`)
 * combinados con los campos escalares reales de cada modelo en
 * `schema.prisma` — es la forma real que produce Prisma con `include`
 * (trae todos los escalares del modelo, no un subconjunto via `select`),
 * no una suposicion. El resto de los tipos (`DashboardResponse`,
 * `TopProductItem`, `LowStockItem`, `SalesByCategoryItem`,
 * `SalesByCashierItem`) si tienen nombre propio en el backend y se
 * mirror-earon exactamente.
 *
 * Solo formas de datos: sin logica de negocio, sin React, sin hooks, sin
 * llamadas a la API.
 */

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

/** Coincide exactamente con `DashboardFilters` del backend. */
export interface DashboardFilters {
  sucursalId?: string
  dateFrom?: string
  dateTo?: string
}

/** Coincide exactamente con `DashboardResponse` del backend. */
export interface DashboardResponse {
  totalSales: number
  totalSalesAmount: number
  totalPurchases: number
  totalPurchaseAmount: number
  totalProducts: number
  totalCategories: number
  totalSuppliers: number
  totalUsers: number
  openCashSessions: number
  /** Bloque COST-04.1 (utilidad diaria, Fase 1): utilidad de las ventas
   * completadas de HOY, calculada con el CostEngine sobre los snapshots
   * historicos de cada `SaleItem` (nunca sobre `Product` vigente). `0` si
   * no hubo ventas hoy. */
  totalProfitToday: number
  /** Bloque COST-04.1: margen promedio (%) de las ventas de HOY,
   * `(totalProfitToday / subtotalDeHoy) * 100`. `0` si no hubo ventas
   * hoy. */
  averageMarginToday: number
}

// ---------------------------------------------------------------------------
// Reporte de Ventas (paginado)
// ---------------------------------------------------------------------------

/** Metodo de pago (enum `PaymentMethod` de schema.prisma). */
export type PaymentMethod = 'CASH' | 'CARD' | 'SINPE_MOVIL' | 'TRANSFER' | 'MIXED'

/** Coincide exactamente con `SalesReportFilters` del backend. `page`/
 * `limit` no son filtros de negocio: son los parametros de paginacion que
 * el controller (`resolvePagination`) ya lee de `req.query` — el backend
 * los soporta desde siempre, solo faltaba que el frontend los enviara. */
export interface SalesReportFilters {
  sucursalId?: string
  userId?: string
  paymentMethod?: PaymentMethod
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}

/** Fila del reporte de ventas. Ver hallazgo en el encabezado del archivo:
 * derivada de `saleReportInclude` + los campos escalares reales del
 * modelo `Sale`. */
export interface SalesReportItem {
  id: string
  sucursalId: string
  userId: string
  cashSessionId: string
  documentNumber: string | null
  status: string
  paymentMethod: PaymentMethod
  /** Referencia del pago electronico (QA-007): numero de autorizacion/
   * voucher de tarjeta, comprobante SINPE o numero de transferencia. Nula
   * para CASH. */
  paymentReference: string | null
  saleDate: string
  subtotal: number
  taxTotal: number
  discountTotal: number
  /** Bloque "consistencia de descuentos": descuento TOTAL real de la
   * venta — descuentos manuales (de línea y de carrito) MÁS promociones
   * automáticas. A diferencia de `discountTotal` (columna cruda de
   * `Sale`, exclusivamente el descuento manual de carrito), este es el
   * monto que también se muestra en el Historial de Ventas y en el
   * detalle de la venta. */
  discountAmount: number
  /** Único porcentaje aplicable a toda la venta, cuando es determinable
   * sin ambigüedad (una sola fuente de descuento, de tipo porcentual) —
   * `null` en cualquier otro caso (varias promociones, tipos distintos,
   * o mezclado con un descuento manual), en cuyo caso solo se muestra
   * `discountAmount`. */
  discountPercent: number | null
  total: number
  amountPaid: number
  changeGiven: number
  notes: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  syncStatus: string
  user: {
    id: string
    fullName: string
  }
  sucursal: {
    id: string
    name: string
  }
  items: unknown[]
}

// ---------------------------------------------------------------------------
// Reporte de Compras (paginado)
// ---------------------------------------------------------------------------

/** Coincide exactamente con `PurchasesReportFilters` del backend. `page`/
 * `limit` son los parametros de paginacion (mismo criterio que
 * `SalesReportFilters`). */
export interface PurchasesReportFilters {
  sucursalId?: string
  supplierId?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}

/** Fila del reporte de compras. Ver hallazgo en el encabezado del
 * archivo: derivada de `purchaseReportInclude` + los campos escalares
 * reales del modelo `Purchase`. */
export interface PurchasesReportItem {
  id: string
  sucursalId: string
  supplierId: string
  userId: string
  documentNumber: string | null
  status: string
  purchaseDate: string
  subtotal: number
  taxTotal: number
  total: number
  notes: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  syncStatus: string
  supplier: {
    id: string
    name: string
  }
  user: {
    id: string
    fullName: string
  }
  items: unknown[]
}

// ---------------------------------------------------------------------------
// Reporte de Inventario (paginado)
// ---------------------------------------------------------------------------

/** Coincide exactamente con `InventoryReportFilters` del backend. `page`/
 * `limit` son los parametros de paginacion (mismo criterio que
 * `SalesReportFilters`). */
export interface InventoryReportFilters {
  categoryId?: string
  sucursalId?: string
  active?: boolean
  page?: number
  limit?: number
}

/** Fila del reporte de inventario. Ver hallazgo en el encabezado del
 * archivo: derivada de `inventoryReportInclude` + los campos escalares
 * reales del modelo `Inventory`. */
export interface InventoryReportItem {
  id: string
  sucursalId: string
  productId: string
  quantity: number
  reorderPoint: number | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  syncStatus: string
  product: {
    id: string
    sku: string | null
    name: string
    unitOfMeasure: 'KILOGRAM' | 'UNIT'
  }
  sucursal: {
    id: string
    name: string
  }
}

// ---------------------------------------------------------------------------
// Reporte de Utilidad (paginado)
// ---------------------------------------------------------------------------

/** Coincide exactamente con `ProfitReportFilters` del backend. `page`/
 * `limit` son los parametros de paginacion (mismo criterio que
 * `SalesReportFilters`). */
export interface ProfitReportFilters {
  sucursalId?: string
  categoryId?: string
  productId?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}

/** Fila del reporte de utilidad. Ver hallazgo en el encabezado del
 * archivo: derivada de `profitReportInclude` + los campos escalares
 * reales del modelo `SaleItem`. */
export interface ProfitReportItem {
  id: string
  saleId: string
  productId: string
  taxId: string | null
  quantity: number
  unitPrice: number
  taxRate: number
  discount: number
  /** Incidencia 1 (06/08/2026): `discount` sigue siendo EXCLUSIVAMENTE el
   * descuento manual de esta línea (`SaleItem.discount`, sin cambios) —
   * cuando el descuento real vino de una promoción automática, ese monto
   * nunca vivió ahí. `discountPercent` (backend, `reports.service.ts`,
   * mismo criterio ya usado por `getSalesReport`) solo viene no-nulo
   * cuando `discount` es 0 y hay EXACTAMENTE una promoción automática
   * porcentual atada a esta línea — mismo criterio de "único porcentaje
   * determinable sin ambigüedad" que `getLineItemDiscount`
   * (`features/sales/utils/saleDiscount.ts`). */
  discountPercent: number | null
  lineSubtotal: number
  lineTax: number
  lineTotal: number
  /** Bloque 14.2 (Costos Base): snapshot de `Product.cost` al momento de
   * la venta (`SaleItem.unitCost`). `null` unicamente en ventas creadas
   * antes de este bloque (costo historico desconocido). */
  unitCost: number | null
  /** Bloque COST-03 (integracion con el CostEngine): costo REALMENTE usado
   * para calcular `costTotal`/`profit`/`marginPercent` — igual a
   * `unitCost` cuando el producto no tiene activada la regla de merma
   * esperada (`Product.applyExpectedWasteToCost: false`, el caso por
   * defecto), mayor a `unitCost` cuando si la tiene activada. `null` en
   * los mismos casos que `unitCost`. */
  effectiveCost: number | null
  /** Bloque 14.2: `effectiveCost * quantity` (Bloque COST-03: antes de ese
   * bloque, `unitCost * quantity`). `null` si `effectiveCost` es `null`. */
  costTotal: number | null
  /** Bloque 14.2: `lineSubtotal - costTotal`. `null` si `costTotal` es
   * `null`. */
  profit: number | null
  /** Bloque 14.2: `(profit / lineSubtotal) * 100`. `null` si `profit` es
   * `null` o `lineSubtotal` es 0. */
  marginPercent: number | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  syncStatus: string
  product: {
    id: string
    sku: string | null
    name: string
    /** Costo VIGENTE del producto (no el historico) — solo referencia,
     * ningun calculo de este reporte lo usa (ver `unitCost`). */
    cost: number
  }
  sale: {
    id: string
    documentNumber: string | null
    saleDate: string
  }
  /** Bloque C ("Impuestos y Descuentos en Ventas"): resumen del impuesto
   * de la linea, mismo shape que `SaleItemTaxSummary` (`sale.types.ts`) —
   * `null` cuando la linea no tiene impuesto, igual que `taxId`. */
  tax: {
    id: string
    name: string
  } | null
}

// ---------------------------------------------------------------------------
// Reporte de Caja (paginado)
// ---------------------------------------------------------------------------

/** Estado de sesion de caja (enum `CashSessionStatus` del backend). */
export type CashSessionReportStatus = 'OPEN' | 'CLOSED'

/** Coincide exactamente con `CashReportFilters` del backend. `page`/
 * `limit` son los parametros de paginacion (mismo criterio que
 * `SalesReportFilters`). `status` (Bloque 2, "Ventas = sesion de caja
 * activa"): el historial de sesiones cerradas filtra por `CLOSED` por
 * defecto, pero el campo admite cualquier valor — sin filtro, el backend
 * devuelve sesiones de cualquier estado (sin cambios de comportamiento
 * preexistente). */
export interface CashReportFilters {
  sucursalId?: string
  cashRegisterId?: string
  userId?: string
  status?: CashSessionReportStatus
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}

/** Fila del reporte de caja. Ver hallazgo en el encabezado del archivo:
 * derivada de `cashReportInclude` + los campos escalares reales del
 * modelo `CashSession`. `salesCount`/`salesTotal` (Bloque 2): agregado de
 * ventas COMPLETED de esa sesion, calculado en el backend con un `groupBy`
 * separado — no son columnas de `CashSession`. */
export interface CashReportItem {
  id: string
  sucursalId: string
  cashRegisterId: string
  status: CashSessionReportStatus
  openedByUserId: string
  openedAt: string
  openingAmount: number
  closedByUserId: string | null
  closedAt: string | null
  closingAmount: number | null
  expectedAmount: number | null
  difference: number | null
  notes: string | null
  sucursal: {
    id: string
    name: string
  }
  cashRegister: {
    id: string
    name: string
  }
  openedBy: {
    id: string
    fullName: string
  }
  closedBy: {
    id: string
    fullName: string
  } | null
  salesCount: number
  salesTotal: number
}

/** Metodo de pago (enum `PaymentMethod` del backend). */
export type CashReportPaymentMethod = 'CASH' | 'CARD' | 'SINPE_MOVIL' | 'TRANSFER' | 'MIXED'

/** Desglose de ventas por metodo de pago para el detalle de una sesion
 * puntual — las 5 llaves de `CashReportPaymentMethod` siempre presentes,
 * en 0 si esa sesion no tuvo ventas con ese medio. */
export type CashReportPaymentBreakdown = Record<
  CashReportPaymentMethod,
  { count: number; total: number }
>

/** Detalle de una sesion de caja puntual (`GET /reports/cash/:id`), para la
 * pantalla "Ver reporte" del historial. */
export interface CashReportDetail extends CashReportItem {
  paymentBreakdown: CashReportPaymentBreakdown
}

/** Respuesta real de GET /reports/cash/:id — un unico registro, sin
 * paginacion (mismo sobre `ApiSuccess<T>` que el resto del modulo). */
export interface CashReportDetailResponse {
  success: true
  data: CashReportDetail
}

// ---------------------------------------------------------------------------
// Productos mas vendidos (lista, sin paginacion)
// ---------------------------------------------------------------------------

/** Coincide exactamente con `TopProductsFilters` del backend. Sin
 * `limit`: es un parametro de consulta, no un filtro (ver
 * `TopProductsQueryParams`). */
export interface TopProductsFilters {
  sucursalId?: string
  categoryId?: string
  dateFrom?: string
  dateTo?: string
}

/** Parametros combinados: filtros + `limit`, para armar el query string. */
export interface TopProductsQueryParams extends TopProductsFilters {
  limit: number
}

/** Coincide exactamente con `TopProductItem` del backend. `salesCount`
 * cuenta lineas de detalle de venta (no ventas distintas). */
export interface TopProductItem {
  productId: string
  sku: string | null
  name: string
  categoryId: string | null
  categoryName: string | null
  unitOfMeasure: 'KILOGRAM' | 'UNIT'
  totalQuantitySold: number
  totalSalesAmount: number
  salesCount: number
}

// ---------------------------------------------------------------------------
// Bajo inventario (lista, sin paginacion)
// ---------------------------------------------------------------------------

/** Coincide exactamente con `LowStockFilters` del backend. `threshold`,
 * si se especifica, reemplaza el `reorderPoint` propio de cada producto
 * como punto de corte. */
export interface LowStockFilters {
  sucursalId?: string
  categoryId?: string
  threshold?: number
}

/** Coincide exactamente con `LowStockItem` del backend. `thresholdUsed`
 * es el punto de corte efectivamente aplicado a esa fila. */
export interface LowStockItem {
  inventoryId: string
  sucursalId: string
  sucursalName: string
  productId: string
  sku: string | null
  productName: string
  categoryId: string | null
  categoryName: string | null
  unitOfMeasure: 'KILOGRAM' | 'UNIT'
  quantity: number
  reorderPoint: number | null
  thresholdUsed: number | null
}

// ---------------------------------------------------------------------------
// Ventas por categoria (lista, sin paginacion)
// ---------------------------------------------------------------------------

/** Coincide exactamente con `SalesByCategoryFilters` del backend. Sin
 * `categoryId`: no tiene sentido filtrar por categoria un reporte que
 * agrupa *por* categoria. Sin `limit`: el numero de categorias reales es
 * naturalmente chico y acotado. */
export interface SalesByCategoryFilters {
  sucursalId?: string
  dateFrom?: string
  dateTo?: string
}

/** Coincide exactamente con `SalesByCategoryItem` del backend.
 * `salesCount` cuenta lineas de detalle de venta (no ventas distintas). */
export interface SalesByCategoryItem {
  categoryId: string | null
  categoryName: string
  totalQuantitySold: number
  totalSalesAmount: number
  salesCount: number
}

// ---------------------------------------------------------------------------
// Ventas por cajero (lista, sin paginacion)
// ---------------------------------------------------------------------------

/** Coincide exactamente con `SalesByCashierFilters` del backend. Sin
 * `userId`: no tiene sentido filtrar por cajero un reporte que agrupa
 * *por* cajero. Sin `limit`: el numero de cajeros reales es naturalmente
 * chico y acotado. */
export interface SalesByCashierFilters {
  sucursalId?: string
  dateFrom?: string
  dateTo?: string
}

/** Coincide exactamente con `SalesByCashierItem` del backend. A
 * diferencia de `SalesByCategoryItem.salesCount`, `totalSales` cuenta
 * VENTAS distintas: se agrupa directamente sobre `Sale`. */
export interface SalesByCashierItem {
  userId: string | null
  userName: string
  totalSales: number
  totalSalesAmount: number
  averageTicket: number
}

/** Bloque REPORTES-AGREGADOS: coincide exactamente con
 * `SalesByCashierSummary` del backend (`GET /reports/sales-by-cashier/summary`)
 * — totales sobre el conjunto COMPLETO que cumple los filtros activos, no
 * el ranking truncado que devuelve `GET /reports/sales-by-cashier`.
 * `topCashierName`/`topCashierAmount`: cajero con mayor `totalSalesAmount`
 * (mismo criterio de orden que usa el listado), `null`/`0` si no hubo
 * ventas en el filtro. */
export interface SalesByCashierSummary {
  totalCashiers: number
  totalSales: number
  totalSalesAmount: number
  averageTicket: number
  topCashierName: string | null
  topCashierAmount: number
}

/** Coincide exactamente con `SalesByDateFilters` del backend. Sin
 * `categoryId`/`userId`: no aplican a este agrupamiento (por fecha). Si
 * se omiten `dateFrom`/`dateTo`, el backend asume los últimos 7 días
 * calendario (incluyendo hoy) — ver `docs/BACKEND_REQUEST_sales-by-date.md`. */
export interface SalesByDateFilters {
  sucursalId?: string
  dateFrom?: string
  dateTo?: string
}

/** Coincide exactamente con `SalesByDateItem` del backend. Un item por
 * cada día del rango solicitado, sin huecos: un día sin ventas viene con
 * `salesCount: 0`/`totalAmount: 0`. `salesCount` cuenta VENTAS distintas
 * (mismo criterio que `SalesByCashierItem.totalSales`, no líneas de
 * detalle como `SalesByCategoryItem.salesCount`). */
export interface SalesByDateItem {
  date: string
  salesCount: number
  totalAmount: number
}

// ---------------------------------------------------------------------------
// Respuestas paginadas (los 5 reportes con `page`/`limit`/`total`)
// ---------------------------------------------------------------------------

interface ReportPaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

/** Respuesta real de GET /reports/sales. */
export interface PaginatedSalesReportResponse {
  success: true
  data: SalesReportItem[]
  meta: ReportPaginationMeta
}

/** Respuesta real de GET /reports/purchases. */
export interface PaginatedPurchasesReportResponse {
  success: true
  data: PurchasesReportItem[]
  meta: ReportPaginationMeta
}

/** Bloque REPORTES-AGREGADOS: coincide exactamente con `SalesReportSummary`
 * del backend (`GET /reports/sales/summary`) — totales sobre el conjunto
 * COMPLETO que cumple los filtros activos, no una pagina. */
export interface SalesReportSummary {
  totalSales: number
  totalAmount: number
  totalDiscount: number
  totalTax: number
  averageTicket: number
}

/** Coincide exactamente con `PurchasesReportSummary` del backend
 * (`GET /reports/purchases/summary`). Sin `totalDiscount`: `Purchase` no
 * tiene ese campo (mismo motivo que `PurchasesReportItem`). `totalSuppliers`:
 * proveedores DISTINTOS dentro del conjunto filtrado, no el catalogo
 * completo de proveedores del sistema. */
export interface PurchasesReportSummary {
  totalPurchases: number
  totalAmount: number
  totalTax: number
  totalSuppliers: number
  averageTicket: number
}

/** Respuesta real de GET /reports/inventory. */
export interface PaginatedInventoryReportResponse {
  success: true
  data: InventoryReportItem[]
  meta: ReportPaginationMeta
}

/** Bloque REPORTES-AGREGADOS: coincide exactamente con
 * `InventoryReportSummary` del backend (`GET /reports/inventory/summary`)
 * — conteos sobre el conjunto COMPLETO que cumple los filtros activos, no
 * una pagina. Sin `totalAmount` ni suma de cantidad: `quantity` mezcla
 * `unitOfMeasure` (`KILOGRAM`/`UNIT`) segun el producto, sumarla no tiene
 * sentido dimensional. */
export interface InventoryReportSummary {
  totalRecords: number
  belowReorderPoint: number
  outOfStock: number
  distinctProducts: number
  distinctSucursales: number
}

/** Respuesta real de GET /reports/profit. */
export interface PaginatedProfitReportResponse {
  success: true
  data: ProfitReportItem[]
  meta: ReportPaginationMeta
}

/** Bloque REPORTES-AGREGADOS: coincide exactamente con `ProfitReportSummary`
 * del backend (`GET /reports/profit/summary`) — totales sobre el conjunto
 * COMPLETO que cumple los filtros activos, no una pagina. `totalCost`/
 * `totalProfit`/`averageMargin` solo consideran las lineas con snapshot de
 * costo conocido (mismo criterio que `marginPercent` por linea). */
export interface ProfitReportSummary {
  totalLines: number
  totalAmount: number
  totalCost: number
  totalProfit: number
  averageMargin: number
}

/** Respuesta real de GET /reports/cash. */
export interface PaginatedCashReportResponse {
  success: true
  data: CashReportItem[]
  meta: ReportPaginationMeta
}

/** Bloque REPORTES-AGREGADOS: coincide exactamente con `CashReportSummary`
 * del backend (`GET /reports/cash/summary`) — totales sobre el conjunto
 * COMPLETO de sesiones que cumplen los filtros activos, no una pagina.
 * `totalSales`/`totalSalesAmount`: de TODAS las ventas de esas sesiones,
 * no solo las de la pagina de sesiones actual. */
export interface CashReportSummary {
  totalSessions: number
  totalSales: number
  totalSalesAmount: number
  averageDifference: number
  totalOpeningAmount: number
}

// ---------------------------------------------------------------------------
// Reporte de Mermas (resumen agregado, sin paginacion) — GET /reports/waste
// ---------------------------------------------------------------------------

/** Coincide exactamente con `WasteReportFilters` del backend. Sin
 * `productId`/`reason`: el reporte ya agrupa por ambos. */
export interface WasteReportFilters {
  sucursalId?: string
  dateFrom?: string
  dateTo?: string
}

export type WasteReportReason =
  | 'RETURNED_NOT_RESTOCKED'
  | 'EXPIRED'
  | 'DAMAGED'
  | 'PRODUCTION_ERROR'
  | 'CUTTING_ERROR'
  | 'PACKAGING_ERROR'
  | 'COLD_CHAIN_FAILURE'
  | 'OTHER'

export interface WasteReportByReasonItem {
  reason: WasteReportReason
  count: number
  quantity: number
  totalValue: number
}

/** `realWastePercent`/`variancePercent` son `null` cuando no hubo compras
 * `RECEIVED` en el periodo filtrado (sin base para calcular el %). */
export interface WasteReportByProductItem {
  productId: string
  productName: string
  sku: string | null
  count: number
  quantity: number
  totalValue: number
  expectedWastePercent: number
  purchasedQuantity: number
  realWastePercent: number | null
  variancePercent: number | null
}

/** Coincide exactamente con `WasteReportResponse` del backend — objeto
 * unico agregado del periodo filtrado, no un listado paginado. */
export interface WasteReportResponse {
  totalCount: number
  totalValue: number
  byReason: WasteReportByReasonItem[]
  byProduct: WasteReportByProductItem[]
}

// ---------------------------------------------------------------------------
// Reporte de Lotes (resumen agregado, sin paginacion) — GET /reports/batches
// ---------------------------------------------------------------------------

/** Coincide exactamente con `BatchesReportFilters` del backend. Sin
 * `status`: el reporte ya agrupa por los 4 estados. */
export interface BatchesReportFilters {
  sucursalId?: string
  productId?: string
  /** Ventana en dias para "proximo a vencer". @default 7 (backend) */
  expiringWithinDays?: number
}

export type BatchesReportStatus = 'ACTIVE' | 'DEPLETED' | 'EXPIRED' | 'BLOCKED'

export interface BatchesReportByStatusItem {
  status: BatchesReportStatus
  count: number
  totalAvailableQuantity: number
}

export interface BatchesReportExpiringSoonItem {
  batchId: string
  code: string
  productId: string
  productName: string
  sku: string | null
  sucursalId: string
  sucursalName: string
  expiryDate: string
  availableQuantity: number
  daysUntilExpiry: number
}

/** Coincide exactamente con `BatchesReportResponse` del backend — foto
 * agregada del estado actual del catalogo de lotes filtrado. */
export interface BatchesReportResponse {
  totalBatches: number
  byStatus: BatchesReportByStatusItem[]
  expiringSoonWithinDays: number
  expiringSoonCount: number
  expiringSoon: BatchesReportExpiringSoonItem[]
}