/**
 * modules/reports/reports.repository.ts
 * -----------------------------------------------------------------------------
 * Acceso a datos del modulo Reports.
 * Es infraestructura pura: no contiene logica de negocio (eso vive en
 * `reports.service.ts`). Usa unicamente la instancia singleton de Prisma
 * expuesta en `@/database`.
 *
 * `getDashboard` calcula sus metricas con `count()`/`aggregate()` de Prisma
 * directamente contra las tablas transaccionales, NO contra `vw_dashboard`
 * (esa vista es exclusiva de Power BI, ver `prisma/sql/views/vw_dashboard.sql`
 * y ARCHITECTURE.md seccion 6.6). Esto evita por completo el problema de
 * serializacion de `BigInt` que produce `$queryRaw` sobre `COUNT(*)` de
 * PostgreSQL: los metodos tipados de Prisma devuelven `number`/
 * `Prisma.Decimal` de forma consistente, sin pasar por el driver `pg` en
 * crudo.
 *
 * `getSalesReport`, `getPurchasesReport`, `getInventoryReport` y
 * `getProfitReport` aplican filtros y paginacion (mismo patron `buildWhere`
 * + `prisma.$transaction([findMany, count])` ya usado en el resto del
 * proyecto), en lugar de devolver la tabla completa sin limite.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/database';
import {
  costaRicaDayEndExclusiveFromDateOnly,
  costaRicaDayStartFromDateOnly,
} from '@/shared/utils/date';
import type {
  BatchesReportFilters,
  CashReportFilters,
  DashboardFilters,
  InventoryReportFilters,
  LowStockFilters,
  ProfitReportFilters,
  PurchasesReportFilters,
  SalesByCashierFilters,
  SalesByCategoryFilters,
  SalesReportFilters,
  TopProductsFilters,
  WasteReportFilters,
} from './reports.types';

/**
 * Construye un filtro de rango de fechas a partir de `dateFrom`/`dateTo`.
 * Devuelve `undefined` si no se especifico ningun limite (sin filtrar).
 *
 * QA.13 (Reportes): `dateFrom`/`dateTo` llegan como medianoche UTC del dia
 * elegido (`z.coerce.date()` sobre "YYYY-MM-DD", ver `reports.validation.ts`)
 * — se traducen a limites de dia CALENDARIO DE COSTA RICA
 * (`costaRicaDayStartFromDateOnly`/`costaRicaDayEndExclusiveFromDateOnly`,
 * `shared/utils/date.ts`) antes de compararlos contra columnas `DateTime`.
 * Antes de esta correccion se usaban tal cual (`gte: dateFrom, lte: dateTo`,
 * instantes UTC crudos): un filtro "Hoy" (`dateFrom === dateTo`) producia
 * un rango de ancho CERO, y cualquier otro rango excluia sistematicamente
 * las primeras 6 horas de Costa Rica en `dateFrom` y las ultimas ~18 horas
 * del dia en `dateTo` — confirmado empiricamente contra datos reales (ver
 * detalle en `shared/utils/date.ts`). `lt` (no `lte`) en el limite
 * superior: un filtro "hasta" debe incluir el dia completo.
 */
function buildDateRange(
  dateFrom?: Date,
  dateTo?: Date,
): Prisma.DateTimeFilter | undefined {
  if (!dateFrom && !dateTo) return undefined;

  return {
    gte: dateFrom ? costaRicaDayStartFromDateOnly(dateFrom) : undefined,
    lt: dateTo ? costaRicaDayEndExclusiveFromDateOnly(dateTo) : undefined,
  };
}

/**
 * Calcula las metricas del Dashboard operativo directamente contra las
 * tablas transaccionales. No usa `vw_dashboard`.
 */
export async function getDashboard(filters?: DashboardFilters) {
  const saleWhere: Prisma.SaleWhereInput = {
    status: 'COMPLETED',
    sucursalId: filters?.sucursalId,
    saleDate: buildDateRange(filters?.dateFrom, filters?.dateTo),
  };

  const purchaseWhere: Prisma.PurchaseWhereInput = {
    status: 'RECEIVED',
    sucursalId: filters?.sucursalId,
    purchaseDate: buildDateRange(filters?.dateFrom, filters?.dateTo),
  };

  const userWhere: Prisma.UserWhereInput = {
    active: true,
    sucursalId: filters?.sucursalId,
  };

  const cashSessionWhere: Prisma.CashSessionWhereInput = {
    status: 'OPEN',
    sucursalId: filters?.sucursalId,
  };

  const [
    totalSales,
    salesAggregate,
    totalPurchases,
    purchasesAggregate,
    totalProducts,
    totalCategories,
    totalSuppliers,
    totalUsers,
    openCashSessions,
  ] = await Promise.all([
    prisma.sale.count({ where: saleWhere }),
    prisma.sale.aggregate({ where: saleWhere, _sum: { total: true } }),
    prisma.purchase.count({ where: purchaseWhere }),
    prisma.purchase.aggregate({ where: purchaseWhere, _sum: { total: true } }),
    prisma.product.count({ where: { active: true } }),
    prisma.category.count({ where: { active: true } }),
    prisma.supplier.count({ where: { active: true } }),
    prisma.user.count({ where: userWhere }),
    prisma.cashSession.count({ where: cashSessionWhere }),
  ]);

  return {
    totalSales,
    totalSalesAmount: salesAggregate._sum.total,
    totalPurchases,
    totalPurchaseAmount: purchasesAggregate._sum.total,
    totalProducts,
    totalCategories,
    totalSuppliers,
    totalUsers,
    openCashSessions,
  };
}

