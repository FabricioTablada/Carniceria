/**
 * modules/reports/index.ts
 * -----------------------------------------------------------------------------
 * Punto de entrada del módulo Reports.
 */

export { reportsRoutes } from './reports.routes';

export { getLowStock } from './reports.service';

export type { LowStockItem } from './reports.types';
