/**
 * modules/reports/reports.validation.ts
 * -----------------------------------------------------------------------------
 * Validaciones del modulo Reports.
 */

import { z } from 'zod';

const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

/**
 * Hallazgo de rendimiento #1 (auditoria 31/07/2026, cierre completo): limite
 * defensivo de rango de fechas para el Reporte de Utilidad.
 * `getProfitReportSummaryRows` (`reports.repository.ts`) no puede resolver
 * costo/utilidad/margen con un `aggregate()` de SQL (`CostEngine.getEffectiveCost()`
 * no es expresable en SQL) — trae TODAS las filas de `SaleItem` del rango a
 * memoria de Node para reducirlas ahi. Dos mecanismos, en el orden en que se
 * aplican (`.superRefine()` primero, `.transform()` despues):
 *
 *  1. `assertProfitReportDateRangeWithinLimit` — rechaza la peticion si el
 *     rango EFECTIVO (usando "ahora" como `dateTo` cuando el cliente no lo
 *     envia) supera el limite. Cubre tanto "ambas fechas explicitas y muy
 *     separadas" como "`dateFrom` antiguo sin `dateTo`" (este segundo caso
 *     se paso por alto en una primera version de este bloque: sin
 *     comparar contra "ahora", un `dateFrom` de hace varios años sin
 *     `dateTo` seguia produciendo un rango de miles de dias). Cuando falta
 *     `dateFrom`, no hay nada que rechazar: el paso 2 lo ancla siempre a
 *     partir de `dateTo`, nunca puede exceder el limite.
 *  2. `fillProfitReportDateRangeDefaults` — si falta `dateFrom` y/o
 *     `dateTo`, completa el que falte para que el rango efectivo NUNCA
 *     quede sin definir, incluida la peticion "sin ningun filtro" (antes
 *     quedaba completamente sin cota: todo el historial). Si falta
 *     `dateTo`, se ancla a "ahora"; si falta `dateFrom`, se ancla a
 *     `dateTo - 366 dias` (nunca a "ahora", para no ignorar el `dateTo`
 *     que si vino).
 *
 * Con esto, `ProfitReportFilters.dateFrom`/`dateTo` llegan SIEMPRE
 * definidos a `reports.service.ts`/`reports.repository.ts` para estos dos
 * endpoints — ningun cambio en `CostEngine` ni en las consultas de
 * `reports.repository.ts` (`buildProfitReportWhere` sigue igual, ahora
 * simplemente nunca recibe un rango abierto).
 *
 * Efecto de negocio a tener en cuenta: el Reporte de Utilidad, al pedirse
 * sin fechas (lo que hace hoy `ProfitReportPage.tsx` al cargar), pasa de
 * mostrar "todo el historial" a mostrar los ultimos 366 dias por defecto.
 */
const MAX_PROFIT_REPORT_RANGE_DAYS = 366;
const MAX_PROFIT_REPORT_RANGE_MS = MAX_PROFIT_REPORT_RANGE_DAYS * 24 * 60 * 60 * 1000;

function assertProfitReportDateRangeWithinLimit(
  data: { dateFrom?: Date; dateTo?: Date },
  ctx: z.RefinementCtx,
): void {
  if (!data.dateFrom) {
    // Sin `dateFrom`, el rango efectivo lo completa
    // `fillProfitReportDateRangeDefaults` anclado a `dateTo` (o "ahora") —
    // por construccion nunca supera el limite, nada que rechazar aca.
    return;
  }

  // Si falta `dateTo`, el rango efectivo llega hasta "ahora" — se valida
  // contra ESE limite, no solo cuando el cliente envia ambas fechas
  // (de lo contrario, un `dateFrom` muy antiguo sin `dateTo` seguiria
  // produciendo un rango de miles de dias).
  const effectiveDateTo = data.dateTo ?? new Date();

  if (effectiveDateTo.getTime() - data.dateFrom.getTime() > MAX_PROFIT_REPORT_RANGE_MS) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['dateTo'],
      message: `El rango del Reporte de Utilidad no puede superar ${MAX_PROFIT_REPORT_RANGE_DAYS} dias. Acota dateFrom/dateTo.`,
    });
  }
}

/**
 * Completa `dateFrom`/`dateTo` cuando el cliente omite alguna (o ambas) —
 * corre DESPUES de `assertProfitReportDateRangeWithinLimit`, asi que un
 * rango explicito invalido ya fue rechazado antes de llegar aca. El
 * resultado siempre trae ambas fechas definidas, acotadas a
 * `MAX_PROFIT_REPORT_RANGE_DAYS` entre si.
 */
function fillProfitReportDateRangeDefaults<T extends { dateFrom?: Date; dateTo?: Date }>(
  data: T,
): Omit<T, 'dateFrom' | 'dateTo'> & { dateFrom: Date; dateTo: Date } {
  const dateTo = data.dateTo ?? new Date();
  const dateFrom = data.dateFrom ?? new Date(dateTo.getTime() - MAX_PROFIT_REPORT_RANGE_MS);

  return { ...data, dateFrom, dateTo };
}