/**
 * Bloque COST-04.1 (utilidad diaria del Dashboard): trae las lineas de
 * venta (`SaleItem`) de ventas `COMPLETED` del rango de "hoy" (calculado
 * por `reports.service.ts`, mismo criterio UTC ya usado por
 * `getSalesByDate`), con exactamente los campos que
 * `getEffectiveCost()`/el calculo de utilidad necesitan.
 *
 * Deliberadamente NO se agrega ningun `select`/`include` de `product`:
 * este calculo usa EXCLUSIVAMENTE los snapshots del propio `SaleItem`
 * (`unitCost`/`expectedWastePercentAtSale`/`applyExpectedWasteToCostAtSale`,
 * Bloques 14.2/COST-03.2) — nunca `Product.expectedWastePercent`/
 * `Product.applyExpectedWasteToCost` vigentes (aunque hoy fuera el mismo
 * dia de la venta, seguir ese camino reintroduciria la dependencia del
 * dato maestro en vez del snapshot, que es exactamente lo que corrigio
 * COST-03.2).
 *
 * Sin `take`/paginacion a proposito: el volumen de lineas de venta de UN
 * SOLO DIA es naturalmente acotado (ver analisis aprobado del Bloque
 * COST-04, §4.1) — a diferencia de un rango historico completo, que si
 * necesitaria un limite defensivo.
 */
export function getDashboardTodaySaleItems(params: {
  sucursalId?: string;
  dateFrom: Date;
  dateToExclusive: Date;
}) {
  return prisma.saleItem.findMany({
    where: {
      sale: {
        status: 'COMPLETED',
        sucursalId: params.sucursalId,
        saleDate: { gte: params.dateFrom, lt: params.dateToExclusive },
      },
    },
    select: {
      unitCost: true,
      expectedWastePercentAtSale: true,
      applyExpectedWasteToCostAtSale: true,
      lineSubtotal: true,
      quantity: true,
    },
  });
}

/**
 * Incluye los resumenes de usuario y sucursal para el reporte de ventas,
 * mas el MINIMO necesario para calcular el descuento TOTAL real de cada
 * venta (bloque "consistencia de descuentos"): `SaleItem.discount`
 * (manual de linea) es EXCLUSIVAMENTE eso — cuando una promocion
 * AUTOMATICA ajusta una linea, ese monto nunca vive ahi, solo en
 * `SaleAppliedPromotion.amountApplied` (que tambien incluye, en su propia
 * fila, el descuento MANUAL de carrito). Por eso se seleccionan ambas
 * relaciones, pero con el `select` mas angosto posible (nunca las lineas
 * completas ni el resto de columnas de auditoria de la promocion) — el
 * reporte sigue sin exponer `items`/`appliedPromotions` crudos al
 * frontend, `reports.service.ts` los consume y los descarta, quedandose
 * solo con los 2 numeros derivados (`discountAmount`/`discountPercent`).
 */
const saleReportInclude = {
  user: { select: { id: true, fullName: true } },
  sucursal: { select: { id: true, name: true } },
  items: { select: { discount: true } },
  appliedPromotions: {
    select: { amountApplied: true, effectType: true, discountType: true, discountValue: true },
  },
} as const;

function buildSalesReportWhere(filters?: SalesReportFilters): Prisma.SaleWhereInput {
  return {
    status: 'COMPLETED',
    sucursalId: filters?.sucursalId,
    userId: filters?.userId,
    paymentMethod: filters?.paymentMethod,
    saleDate: buildDateRange(filters?.dateFrom, filters?.dateTo),
  };
}

/** Obtiene el reporte de ventas, filtrado y paginado. */
export function getSalesReport(params: {
  skip: number;
  take: number;
  filters?: SalesReportFilters;
}) {
  const where = buildSalesReportWhere(params.filters);

  return prisma.$transaction([
    prisma.sale.findMany({
      where,
      include: saleReportInclude,
      skip: params.skip,
      take: params.take,
      orderBy: { saleDate: 'desc' },
    }),
    prisma.sale.count({ where }),
  ]);
}

/**
 * Agregado del Reporte de Ventas (Bloque REPORTES-AGREGADOS): totales
 * REALES sobre el conjunto COMPLETO que cumple `filters` — no la pagina
 * actual. Reutiliza el MISMO `buildSalesReportWhere` que ya usa
 * `getSalesReport` (paginado): garantiza que el conjunto agregado es
 * exactamente el mismo que el usuario ve filtrado/paginado en la tabla,
 * sin duplicar la logica de filtros en un segundo lugar.
 *
 * Patron reutilizable para los proximos reportes (Utilidad, Inventario,
 * Historial de Caja): una funcion `get<Reporte>Summary` que reusa el
 * `buildXxxWhere` existente + `prisma.<modelo>.aggregate()` con
 * `_count`/`_sum` sobre los campos relevantes — sin `$transaction`
 * (una sola consulta, no dos como el paginado).
 *
 * Bloque "consistencia de descuentos": `aggregate._sum.discountTotal`
 * (columna real de `Sale`) sigue siendo EXCLUSIVAMENTE el descuento
 * MANUAL de carrito — para el KPI "Descuentos" completo (manual + lineas
 * + promociones automaticas) hacen falta 2 consultas mas, reutilizando el
 * MISMO `where` como filtro anidado por relacion (mismo patron ya usado
 * en `getCashReportSummary`, `Sale.cashSession`): una sobre `SaleItem`
 * (descuentos manuales de linea) y otra sobre `SaleAppliedPromotion`
 * (carrito manual + automaticas — sumar ambas SIN sumar tambien
 * `discountTotal` evita contar el descuento de carrito dos veces, ya que
 * ese descuento tiene su propia fila en `SaleAppliedPromotion`).
 */
export async function getSalesReportSummary(filters?: SalesReportFilters) {
  const where = buildSalesReportWhere(filters);

  const [aggregate, lineDiscountAggregate, promotionDiscountAggregate] = await Promise.all([
    prisma.sale.aggregate({
      where,
      _count: { _all: true },
      _sum: { subtotal: true, taxTotal: true, discountTotal: true, total: true },
    }),
    prisma.saleItem.aggregate({
      where: { sale: where },
      _sum: { discount: true },
    }),
    prisma.saleAppliedPromotion.aggregate({
      where: { sale: where },
      _sum: { amountApplied: true },
    }),
  ]);

  return {
    aggregate,
    lineDiscountTotal: lineDiscountAggregate._sum.discount,
    promotionDiscountTotal: promotionDiscountAggregate._sum.amountApplied,
  };
}

