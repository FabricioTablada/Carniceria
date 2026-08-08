/**
 * modules/reports/reports.service.ts
 * -----------------------------------------------------------------------------
 * Logica de negocio del modulo Reports.
 *
 * Responsabilidades:
 *  - Coordinar los reportes operativos rapidos que la API expone (nunca el
 *    BI pesado, que vive en `prisma/sql/views/` y consume Power BI
 *    directamente contra PostgreSQL, ver ARCHITECTURE.md seccion 6.6).
 *  - Traducir los agregados de Prisma (`Prisma.Decimal`) a numeros planos en
 *    las respuestas, mismo patron usado en Products/Inventory/Purchases/
 *    Sales: `Prisma.Decimal` internamente, `Number()` unicamente aqui.
 *
 * Toda consulta a la base de datos se hace a traves de
 * `reports.repository.ts`; este servicio no ejecuta queries de Prisma
 * directamente.
 */
import { NotFoundError, ValidationError } from '@/shared/errors';
import { getEffectiveCost } from '@/shared/services/costEngine';
import { getCostaRicaDayRange } from '@/shared/utils/date';
import { expireOverdueBatchesService, findByIdBatchService } from '@/modules/batches';
import * as reportsRepository from './reports.repository';
import type {
  BatchesReportByStatusItem,
  BatchesReportExpiringSoonItem,
  BatchesReportFilters,
  BatchesReportResponse,
  BatchesReportStatus,
  BatchReportDetail,
  BatchReportMovementItem,
  CashReportDetail,
  CashReportFilters,
  CashReportItem,
  CashReportPaymentBreakdown,
  CashReportQuery,
  CashReportSummary,
  DashboardFilters,
  DashboardResponse,
  InventoryReportFilters,
  InventoryReportQuery,
  InventoryReportSummary,
  LowStockFilters,
  LowStockItem,
  PaymentMethod,
  ProfitReportFilters,
  ProfitReportQuery,
  ProfitReportSummary,
  PurchasesReportFilters,
  PurchasesReportQuery,
  PurchasesReportSummary,
  ReportResult,
  SalesByCashierFilters,
  SalesByCashierItem,
  SalesByCashierSummary,
  SalesByCategoryFilters,
  SalesByCategoryItem,
  SalesByDateFilters,
  SalesByDateItem,
  SalesReportFilters,
  SalesReportQuery,
  SalesReportSummary,
  TopProductItem,
  TopProductsQuery,
  WasteReportByProductItem,
  WasteReportByReasonItem,
  WasteReportFilters,
  WasteReportReason,
  WasteReportResponse,
} from './reports.types';

/** Las 5 llaves de `PaymentMethod`, para inicializar el desglose de pago en
 * 0 y evitar huecos (ver `CashReportPaymentBreakdown` en reports.types.ts). */
const PAYMENT_METHODS: PaymentMethod[] = ['CASH', 'CARD', 'SINPE_MOVIL', 'TRANSFER', 'MIXED'];

/** Ventana por defecto (dias) para `BatchesReportFilters.expiringWithinDays`
 * cuando el cliente no la especifica — ver `getBatchesReport`. */
const DEFAULT_EXPIRING_SOON_DAYS = 7;

/** Las 4 llaves de `BatchesReportStatus`, para que `getBatchesReport`
 * siempre devuelva las 4 en 0 cuando el catalogo filtrado no tiene lotes
 * en ese estado — mismo criterio de continuidad sin huecos que
 * `PAYMENT_METHODS`/`CashReportPaymentBreakdown`. */
const BATCH_STATUSES: BatchesReportStatus[] = ['ACTIVE', 'DEPLETED', 'EXPIRED', 'BLOCKED'];

/**
 * Bloque COST-04.1 (utilidad diaria del Dashboard, Fase 1 del analisis
 * aprobado — Bloque COST-04): calcula `totalProfitToday`/
 * `averageMarginToday` a partir de las lineas de venta `COMPLETED` de
 * HOY, usando EXCLUSIVAMENTE los snapshots de `SaleItem`
 * (`unitCost`/`expectedWastePercentAtSale`/`applyExpectedWasteToCostAtSale`,
 * Bloques 14.2/COST-03.2) — nunca `Product.expectedWastePercent`/
 * `Product.applyExpectedWasteToCost` vigentes, mismo criterio ya corregido
 * en COST-03.2 para el Reporte de Utilidad.
 *
 * "Hoy" se calcula en la ZONA HORARIA DEL NEGOCIO (Costa Rica, UTC-6 fijo),
 * NUNCA en UTC (Bloque COST-04.2, correccion): `getCostaRicaDayRange()`
 * (`shared/utils/date.ts`, reutilizable) resuelve el dia calendario real
 * de Costa Rica para "ahora" y devuelve su rango como instantes UTC —
 * evita que una venta hecha, por ejemplo, a las 6:30pm hora de Costa Rica
 * (medianoche UTC) quede contada como "de mañana". Deliberadamente
 * DISTINTO del criterio UTC que usa `getSalesByDate` mas abajo en este
 * archivo (reporte historico por rango, no tocado por este bloque) —
 * "hoy" en el Dashboard es un concepto operativo del negocio, no un corte
 * arbitrario de agrupacion.
 *
 * Lineas sin `unitCost` (sin snapshot de costo, caso solo teorico para
 * ventas de HOY ya que el Bloque 14.2 esta vigente desde antes) se
 * EXCLUYEN por completo del calculo — ni su utilidad ni su subtotal
 * participan, para no mezclar "no sabemos el costo de esta linea" con un
 * margen que implicaria confianza en el dato.
 */
async function calculateTodayProfit(
  filters?: DashboardFilters,
): Promise<{ totalProfitToday: number; averageMarginToday: number }> {
  const { start: todayStart, end: todayEnd } = getCostaRicaDayRange();

  const todaySaleItems = await reportsRepository.getDashboardTodaySaleItems({
    sucursalId: filters?.sucursalId,
    dateFrom: todayStart,
    dateToExclusive: todayEnd,
  });

  let totalProfitToday = 0;
  let totalSubtotalToday = 0;

  for (const item of todaySaleItems) {
    if (item.unitCost === null) {
      continue;
    }

    const lineSubtotal = Number(item.lineSubtotal);
    const { effectiveCost } = getEffectiveCost({
      averageCost: Number(item.unitCost),
      wastePercent:
        item.expectedWastePercentAtSale !== null ? Number(item.expectedWastePercentAtSale) : 0,
      applyExpectedWasteToCost: item.applyExpectedWasteToCostAtSale ?? false,
    });

    totalProfitToday += lineSubtotal - effectiveCost * Number(item.quantity);
    totalSubtotalToday += lineSubtotal;
  }

  const averageMarginToday = totalSubtotalToday !== 0 ? (totalProfitToday / totalSubtotalToday) * 100 : 0;

  return { totalProfitToday, averageMarginToday };
}