export const DashboardQuerySchema = z.object({
  sucursalId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

/** Metodos de pago soportados (enum `PaymentMethod` de `schema.prisma`). */
const PaymentMethodSchema = z.enum(['CASH', 'CARD', 'SINPE_MOVIL', 'TRANSFER', 'MIXED']);

export const SalesReportQuerySchema = PaginationSchema.extend({
  sucursalId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  paymentMethod: PaymentMethodSchema.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export const PurchasesReportQuerySchema = PaginationSchema.extend({
  sucursalId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

/** Bloque REPORTES-AGREGADOS: mismos filtros que `SalesReportQuerySchema`,
 * SIN paginacion — el agregado no tiene paginas. */
export const SalesReportSummaryQuerySchema = z.object({
  sucursalId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  paymentMethod: PaymentMethodSchema.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

/** Mismos filtros que `PurchasesReportQuerySchema`, sin paginacion. */
export const PurchasesReportSummaryQuerySchema = z.object({
  sucursalId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export const InventoryReportQuerySchema = PaginationSchema.extend({
  categoryId: z.string().uuid().optional(),
  sucursalId: z.string().uuid().optional(),
  active: z
    .preprocess((val) => (val === 'true' ? true : val === 'false' ? false : val), z.boolean())
    .optional(),
});

/** Bloque REPORTES-AGREGADOS: mismos filtros que `InventoryReportQuerySchema`,
 * sin paginacion. */
export const InventoryReportSummaryQuerySchema = z.object({
  categoryId: z.string().uuid().optional(),
  sucursalId: z.string().uuid().optional(),
  active: z
    .preprocess((val) => (val === 'true' ? true : val === 'false' ? false : val), z.boolean())
    .optional(),
});

/** Estado de sesion de caja (enum `CashSessionStatus` de `schema.prisma`). */
const CashSessionStatusSchema = z.enum(['OPEN', 'CLOSED']);

export const CashReportQuerySchema = PaginationSchema.extend({
  sucursalId: z.string().uuid().optional(),
  cashRegisterId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  status: CashSessionStatusSchema.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

/** Bloque REPORTES-AGREGADOS: mismos filtros que `CashReportQuerySchema`,
 * sin paginacion. */
export const CashReportSummaryQuerySchema = z.object({
  sucursalId: z.string().uuid().optional(),
  cashRegisterId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  status: CashSessionStatusSchema.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export const ProfitReportQuerySchema = PaginationSchema.extend({
  sucursalId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
})
  .superRefine(assertProfitReportDateRangeWithinLimit)
  .transform(fillProfitReportDateRangeDefaults);

/** Bloque REPORTES-AGREGADOS: mismos filtros que `ProfitReportQuerySchema`,
 * sin paginacion. */
export const ProfitReportSummaryQuerySchema = z
  .object({
    sucursalId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
    productId: z.string().uuid().optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
  })
  .superRefine(assertProfitReportDateRangeWithinLimit)
  .transform(fillProfitReportDateRangeDefaults);

/** Sin `page`/`skip`: es un ranking acotado por `limit`, no un listado
 * paginado tradicional. */
export const TopProductsQuerySchema = z.object({
  sucursalId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  limit: z.coerce.number().int().positive().max(50).default(10),
});

/** Sin fechas: es una foto del estado actual del inventario, no un
 * historico. `threshold`, si viene, debe ser un numero mayor o igual a 0
 * (un punto de corte negativo no tiene sentido de negocio). */
export const LowStockQuerySchema = z.object({
  sucursalId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  threshold: z.coerce.number().min(0).optional(),
});

/** Sin `categoryId` (el reporte agrupa *por* categoria) ni `page`/`limit`
 * (resumen agregado, no listado paginado). */
export const SalesByCategoryQuerySchema = z.object({
  sucursalId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

/** Sin `userId` (el reporte agrupa *por* cajero) ni `page`/`limit`
 * (resumen agregado, no listado paginado). */
export const SalesByCashierQuerySchema = z.object({
  sucursalId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

/** Sin `categoryId`/`userId` (el reporte agrupa *por* fecha) ni
 * `page`/`limit` (serie temporal acotada por rango de fechas, no listado
 * paginado). Si se omiten `dateFrom`/`dateTo`, `reports.service.ts` asume
 * los ultimos 7 dias calendario. */
export const SalesByDateQuerySchema = z.object({
  sucursalId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

/** Sin `productId`/`reason` (el reporte agrupa *por* ambos) ni
 * `page`/`limit` (resumen agregado, mismo criterio que
 * `SalesByCategoryQuerySchema`). */
export const WasteReportQuerySchema = z.object({
  sucursalId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

/** Bloque LOTES-06 (Reportes del Modulo de Lotes). Sin `status` (el
 * reporte agrupa *por* los 4 estados) ni `page`/`limit` (foto agregada del
 * estado actual, mismo criterio que `LowStockQuerySchema`). Sin fechas: no
 * es un reporte historico de un periodo, es el estado ACTUAL del catalogo
 * de lotes filtrado. */
export const BatchesReportQuerySchema = z.object({
  sucursalId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  expiringWithinDays: z.coerce.number().int().positive().optional(),
});