/** Incluye los resumenes de proveedor y usuario para el reporte de compras. */
const purchaseReportInclude = {
  supplier: { select: { id: true, name: true } },
  user: { select: { id: true, fullName: true } },
  items: true,
} as const;

/**
 * Bloque REPORTES-AGREGADOS (correccion): `status: 'RECEIVED'` agregado —
 * antes esta funcion no filtraba por estado en absoluto, asi que tanto
 * `getPurchasesReport` (paginado) como `getPurchasesReportSummary`
 * (agregado, que reutiliza esta MISMA funcion) incluian compras `DRAFT`/
 * `CANCELLED` junto con `RECEIVED` en sus totales — un cambio de estado
 * nunca afectaba ningun conteo/suma, porque el estado simplemente no se
 * evaluaba. Mismo criterio de negocio ya usado en `buildSalesReportWhere`
 * (`status: 'COMPLETED'`) y en `getDashboard` mas arriba en este mismo
 * archivo (`purchaseWhere: { status: 'RECEIVED', ... }`) — una compra
 * `DRAFT`/`CANCELLED` no es dinero realmente gastado, no debe contar en
 * ningun total de "compras". Como ambos endpoints comparten esta funcion,
 * la correccion los alinea a los dos a la vez.
 */
function buildPurchasesReportWhere(
  filters?: PurchasesReportFilters,
): Prisma.PurchaseWhereInput {
  return {
    status: 'RECEIVED',
    sucursalId: filters?.sucursalId,
    supplierId: filters?.supplierId,
    purchaseDate: buildDateRange(filters?.dateFrom, filters?.dateTo),
  };
}

/** Obtiene el reporte de compras, filtrado y paginado. */
export function getPurchasesReport(params: {
  skip: number;
  take: number;
  filters?: PurchasesReportFilters;
}) {
  const where = buildPurchasesReportWhere(params.filters);

  return prisma.$transaction([
    prisma.purchase.findMany({
      where,
      include: purchaseReportInclude,
      skip: params.skip,
      take: params.take,
      orderBy: { purchaseDate: 'desc' },
    }),
    prisma.purchase.count({ where }),
  ]);
}

/**
 * Agregado del Reporte de Compras (Bloque REPORTES-AGREGADOS): mismo
 * patron que `getSalesReportSummary` — reutiliza `buildPurchasesReportWhere`
 * (el mismo que ya usa `getPurchasesReport` paginado), sin `discountTotal`
 * (`Purchase` no tiene ese campo, a diferencia de `Sale`).
 *
 * `distinctSuppliers` (proveedores distintos dentro del conjunto
 * filtrado, para el KPI "Proveedores"): Prisma `aggregate()` no calcula
 * `COUNT(DISTINCT columna)`, asi que se resuelve con un `groupBy` sobre
 * el MISMO `where` — cada grupo es un proveedor distinto, `length` es el
 * conteo. Ambas consultas comparten el mismo filtro, corren en paralelo
 * (`Promise.all`), y ninguna trae filas de `Purchase` completas (ni el
 * `aggregate` ni el `groupBy` devuelven columnas de detalle).
 */
export async function getPurchasesReportSummary(filters?: PurchasesReportFilters) {
  const where = buildPurchasesReportWhere(filters);

  const [aggregate, supplierGroups] = await Promise.all([
    prisma.purchase.aggregate({
      where,
      _count: { _all: true },
      _sum: { subtotal: true, taxTotal: true, total: true },
    }),
    prisma.purchase.groupBy({ by: ['supplierId'], where }),
  ]);

  return { aggregate, distinctSuppliers: supplierGroups.length };
}

/** Incluye los resumenes de producto y sucursal para el reporte de inventario.
 * `unitOfMeasure` agregado (aprobado): columna ya existente en `Product`,
 * necesaria para que el frontend formatee la cantidad con su unidad
 * ("12.500 kg" / "3 u.") en vez de un numero sin contexto. */
const inventoryReportInclude = {
  product: { select: { id: true, sku: true, name: true, unitOfMeasure: true } },
  sucursal: { select: { id: true, name: true } },
} as const;

function buildInventoryReportWhere(
  filters?: InventoryReportFilters,
): Prisma.InventoryWhereInput {
  return {
    sucursalId: filters?.sucursalId,
    product: {
      categoryId: filters?.categoryId,
      active: filters?.active,
    },
  };
}