/** Calcula las metricas del Dashboard operativo. */
export async function getDashboard(filters?: DashboardFilters): Promise<DashboardResponse> {
  const [dashboard, todayProfit] = await Promise.all([
    reportsRepository.getDashboard(filters),
    calculateTodayProfit(filters),
  ]);

  return {
    totalSales: dashboard.totalSales,
    totalSalesAmount: dashboard.totalSalesAmount ? Number(dashboard.totalSalesAmount) : 0,
    totalPurchases: dashboard.totalPurchases,
    totalPurchaseAmount: dashboard.totalPurchaseAmount ? Number(dashboard.totalPurchaseAmount) : 0,
    totalProducts: dashboard.totalProducts,
    totalCategories: dashboard.totalCategories,
    totalSuppliers: dashboard.totalSuppliers,
    totalUsers: dashboard.totalUsers,
    openCashSessions: dashboard.openCashSessions,
    totalProfitToday: todayProfit.totalProfitToday,
    averageMarginToday: todayProfit.averageMarginToday,
  };
}

/** Obtiene el reporte de ventas, filtrado y paginado.
 *
 * Mismo criterio ya aplicado en `getCashReport`/`getDashboard`/
 * `getTopProducts`: convertir los campos `Prisma.Decimal` de `Sale` a
 * `Number()` antes de responder, para que el frontend (`formatCurrency`,
 * que exige `Number.isFinite`) reciba numeros JSON y no strings. */
export async function getSalesReport(query: SalesReportQuery): Promise<ReportResult<unknown>> {
  const [items, total] = await reportsRepository.getSalesReport({
    skip: query.skip,
    take: query.limit,
    filters: query.filters,
  });

  const mappedItems = items.map((item) => {
    // Bloque "consistencia de descuentos": `items`/`appliedPromotions` son
    // el `select` minimo agregado en `reports.repository.ts::saleReportInclude`
    // (nunca las lineas completas) — se consumen aca UNICAMENTE para
    // derivar `discountAmount`/`discountPercent` y se descartan; el DTO
    // publico de este reporte nunca expuso `items`/`appliedPromotions` y
    // sigue sin hacerlo. Mismo criterio (monto real + porcentaje solo
    // cuando es determinable sin ambiguedad) que
    // `SaleDetailContent.tsx`/`SalesTable.tsx` (frontend) y
    // `sales.receiptBuilder.ts` — reescrito aca porque este archivo no
    // puede importar codigo del frontend.
    const { items: lines, appliedPromotions, ...sale } = item;

    const lineDiscountTotal = lines.reduce((sum, line) => sum + Number(line.discount), 0);
    const promotionAmountTotal = appliedPromotions.reduce(
      (sum, promotion) => sum + Number(promotion.amountApplied),
      0,
    );
    const discountAmount = lineDiscountTotal + promotionAmountTotal;

    const singlePercentagePromotion =
      lineDiscountTotal === 0 && appliedPromotions.length === 1
        ? (appliedPromotions[0].effectType
            ? appliedPromotions[0].effectType === 'PERCENTAGE'
            : appliedPromotions[0].discountType === 'PERCENTAGE') && appliedPromotions[0]
        : null;

    return {
      ...sale,
      subtotal: Number(sale.subtotal),
      taxTotal: Number(sale.taxTotal),
      discountTotal: Number(sale.discountTotal),
      total: Number(sale.total),
      amountPaid: Number(sale.amountPaid),
      changeGiven: Number(sale.changeGiven),
      discountAmount,
      discountPercent: singlePercentagePromotion
        ? Number(singlePercentagePromotion.discountValue)
        : null,
    };
  });

  return { items: mappedItems, total };
}

/**
 * Bloque REPORTES-AGREGADOS: totales del Reporte de Ventas sobre el
 * conjunto COMPLETO que cumple `filters` (nunca una pagina) — reutiliza
 * `reportsRepository.getSalesReportSummary`, que a su vez reutiliza el
 * MISMO `buildSalesReportWhere` que ya usa `getSalesReport` (paginado):
 * el agregado y la tabla paginada siempre reflejan exactamente los mismos
 * filtros, sin duplicar esa logica.
 *
 * `averageTicket` se calcula aca (no en el repositorio, que solo hace
 * `aggregate()`): division por cero evitada explicitamente cuando
 * `totalSales` es 0 (sin ventas en el filtro, el promedio no existe).
 *
 * Bloque "consistencia de descuentos": `totalDiscount` ya NO es
 * `_sum.discountTotal` (esa columna es exclusivamente el descuento MANUAL
 * de carrito) — ahora es `lineDiscountTotal + promotionDiscountTotal`
 * (descuentos manuales de linea + TODAS las `SaleAppliedPromotion`,
 * carrito manual y promociones automaticas incluidas), calculados en
 * `reportsRepository.getSalesReportSummary` sobre el MISMO `where`
 * filtrado. Mismo total que ahora se muestra en la columna "Descuento" de
 * la tabla y en el Historial de Ventas — el KPI ya no subreporta cuando
 * el descuento vino de una promocion automatica.
 */
export async function getSalesReportSummary(
  filters?: SalesReportFilters,
): Promise<SalesReportSummary> {
  const { aggregate, lineDiscountTotal, promotionDiscountTotal } =
    await reportsRepository.getSalesReportSummary(filters);

  const totalSales = aggregate._count._all;
  const totalAmount = Number(aggregate._sum.total ?? 0);

  return {
    totalSales,
    totalAmount,
    totalDiscount: Number(lineDiscountTotal ?? 0) + Number(promotionDiscountTotal ?? 0),
    totalTax: Number(aggregate._sum.taxTotal ?? 0),
    averageTicket: totalSales > 0 ? totalAmount / totalSales : 0,
  };
}

/** Obtiene el reporte de compras, filtrado y paginado.
 *
 * Mismo criterio que `getSalesReport`: convierte los `Prisma.Decimal` de
 * `Purchase` y, dado que el `include` trae tambien `items` (lineas de
 * compra completas), los `Prisma.Decimal` de cada `PurchaseItem`. */
