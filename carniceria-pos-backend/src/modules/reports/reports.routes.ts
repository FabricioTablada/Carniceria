/**
 * modules/reports/reports.routes.ts
 * -----------------------------------------------------------------------------
 * Rutas HTTP del módulo Reports.
 *
 * Fase 19 (Bloque 19.4): Rate Limiter como primer middleware de cada ruta
 * (antes de `authenticate`), mismo criterio que el resto de los modulos.
 */

import { Router } from 'express';
import { authenticate, authorizePermission, reportsRateLimiter } from '@/middlewares';

import {
  getBatchesReport,
  getBatchReportDetail,
  getCashReport,
  getCashReportDetail,
  getCashReportSummary,
  getDashboard,
  getInventoryReport,
  getInventoryReportSummary,
  getLowStock,
  getProfitReport,
  getProfitReportSummary,
  getPurchasesReport,
  getPurchasesReportSummary,
  getSalesByCashier,
  getSalesByCashierSummary,
  getSalesByCategory,
  getSalesByDate,
  getSalesReport,
  getSalesReportSummary,
  getTopProducts,
  getWasteReport,
} from './reports.controller';

export const reportsRoutes = Router();

reportsRoutes.get(
  '/dashboard',
  reportsRateLimiter,
  authenticate,
  authorizePermission('reports.view'),
  getDashboard,
);

reportsRoutes.get(
  '/sales',
  reportsRateLimiter,
  authenticate,
  authorizePermission('reports.view'),
  getSalesReport,
);

/** Bloque REPORTES-AGREGADOS: mismo permiso que `/sales` (es el mismo
 * reporte, solo agregado en vez de paginado). */
reportsRoutes.get(
  '/sales/summary',
  reportsRateLimiter,
  authenticate,
  authorizePermission('reports.view'),
  getSalesReportSummary,
);

reportsRoutes.get(
  '/purchases',
  reportsRateLimiter,
  authenticate,
  authorizePermission('reports.view'),
  getPurchasesReport,
);

reportsRoutes.get(
  '/purchases/summary',
  reportsRateLimiter,
  authenticate,
  authorizePermission('reports.view'),
  getPurchasesReportSummary,
);

reportsRoutes.get(
  '/inventory',
  reportsRateLimiter,
  authenticate,
  authorizePermission('reports.view'),
  getInventoryReport,
);

reportsRoutes.get(
  '/inventory/summary',
  reportsRateLimiter,
  authenticate,
  authorizePermission('reports.view'),
  getInventoryReportSummary,
);

reportsRoutes.get(
  '/profit',
  reportsRateLimiter,
  authenticate,
  authorizePermission('reports.view'),
  getProfitReport,
);

reportsRoutes.get(
  '/profit/summary',
  reportsRateLimiter,
  authenticate,
  authorizePermission('reports.view'),
  getProfitReportSummary,
);

reportsRoutes.get(
  '/cash',
  reportsRateLimiter,
  authenticate,
  authorizePermission('reports.view'),
  getCashReport,
);

/** Bloque REPORTES-AGREGADOS: DEBE registrarse antes de `/cash/:id` — si
 * fuera al reves, Express interpretaria "summary" como el `:id` de esa
 * ruta y nunca llegaria aca. */
reportsRoutes.get(
  '/cash/summary',
  reportsRateLimiter,
  authenticate,
  authorizePermission('reports.view'),
  getCashReportSummary,
);

reportsRoutes.get(
  '/cash/:id',
  reportsRateLimiter,
  authenticate,
  authorizePermission('reports.view'),
  getCashReportDetail,
);

reportsRoutes.get(
  '/top-products',
  reportsRateLimiter,
  authenticate,
  authorizePermission('reports.view'),
  getTopProducts,
);

reportsRoutes.get(
  '/low-stock',
  reportsRateLimiter,
  authenticate,
  authorizePermission('reports.view'),
  getLowStock,
);

reportsRoutes.get(
  '/sales-by-category',
  reportsRateLimiter,
  authenticate,
  authorizePermission('reports.view'),
  getSalesByCategory,
);

reportsRoutes.get(
  '/sales-by-cashier',
  reportsRateLimiter,
  authenticate,
  authorizePermission('reports.view'),
  getSalesByCashier,
);

/** Bloque REPORTES-AGREGADOS: mismo permiso que `/sales-by-cashier` (es el
 * mismo reporte, solo agregado). Sin ninguna ruta `/sales-by-cashier/:id`
 * en este modulo, no hay riesgo de colision de orden (a diferencia de
 * `/cash/summary` vs. `/cash/:id`). */
reportsRoutes.get(
  '/sales-by-cashier/summary',
  reportsRateLimiter,
  authenticate,
  authorizePermission('reports.view'),
  getSalesByCashierSummary,
);

reportsRoutes.get(
  '/sales-by-date',
  reportsRateLimiter,
  authenticate,
  authorizePermission('reports.view'),
  getSalesByDate,
);

reportsRoutes.get(
  '/waste',
  reportsRateLimiter,
  authenticate,
  authorizePermission('reports.view'),
  getWasteReport,
);

/** Bloque LOTES-06: registrada ANTES de `/batches/:id` — mismo motivo que
 * `/cash/summary` vs `/cash/:id` (si fuera al reves, Express interpretaria
 * cualquier segmento como el `:id` de esa ruta). En este caso no hay
 * colision real (`/batches` no tiene un segmento extra que confundir con
 * `:id`), pero se mantiene el mismo orden defensivo por consistencia. */
reportsRoutes.get(
  '/batches',
  reportsRateLimiter,
  authenticate,
  authorizePermission('reports.view'),
  getBatchesReport,
);

reportsRoutes.get(
  '/batches/:id',
  reportsRateLimiter,
  authenticate,
  authorizePermission('reports.view'),
  getBatchReportDetail,
);
