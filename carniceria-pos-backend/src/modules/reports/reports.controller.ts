/**
 * modules/reports/reports.controller.ts
 * -----------------------------------------------------------------------------
 * Controlador HTTP del modulo Reports.
 * Solo se encarga de: validar la peticion, invocar la logica de negocio de
 * `reports.service.ts` y responder con el formato estandar de la API. No
 * accede a Prisma ni contiene logica de negocio.
 */
import type { Request, Response } from 'express';
import { asyncHandler } from '@/shared/utils/asyncHandler';
import { success } from '@/shared/utils/httpResponse';
import { buildPaginationMeta, resolvePagination } from '@/shared/utils/pagination';
import { HttpStatus } from '@/shared/constants';
import * as reportsService from './reports.service';
import {
  BatchesReportQuerySchema,
  CashReportQuerySchema,
  CashReportSummaryQuerySchema,
  DashboardQuerySchema,
  InventoryReportQuerySchema,
  InventoryReportSummaryQuerySchema,
  LowStockQuerySchema,
  ProfitReportQuerySchema,
  ProfitReportSummaryQuerySchema,
  PurchasesReportQuerySchema,
  PurchasesReportSummaryQuerySchema,
  SalesByCashierQuerySchema,
  SalesByCategoryQuerySchema,
  SalesByDateQuerySchema,
  SalesReportQuerySchema,
  SalesReportSummaryQuerySchema,
  TopProductsQuerySchema,
  WasteReportQuerySchema,
} from './reports.validation';

/** GET /reports/dashboard */
export const getDashboard = asyncHandler(async (req: Request, res: Response) => {
  const query = DashboardQuerySchema.parse(req.query);

  const result = await reportsService.getDashboard(query);

  res.status(HttpStatus.OK).json(success(result));
});

/** GET /reports/sales */
export const getSalesReport = asyncHandler(async (req: Request, res: Response) => {
  const query = SalesReportQuerySchema.parse(req.query);
  const pagination = resolvePagination({ page: query.page, limit: query.limit });

  const result = await reportsService.getSalesReport({
    ...pagination,
    filters: {
      sucursalId: query.sucursalId,
      userId: query.userId,
      paymentMethod: query.paymentMethod,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    },
  });

  const meta = buildPaginationMeta(result.total, pagination);

  res.status(HttpStatus.OK).json(success(result.items, { ...meta }));
});

/** GET /reports/sales/summary — Bloque REPORTES-AGREGADOS: totales reales
 * sobre el conjunto COMPLETO que cumple los mismos filtros que
 * `GET /reports/sales`, sin paginacion (no aplica a un agregado). */
export const getSalesReportSummary = asyncHandler(async (req: Request, res: Response) => {
  const query = SalesReportSummaryQuerySchema.parse(req.query);

  const result = await reportsService.getSalesReportSummary({
    sucursalId: query.sucursalId,
    userId: query.userId,
    paymentMethod: query.paymentMethod,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  });

  res.status(HttpStatus.OK).json(success(result));
});

/** GET /reports/purchases */
export const getPurchasesReport = asyncHandler(async (req: Request, res: Response) => {
  const query = PurchasesReportQuerySchema.parse(req.query);
  const pagination = resolvePagination({ page: query.page, limit: query.limit });

  const result = await reportsService.getPurchasesReport({
    ...pagination,
    filters: {
      sucursalId: query.sucursalId,
      supplierId: query.supplierId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    },
  });

  const meta = buildPaginationMeta(result.total, pagination);

  res.status(HttpStatus.OK).json(success(result.items, { ...meta }));
});

/** GET /reports/purchases/summary — mismo criterio que
 * `getSalesReportSummary`. */
export const getPurchasesReportSummary = asyncHandler(async (req: Request, res: Response) => {
  const query = PurchasesReportSummaryQuerySchema.parse(req.query);

  const result = await reportsService.getPurchasesReportSummary({
    sucursalId: query.sucursalId,
    supplierId: query.supplierId,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  });

  res.status(HttpStatus.OK).json(success(result));
});

/** GET /reports/inventory */
export const getInventoryReport = asyncHandler(async (req: Request, res: Response) => {
  const query = InventoryReportQuerySchema.parse(req.query);
  const pagination = resolvePagination({ page: query.page, limit: query.limit });

  const result = await reportsService.getInventoryReport({
    ...pagination,
    filters: {
      categoryId: query.categoryId,
      sucursalId: query.sucursalId,
      active: query.active,
    },
  });

  const meta = buildPaginationMeta(result.total, pagination);

  res.status(HttpStatus.OK).json(success(result.items, { ...meta }));
});