export async function getPurchasesReport(
  query: PurchasesReportQuery,
): Promise<ReportResult<unknown>> {
  const [items, total] = await reportsRepository.getPurchasesReport({
    skip: query.skip,
    take: query.limit,
    filters: query.filters,
  });

  const mappedItems = items.map((item) => ({
    ...item,
    subtotal: Number(item.subtotal),
    taxTotal: Number(item.taxTotal),
    total: Number(item.total),
    items: item.items.map((line) => ({
      ...line,
      quantity: Number(line.quantity),
      unitCost: Number(line.unitCost),
      taxRate: Number(line.taxRate),
      lineSubtotal: Number(line.lineSubtotal),
      lineTax: Number(line.lineTax),
      lineTotal: Number(line.lineTotal),
    })),
  }));

  return { items: mappedItems, total };
}

/** Bloque REPORTES-AGREGADOS: mismo patron que `getSalesReportSummary`,
 * sin `totalDiscount` (`Purchase` no tiene ese campo). `totalSuppliers`
 * viene ya resuelto del repositorio (`groupBy` por `supplierId`, mismo
 * `where` que el resto del agregado). */
export async function getPurchasesReportSummary(
  filters?: PurchasesReportFilters,
): Promise<PurchasesReportSummary> {
  const { aggregate, distinctSuppliers } =
    await reportsRepository.getPurchasesReportSummary(filters);

  const totalPurchases = aggregate._count._all;
  const totalAmount = Number(aggregate._sum.total ?? 0);

  return {
    totalPurchases,
    totalAmount,
    totalTax: Number(aggregate._sum.taxTotal ?? 0),
    totalSuppliers: distinctSuppliers,
    averageTicket: totalPurchases > 0 ? totalAmount / totalPurchases : 0,
  };
}

/** Obtiene el reporte de inventario, filtrado y paginado.
 *
 * Mismo criterio que `getSalesReport`: convierte los `Prisma.Decimal` de
 * `Inventory` (`quantity`/`reorderPoint`, este ultimo nullable). */
export async function getInventoryReport(
  query: InventoryReportQuery,
): Promise<ReportResult<unknown>> {
  const [items, total] = await reportsRepository.getInventoryReport({
    skip: query.skip,
    take: query.limit,
    filters: query.filters,
  });

  const mappedItems = items.map((item) => ({
    ...item,
    quantity: Number(item.quantity),
    reorderPoint: item.reorderPoint !== null ? Number(item.reorderPoint) : null,
  }));

  return { items: mappedItems, total };
}

/**
 * Bloque REPORTES-AGREGADOS: totales del Reporte de Inventario sobre el
 * conjunto COMPLETO que cumple `filters` (nunca una pagina). 4 de los 5
 * numeros ya vienen resueltos del repositorio (`count()`/`groupBy()`
 * nativos); `belowReorderPoint` es el unico que este servicio calcula,
 * comparando `quantity <= reorderPoint` linea por linea sobre las filas
 * ya acotadas por el repositorio (solo las que tienen `reorderPoint`
 * configurado dentro del filtro activo) — mismo motivo que
 * `getProfitReportSummary`: esa comparacion no es expresable en un
 * `where` de Prisma sin SQL crudo.
 */
export async function getInventoryReportSummary(
  filters?: InventoryReportFilters,
): Promise<InventoryReportSummary> {
  const { totalRecords, outOfStock, distinctProducts, distinctSucursales, belowReorderPointRows } =
    await reportsRepository.getInventoryReportSummary(filters);

  const belowReorderPoint = belowReorderPointRows.filter(
    (row) => Number(row.quantity) <= Number(row.reorderPoint),
  ).length;

  return {
    totalRecords,
    belowReorderPoint,
    outOfStock,
    distinctProducts,
    distinctSucursales,
  };
}

/** Obtiene el reporte de utilidad, filtrado y paginado.
 *
 * Mismo criterio que `getSalesReport`: convierte los `Prisma.Decimal` de
 * `SaleItem` y, dado que el `include` trae `product.cost`, tambien ese
 * campo anidado.
 *
 * Bloque 14.2 (Costos Base): `SaleItem.unitCost` (el snapshot inmutable del
 * costo al momento de la venta) sigue siendo la UNICA fuente de
 * `averageCost` para este reporte — NUNCA `Product.cost` (el costo
 * VIGENTE, que pudo cambiar desde entonces y falsearia la utilidad de
 * ventas historicas). Si `unitCost` es `null` (venta creada antes del
 * Bloque 14.2, sin snapshot), todos los campos derivados (`effectiveCost`/
 * `costTotal`/`profit`/`marginPercent`) tambien son `null` — no se
 * completan con el costo actual ni con 0, para no mostrar una utilidad
 * inventada.
 *
 * Bloque COST-03.2 (correccion de historico, Opcion A aprobada):
 * `costTotal`/`profit`/`marginPercent` se calculan a partir de
 * `effectiveCost` (`CostEngine.getEffectiveCost()`), no directamente de
 * `unitCost`. El `CostContext` de cada linea combina `averageCost:
 * unitCost` con `wastePercent`/`applyExpectedWasteToCost` leidos
 * EXCLUSIVAMENTE de los snapshots ya persistidos en el propio `SaleItem`
 * (`expectedWastePercentAtSale`/`applyExpectedWasteToCostAtSale`, Bloque
 * COST-03.2) — NUNCA de `Product.expectedWastePercent`/
 * `Product.applyExpectedWasteToCost` (el dato VIGENTE, que si cambiara
 * despues de la venta falsearia su utilidad historica; este es
 * exactamente el defecto que corrigio este bloque respecto de la primera
 * version de la integracion). Si el snapshot es `null` (venta anterior a
 * este bloque, sin dato registrado), se trata como
 * `applyExpectedWasteToCostAtSale: false` — nunca se infiere del `Product`
 * vigente. Si `applyExpectedWasteToCostAtSale` es `false` (default y
 * comportamiento actual de toda venta existente), el motor devuelve
 * `effectiveCost === averageCost` — el calculo de utilidad es identico al
 * de antes de la integracion con el CostEngine. `unitCost` (costo
 * promedio) y `effectiveCost` (costo efectivo) se exponen AMBOS en la
 * respuesta para que el consumidor pueda mostrar los dos. `Product.cost`
 * sigue exponiendose tal cual, como referencia informativa del costo
 * VIGENTE del producto, sin participar de ningun calculo de este
 * reporte. */