/** Obtiene el reporte de inventario, filtrado y paginado. */
export function getInventoryReport(params: {
  skip: number;
  take: number;
  filters?: InventoryReportFilters;
}) {
  const where = buildInventoryReportWhere(params.filters);

  return prisma.$transaction([
    prisma.inventory.findMany({
      where,
      include: inventoryReportInclude,
      skip: params.skip,
      take: params.take,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.inventory.count({ where }),
  ]);
}

/**
 * Agregado del Reporte de Inventario (Bloque REPORTES-AGREGADOS): mismo
 * patron que `getSalesReportSummary`/`getPurchasesReportSummary` —
 * reutiliza el MISMO `buildInventoryReportWhere` que ya usa
 * `getInventoryReport` (paginado).
 *
 * Deliberadamente SIN sumar `quantity` entre filas ("cantidad total en
 * stock"): `Inventory.quantity` mezcla `unitOfMeasure` (`KILOGRAM`/`UNIT`)
 * segun el producto — sumar kilogramos y unidades en un solo numero no
 * tiene sentido dimensional (mismo motivo ya documentado para
 * `LowStockKpiRow.tsx` en el frontend). Los KPIs de este agregado son
 * conteos, no sumas de cantidad.
 *
 * `totalRecords`/`outOfStock`/`distinctProducts`/`distinctSucursales`: los
 * 4 se resuelven con `count()`/`groupBy()` nativos de Prisma (sin traer
 * filas de `Inventory`). `belowReorderPointRows` es la UNICA excepcion —
 * comparar `quantity <= reorderPoint` es una comparacion entre dos
 * COLUMNAS de la misma fila, que Prisma no puede expresar en un `where`
 * sin SQL crudo (mismo hallazgo ya documentado en `getLowStock`, mas
 * abajo en este archivo) — por eso se traen unicamente los 2 campos
 * necesarios (`quantity`/`reorderPoint`) de las filas CON `reorderPoint`
 * configurado dentro del conjunto filtrado, y `reports.service.ts` cuenta
 * cuantas cumplen la condicion. Ninguna columna extra, ninguna fila
 * completa de `Inventory`.
 */
export async function getInventoryReportSummary(filters?: InventoryReportFilters) {
  const where = buildInventoryReportWhere(filters);

  const [totalRecords, outOfStock, productGroups, sucursalGroups, belowReorderPointRows] =
    await Promise.all([
      prisma.inventory.count({ where }),
      prisma.inventory.count({ where: { ...where, quantity: 0 } }),
      prisma.inventory.groupBy({ by: ['productId'], where }),
      prisma.inventory.groupBy({ by: ['sucursalId'], where }),
      prisma.inventory.findMany({
        where: { ...where, reorderPoint: { not: null } },
        select: { quantity: true, reorderPoint: true },
      }),
    ]);

  return {
    totalRecords,
    outOfStock,
    distinctProducts: productGroups.length,
    distinctSucursales: sucursalGroups.length,
    belowReorderPointRows,
  };
}

/** Incluye los resumenes de producto, venta e impuesto para el reporte de
 * utilidad. `tax` (Bloque C, "Impuestos y Descuentos en Ventas"): sin este
 * join, el reporte solo tenia `taxId` (crudo) y `taxRate` (snapshot
 * numerico) — no habia forma de mostrar el NOMBRE del impuesto sin volver
 * a consultarlo aparte. Mismo criterio ya usado por `sales/service.ts`
 * para el Detalle de Venta (`tax: { select: { id: true, name: true } }`),
 * sin agregar logica nueva: es una lectura, no un calculo. `tax` puede ser
 * `null` (linea sin impuesto), igual que en `SaleItem.taxId`. */
const profitReportInclude = {
  // Bloque COST-03.2 (correccion de historico): `product` NO trae
  // `expectedWastePercent`/`applyExpectedWasteToCost` — esos son el dato
  // MAESTRO VIGENTE, y usarlos aca recalcularia ventas historicas con la
  // configuracion de HOY (el defecto que este bloque corrigio). El
  // `CostContext` de cada linea se construye exclusivamente con los
  // snapshots ya persistidos en el propio `SaleItem`
  // (`expectedWastePercentAtSale`/`applyExpectedWasteToCostAtSale`,
  // scalares — automaticamente incluidos por `include`, sin necesidad de
  // `select` explicito aca).
  product: {
    select: {
      id: true,
      sku: true,
      name: true,
      cost: true,
    },
  },
  sale: { select: { id: true, documentNumber: true, saleDate: true } },
  tax: { select: { id: true, name: true } },
  // Incidencia 1 (Reporte de Utilidad, 06/08/2026): `SaleItem.discount` es
  // EXCLUSIVAMENTE el descuento manual de esa linea (ver comentario de
  // `saleReportInclude` mas arriba) — un descuento por promocion
  // automatica solo vive en `SaleAppliedPromotion.amountApplied`. `select`
  // minimo, igual criterio que `saleReportInclude`: nunca se expone la
  // fila completa de la promocion, solo lo necesario para derivar el %
  // (mismo campo usado por `getSalesReport` para su propio
  // `singlePercentagePromotion`).
  appliedPromotions: {
    select: { amountApplied: true, effectType: true, discountType: true, discountValue: true },
  },
} as const;

function buildProfitReportWhere(
  filters?: ProfitReportFilters,
): Prisma.SaleItemWhereInput {
  return {
    productId: filters?.productId,
    product: filters?.categoryId ? { categoryId: filters.categoryId } : undefined,
    sale: {
      status: 'COMPLETED',
      sucursalId: filters?.sucursalId,
      saleDate: buildDateRange(filters?.dateFrom, filters?.dateTo),
    },
  };
}

/** Obtiene el reporte de utilidad (por detalle de venta), filtrado y paginado. */
export function getProfitReport(params: {
  skip: number;
  take: number;
  filters?: ProfitReportFilters;
}) {
  const where = buildProfitReportWhere(params.filters);

  return prisma.$transaction([
    prisma.saleItem.findMany({
      where,
      include: profitReportInclude,
      skip: params.skip,
      take: params.take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.saleItem.count({ where }),
  ]);
}

/**
 * Filas crudas para el agregado del Reporte de Utilidad (Bloque
 * REPORTES-AGREGADOS): a diferencia de `getSalesReportSummary`/
 * `getPurchasesReportSummary` (un `aggregate()` nativo de Prisma alcanza,
 * `total`/`taxTotal`/etc. son columnas reales), `costTotal`/`profit`/
 * `marginPercent` NO son columnas de `SaleItem` — se calculan con
 * `CostEngine.getEffectiveCost()`, logica de negocio que le corresponde a
 * `reports.service.ts` (ver su propio encabezado: este archivo es
 * infraestructura pura). Un `aggregate()` sobre esos campos no es posible.
 *
 * Mismo patron ya usado en este archivo para el mismo problema exacto
 * (Bloque COST-04.1, `getDashboardTodaySaleItems`, utilidad de HOY para el
 * Dashboard): traer solo los snapshots minimos necesarios
 * (`quantity`/`lineSubtotal`/`lineTotal`/`unitCost`/
 * `expectedWastePercentAtSale`/`applyExpectedWasteToCostAtSale`) del
 * conjunto COMPLETO filtrado (reutilizando el MISMO `buildProfitReportWhere`
 * que ya usa `getProfitReport` paginado, incluyendo `sale.status:
 * 'COMPLETED'`), sin `take` — el servicio reduce estas filas con
 * `CostEngine` para sumar. Nunca llega al frontend: solo el resultado ya
 * agregado sale de `reports.service.ts::getProfitReportSummary`.
 */
export function getProfitReportSummaryRows(filters?: ProfitReportFilters) {
  const where = buildProfitReportWhere(filters);

  return prisma.saleItem.findMany({
    where,
    select: {
      quantity: true,
      lineSubtotal: true,
      lineTotal: true,
      unitCost: true,
      expectedWastePercentAtSale: true,
      applyExpectedWasteToCostAtSale: true,
    },
  });
}

/** Incluye los resumenes de sucursal, caja registradora y cajeros (apertura
 * y cierre) para el reporte de caja. */
const cashReportInclude = {
  sucursal: { select: { id: true, name: true } },
  cashRegister: { select: { id: true, name: true } },
  openedBy: { select: { id: true, fullName: true } },
  closedBy: { select: { id: true, fullName: true } },
} as const;

function buildCashReportWhere(filters?: CashReportFilters): Prisma.CashSessionWhereInput {
  return {
    sucursalId: filters?.sucursalId,
    cashRegisterId: filters?.cashRegisterId,
    openedByUserId: filters?.userId,
    status: filters?.status,
    openedAt: buildDateRange(filters?.dateFrom, filters?.dateTo),
  };
}

/** Obtiene el reporte de caja (sesiones), filtrado y paginado. */
export function getCashReport(params: {
  skip: number;
  take: number;
  filters?: CashReportFilters;
}) {
  const where = buildCashReportWhere(params.filters);

  return prisma.$transaction([
    prisma.cashSession.findMany({
      where,
      include: cashReportInclude,
      skip: params.skip,
      take: params.take,
      orderBy: { openedAt: 'desc' },
    }),
    prisma.cashSession.count({ where }),
  ]);
}

/**
 * Agregado del Reporte de Caja (Bloque REPORTES-AGREGADOS): mismo patron
 * que `getSalesReportSummary`/`getPurchasesReportSummary` — reutiliza el
 * MISMO `buildCashReportWhere` que ya usa `getCashReport` (paginado).
 *
 * `openingAmount`/`difference` SI son columnas reales de `CashSession`
 * (a diferencia de `salesCount`/`salesTotal`, que nunca lo fueron — ver
 * comentario de `cashReportInclude`/`getCashSessionsSalesAggregate` mas
 * abajo), asi que un `aggregate()` nativo alcanza para esos dos.
 *
 * `totalSales`/`totalSalesAmount` (ventas de TODAS las sesiones
 * filtradas, no solo la pagina actual): en vez de traer los ids de sesion
 * y agregar `Sale` por separado (dos consultas, con el riesgo de que
 * diverjan si alguien cambia una sin la otra), se filtra `Sale`
 * DIRECTAMENTE por la relacion `cashSession` usando el MISMO objeto
 * `where` de `CashSession` (Prisma traduce el filtro anidado a un JOIN) —
 * una sola fuente de verdad para "que sesiones cuentan", sin duplicar la
 * logica de filtros en un segundo lugar. Ambas consultas corren en
 * paralelo, ninguna trae filas completas.
 */
export async function getCashReportSummary(filters?: CashReportFilters) {
  const where = buildCashReportWhere(filters);

  const [sessionAggregate, salesAggregate] = await Promise.all([
    prisma.cashSession.aggregate({
      where,
      _count: { _all: true },
      _sum: { openingAmount: true },
      _avg: { difference: true },
    }),
    prisma.sale.aggregate({
      where: { status: 'COMPLETED', cashSession: where },
      _count: { _all: true },
      _sum: { total: true },
    }),
  ]);

  return { sessionAggregate, salesAggregate };
}

/**
 * Agrega cantidad e importe de ventas (COMPLETED) por sesion de caja, para
 * las sesiones de una pagina de `getCashReport` (`sessionIds` = los ids ya
 * resueltos por esa consulta, nunca todas las sesiones de la tabla). Mismo
 * patron que `getSalesByCashier`: `groupBy` directo sobre `Sale` (el campo
 * agrupador vive directo en la tabla, sin paso intermedio por `SaleItem`),
 * fusionado con las filas de sesion en el service.
 */
export async function getCashSessionsSalesAggregate(sessionIds: string[]) {
  if (sessionIds.length === 0) {
    return [];
  }

  return prisma.sale.groupBy({
    by: ['cashSessionId'],
    where: { cashSessionId: { in: sessionIds }, status: 'COMPLETED' },
    _sum: { total: true },
    _count: { _all: true },
  });
}

/** Obtiene una sesion de caja puntual (con los mismos resumenes que
 * `getCashReport`), para el detalle de sesion (`GET /reports/cash/:id`). */
export function getCashSessionById(id: string) {
  return prisma.cashSession.findUnique({
    where: { id },
    include: cashReportInclude,
  });
}

/**
 * Agrupa las ventas (COMPLETED) de una sesion de caja puntual por metodo de
 * pago — mismo patron `groupBy` directo sobre `Sale` que
 * `getCashSessionsSalesAggregate`/`getSalesByCashier`, aca agrupado por
 * `paymentMethod` en vez de `cashSessionId`/`userId`. Sin `take`: como
 * mucho hay 5 metodos de pago posibles (`PaymentMethod`), no hace falta
 * limite.
 */
export async function getCashSessionPaymentBreakdown(cashSessionId: string) {
  return prisma.sale.groupBy({
    by: ['paymentMethod'],
    where: { cashSessionId, status: 'COMPLETED' },
    _sum: { total: true },
    _count: { _all: true },
  });
}

function buildTopProductsWhere(filters?: TopProductsFilters): Prisma.SaleItemWhereInput {
  return {
    product: filters?.categoryId ? { categoryId: filters.categoryId } : undefined,
    sale: {
      status: 'COMPLETED',
      sucursalId: filters?.sucursalId,
      saleDate: buildDateRange(filters?.dateFrom, filters?.dateTo),
    },
  };
}

/**
 * Agrupa los detalles de venta por producto (`groupBy`, sin SQL crudo,
 * mismo criterio que el resto de este archivo) y calcula cantidad e
 * importe vendidos. `groupBy` no trae los datos del producto (nombre,
 * sku, categoria), asi que se resuelven en una segunda consulta por los
 * `productId` resultantes.
 *
 * NOTA: `_count._all` cuenta LINEAS de detalle (`SaleItem`), no ventas
 * distintas — Prisma `groupBy` no soporta `COUNT(DISTINCT sale_id)`. La
 * vista `vw_top_products` (exclusiva de Power BI,
 * `prisma/sql/views/vw_top_products.sql`) si calcula ese conteo distinto;
 * no se usa aqui porque este modulo nunca consume esas vistas
 * (ARCHITECTURE.md seccion 6.6).
 */
export async function getTopProducts(params: {
  take: number;
  filters?: TopProductsFilters;
}) {
  const where = buildTopProductsWhere(params.filters);

  const grouped = await prisma.saleItem.groupBy({
    by: ['productId'],
    where,
    _sum: { quantity: true, lineTotal: true },
    _count: { _all: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: params.take,
  });

  const products = await prisma.product.findMany({
    where: { id: { in: grouped.map((group) => group.productId) } },
    include: { category: { select: { id: true, name: true } } },
  });

  return { grouped, products };
}

/** Incluye los resumenes de producto (con categoria) y sucursal para el
 * reporte de bajo inventario. `unitOfMeasure` agregado (aprobado): mismo
 * criterio que `inventoryReportInclude`. */
const lowStockInclude = {
  product: {
    select: {
      id: true,
      sku: true,
      name: true,
      unitOfMeasure: true,
      category: { select: { id: true, name: true } },
    },
  },
  sucursal: { select: { id: true, name: true } },
} as const;

function buildLowStockWhere(filters?: LowStockFilters): Prisma.InventoryWhereInput {
  return {
    sucursalId: filters?.sucursalId,
    product: filters?.categoryId ? { categoryId: filters.categoryId } : undefined,
    // Sin `threshold` manual, interesan: (a) las filas con `reorderPoint`
    // configurado (el punto de corte real lo evalua `reports.service.ts`
    // columna-contra-columna), y (b) las filas SIN `reorderPoint` pero con
    // `quantity` ya negativa — el peor caso de stock posible, que antes
    // quedaba fuera del reporte solo por no tener `reorderPoint`. Con
    // `threshold`, no se aplica esta restriccion (puede interesar
    // cualquier fila, tenga o no su propio reorderPoint).
    ...(filters?.threshold === undefined && {
      OR: [{ reorderPoint: { not: null } }, { reorderPoint: null, quantity: { lt: 0 } }],
    }),
  };
}

/**
 * Trae las filas de inventario candidatas a "bajo stock", ordenadas por
 * cantidad ascendente (lo mas critico primero).
 *
 * Si `filters.threshold` viene especificado, la comparacion
 * `quantity <= threshold` la resuelve Prisma directo en el `where` (un
 * literal, sin problema). Si NO viene, hace falta comparar `quantity`
 * contra `reorderPoint` — dos COLUMNAS de la misma fila — algo que Prisma
 * no puede expresar en `where` sin SQL crudo; en su lugar, esta funcion
 * trae todas las filas con `reorderPoint` configurado y
 * `reports.service.ts` decide cuales estan realmente por debajo de su
 * propio `reorderPoint` (JS puro sobre datos ya traidos, sigue sin ser
 * SQL crudo).
 */
export function getLowStock(filters?: LowStockFilters) {
  const where = buildLowStockWhere(filters);

  return prisma.inventory.findMany({
    where: {
      ...where,
      ...(filters?.threshold !== undefined && {
        quantity: { lte: filters.threshold },
      }),
    },
    include: lowStockInclude,
    orderBy: { quantity: 'asc' },
  });
}

function buildSalesByCategoryWhere(
  filters?: SalesByCategoryFilters,
): Prisma.SaleItemWhereInput {
  return {
    sale: {
      status: 'COMPLETED',
      sucursalId: filters?.sucursalId,
      saleDate: buildDateRange(filters?.dateFrom, filters?.dateTo),
    },
  };
}

/**
 * Agrupa los detalles de venta por producto (`groupBy`, sin SQL crudo,
 * mismo criterio que `getTopProducts`), SIN `take`: a diferencia del
 * ranking de productos mas vendidos, aqui hace falta TODOS los productos
 * vendidos en el periodo filtrado, porque la agrupacion final por
 * categoria (responsabilidad de `reports.service.ts`, no de este
 * repositorio) necesita ver el conjunto completo antes de reducir.
 *
 * `groupBy` no puede agrupar directamente por un campo de una relacion
 * (`categoryId` vive en `Product`, no en `SaleItem`), asi que esta
 * funcion trae el agrupado por `productId` junto con los productos
 * (incluyendo su categoria) que le corresponden a cada uno, para que el
 * service haga la reduccion final por categoria en JS (sin SQL crudo).
 *
 * SIN `take` A PROPOSITO (hallazgo 2.4 de la auditoria, reanalizado y
 * cerrado como FALSO POSITIVO para esta funcion especifica): este
 * agrupado es un paso INTERMEDIO, no el resultado final -- el service
 * reduce estas filas a totales por categoria. Truncar esta consulta
 * podria dejar fuera productos cuya categoria si tiene otras filas
 * incluidas, generando un total de categoria incompleto sin ningun
 * indicio de que faltan datos: un error de calculo silencioso, peor que
 * el problema que se buscaba evitar. Ademas, a diferencia de `Sale`/
 * `Purchase`/`CashSession` (que crecen indefinidamente con el volumen
 * transaccional), esta consulta crece unicamente con la cantidad de
 * PRODUCTOS DISTINTOS del periodo filtrado -- acotada por el tamaño del
 * catalogo, no por el tiempo de operacion del negocio. Ver
 * `getSalesByCashier` mas abajo para el caso donde SI se aplico un
 * limite (ahi es seguro: cada fila ya es el resultado final).
 */
export async function getSalesByCategory(filters?: SalesByCategoryFilters) {
  const where = buildSalesByCategoryWhere(filters);

  const grouped = await prisma.saleItem.groupBy({
    by: ['productId'],
    where,
    _sum: { quantity: true, lineTotal: true },
    _count: { _all: true },
  });

  const products = await prisma.product.findMany({
    where: { id: { in: grouped.map((group) => group.productId) } },
    include: { category: { select: { id: true, name: true } } },
  });

  return { grouped, products };
}

function buildSalesByCashierWhere(filters?: SalesByCashierFilters): Prisma.SaleWhereInput {
  return {
    status: 'COMPLETED',
    sucursalId: filters?.sucursalId,
    saleDate: buildDateRange(filters?.dateFrom, filters?.dateTo),
  };
}

/** Limite defensivo de filas para `getSalesByCashier`: a diferencia de
 * `getSalesByCategory` (descartado como falso positivo tras el
 * hallazgo 2.4 de la auditoria -- su agrupado intermedio por producto no
 * debe truncarse, o los totales por categoria quedarian incompletos),
 * `getSalesByCashier` agrupa directamente sobre `Sale`: cada fila ya es
 * el resultado final de un cajero, asi que un limite acá es seguro
 * (mismo criterio que `getTopProducts`), sin ningun riesgo de calculo
 * incompleto. */
const MAX_SALES_BY_CASHIER_RESULTS = 500;

/**
 * Agrupa las ventas directamente por cajero (`groupBy` sobre `Sale`, sin
 * SQL crudo). A diferencia de `getTopProducts`/`getSalesByCategory`,
 * `userId` vive directo en `Sale` (no en una relacion indirecta via
 * `SaleItem`), asi que un solo `groupBy` alcanza — sin el paso intermedio
 * por detalle de venta. `_count._all` aqui SI es un conteo real de ventas
 * distintas (no de lineas de detalle): se agrupa sobre `Sale` mismo, no
 * sobre `SaleItem`.
 *
 * `groupBy` no trae los datos del usuario (nombre), asi que se resuelven
 * en una segunda consulta por los `userId` resultantes.
 */
export async function getSalesByCashier(filters?: SalesByCashierFilters) {
  const where = buildSalesByCashierWhere(filters);

  const grouped = await prisma.sale.groupBy({
    by: ['userId'],
    where,
    _sum: { total: true },
    _count: { _all: true },
    orderBy: { _sum: { total: 'desc' } },
    take: MAX_SALES_BY_CASHIER_RESULTS,
  });

  const users = await prisma.user.findMany({
    where: { id: { in: grouped.map((group) => group.userId) } },
    select: { id: true, fullName: true },
  });

  return { grouped, users };
}

/**
 * Agregado del Reporte de Ventas por Cajero (Bloque REPORTES-AGREGADOS):
 * mismo patron que `getSalesReportSummary`/`getPurchasesReportSummary` —
 * reutiliza el MISMO `buildSalesByCashierWhere` que ya usa
 * `getSalesByCashier` (incluyendo su `status: 'COMPLETED'`).
 *
 * `distinctCashiers` (a diferencia del `grouped` de `getSalesByCashier`,
 * que trunca a `MAX_SALES_BY_CASHIER_RESULTS`): un `groupBy` SIN `take`
 * — el conteo real de cajeros distintos no debe depender del limite
 * defensivo de la lista.
 *
 * `topCashier`: mismo `groupBy` ordenado por `_sum.total desc` que ya usa
 * `getSalesByCashier`, pero con `take: 1` (solo se necesita el primero) —
 * el nombre se resuelve con una segunda consulta puntual por ese
 * `userId` (no `findMany` de todos los cajeros, como si hace la lista).
 */
export async function getSalesByCashierSummary(filters?: SalesByCashierFilters) {
  const where = buildSalesByCashierWhere(filters);

  const [aggregate, cashierGroups, topGroup] = await Promise.all([
    prisma.sale.aggregate({
      where,
      _count: { _all: true },
      _sum: { total: true },
    }),
    prisma.sale.groupBy({ by: ['userId'], where }),
    prisma.sale.groupBy({
      by: ['userId'],
      where,
      _sum: { total: true },
      orderBy: { _sum: { total: 'desc' } },
      take: 1,
    }),
  ]);

  const topUser = topGroup[0]
    ? await prisma.user.findUnique({
        where: { id: topGroup[0].userId },
        select: { id: true, fullName: true },
      })
    : null;

  return {
    aggregate,
    distinctCashiers: cashierGroups.length,
    topCashier: topGroup[0]
      ? { name: topUser?.fullName ?? null, amount: Number(topGroup[0]._sum.total ?? 0) }
      : null,
  };
}

function buildSalesByDateWhere(params: {
  sucursalId?: string;
  dateFrom: Date;
  dateToExclusive: Date;
}): Prisma.SaleWhereInput {
  return {
    status: 'COMPLETED',
    sucursalId: params.sucursalId,
    saleDate: { gte: params.dateFrom, lt: params.dateToExclusive },
  };
}

/**
 * Trae las ventas completadas dentro de [dateFrom, dateToExclusive) —
 * rango ya resuelto y acotado por `reports.service.ts` (defaults de 7
 * dias, limite maximo de rango). Solo `saleDate`/`total`: el agrupado por
 * dia (y el relleno de dias sin ventas) es responsabilidad del service.
 *
 * Sin `groupBy`: Prisma no puede agrupar por la parte de fecha (sin hora)
 * de una columna `DateTime` sin SQL crudo, y este modulo evita `$queryRaw`
 * a proposito (ver encabezado del archivo, mismo motivo que
 * `getDashboard`). Se trae el conjunto ya acotado por rango de fechas
 * (nunca la tabla completa) y se reduce en JS — mismo criterio ya usado
 * en `getSalesByCategory` para el caso analogo (Prisma tampoco puede
 * agrupar por un campo de una relacion).
 */
export function getSalesByDate(params: {
  sucursalId?: string;
  dateFrom: Date;
  dateToExclusive: Date;
}) {
  return prisma.sale.findMany({
    where: buildSalesByDateWhere(params),
    select: { saleDate: true, total: true },
  });
}

/** Filtro comun de las 3 consultas del reporte de Mermas y Rendimiento
 * (Bloque 14.7) — `createdAt` (no `deletedAt`, que `InventoryWaste` no usa
 * para excluir filas activas por si mismo: es un campo de borrado logico
 * generico, ver `schema.prisma`) es el "cuando ocurrio" real de una merma,
 * mismo campo que ya ordena `findMany` en `inventoryWaste/repository.ts`. */
function buildWasteReportWhere(filters?: WasteReportFilters): Prisma.InventoryWasteWhereInput {
  return {
    sucursalId: filters?.sucursalId,
    createdAt: buildDateRange(filters?.dateFrom, filters?.dateTo),
  };
}

/** Total de mermas y valor economico total del periodo filtrado. */
export function getWasteReportTotals(filters?: WasteReportFilters) {
  return prisma.inventoryWaste.aggregate({
    where: buildWasteReportWhere(filters),
    _count: { _all: true },
    _sum: { totalValue: true },
  });
}

/** Mermas del periodo filtrado, agrupadas por motivo (`reason`). */
export function getWasteReportByReason(filters?: WasteReportFilters) {
  return prisma.inventoryWaste.groupBy({
    by: ['reason'],
    where: buildWasteReportWhere(filters),
    _count: { _all: true },
    _sum: { quantity: true, totalValue: true },
  });
}

/**
 * Mermas del periodo filtrado, agrupadas por producto, junto con los datos
 * necesarios para que `reports.service.ts` calcule la comparacion merma
 * esperada vs. real: el `expectedWastePercent` vigente de cada producto
 * (`Product`, Bloque 14.4) y la cantidad comprada de ese mismo producto en
 * el mismo periodo/sucursal (`PurchaseItem` de compras `RECEIVED` —
 * lectura directa, mismo criterio ya usado por `getProfitReport`/
 * `getTopProducts` para leer otros modelos sin pasar por su modulo). Sin
 * `take`: mismo razonamiento que `getSalesByCategory` (paso intermedio,
 * acotado por el catalogo de productos con mermas en el periodo, no por
 * volumen transaccional).
 */
export async function getWasteReportByProduct(filters?: WasteReportFilters) {
  const where = buildWasteReportWhere(filters);

  const grouped = await prisma.inventoryWaste.groupBy({
    by: ['productId'],
    where,
    _count: { _all: true },
    _sum: { quantity: true, totalValue: true },
  });

  const productIds = grouped.map((group) => group.productId);

  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, sku: true, expectedWastePercent: true },
  });

  const purchased =
    productIds.length > 0
      ? await prisma.purchaseItem.groupBy({
          by: ['productId'],
          where: {
            productId: { in: productIds },
            purchase: {
              status: 'RECEIVED',
              sucursalId: filters?.sucursalId,
              purchaseDate: buildDateRange(filters?.dateFrom, filters?.dateTo),
            },
          },
          _sum: { quantity: true },
        })
      : [];

  return { grouped, products, purchased };
}

/**
 * Bloque LOTES-06 (Reportes del Modulo de Lotes). Lectura directa de
 * `Batch`/`InventoryMovement` — mismo criterio ya usado por
 * `getWasteReportByProduct` para `PurchaseItem`/`Product` ("lectura
 * directa... sin pasar por su modulo"): las consultas agregadas (`groupBy`)
 * son propias de este repositorio, no una responsabilidad que el modulo
 * de Lotes ya resuelva. La UNICA logica de negocio real que existe sobre
 * `Batch` (la transicion de estados, ver `batches/service.ts`) NO se
 * reimplementa aca — `reports.service.ts` la reutiliza explicitamente
 * (`expireOverdueBatchesService`, barrel `@/modules/batches`) antes de
 * llamar a estas funciones, para que el barrido "lazy" de vencidos corra
 * primero y estas consultas lean el estado ya actualizado.
 */
function buildBatchesReportWhere(filters?: BatchesReportFilters): Prisma.BatchWhereInput {
  return {
    sucursalId: filters?.sucursalId,
    productId: filters?.productId,
  };
}

/** Cantidad de lotes por estado + su saldo disponible sumado, del
 * catalogo filtrado. */
export function getBatchesReportByStatus(filters?: BatchesReportFilters) {
  return prisma.batch.groupBy({
    by: ['status'],
    where: buildBatchesReportWhere(filters),
    _count: { _all: true },
    _sum: { availableQuantity: true },
  });
}

/**
 * Lotes `ACTIVE` cuya `expiryDate` cae dentro de `[hoy, hoy + expiringWithinDays]`
 * — mismo criterio de alerta "foto del momento" que `getLowStock`, sin
 * paginacion (`orderBy: expiryDate asc`: el que vence antes aparece
 * primero, mismo orden FEFO que `batches/repository.ts::findActiveForConsumption`).
 */
export function getBatchesReportExpiringSoon(
  filters: BatchesReportFilters | undefined,
  expiringWithinDays: number,
) {
  const now = new Date();
  const cutoff = new Date(now.getTime() + expiringWithinDays * 24 * 60 * 60 * 1000);

  return prisma.batch.findMany({
    where: {
      ...buildBatchesReportWhere(filters),
      status: 'ACTIVE',
      expiryDate: { gte: now, lte: cutoff },
    },
    include: {
      product: { select: { id: true, name: true, sku: true } },
      sucursal: { select: { id: true, name: true } },
    },
    orderBy: { expiryDate: 'asc' },
  });
}

/**
 * Movimientos de inventario (`InventoryMovement`) que afectaron a un lote
 * puntual, en orden cronologico — la trazabilidad completa del lote
 * (`GET /reports/batches/:id`): alta (Compras/reingreso de Devoluciones),
 * consumo (Ventas/Mermas) y ajuste manual, todos etiquetados con `batchId`
 * desde el Bloque LOTES-01/02/03/05.
 */
export function getBatchMovements(batchId: string) {
  return prisma.inventoryMovement.findMany({
    where: { batchId },
    include: { user: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: 'asc' },
  });
}