/** GET /reports/inventory/summary — mismo criterio que
 * `getSalesReportSummary`/`getPurchasesReportSummary`. */
export const getInventoryReportSummary = asyncHandler(async (req: Request, res: Response) => {
  const query = InventoryReportSummaryQuerySchema.parse(req.query);

  const result = await reportsService.getInventoryReportSummary({
    categoryId: query.categoryId,
    sucursalId: query.sucursalId,
    active: query.active,
  });

  res.status(HttpStatus.OK).json(success(result));
});

/** GET /reports/profit */
export const getProfitReport = asyncHandler(async (req: Request, res: Response) => {
  const query = ProfitReportQuerySchema.parse(req.query);
  const pagination = resolvePagination({ page: query.page, limit: query.limit });

  const result = await reportsService.getProfitReport({
    ...pagination,
    filters: {
      sucursalId: query.sucursalId,
      categoryId: query.categoryId,
      productId: query.productId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    },
  });

  const meta = buildPaginationMeta(result.total, pagination);

  res.status(HttpStatus.OK).json(success(result.items, { ...meta }));
});

/** GET /reports/profit/summary — mismo criterio que
 * `getSalesReportSummary`/`getPurchasesReportSummary`. */
export const getProfitReportSummary = asyncHandler(async (req: Request, res: Response) => {
  const query = ProfitReportSummaryQuerySchema.parse(req.query);

  const result = await reportsService.getProfitReportSummary({
    sucursalId: query.sucursalId,
    categoryId: query.categoryId,
    productId: query.productId,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  });

  res.status(HttpStatus.OK).json(success(result));
});

/** GET /reports/cash */
export const getCashReport = asyncHandler(async (req: Request, res: Response) => {
  const query = CashReportQuerySchema.parse(req.query);
  const pagination = resolvePagination({ page: query.page, limit: query.limit });

  const result = await reportsService.getCashReport({
    ...pagination,
    filters: {
      sucursalId: query.sucursalId,
      cashRegisterId: query.cashRegisterId,
      userId: query.userId,
      status: query.status,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    },
  });

  const meta = buildPaginationMeta(result.total, pagination);

  res.status(HttpStatus.OK).json(success(result.items, { ...meta }));
});

/** GET /reports/cash/summary — mismo criterio que
 * `getSalesReportSummary`/`getPurchasesReportSummary`. Registrada ANTES
 * de `/cash/:id` en `reports.routes.ts`: si fuera al reves, Express
 * interpretaria "summary" como el `:id` de esa ruta. */
export const getCashReportSummary = asyncHandler(async (req: Request, res: Response) => {
  const query = CashReportSummaryQuerySchema.parse(req.query);

  const result = await reportsService.getCashReportSummary({
    sucursalId: query.sucursalId,
    cashRegisterId: query.cashRegisterId,
    userId: query.userId,
    status: query.status,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  });

  res.status(HttpStatus.OK).json(success(result));
});

/** GET /reports/cash/:id
 * Detalle de una sesion de caja puntual (Bloque 2, "Ventas = sesion de caja
 * activa"), para la pantalla "Ver reporte" del historial. Sin `meta` de
 * paginacion: es un unico registro, no un listado. */
export const getCashReportDetail = asyncHandler(async (req: Request, res: Response) => {
  const result = await reportsService.getCashReportDetail(req.params.id);

  res.status(HttpStatus.OK).json(success(result));
});

/** GET /reports/top-products
 * Sin `meta` de paginacion: es un ranking acotado por `limit`, no un
 * listado paginado (mismo criterio que `getDashboard`, que tampoco
 * pagina). */
export const getTopProducts = asyncHandler(async (req: Request, res: Response) => {
  const query = TopProductsQuerySchema.parse(req.query);

  const result = await reportsService.getTopProducts({
    limit: query.limit,
    filters: {
      sucursalId: query.sucursalId,
      categoryId: query.categoryId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    },
  });

  res.status(HttpStatus.OK).json(success(result));
});

/** GET /reports/low-stock
 * Sin `meta` de paginacion ni `page`/`skip`: es una foto del estado
 * actual del inventario (alertas), no un listado paginado tradicional. */