export async function getProfitReport(query: ProfitReportQuery): Promise<ReportResult<unknown>> {
  const [items, total] = await reportsRepository.getProfitReport({
    skip: query.skip,
    take: query.limit,
    filters: query.filters,
  });

  const mappedItems = items.map((item) => {
    const quantity = Number(item.quantity);
    const lineSubtotal = Number(item.lineSubtotal);
    const unitCost = item.unitCost !== null ? Number(item.unitCost) : null;
    const effectiveCost =
      unitCost !== null
        ? getEffectiveCost({
            averageCost: unitCost,
            wastePercent:
              item.expectedWastePercentAtSale !== null ? Number(item.expectedWastePercentAtSale) : 0,
            applyExpectedWasteToCost: item.applyExpectedWasteToCostAtSale ?? false,
          }).effectiveCost
        : null;
    const costTotal = effectiveCost !== null ? effectiveCost * quantity : null;
    const profit = costTotal !== null ? lineSubtotal - costTotal : null;
    const marginPercent = profit !== null && lineSubtotal !== 0 ? (profit / lineSubtotal) * 100 : null;

    // Incidencia 1 (Reporte de Utilidad, 06/08/2026): mismo criterio EXACTO
    // que `getSalesReport` de arriba usa para `discountPercent` (reescrito
    // aca porque este archivo no puede importar `saleDiscount.ts` del
    // frontend) — un unico porcentaje solo se expone cuando no hubo
    // descuento manual de linea y existe EXACTAMENTE una promocion
    // automatica de tipo porcentual atada a esta linea
    // (`appliedPromotions`, ya filtrada por `saleItemId` via la relacion
    // directa de `SaleItem`, ver `profitReportInclude`). NO se toca
    // `discount` (sigue siendo exclusivamente el manual, columna existente
    // sin cambios) ni ningun calculo de costo/utilidad/margen de arriba.
    const { appliedPromotions, ...itemWithoutPromotions } = item;
    const lineDiscount = Number(item.discount);
    const singlePercentagePromotion =
      lineDiscount === 0 && appliedPromotions.length === 1
        ? (appliedPromotions[0].effectType
            ? appliedPromotions[0].effectType === 'PERCENTAGE'
            : appliedPromotions[0].discountType === 'PERCENTAGE') && appliedPromotions[0]
        : null;
    const discountPercent = singlePercentagePromotion
      ? Number(singlePercentagePromotion.discountValue)
      : null;

    return {
      ...itemWithoutPromotions,
      quantity,
      unitPrice: Number(item.unitPrice),
      taxRate: Number(item.taxRate),
      discount: lineDiscount,
      discountPercent,
      lineSubtotal,
      lineTax: Number(item.lineTax),
      lineTotal: Number(item.lineTotal),
      unitCost,
      effectiveCost,
      // Snapshots crudos convertidos (`...item` los trae como
      // `Prisma.Decimal | null`/`boolean | null` sin tocar; se sobrescriben
      // aca con la misma disciplina de conversion que el resto de este
      // mapeo) — se exponen como referencia de auditoria de por que
      // `effectiveCost` difiere (o no) de `unitCost` en esta linea.
      expectedWastePercentAtSale:
        item.expectedWastePercentAtSale !== null ? Number(item.expectedWastePercentAtSale) : null,
      applyExpectedWasteToCostAtSale: item.applyExpectedWasteToCostAtSale,
      costTotal,
      profit,
      marginPercent,
      product: {
        id: item.product.id,
        sku: item.product.sku,
        name: item.product.name,
        cost: Number(item.product.cost),
      },
    };
  });

  return { items: mappedItems, total };
}

/**
 * Bloque REPORTES-AGREGADOS: totales del Reporte de Utilidad sobre el
 * conjunto COMPLETO que cumple `filters` (nunca una pagina). Mismo
 * patron exacto que `calculateTodayProfit` (mas arriba, Bloque COST-04.1
 * del Dashboard) — no un `aggregate()` nativo, porque `costTotal`/
 * `profit` no son columnas reales (ver comentario de
 * `reportsRepository.getProfitReportSummaryRows`).
 *
 * Lineas sin `unitCost` (sin snapshot de costo) se EXCLUYEN por completo
 * del calculo de costo/utilidad/margen — ni su costo ni su subtotal
 * participan en `totalCost`/`totalProfit`/`averageMargin`, mismo criterio
 * que `calculateTodayProfit` (no mezclar "costo desconocido" con un
 * margen que implicaria confianza en el dato). `totalAmount` (importe
 * vendido) SI incluye todas las lineas — no depende del costo, es un dato
 * independiente (`lineTotal`, ya con impuesto).
 */
export async function getProfitReportSummary(
  filters?: ProfitReportFilters,
): Promise<ProfitReportSummary> {
  const rows = await reportsRepository.getProfitReportSummaryRows(filters);

  let totalAmount = 0;
  let totalCost = 0;
  let totalProfit = 0;
  let totalSubtotalWithCost = 0;

  for (const row of rows) {
    totalAmount += Number(row.lineTotal);

    if (row.unitCost === null) {
      continue;
    }

    const quantity = Number(row.quantity);
    const lineSubtotal = Number(row.lineSubtotal);
    const { effectiveCost } = getEffectiveCost({
      averageCost: Number(row.unitCost),
      wastePercent:
        row.expectedWastePercentAtSale !== null ? Number(row.expectedWastePercentAtSale) : 0,
      applyExpectedWasteToCost: row.applyExpectedWasteToCostAtSale ?? false,
    });

    const costTotal = effectiveCost * quantity;
    totalCost += costTotal;
    totalProfit += lineSubtotal - costTotal;
    totalSubtotalWithCost += lineSubtotal;
  }

  return {
    totalLines: rows.length,
    totalAmount,
    totalCost,
    totalProfit,
    averageMargin: totalSubtotalWithCost !== 0 ? (totalProfit / totalSubtotalWithCost) * 100 : 0,
  };
}

/** Obtiene el reporte de caja, filtrado y paginado.
 *
 * A diferencia de sales/purchases/inventory/profit (que hoy tampoco
 * convierten, ver auditoria), este reporte SI necesita la conversion
 * `Prisma.Decimal` -> `Number()` porque sus 4 campos monetarios
 * (`openingAmount`/`closingAmount`/`expectedAmount`/`difference`) llegaban
 * a la respuesta como instancias de `Prisma.Decimal` sin convertir:
 * `decimal.js` (que respalda `Prisma.Decimal`) define su propio
 * `toJSON()`, asi que `JSON.stringify` los serializaba como *string*
 * (ej. `"150.00"`), no como numero. El frontend (`formatCurrency`, que
 * exige `Number.isFinite`) descarta cualquier string y muestra "—",
 * aunque el dato si existiera en la base de datos. Mismo patron ya usado
 * en `getDashboard`/`getTopProducts`/`getLowStock` de este mismo archivo. */
