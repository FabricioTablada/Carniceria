/**
 * modules/reports/reports.types.ts
 * -----------------------------------------------------------------------------
 * Tipos compartidos del modulo Reports.
 *
 * Define los filtros y estructuras utilizadas por Repository, Service y
 * Controller para la generacion de reportes operativos del sistema.
 *
 * NOTA ARQUITECTONICA: este modulo cubre unicamente reportes rapidos
 * servidos por la API (ver ARCHITECTURE.md seccion 6.6). El BI pesado
 * (tendencias, margenes historicos, top de productos) vive en vistas SQL
 * bajo `prisma/sql/views/`, consumidas directamente por Power BI, nunca
 * por este modulo. `getDashboard()` NO consume `vw_dashboard`; calcula sus
 * metricas con `count()`/`aggregate()` de Prisma directamente contra las
 * tablas transaccionales, evitando por completo el problema de
 * serializacion de `BigInt` que produce `$queryRaw` sobre columnas
 * `bigint`/`COUNT(*)` de PostgreSQL.
 */
import type { PaginationParams } from '@/shared/utils/pagination';

/** Filtros para el Dashboard operativo. */
export interface DashboardFilters {
  sucursalId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

/** Forma de las metricas del Dashboard operativo. */
export interface DashboardResponse {
  totalSales: number;
  totalSalesAmount: number;
  totalPurchases: number;
  totalPurchaseAmount: number;
  totalProducts: number;
  totalCategories: number;
  totalSuppliers: number;
  totalUsers: number;
  openCashSessions: number;
  /** Bloque COST-04.1 (utilidad diaria, Fase 1 del analisis aprobado):
   * `Σ (lineSubtotal - effectiveCost * quantity)` de las lineas de venta
   * `COMPLETED` de HOY. Calculado exclusivamente con los snapshots de
   * `SaleItem` (`unitCost`/`expectedWastePercentAtSale`/
   * `applyExpectedWasteToCostAtSale`) via `CostEngine.getEffectiveCost()`
   * — nunca con `Product.expectedWastePercent`/
   * `Product.applyExpectedWasteToCost` vigentes. `0` si no hubo ventas hoy
   * (nunca `null`: "cero utilidad" es un valor real y valido para un dia
   * sin ventas). Ignora `DashboardFilters.dateFrom`/`dateTo` (siempre es
   * el dia de HOY); respeta `sucursalId`. */
  totalProfitToday: number;
  /** Bloque COST-04.1: `(totalProfitToday / subtotalTotalDeHoy) * 100`.
   * `0` si no hubo ventas hoy (mismo criterio que `totalProfitToday`, sin
   * `null`: no hay division por cero real porque el denominador se valida
   * antes de dividir). */
  averageMarginToday: number;
}

/** Metodo de pago (enum `PaymentMethod` de `schema.prisma`). */
export type PaymentMethod = 'CASH' | 'CARD' | 'SINPE_MOVIL' | 'TRANSFER' | 'MIXED';

/** Filtros para Reporte de Ventas. */
export interface SalesReportFilters {
  sucursalId?: string;
  userId?: string;
  paymentMethod?: PaymentMethod;
  dateFrom?: Date;
  dateTo?: Date;
}

/** Parametros combinados para el reporte de ventas: filtros + paginacion. */
export interface SalesReportQuery extends PaginationParams {
  filters?: SalesReportFilters;
}

/** Filtros para Reporte de Compras. */
export interface PurchasesReportFilters {
  sucursalId?: string;
  supplierId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

/** Parametros combinados para el reporte de compras: filtros + paginacion. */
export interface PurchasesReportQuery extends PaginationParams {
  filters?: PurchasesReportFilters;
}

/** Filtros para Reporte de Inventario. */
export interface InventoryReportFilters {
  categoryId?: string;
  sucursalId?: string;
  active?: boolean;
}

/** Parametros combinados para el reporte de inventario: filtros + paginacion. */
export interface InventoryReportQuery extends PaginationParams {
  filters?: InventoryReportFilters;
}

/** Estado de sesion de caja (enum `CashSessionStatus` de `schema.prisma`).
 * Declarado localmente, mismo criterio que `ReportUnitOfMeasure`: sin
 * import cruzado hacia el modulo `cash`. */
export type ReportCashSessionStatus = 'OPEN' | 'CLOSED';

/** Filtros para Reporte de Caja. `status`: historial de sesiones cerradas
 * (frontend, "Ventas = sesion de caja activa" Bloque 2) filtra por
 * `CLOSED` por defecto, pero el backend no fuerza ningun valor — sin este
 * filtro, se listan sesiones de cualquier estado (comportamiento
 * preexistente, sin cambios). */
export interface CashReportFilters {
  sucursalId?: string;
  cashRegisterId?: string;
  userId?: string;
  status?: ReportCashSessionStatus;
  dateFrom?: Date;
  dateTo?: Date;
}

/** Parametros combinados para el reporte de caja: filtros + paginacion. */
export interface CashReportQuery extends PaginationParams {
  filters?: CashReportFilters;
}

/** Item del reporte de Caja (listado). `salesCount`/`salesTotal` son
 * agregados de `Sale` (COMPLETED) para esa sesion — no existian antes de
 * este cambio (antes el reporte solo devolvia las columnas propias de
 * `CashSession`, sin ningun dato de ventas); se calculan con un `groupBy`
 * separado y se fusionan en el service (mismo patron ya usado por
 * `getTopProducts`/`getSalesByCashier`: agregado + resolucion, fusionados
 * fuera del repository). */
export interface CashReportItem {
  id: string;
  sucursalId: string;
  cashRegisterId: string;
  status: ReportCashSessionStatus;
  openedByUserId: string;
  openedAt: Date;
  openingAmount: number;
  closedByUserId: string | null;
  closedAt: Date | null;
  closingAmount: number | null;
  expectedAmount: number | null;
  difference: number | null;
  notes: string | null;
  sucursal: { id: string; name: string };
  cashRegister: { id: string; name: string };
  openedBy: { id: string; fullName: string };
  closedBy: { id: string; fullName: string } | null;
  salesCount: number;
  salesTotal: number;
}

/** Desglose de ventas por metodo de pago, para el detalle de una sesion de
 * caja puntual. Siempre incluye las 5 llaves de `PaymentMethod`, con
 * `count`/`total` en 0 para los metodos sin ventas en esa sesion (mismo
 * criterio de "sin huecos" ya usado en `SalesByDateItem`). */
export type CashReportPaymentBreakdown = Record<PaymentMethod, { count: number; total: number }>;

/** Detalle de una sesion de caja puntual (`GET /reports/cash/:id`), para la
 * pantalla de "Ver reporte" de una sesion del historial. Extiende
 * `CashReportItem` (mismos campos de sesion) con el desglose de ventas por
 * metodo de pago. */
export interface CashReportDetail extends CashReportItem {
  paymentBreakdown: CashReportPaymentBreakdown;
}

/** Filtros para Reporte de Utilidad. */
export interface ProfitReportFilters {
  sucursalId?: string;
  categoryId?: string;
  productId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

/** Parametros combinados para el reporte de utilidad: filtros + paginacion. */
export interface ProfitReportQuery extends PaginationParams {
  filters?: ProfitReportFilters;
}

/** Resultado generico de un reporte paginado. */
export interface ReportResult<T> {
  items: T[];
  total: number;
}

/**
 * Agregado del Reporte de Ventas (Bloque REPORTES-AGREGADOS): totales
 * calculados sobre el conjunto COMPLETO que cumple los filtros activos
 * (`SalesReportFilters`), no sobre una pagina. `averageTicket` = 0 cuando
 * `totalSales` es 0 (division por cero evitada en el service, no aca).
 *
 * Patron reutilizable para los proximos reportes: un `<Reporte>Summary`
 * con `total<Entidad>` (conteo) + `totalAmount` (suma del campo `total`)
 * + los desgloses relevantes de ESE reporte especifico + `averageTicket`.
 *
 * `totalDiscount` (bloque "consistencia de descuentos"): incluye
 * descuentos MANUALES (de linea y de carrito) Y promociones AUTOMATICAS —
 * no es una simple suma de `Sale.discountTotal` (esa columna, por si
 * sola, es exclusivamente el descuento manual de carrito).
 */
export interface SalesReportSummary {
  totalSales: number;
  totalAmount: number;
  totalDiscount: number;
  totalTax: number;
  averageTicket: number;
}

/** Agregado del Reporte de Compras — mismo patron que `SalesReportSummary`,
 * sin `totalDiscount` (`Purchase` no tiene ese campo). `totalSuppliers`:
 * proveedores DISTINTOS dentro del conjunto filtrado (no el catalogo
 * completo de proveedores del sistema). */
export interface PurchasesReportSummary {
  totalPurchases: number;
  totalAmount: number;
  totalTax: number;
  totalSuppliers: number;
  averageTicket: number;
}

/**
 * Agregado del Reporte de Utilidad — mismo patron que `SalesReportSummary`/
 * `PurchasesReportSummary`. `totalAmount` = suma de `lineTotal` (importe
 * vendido, igual base que "Importe total" en Ventas); `totalCost`/
 * `totalProfit` = suma de `costTotal`/`profit` (solo de las lineas que SI
 * tienen snapshot de costo — ver `getProfitReportSummary` en el
 * repositorio). `averageMargin` (%) se calcula como
 * `totalProfit / totalSubtotal * 100` (base ANTES de impuesto, mismo
 * criterio que `marginPercent` por linea, `reports.service.ts::
 * getProfitReport`), 0 si `totalSubtotal` es 0.
 */
export interface ProfitReportSummary {
  totalLines: number;
  totalAmount: number;
  totalCost: number;
  totalProfit: number;
  averageMargin: number;
}

/**
 * Agregado del Reporte de Inventario — a diferencia de `SalesReportSummary`/
 * `PurchasesReportSummary`/`ProfitReportSummary`, no tiene `totalAmount`
 * ni suma cantidades: `Inventory.quantity` mezcla `unitOfMeasure`
 * (`KILOGRAM`/`UNIT`) segun el producto, sumarla no tiene sentido
 * dimensional. Los 5 campos son conteos sobre el conjunto COMPLETO
 * filtrado. `belowReorderPoint`: filas con `reorderPoint` configurado
 * donde `quantity` <= `reorderPoint` (ver `getInventoryReportSummary` en
 * el repositorio para el motivo de por que esta es la unica metrica que
 * no sale de un `count()`/`groupBy()` directo).
 */
export interface InventoryReportSummary {
  totalRecords: number;
  belowReorderPoint: number;
  outOfStock: number;
  distinctProducts: number;
  distinctSucursales: number;
}

/**
 * Agregado del Reporte de Caja — mismo patron que el resto. `totalSessions`/
 * `totalOpeningAmount`/`averageDifference` salen de columnas reales de
 * `CashSession` (`aggregate()` nativo). `totalSales`/`totalSalesAmount`
 * son de TODAS las ventas COMPLETED de las sesiones que cumplen el
 * filtro (no solo la pagina de sesiones actual) — ver
 * `getCashReportSummary` en el repositorio para el criterio de filtrado
 * anidado (`Sale.cashSession`, mismo `where` de `CashSession`).
 * `averageDifference` = 0 si ninguna sesion filtrada tiene `difference`
 * (todas siguen abiertas).
 */
export interface CashReportSummary {
  totalSessions: number;
  totalSales: number;
  totalSalesAmount: number;
  averageDifference: number;
  totalOpeningAmount: number;
}

/** Filtros para Reporte de Productos mas vendidos. No incluye `limit`: es
 * un parametro de consulta, no un filtro (ver `TopProductsQuery`). */
export interface TopProductsFilters {
  sucursalId?: string;
  categoryId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

/** Parametros combinados para el reporte de productos mas vendidos:
 * filtros + `limit`. No extiende `PaginationParams` (sin `page`/`skip`):
 * es un ranking acotado por `limit`, no un listado paginado tradicional. */
export interface TopProductsQuery {
  limit: number;
  filters?: TopProductsFilters;
}

/** Item del reporte de Productos mas vendidos. `salesCount` cuenta lineas
 * de detalle de venta (no ventas distintas) — ver nota en
 * `reports.repository.ts`. */
/** Unidad de medida del producto (enum `UnitOfMeasure` de `schema.prisma`).
 * Declarado localmente (mismo criterio ya usado en `products.types.ts`,
 * sin import cruzado entre modulos) — necesario para que el frontend
 * formatee cantidades con su unidad ("12.500 kg" / "3 u.") en vez de un
 * numero sin contexto. */
export type ReportUnitOfMeasure = 'KILOGRAM' | 'UNIT';

export interface TopProductItem {
  productId: string;
  sku: string | null;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  unitOfMeasure: ReportUnitOfMeasure;
  totalQuantitySold: number;
  totalSalesAmount: number;
  salesCount: number;
}

/** Filtros para Reporte de Productos con bajo inventario.
 * `threshold`, si se especifica, reemplaza el `reorderPoint` propio de
 * cada producto como punto de corte (util para consultas puntuales tipo
 * "que hay por debajo de X unidades", sin importar como este configurado
 * cada producto). Sin `threshold`, se usa el `reorderPoint` real de cada
 * fila de inventario (y se excluyen las filas sin `reorderPoint`
 * configurado: no hay "bajo" que evaluar sin un punto de corte). */
export interface LowStockFilters {
  sucursalId?: string;
  categoryId?: string;
  threshold?: number;
}

/** Item del reporte de Productos con bajo inventario. `thresholdUsed` es
 * el punto de corte efectivamente aplicado a esa fila (el `threshold` del
 * filtro si se especifico, o el `reorderPoint` propio del producto). */
export interface LowStockItem {
  inventoryId: string;
  sucursalId: string;
  sucursalName: string;
  productId: string;
  sku: string | null;
  productName: string;
  categoryId: string | null;
  categoryName: string | null;
  unitOfMeasure: ReportUnitOfMeasure;
  quantity: number;
  reorderPoint: number | null;
  thresholdUsed: number | null;
}

/** Filtros para Reporte de Ventas por categoria. Sin `categoryId`: no
 * tiene sentido filtrar por categoria un reporte que agrupa *por*
 * categoria. Sin `limit`: a diferencia de Top Products, el numero de
 * categorias reales es naturalmente chico y acotado, no hace falta
 * truncar el resultado. */
export interface SalesByCategoryFilters {
  sucursalId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

/** Item del reporte de Ventas por categoria. `salesCount` cuenta lineas
 * de detalle de venta (no ventas distintas) — misma limitacion que
 * `TopProductItem.salesCount`, ver nota en `reports.repository.ts`. */
export interface SalesByCategoryItem {
  categoryId: string | null;
  categoryName: string;
  totalQuantitySold: number;
  totalSalesAmount: number;
  salesCount: number;
}

/** Filtros para Reporte de Ventas por cajero. Sin `userId`: no tiene
 * sentido filtrar por cajero un reporte que agrupa *por* cajero. Sin
 * `limit`: el numero de cajeros reales es naturalmente chico y acotado,
 * no hace falta truncar el resultado. */
export interface SalesByCashierFilters {
  sucursalId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

/** Item del reporte de Ventas por cajero. A diferencia de
 * `SalesByCategoryItem.salesCount` (que cuenta lineas de detalle),
 * `totalSales` cuenta VENTAS distintas: se agrupa directamente sobre
 * `Sale`, no sobre `SaleItem`, asi que no hay la limitacion de
 * `COUNT(DISTINCT)` que si aplica a Top Products/Ventas por categoria. */
export interface SalesByCashierItem {
  userId: string | null;
  userName: string;
  totalSales: number;
  totalSalesAmount: number;
  averageTicket: number;
}

/**
 * Agregado del Reporte de Ventas por Cajero (Bloque REPORTES-AGREGADOS) —
 * mismo patron que `SalesReportSummary`/`CashReportSummary`. `totalCashiers`
 * = cajeros DISTINTOS dentro del conjunto filtrado (ver `getSalesByCashierSummary`
 * en el repositorio, `groupBy` sin `take` — no depende del limite defensivo
 * `MAX_SALES_BY_CASHIER_RESULTS` que si trunca el listado de `getSalesByCashier`).
 * `topCashierName`/`topCashierAmount`: cajero con mayor `totalSalesAmount`
 * dentro del conjunto filtrado (mismo criterio de orden — `_sum.total desc`
 * — que ya usa `getSalesByCashier` para su propio listado, para que "lider"
 * en el KPI coincida con el primero de la tabla). `null`/`0` si no hubo
 * ventas en el periodo filtrado.
 */
export interface SalesByCashierSummary {
  totalCashiers: number;
  totalSales: number;
  totalSalesAmount: number;
  averageTicket: number;
  topCashierName: string | null;
  topCashierAmount: number;
}

/** Filtros para Reporte de Ventas por fecha (evolucion diaria, Dashboard).
 * Sin `categoryId`/`userId`: no aplican a este agrupamiento. Sin
 * `dateFrom`/`dateTo`, `reports.service.ts` asume los ultimos 7 dias
 * calendario (incluyendo hoy) — ver `getSalesByDate` en ese archivo. */
export interface SalesByDateFilters {
  sucursalId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

/** Item del reporte de Ventas por fecha. Siempre un item por cada dia del
 * rango solicitado, SIN huecos: un dia sin ventas aparece igual con
 * `salesCount: 0`/`totalAmount: 0` (requisito de continuidad diaria para
 * el grafico de lineas del Dashboard — ver `reports.service.ts`).
 * `salesCount` cuenta VENTAS distintas (se agrupa sobre `Sale`), mismo
 * criterio que `SalesByCashierItem.totalSales` — no lineas de detalle
 * como `SalesByCategoryItem.salesCount`. */
export interface SalesByDateItem {
  date: string;
  salesCount: number;
  totalAmount: number;
}

// ---------------------------------------------------------------------------
// Reporte de Mermas y Rendimiento (Bloque 14.7 — resumen agregado, sin
// paginacion, mismo criterio que SalesByCategoryItem/TopProductItem)
// ---------------------------------------------------------------------------

/** Origen/causa de una merma (enum `WasteReason` de `schema.prisma`). Mismo
 * vocabulario que `modules/inventoryWaste/types.ts`, redeclarado aca sin
 * import cruzado entre modulos (mismo criterio que el resto de este
 * archivo). */
export type WasteReportReason =
  | 'RETURNED_NOT_RESTOCKED'
  | 'EXPIRED'
  | 'DAMAGED'
  | 'PRODUCTION_ERROR'
  | 'CUTTING_ERROR'
  | 'PACKAGING_ERROR'
  | 'COLD_CHAIN_FAILURE'
  | 'OTHER';

/** Filtros para Reporte de Mermas y Rendimiento. Sin `productId`/`reason`
 * (el reporte ya agrupa por ambos, ver `WasteReportItem`) — mismo criterio
 * que `SalesByCategoryFilters` (sin `categoryId`, porque agrupa por esa
 * dimension). */
export interface WasteReportFilters {
  sucursalId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

/** Mermas del periodo filtrado, agrupadas por motivo (`InventoryWaste.reason`). */
export interface WasteReportByReasonItem {
  reason: WasteReportReason;
  count: number;
  quantity: number;
  totalValue: number;
}

/**
 * Mermas del periodo filtrado, agrupadas por producto, con comparacion
 * merma esperada (`Product.expectedWastePercent`, Bloque 14.4) vs. merma
 * real cuando exista informacion suficiente para calcularla.
 *
 * "Informacion suficiente" = el producto tuvo compras `RECEIVED` en el
 * mismo periodo/sucursal filtrado (`purchasedQuantity > 0`): sin una base
 * de volumen recibido, un porcentaje real de merma no tendria contra que
 * compararse. Cuando no la hay, `realWastePercent`/`variancePercent` son
 * `null` — nunca se inventa un porcentaje sobre una base de 0.
 */
export interface WasteReportByProductItem {
  productId: string;
  productName: string;
  sku: string | null;
  count: number;
  quantity: number;
  totalValue: number;
  /** `Product.expectedWastePercent` vigente (Bloque 14.4) — snapshot del
   * dato MAESTRO actual del producto, no historico: este reporte compara
   * mermas ya ocurridas contra la expectativa configurada HOY, mismo
   * criterio ya documentado para ese campo (dato maestro, sin snapshot
   * propio todavia). */
  expectedWastePercent: number;
  /** Cantidad comprada del producto (`PurchaseItem.quantity`, compras
   * `RECEIVED`) en el mismo periodo/sucursal filtrado — base para calcular
   * el porcentaje real de merma. `0` si no hubo compras en el periodo. */
  purchasedQuantity: number;
  /** `(quantity / purchasedQuantity) * 100`. `null` si `purchasedQuantity`
   * es 0. */
  realWastePercent: number | null;
  /** `realWastePercent - expectedWastePercent`. `null` si `realWastePercent`
   * es `null`. Positivo = se mermo mas de lo esperado; negativo = menos. */
  variancePercent: number | null;
}

/** Resumen del reporte de Mermas y Rendimiento (Bloque 14.7). Objeto unico,
 * sin paginacion ni `meta` — mismo criterio que `DashboardResponse`: un
 * resumen agregado del periodo filtrado, no un listado. */
export interface WasteReportResponse {
  totalCount: number;
  totalValue: number;
  byReason: WasteReportByReasonItem[];
  byProduct: WasteReportByProductItem[];
}

/**
 * Bloque LOTES-06 (Reportes del Modulo de Lotes). Estado de un lote (enum
 * `BatchStatus` de `schema.prisma`), re-declarado localmente como union
 * type — mismo criterio que `WasteReportReason` en este mismo archivo (sin
 * import cruzado entre modulos).
 */
export type BatchesReportStatus = 'ACTIVE' | 'DEPLETED' | 'EXPIRED' | 'BLOCKED';

/** Filtros para el Reporte de Lotes (`GET /reports/batches`). Sin
 * `status` (el reporte ya agrupa por los 4 estados, ver
 * `BatchesReportByStatusItem`) — mismo criterio que `WasteReportFilters`
 * (sin `reason`, porque agrupa por esa dimension). */
export interface BatchesReportFilters {
  sucursalId?: string;
  productId?: string;
  /** Ventana, en dias, para considerar un lote `ACTIVE` "proximo a vencer"
   * (`expiryDate` dentro de `[hoy, hoy + N]`). @default 7 */
  expiringWithinDays?: number;
}

/** Cantidad de lotes por estado, mas su saldo disponible sumado — este
 * ultimo solo es economicamente significativo para `ACTIVE`/`EXPIRED`/
 * `BLOCKED` (los que aun representan existencia real, ver el invariante
 * corregido en `batches/service.ts`); para `DEPLETED` siempre es 0 por
 * construccion. */
export interface BatchesReportByStatusItem {
  status: BatchesReportStatus;
  count: number;
  totalAvailableQuantity: number;
}

/** Un lote `ACTIVE` cuya `expiryDate` cae dentro de la ventana de "proximo
 * a vencer" filtrada (`BatchesReportFilters.expiringWithinDays`). */
export interface BatchesReportExpiringSoonItem {
  batchId: string;
  code: string;
  productId: string;
  productName: string;
  sku: string | null;
  sucursalId: string;
  sucursalName: string;
  expiryDate: Date;
  availableQuantity: number;
  /** Dias enteros restantes hasta `expiryDate` (redondeado hacia abajo,
   * puede ser `0` el dia mismo del vencimiento). */
  daysUntilExpiry: number;
}

/** Resumen del Reporte de Lotes (`GET /reports/batches`). Objeto unico,
 * sin paginacion ni `meta` — mismo criterio que `WasteReportResponse`: una
 * foto agregada del estado actual del catalogo de lotes filtrado, no un
 * listado paginado (mismo criterio de `getLowStock`, tambien una foto de
 * alertas del momento). */
export interface BatchesReportResponse {
  totalBatches: number;
  byStatus: BatchesReportByStatusItem[];
  /** Ventana (dias) realmente usada para `expiringSoon` — eco de
   * `filters.expiringWithinDays` o su default, para que el cliente sepa
   * que ventana esta viendo sin tener que repetir el valor por su cuenta. */
  expiringSoonWithinDays: number;
  expiringSoonCount: number;
  expiringSoon: BatchesReportExpiringSoonItem[];
}

/**
 * Un movimiento de inventario (`InventoryMovement`) que afecto a un lote
 * puntual — la "trazabilidad" del lote: alta (Compras/reingreso de
 * Devoluciones), consumo (Ventas/Mermas) y ajuste manual, en orden
 * cronologico.
 */
export interface BatchReportMovementItem {
  id: string;
  type: string;
  /** Con signo: positivo entra, negativo sale (mismo criterio que
   * `InventoryMovement.quantity`, ver DATABASE.md). */
  quantity: number;
  balanceAfter: number;
  referenceType: string | null;
  referenceId: string | null;
  reason: string | null;
  userId: string;
  userName: string;
  createdAt: Date;
}

/**
 * Detalle de trazabilidad de un lote puntual (`GET /reports/batches/:id`):
 * el mismo `BatchResponse` que expone `GET /inventory/batches/:id`
 * (`modules/batches`, reutilizado tal cual — "no duplicar logica de
 * negocio", ver `reports.service.ts::getBatchReportDetail`) mas la lista
 * completa de sus movimientos de inventario.
 */
export interface BatchReportDetail {
  id: string;
  code: string;
  supplierLotCode: string | null;
  productId: string;
  productName: string;
  sku: string | null;
  unitOfMeasure: string;
  sucursalId: string;
  sucursalName: string;
  supplierId: string | null;
  supplierName: string | null;
  receivedAt: Date;
  productionDate: Date | null;
  expiryDate: Date | null;
  initialQuantity: number;
  availableQuantity: number;
  unitCost: number;
  status: BatchesReportStatus;
  closedAt: Date | null;
  notes: string | null;
  movements: BatchReportMovementItem[];
}