export const getLowStock = asyncHandler(async (req: Request, res: Response) => {
  const query = LowStockQuerySchema.parse(req.query);

  const result = await reportsService.getLowStock({
    sucursalId: query.sucursalId,
    categoryId: query.categoryId,
    threshold: query.threshold,
  });

  res.status(HttpStatus.OK).json(success(result));
});

/** GET /reports/sales-by-category
 * Sin `meta` de paginacion: es un resumen agregado por categoria, no un
 * listado paginado (mismo criterio que `getTopProducts`/`getLowStock`). */
export const getSalesByCategory = asyncHandler(async (req: Request, res: Response) => {
  const query = SalesByCategoryQuerySchema.parse(req.query);

  const result = await reportsService.getSalesByCategory({
    sucursalId: query.sucursalId,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  });

  res.status(HttpStatus.OK).json(success(result));
});

/** GET /reports/sales-by-cashier
 * Sin `meta` de paginacion: es un resumen agregado por cajero, no un
 * listado paginado (mismo criterio que el resto de reportes agregados). */
export const getSalesByCashier = asyncHandler(async (req: Request, res: Response) => {
  const query = SalesByCashierQuerySchema.parse(req.query);

  const result = await reportsService.getSalesByCashier({
    sucursalId: query.sucursalId,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  });

  res.status(HttpStatus.OK).json(success(result));
});

/** GET /reports/sales-by-cashier/summary — Bloque REPORTES-AGREGADOS:
 * totales reales sobre el conjunto COMPLETO que cumple los mismos filtros
 * que `GET /reports/sales-by-cashier`. Reutiliza `SalesByCashierQuerySchema`
 * tal cual (no una copia "Summary" separada): ese schema ya no tenia
 * `page`/`limit` desde antes (este reporte nunca fue paginado), asi que sus
 * campos ya son identicos a los de un agregado. */
export const getSalesByCashierSummary = asyncHandler(async (req: Request, res: Response) => {
  const query = SalesByCashierQuerySchema.parse(req.query);

  const result = await reportsService.getSalesByCashierSummary({
    sucursalId: query.sucursalId,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  });

  res.status(HttpStatus.OK).json(success(result));
});

/** GET /reports/sales-by-date
 * Sin `meta` de paginacion: es una serie temporal acotada por rango de
 * fechas (7 dias por defecto), no un listado paginado (mismo criterio que
 * `getSalesByCategory`/`getSalesByCashier`). */
export const getSalesByDate = asyncHandler(async (req: Request, res: Response) => {
  const query = SalesByDateQuerySchema.parse(req.query);

  const result = await reportsService.getSalesByDate({
    sucursalId: query.sucursalId,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  });

  res.status(HttpStatus.OK).json(success(result));
});

/** GET /reports/waste (Bloque 14.7)
 * Sin `meta` de paginacion: resumen agregado del periodo filtrado (mismo
 * criterio que `getSalesByCategory`/`getTopProducts`), no un listado
 * paginado. */
export const getWasteReport = asyncHandler(async (req: Request, res: Response) => {
  const query = WasteReportQuerySchema.parse(req.query);

  const result = await reportsService.getWasteReport({
    sucursalId: query.sucursalId,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  });

  res.status(HttpStatus.OK).json(success(result));
});

/** GET /reports/batches (Bloque LOTES-06)
 * Sin `meta` de paginacion: foto agregada del estado actual del catalogo
 * de lotes filtrado (mismo criterio que `getLowStock`/`getWasteReport`),
 * no un listado paginado. */
export const getBatchesReport = asyncHandler(async (req: Request, res: Response) => {
  const query = BatchesReportQuerySchema.parse(req.query);

  const result = await reportsService.getBatchesReport({
    sucursalId: query.sucursalId,
    productId: query.productId,
    expiringWithinDays: query.expiringWithinDays,
  });

  res.status(HttpStatus.OK).json(success(result));
});

/** GET /reports/batches/:id (Bloque LOTES-06)
 * Trazabilidad completa de un lote puntual: su resumen (reutilizado de
 * `GET /inventory/batches/:id`) mas todos sus movimientos de inventario. */
export const getBatchReportDetail = asyncHandler(async (req: Request, res: Response) => {
  const result = await reportsService.getBatchReportDetail(req.params.id);

  res.status(HttpStatus.OK).json(success(result));
});