export async function getCashReport(query: CashReportQuery): Promise<ReportResult<CashReportItem>> {
  const [items, total] = await reportsRepository.getCashReport({
    skip: query.skip,
    take: query.limit,
    filters: query.filters,
  });

  // `salesCount`/`salesTotal` (Bloque 2, "Ventas = sesion de caja activa"):
  // agregado separado, solo para las sesiones de esta pagina (no toda la
  // tabla) — mismo patron `groupBy` + fusion en el service ya usado por
  // `getTopProducts`/`getSalesByCashier`, nunca un JOIN ni un cambio de
  // schema.
  const salesAggregate = await reportsRepository.getCashSessionsSalesAggregate(
    items.map((item) => item.id),
  );
  const salesById = new Map(
    salesAggregate.map((row) => [
      row.cashSessionId,
      { count: row._count._all, total: Number(row._sum.total ?? 0) },
    ]),
  );

  const mappedItems = items.map((item) => ({
    ...item,
    openingAmount: Number(item.openingAmount),
    closingAmount: item.closingAmount !== null ? Number(item.closingAmount) : null,
    expectedAmount: item.expectedAmount !== null ? Number(item.expectedAmount) : null,
    difference: item.difference !== null ? Number(item.difference) : null,
    salesCount: salesById.get(item.id)?.count ?? 0,
    salesTotal: salesById.get(item.id)?.total ?? 0,
  }));

  return { items: mappedItems, total };
}

/**
 * Bloque REPORTES-AGREGADOS: totales del Reporte de Caja sobre el
 * conjunto COMPLETO que cumple `filters` (nunca una pagina). A diferencia
 * de `getCashReport` (paginado, que fusiona `salesCount`/`salesTotal` por
 * sesion vía `groupBy` + `Map`, solo para las sesiones de esa pagina),
 * aca `reportsRepository.getCashReportSummary` ya resuelve todo con dos
 * `aggregate()` en paralelo (uno sobre `CashSession`, otro sobre `Sale`
 * filtrado por la MISMA relacion `cashSession`) — sin traer ninguna fila.
 */
export async function getCashReportSummary(filters?: CashReportFilters): Promise<CashReportSummary> {
  const { sessionAggregate, salesAggregate } = await reportsRepository.getCashReportSummary(filters);

  return {
    totalSessions: sessionAggregate._count._all,
    totalOpeningAmount: Number(sessionAggregate._sum.openingAmount ?? 0),
    averageDifference:
      sessionAggregate._avg.difference !== null ? Number(sessionAggregate._avg.difference) : 0,
    totalSales: salesAggregate._count._all,
    totalSalesAmount: Number(salesAggregate._sum.total ?? 0),
  };
}

/**
 * Detalle de una sesion de caja puntual (`GET /reports/cash/:id`), para la
 * pantalla "Ver reporte" del historial de sesiones. Incluye el desglose de
 * ventas por metodo de pago, sin huecos: las 5 llaves de `PaymentMethod`
 * siempre estan presentes, en 0 si esa sesion no tuvo ventas con ese medio
 * (mismo criterio de continuidad que `getSalesByDate`).
 */
export async function getCashReportDetail(id: string): Promise<CashReportDetail> {
  const session = await reportsRepository.getCashSessionById(id);

  if (!session) {
    throw new NotFoundError('Sesion de caja');
  }

  const breakdownRows = await reportsRepository.getCashSessionPaymentBreakdown(id);
  const breakdownByMethod = new Map(
    breakdownRows.map((row) => [
      row.paymentMethod,
      { count: row._count._all, total: Number(row._sum.total ?? 0) },
    ]),
  );

  const paymentBreakdown = PAYMENT_METHODS.reduce((acc, method) => {
    acc[method] = breakdownByMethod.get(method) ?? { count: 0, total: 0 };
    return acc;
  }, {} as CashReportPaymentBreakdown);

  const salesCount = Object.values(paymentBreakdown).reduce((sum, entry) => sum + entry.count, 0);
  const salesTotal = Object.values(paymentBreakdown).reduce((sum, entry) => sum + entry.total, 0);

  return {
    ...session,
    openingAmount: Number(session.openingAmount),
    closingAmount: session.closingAmount !== null ? Number(session.closingAmount) : null,
    expectedAmount: session.expectedAmount !== null ? Number(session.expectedAmount) : null,
    difference: session.difference !== null ? Number(session.difference) : null,
    salesCount,
    salesTotal,
    paymentBreakdown,
  };
}

/** Obtiene el ranking de productos mas vendidos. Sin paginacion clasica:
 * `query.limit` acota el tamaño del ranking, separado de `query.filters`
 * (mismo criterio que el resto del modulo: filtros aparte de los
 * parametros de consulta). */
export async function getTopProducts(query: TopProductsQuery): Promise<TopProductItem[]> {
  const { grouped, products } = await reportsRepository.getTopProducts({
    take: query.limit,
    filters: query.filters,
  });

  const productById = new Map(products.map((product) => [product.id, product]));

  return grouped.map((group) => {
    const product = productById.get(group.productId);

    return {
      productId: group.productId,
      sku: product?.sku ?? null,
      // Un producto puede haberse borrado logicamente despues de vender;
      // la extension de borrado logico excluye ese producto de
      // `products` (ver reports.repository.ts), asi que se deja un
      // nombre explicito en vez de dejar el campo vacio.
      name: product?.name ?? 'Producto eliminado',
      categoryId: product?.category.id ?? null,
      categoryName: product?.category.name ?? null,
      // unitOfMeasure ya se traia en la consulta (`include` completo de
      // Product en reports.repository.ts) — solo faltaba pasarlo por
      // este mapeo. 'UNIT' como fallback para el caso "Producto
      // eliminado" (sin fila real de la que leerlo).
      unitOfMeasure: product?.unitOfMeasure ?? 'UNIT',
      totalQuantitySold: Number(group._sum.quantity ?? 0),
      totalSalesAmount: Number(group._sum.lineTotal ?? 0),
      salesCount: group._count._all,
    };
  });
}

/**
 * Obtiene el reporte de productos con bajo inventario. Sin `filters.threshold`,
 * aplica la regla de negocio real ("bajo" = `quantity <= reorderPoint` de
 * cada producto) sobre las filas que ya trajo el repositorio (con
 * `reorderPoint` configurado); esa comparacion columna-contra-columna no
 * la puede hacer Prisma en el `where` (ver nota en `reports.repository.ts`).
 * Las filas sin `reorderPoint` que trae el repositorio ya vienen
 * pre-filtradas por `quantity < 0` en el `where` (peor caso de stock, sin
 * punto de corte propio que evaluar) — se incluyen tal cual, sin repetir
 * aqui esa misma condicion. Con `filters.threshold`, el repositorio ya
 * filtro por Prisma (`quantity <= threshold`) y aqui no hace falta filtrar
 * de nuevo.
 */
export async function getLowStock(filters?: LowStockFilters): Promise<LowStockItem[]> {
  const rows = await reportsRepository.getLowStock(filters);

  const lowStockRows =
    filters?.threshold !== undefined
      ? rows
      : rows.filter(
          (row) => row.reorderPoint === null || Number(row.quantity) <= Number(row.reorderPoint),
        );

  return lowStockRows.map((row) => ({
    inventoryId: row.id,
    sucursalId: row.sucursal.id,
    sucursalName: row.sucursal.name,
    productId: row.product.id,
    sku: row.product.sku,
    productName: row.product.name,
    categoryId: row.product.category?.id ?? null,
    categoryName: row.product.category?.name ?? null,
    unitOfMeasure: row.product.unitOfMeasure,
    quantity: Number(row.quantity),
    reorderPoint: row.reorderPoint ? Number(row.reorderPoint) : null,
    thresholdUsed: filters?.threshold ?? (row.reorderPoint ? Number(row.reorderPoint) : null),
  }));
}

/**
 * Obtiene el reporte de ventas por categoria. El repositorio solo entrega
 * el agrupado por producto (`grouped`) y los productos con su categoria
 * (`products`) — toda la reduccion final por categoria vive aqui, que es
 * donde corresponde la logica de negocio.
 *
 * Si un producto se borro logicamente despues de vender, o su categoria
 * ya no existe, esas ventas se acumulan bajo un cubo "Categoria
 * eliminada" (`categoryId: null`) en vez de perderse del total — mismo
 * criterio defensivo que `getTopProducts` usa para "Producto eliminado".
 */
export async function getSalesByCategory(
  filters?: SalesByCategoryFilters,
): Promise<SalesByCategoryItem[]> {
  const { grouped, products } = await reportsRepository.getSalesByCategory(filters);

  const productById = new Map(products.map((product) => [product.id, product]));

  const totalsByCategory = new Map<string | null, SalesByCategoryItem>();

  for (const group of grouped) {
    const product = productById.get(group.productId);
    const categoryId = product?.category?.id ?? null;
    const categoryName = product?.category?.name ?? 'Categoria eliminada';

    const quantitySold = Number(group._sum.quantity ?? 0);
    const salesAmount = Number(group._sum.lineTotal ?? 0);
    const salesCount = group._count._all;

    const existing = totalsByCategory.get(categoryId);

    if (existing) {
      existing.totalQuantitySold += quantitySold;
      existing.totalSalesAmount += salesAmount;
      existing.salesCount += salesCount;
    } else {
      totalsByCategory.set(categoryId, {
        categoryId,
        categoryName,
        totalQuantitySold: quantitySold,
        totalSalesAmount: salesAmount,
        salesCount,
      });
    }
  }

  return [...totalsByCategory.values()].sort((a, b) => b.totalSalesAmount - a.totalSalesAmount);
}

/**
 * Obtiene el reporte de ventas por cajero. A diferencia de
 * `getSalesByCategory`, no hace falta ninguna reduccion en JS: el
 * repositorio ya agrupa directamente sobre `Sale` (una fila por cajero) y
 * ya devuelve el orden correcto (`orderBy: { _sum: { total: 'desc' } }`),
 * asi que aqui solo se resuelve el nombre de cada cajero y se calcula
 * `averageTicket` — el unico calculo derivado que le corresponde al
 * Service, no al Repository.
 */
export async function getSalesByCashier(
  filters?: SalesByCashierFilters,
): Promise<SalesByCashierItem[]> {
  const { grouped, users } = await reportsRepository.getSalesByCashier(filters);

  const userById = new Map(users.map((user) => [user.id, user]));

  return grouped.map((group) => {
    const user = userById.get(group.userId);
    const totalSales = group._count._all;
    const totalSalesAmount = Number(group._sum.total ?? 0);

    return {
      userId: user?.id ?? null,
      // Un cajero que ya no se pueda resolver (caso hoy poco probable:
      // User no esta en SOFT_DELETE_MODELS y no hay borrado fisico, ver
      // verificacion previa) cae en este fallback por consistencia con
      // el mismo criterio defensivo de getTopProducts/getSalesByCategory.
      userName: user?.fullName ?? 'Usuario eliminado',
      totalSales,
      totalSalesAmount,
      averageTicket: totalSales > 0 ? totalSalesAmount / totalSales : 0,
    };
  });
}

/**
 * Bloque REPORTES-AGREGADOS: totales del Reporte de Ventas por Cajero
 * sobre el conjunto COMPLETO que cumple `filters` (nunca el ranking
 * truncado de `getSalesByCashier`). `totalCashiers` viene del `groupBy`
 * SIN `take` del repositorio (no depende de `MAX_SALES_BY_CASHIER_RESULTS`).
 * `topCashierName`/`topCashierAmount` ya vienen resueltos del repositorio
 * (mismo `orderBy: { _sum: { total: 'desc' } }` que usa `getSalesByCashier`
 * para su propio ranking) — `null`/`0` si no hubo ventas en el filtro.
 */
export async function getSalesByCashierSummary(
  filters?: SalesByCashierFilters,
): Promise<SalesByCashierSummary> {
  const { aggregate, distinctCashiers, topCashier } =
    await reportsRepository.getSalesByCashierSummary(filters);

  const totalSales = aggregate._count._all;
  const totalSalesAmount = Number(aggregate._sum.total ?? 0);

  return {
    totalCashiers: distinctCashiers,
    totalSales,
    totalSalesAmount,
    averageTicket: totalSales > 0 ? totalSalesAmount / totalSales : 0,
    topCashierName: topCashier?.name ?? null,
    topCashierAmount: topCashier?.amount ?? 0,
  };
}

/** Limite defensivo del rango solicitado para `getSalesByDate`: la
 * consulta trae TODAS las ventas del rango a la aplicacion (sin
 * paginacion, ver `reports.repository.ts`) para agruparlas por dia en JS,
 * asi que el rango no puede ser arbitrariamente grande — mismo criterio
 * defensivo que `MAX_SALES_BY_CASHIER_RESULTS` en el repositorio, aplicado
 * aca porque lo que hay que acotar es el rango de fechas, no un `take`. */
const MAX_SALES_BY_DATE_RANGE_DAYS = 92;

/** Tamaño del rango por defecto cuando no se especifica `dateFrom`/
 * `dateTo`: "ultimos 7 dias calendario, incluyendo hoy" (dateTo=hoy,
 * dateFrom=hoy-6) — mismo default documentado y aprobado para el
 * Dashboard. */
const DEFAULT_SALES_BY_DATE_RANGE_DAYS = 6;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Trunca `date` al inicio de su dia en UTC (sin hora). `saleDate` se
 * almacena en UTC (`DateTime` de Prisma/Postgres), asi que agrupar por
 * dia tiene que hacerse en UTC — no en la zona horaria local del proceso
 * — para que el resultado no dependa de donde corre el servidor. */
function toUTCDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUTCDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/** Formatea una fecha ya truncada a dia (UTC) como `YYYY-MM-DD`. */
function formatUTCDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Obtiene la evolucion diaria de ventas (monto + cantidad) para el
 * grafico de lineas del Dashboard ("Ventas últimos 7 días").
 *
 * Sin `filters.dateFrom`/`dateTo`, asume los ultimos 7 dias calendario
 * (incluyendo hoy) — mismo default aprobado para el Dashboard. Siempre
 * devuelve un item por cada dia del rango, SIN huecos: los dias sin
 * ventas se completan aca mismo con `salesCount: 0`/`totalAmount: 0`, en
 * vez de dejar que el frontend adivine que dias faltan (requisito
 * explicito: el grafico de lineas necesita continuidad diaria).
 *
 * El rango se normaliza a limites de dia en UTC antes de consultar y de
 * agrupar, y se acota a `MAX_SALES_BY_DATE_RANGE_DAYS` dias como maximo —
 * ver esa constante para el motivo.
 */
export async function getSalesByDate(filters?: SalesByDateFilters): Promise<SalesByDateItem[]> {
  const dateTo = toUTCDateOnly(filters?.dateTo ?? new Date());
  const dateFrom = toUTCDateOnly(
    filters?.dateFrom ?? addUTCDays(dateTo, -DEFAULT_SALES_BY_DATE_RANGE_DAYS),
  );

  if (dateFrom.getTime() > dateTo.getTime()) {
    throw new ValidationError('dateFrom no puede ser posterior a dateTo.');
  }

  const rangeDays = Math.round((dateTo.getTime() - dateFrom.getTime()) / MS_PER_DAY);

  if (rangeDays > MAX_SALES_BY_DATE_RANGE_DAYS) {
    throw new ValidationError(
      `El rango solicitado no puede superar los ${MAX_SALES_BY_DATE_RANGE_DAYS} dias.`,
    );
  }

  const sales = await reportsRepository.getSalesByDate({
    sucursalId: filters?.sucursalId,
    dateFrom,
    dateToExclusive: addUTCDays(dateTo, 1),
  });

  const totalsByDate = new Map<string, { salesCount: number; totalAmount: number }>();

  for (const sale of sales) {
    const key = formatUTCDate(toUTCDateOnly(sale.saleDate));
    const existing = totalsByDate.get(key) ?? { salesCount: 0, totalAmount: 0 };

    existing.salesCount += 1;
    existing.totalAmount += Number(sale.total);

    totalsByDate.set(key, existing);
  }

  const items: SalesByDateItem[] = [];

  for (let cursor = dateFrom; cursor.getTime() <= dateTo.getTime(); cursor = addUTCDays(cursor, 1)) {
    const key = formatUTCDate(cursor);
    const totals = totalsByDate.get(key);

    items.push({
      date: key,
      salesCount: totals?.salesCount ?? 0,
      totalAmount: totals?.totalAmount ?? 0,
    });
  }

  return items;
}

/**
 * Obtiene el reporte de Mermas y Rendimiento (Bloque 14.7). Resumen unico
 * (sin paginacion, mismo criterio que `getDashboard`): total de mermas,
 * valor economico total, agrupado por motivo y agrupado por producto —
 * este ultimo con la comparacion merma esperada
 * (`Product.expectedWastePercent`, Bloque 14.4) vs. merma real.
 *
 * Las 3 consultas (`getWasteReportTotals`/`getWasteReportByReason`/
 * `getWasteReportByProduct`) son independientes entre si (mismo filtro,
 * distinto agregado) — se piden en paralelo, mismo criterio que
 * `getCashReport` al combinar `getCashReport` + `getCashSessionsSalesAggregate`.
 */
export async function getWasteReport(filters?: WasteReportFilters): Promise<WasteReportResponse> {
  const [totals, byReasonGrouped, byProductData] = await Promise.all([
    reportsRepository.getWasteReportTotals(filters),
    reportsRepository.getWasteReportByReason(filters),
    reportsRepository.getWasteReportByProduct(filters),
  ]);

  const byReason: WasteReportByReasonItem[] = byReasonGrouped.map((group) => ({
    reason: group.reason as WasteReportReason,
    count: group._count._all,
    quantity: Number(group._sum.quantity ?? 0),
    totalValue: Number(group._sum.totalValue ?? 0),
  }));

  const { grouped: byProductGrouped, products, purchased } = byProductData;
  const productById = new Map(products.map((product) => [product.id, product]));
  const purchasedQuantityByProductId = new Map(
    purchased.map((group) => [group.productId, Number(group._sum.quantity ?? 0)]),
  );

  const byProduct: WasteReportByProductItem[] = byProductGrouped
    .map((group) => {
      const product = productById.get(group.productId);
      const quantity = Number(group._sum.quantity ?? 0);
      const purchasedQuantity = purchasedQuantityByProductId.get(group.productId) ?? 0;
      const expectedWastePercent = product ? Number(product.expectedWastePercent) : 0;
      // "Informacion suficiente" (ver `WasteReportByProductItem`): sin
      // compras del producto en el periodo, no hay base de volumen contra
      // la cual expresar un porcentaje real — se deja `null`, nunca 0 ni
      // un porcentaje inventado sobre una base vacia.
      const realWastePercent = purchasedQuantity > 0 ? (quantity / purchasedQuantity) * 100 : null;
      const variancePercent =
        realWastePercent !== null ? realWastePercent - expectedWastePercent : null;

      return {
        productId: group.productId,
        // Mismo criterio defensivo que `getSalesByCategory`/
        // `getSalesByCashier` (`'Categoria eliminada'`/`'Usuario
        // eliminado'`): un producto que ya no se pueda resolver no debe
        // tumbar el reporte.
        productName: product?.name ?? 'Producto eliminado',
        sku: product?.sku ?? null,
        count: group._count._all,
        quantity,
        totalValue: Number(group._sum.totalValue ?? 0),
        expectedWastePercent,
        purchasedQuantity,
        realWastePercent,
        variancePercent,
      };
    })
    .sort((a, b) => b.totalValue - a.totalValue);

  return {
    totalCount: totals._count._all,
    totalValue: Number(totals._sum.totalValue ?? 0),
    byReason,
    byProduct,
  };
}

/**
 * Bloque LOTES-06: Reporte de Lotes (`GET /reports/batches`) — foto
 * agregada del catalogo de lotes filtrado (mismo criterio "sin paginacion"
 * que `getLowStock`/`getWasteReport`): cantidad por estado (`ACTIVE`/
 * `DEPLETED`/`EXPIRED`/`BLOCKED`, siempre las 4 llaves presentes, mismo
 * criterio de continuidad que `PAYMENT_METHODS`) y el detalle de los que
 * estan `ACTIVE` y proximos a vencer.
 *
 * `expireOverdueBatchesService()` (barrel `@/modules/batches`) corre
 * PRIMERO, acotado a los mismos `sucursalId`/`productId` filtrados —
 * "no duplicar logica de negocio": este reporte NUNCA decide por su
 * cuenta cuando un lote vencio, solo reutiliza la politica oficial de
 * transicion de estados que ya vive en `batches/service.ts` (Bloque
 * LOTES-05), antes de leer, exactamente como ya hace ese mismo modulo
 * consigo mismo en `findMany`/`findById`.
 */
export async function getBatchesReport(
  filters?: BatchesReportFilters,
): Promise<BatchesReportResponse> {
  await expireOverdueBatchesService({
    sucursalId: filters?.sucursalId,
    productId: filters?.productId,
  });

  const expiringSoonWithinDays = filters?.expiringWithinDays ?? DEFAULT_EXPIRING_SOON_DAYS;

  const [byStatusGrouped, expiringSoonRows] = await Promise.all([
    reportsRepository.getBatchesReportByStatus(filters),
    reportsRepository.getBatchesReportExpiringSoon(filters, expiringSoonWithinDays),
  ]);

  const countByStatus = new Map(
    byStatusGrouped.map((group) => [
      group.status,
      { count: group._count._all, totalAvailableQuantity: Number(group._sum.availableQuantity ?? 0) },
    ]),
  );

  const byStatus: BatchesReportByStatusItem[] = BATCH_STATUSES.map((status) => ({
    status,
    count: countByStatus.get(status)?.count ?? 0,
    totalAvailableQuantity: countByStatus.get(status)?.totalAvailableQuantity ?? 0,
  }));

  const totalBatches = byStatus.reduce((sum, item) => sum + item.count, 0);

  const now = Date.now();
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  const expiringSoon: BatchesReportExpiringSoonItem[] = expiringSoonRows.map((batch) => ({
    batchId: batch.id,
    code: batch.code,
    productId: batch.product.id,
    productName: batch.product.name,
    sku: batch.product.sku,
    sucursalId: batch.sucursal.id,
    sucursalName: batch.sucursal.name,
    // `expiryDate` no puede ser `null` aca: `getBatchesReportExpiringSoon`
    // ya filtro `expiryDate: { gte, lte }` en el `where` (Prisma nunca
    // incluye una fila con `NULL` contra un filtro de rango).
    expiryDate: batch.expiryDate!,
    availableQuantity: Number(batch.availableQuantity),
    daysUntilExpiry: Math.max(0, Math.floor((batch.expiryDate!.getTime() - now) / MS_PER_DAY)),
  }));

  return {
    totalBatches,
    byStatus,
    expiringSoonWithinDays,
    expiringSoonCount: expiringSoon.length,
    expiringSoon,
  };
}

/**
 * Bloque LOTES-06: Detalle de trazabilidad de un lote puntual
 * (`GET /reports/batches/:id`) — mismo patron "detalle + desglose" que
 * `getCashReportDetail`. El resumen del lote se REUTILIZA de
 * `findByIdBatchService` (barrel `@/modules/batches`, la misma funcion
 * que sirve `GET /inventory/batches/:id`) en vez de reconsultar `Batch`
 * por su cuenta: evita duplicar tanto la consulta (`include` de
 * producto/sucursal/proveedor) como, mas importante, el barrido de
 * vencimiento que esa funcion ya aplica (Bloque LOTES-05) -- este reporte
 * jamas mostraria un lote vencido como `ACTIVE`.
 */
export async function getBatchReportDetail(id: string): Promise<BatchReportDetail> {
  // `findByIdBatchService` ya lanza `NotFoundError` si el lote no existe
  // (`batches/service.ts::findById`) -- este reporte no repite esa
  // validacion, la reutiliza tal cual.
  const batch = await findByIdBatchService(id);

  const movementRows = await reportsRepository.getBatchMovements(id);

  const movements: BatchReportMovementItem[] = movementRows.map((movement) => ({
    id: movement.id,
    type: movement.type,
    quantity: Number(movement.quantity),
    balanceAfter: Number(movement.balanceAfter),
    referenceType: movement.referenceType,
    referenceId: movement.referenceId,
    reason: movement.reason,
    userId: movement.user.id,
    userName: movement.user.fullName,
    createdAt: movement.createdAt,
  }));

  return {
    id: batch.id,
    code: batch.code,
    supplierLotCode: batch.supplierLotCode,
    productId: batch.product.id,
    productName: batch.product.name,
    sku: batch.product.sku,
    unitOfMeasure: batch.product.unitOfMeasure,
    sucursalId: batch.sucursal.id,
    sucursalName: batch.sucursal.name,
    supplierId: batch.supplier?.id ?? null,
    supplierName: batch.supplier?.name ?? null,
    receivedAt: batch.receivedAt,
    productionDate: batch.productionDate,
    expiryDate: batch.expiryDate,
    initialQuantity: batch.initialQuantity,
    availableQuantity: batch.availableQuantity,
    unitCost: batch.unitCost,
    status: batch.status,
    closedAt: batch.closedAt,
    notes: batch.notes,
    movements,
  };
}
